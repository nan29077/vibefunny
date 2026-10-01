// ===========================================================================
// 캠페인 참여/검수/정산 공용 워크플로우 (광고주 ↔ 관리자 ↔ 크리에이터)
// ---------------------------------------------------------------------------
// API 라우트와 서버 액션이 같은 규칙을 쓰도록 비즈니스 로직을 한 곳에 모았다.
// 모든 함수는 db 스냅샷을 직접 수정하므로 반드시 tx() 내부에서 호출한다.
// ===========================================================================

import { genId } from "./crypto";
import { campaignEligibility, participationCapacity } from "./campaign-eligibility";
import {
  allocateVideoForParticipation,
  hasVideoPool,
  isDistributionUnlocked,
  markVideoDistributed,
  releaseVideo,
  syncCampaignVideos,
} from "./distribution";
import { statusLabel } from "./labels";
import { computeCampaignCost, creatorDeployPayout, creatorVideoPayout } from "./queries";
import { addPointTx, addPointTxOnce, addWalletTxOnce, audit, notifyUser } from "./services";
import type {
  AdCampaign,
  CampaignParticipation,
  Database,
  NotificationCategory,
  Profile,
} from "./schema";

const now = () => new Date().toISOString();

export type ParticipationType = "deploy" | "video_production";

export type WorkflowResult<T = unknown> =
  | { ok: true; status: 200; body: T; message: string }
  | { ok: false; status: number; error: string };

function fail(status: number, error: string): WorkflowResult<never> {
  return { ok: false, status, error };
}

// --- 캠페인 상태 --------------------------------------------------------------

/** 크리에이터가 참여/제출할 수 있는 캠페인 상태 ("submitted" 는 구버전 흐름 호환) */
export const ACTIVE_CAMPAIGN_STATUSES = ["recruiting", "published", "in_progress", "submitted"] as const;

export function isCampaignActive(campaign: AdCampaign): boolean {
  return (ACTIVE_CAMPAIGN_STATUSES as readonly string[]).includes(campaign.status);
}

/** 크리에이터에게 공개되는 캠페인인가 (모집·진행·완료). 검토중/반려/취소는 비공개 */
export function isCampaignPublicToCreators(campaign: AdCampaign): boolean {
  return isCampaignActive(campaign) || campaign.status === "completed";
}

/** 크리에이터가 이 캠페인을 열람할 수 있는가 (공개 캠페인 또는 본인 참여 이력 존재) */
export function canCreatorViewCampaign(db: Database, creatorId: string, campaign: AdCampaign): boolean {
  if (isCampaignPublicToCreators(campaign)) return true;
  return (
    (db.campaign_participations ?? []).some((p) => p.campaign_id === campaign.id && p.creator_id === creatorId) ||
    db.campaign_applications.some((a) => a.campaign_id === campaign.id && a.creator_id === creatorId) ||
    db.campaign_deliveries.some((d) => d.campaign_id === campaign.id && d.creator_id === creatorId)
  );
}

/**
 * 마감일(YYYY-MM-DD)이 지났는가. 한국 시간 기준으로 마감일 "당일 23:59:59"까지 허용한다.
 * (기존: new Date("YYYY-MM-DD") = UTC 자정 → 한국 시간 오전 9시에 조기 마감되던 문제)
 */
export function isPastDeadline(endDate: string | null | undefined, at: number = Date.now()): boolean {
  if (!endDate) return false;
  const value = /^\d{4}-\d{2}-\d{2}$/.test(endDate) ? `${endDate}T23:59:59.999+09:00` : endDate;
  const t = Date.parse(value);
  if (Number.isNaN(t)) return false;
  return t < at;
}

/** 캠페인 유형이 해당 참여 유형을 모집하는가 */
export function campaignAcceptsType(campaign: AdCampaign, type: ParticipationType): boolean {
  if (type === "deploy") {
    return campaign.campaign_type !== "create_only" && (campaign.distribution_count ?? 0) > 0;
  }
  // 영상(동화) 제작 참여: 제작+배포 / 단순 제작 / 동화 제작 의뢰
  if (!["create_and_distribute", "create_only", "story_creation"].includes(campaign.campaign_type)) return false;
  return (campaign.video_production_count ?? 0) > 0;
}

export function participationTypeOf(p: CampaignParticipation): ParticipationType {
  return p.participation_type ?? "deploy";
}

/** 구버전(campaign_deliveries) 흐름으로 이미 제출·정산된 건이 있는가 — 이중 지급 방지 */
export function hasLegacyDelivery(db: Database, campaignId: string, creatorId: string): boolean {
  return db.campaign_deliveries.some(
    (d) => d.campaign_id === campaignId && d.creator_id === creatorId && d.status !== "rejected"
  );
}

// --- 알림 헬퍼 ----------------------------------------------------------------

export function adminIds(db: Database): string[] {
  return db.profiles.filter((p) => p.role === "admin" && p.status === "active").map((p) => p.id);
}

export function notifyAdmins(db: Database, params: { title: string; message: string; link?: string }, exceptId?: string): void {
  for (const id of adminIds(db)) {
    if (id === exceptId) continue;
    notifyUser(db, { recipientId: id, ...params });
  }
}

/** 수신자 역할에 맞는 캠페인 링크 */
export function campaignLinkFor(db: Database, recipientId: string, campaignId: string): string {
  const role = db.profiles.find((p) => p.id === recipientId)?.role;
  if (role === "admin") return "/admin/campaigns";
  if (role === "advertiser") return `/advertiser/campaigns/${campaignId}`;
  return "/creator/campaigns";
}

/** 알림 수신자가 실제 존재하는 프로필인지 (vibeporter_system 같은 가상 계정이면 관리자에게 전달) */
function notifyCampaignOwner(
  db: Database,
  campaign: AdCampaign,
  params: { title: string; message: string; category?: NotificationCategory }
): void {
  const owner = db.profiles.find((p) => p.id === campaign.advertiser_id);
  if (owner) {
    notifyUser(db, { recipientId: owner.id, ...params, link: campaignLinkFor(db, owner.id, campaign.id) });
  } else {
    notifyAdmins(db, { title: params.title, message: params.message, link: "/admin/campaigns" });
  }
}

// --- 파일 소유권 ----------------------------------------------------------------

const PRIVATE_FILE_URL = /^\/api\/files\/([0-9a-f-]{36})$/;

/** /api/files/<id> 형식이면 파일 id 반환 */
export function privateFileIdOf(url: string | null | undefined): string | null {
  const m = (url ?? "").match(PRIVATE_FILE_URL);
  return m ? m[1] : null;
}

/**
 * 제출하려는 주소가 비공개 파일(/api/files/<id>)이면, 그 파일이 제출자 본인의 것인지 확인한다.
 * 외부 http(s) 주소는 true. 남의 파일·존재하지 않는 파일은 false.
 * (제출물 주소에 연결되면 상대방에게 열람 권한이 생기므로 반드시 확인해야 한다)
 */
export function isOwnPrivateFileOrExternal(db: Database, url: string, userId: string): boolean {
  if (!/^\/api\/files\//.test(url)) return true;
  const fileId = privateFileIdOf(url);
  if (!fileId) return false;
  const file = (db.private_files ?? []).find((item) => item.id === fileId);
  return !!file && file.owner_id === userId;
}

// --- 참여 신청 ------------------------------------------------------------------

export function joinParticipation(
  db: Database,
  user: Profile,
  campaignId: string,
  type: ParticipationType
): WorkflowResult<CampaignParticipation & { assigned_video?: unknown }> {
  if (type !== "deploy" && type !== "video_production") return fail(400, "참여 유형이 올바르지 않습니다.");
  const campaign = db.ad_campaigns.find((c) => c.id === campaignId);
  if (!campaign) return fail(404, "캠페인을 찾을 수 없습니다.");
  if (!isCampaignActive(campaign)) return fail(409, "현재 참여할 수 없는 캠페인입니다.");
  if (isPastDeadline(campaign.end_date)) return fail(409, "참여 모집 기한이 종료되었습니다.");
  if (!campaignAcceptsType(campaign, type)) {
    return fail(400, `이 캠페인은 ${type === "deploy" ? "배포" : "영상 제작"} 참여를 모집하지 않습니다.`);
  }
  if (type === "deploy" && hasLegacyDelivery(db, campaign.id, user.id)) {
    return fail(409, "이 캠페인은 이미 이전 방식으로 납품(증빙)을 제출하셨습니다.");
  }

  // 구독료 제도가 켜져 있으면 활성 구독자만 참여 가능 (영상 등록과 동일한 규칙, 대시보드 안내 문구와 일치)
  const sub = db.settings.fees.creator;
  if (sub?.subscription_enabled && sub.subscription_amount > 0) {
    const active = user.subscription_active_until && new Date(user.subscription_active_until) > new Date();
    if (!active) return fail(403, "구독이 활성화된 회원만 캠페인에 참여할 수 있습니다. 대시보드에서 구독을 먼저 진행하세요.");
  }

  const eligibility = campaignEligibility(db, user, campaign);
  if (!eligibility.eligible) return fail(403, eligibility.reasons.join(" "));

  if (!db.campaign_participations) db.campaign_participations = [];
  const existing = db.campaign_participations.find(
    (p) => p.campaign_id === campaign.id && p.creator_id === user.id && participationTypeOf(p) === type
  );
  // 본인이 취소한 참여는 다시 신청 가능 (선발 반려·완료 등은 재신청 불가)
  if (existing && existing.status !== "cancelled") return fail(400, "이미 해당 유형으로 참여 중입니다.");

  const capacity = participationCapacity(db, campaign, type);
  if (capacity.full) return fail(409, `${type === "deploy" ? "배포" : "영상 제작"} 모집이 마감되었습니다.`);

  const isDeployPool = type === "deploy" && hasVideoPool(campaign);
  if (isDeployPool && !isDistributionUnlocked(db, campaign)) {
    return fail(400, "아직 영상 제작·승인이 완료되지 않아 배포를 신청할 수 없습니다.");
  }

  const participation: CampaignParticipation = existing ?? {
    id: genId(),
    campaign_id: campaign.id,
    creator_id: user.id,
    status: "applied",
    participation_type: type,
    applied_at: now(),
    updated_at: now(),
  };

  let assignedVideo: unknown;
  if (isDeployPool) {
    const alloc = allocateVideoForParticipation(db, campaign, user.id, participation.id);
    if (!alloc.ok) {
      return fail(
        400,
        alloc.reason === "exhausted"
          ? "배포 가능한 영상이 없습니다."
          : alloc.reason === "locked"
          ? "아직 영상 제작·승인이 완료되지 않아 배포를 신청할 수 없습니다."
          : "배포 영상 분배에 실패했습니다."
      );
    }
    assignedVideo = alloc.video;
  }

  // 풀 기반 배포는 신청과 동시에 영상이 분배되므로 바로 accepted
  participation.status = isDeployPool ? "accepted" : "applied";
  participation.applied_at = now();
  participation.updated_at = now();
  participation.rejection_reason = undefined;
  participation.dispute_previous_status = undefined;
  if (existing) {
    participation.video_url = undefined;
    participation.video_note = undefined;
    participation.deploy_link = undefined;
    participation.deploy_note = undefined;
  } else {
    db.campaign_participations.push(participation);
  }

  notifyCampaignOwner(db, campaign, {
    title: isDeployPool ? "새 배포 참여자가 배정되었습니다" : "새 캠페인 참여 신청",
    message: `${campaign.title} · ${type === "deploy" ? "배포" : "영상 제작"}`,
    category: "participation",
  });
  audit(db, { actorId: user.id, action: "join_participation", targetTable: "campaign_participations", targetId: participation.id });
  return {
    ok: true,
    status: 200,
    body: assignedVideo ? { ...participation, assigned_video: assignedVideo } : participation,
    message: isDeployPool ? "배포 참여가 확정되었습니다. 배정된 영상을 확인하세요." : "참여 신청이 완료되었습니다.",
  };
}

// --- 작업물 제출 ------------------------------------------------------------------

export function submitParticipationWork(
  db: Database,
  user: Profile,
  participation: CampaignParticipation,
  input: { url: string; note?: string }
): WorkflowResult<CampaignParticipation> {
  if (participation.creator_id !== user.id) return fail(403, "본인 참여 건만 제출할 수 있습니다.");
  const campaign = db.ad_campaigns.find((c) => c.id === participation.campaign_id);
  if (!campaign) return fail(404, "캠페인을 찾을 수 없습니다.");
  if (!isCampaignActive(campaign)) return fail(409, "진행 중인 캠페인만 제출할 수 있습니다.");
  if (isPastDeadline(campaign.end_date)) return fail(409, "제출 기한이 종료되었습니다.");

  const type = participationTypeOf(participation);
  const allowed = type === "video_production" ? ["accepted", "video_rejected"] : ["accepted", "deploy_rejected"];
  if (!allowed.includes(participation.status)) return fail(409, "승인된 참여 건 또는 반려된 작업만 제출할 수 있습니다.");

  const url = input.url.trim();
  const fileId = privateFileIdOf(url);
  if (fileId) {
    // 비공개 업로드 파일은 영상 제출에만, 그리고 본인이 올린 파일만 허용
    if (type !== "video_production") return fail(400, "배포 링크는 SNS 게시물 주소(http/https)여야 합니다.");
    const file = (db.private_files ?? []).find((f) => f.id === fileId);
    if (!file || file.owner_id !== user.id) return fail(403, "본인이 업로드한 파일만 제출할 수 있습니다.");
  } else {
    let valid = false;
    try {
      const parsed = new URL(url);
      valid = parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      valid = false;
    }
    if (!valid) return fail(400, "유효한 http(s) 작업물 URL이 필요합니다.");
  }

  const note = input.note?.trim() || undefined;
  participation.rejection_reason = undefined;
  participation.updated_at = now();
  if (type === "video_production") {
    participation.status = "video_submitted";
    participation.video_url = url;
    participation.video_note = note;
  } else {
    participation.status = "deploy_submitted";
    participation.deploy_link = url;
    participation.deploy_note = note;
  }
  notifyCampaignOwner(db, campaign, {
    title: "캠페인 작업물이 제출되었습니다",
    message: `${campaign.title} · ${type === "deploy" ? "배포" : "영상 제작"}`,
    category: "submission",
  });
  audit(db, { actorId: user.id, action: "submit_work", targetTable: "campaign_participations", targetId: participation.id });
  return { ok: true, status: 200, body: participation, message: "제출이 완료되었습니다. 검토를 기다려 주세요." };
}

// --- 선발/검수 ---------------------------------------------------------------------

function payParticipationReward(db: Database, campaign: AdCampaign, p: CampaignParticipation, memoPrefix: string): void {
  const isVideo = participationTypeOf(p) === "video_production";
  addWalletTxOnce(db, {
    userId: p.creator_id,
    type: "campaign_reward",
    amount: isVideo ? creatorVideoPayout(db, campaign.video_duration_tier) : creatorDeployPayout(db, campaign.platforms),
    status: "available",
    relatedTable: "campaign_participations",
    relatedId: p.id,
    memo: `${memoPrefix}${isVideo ? "영상제작" : "배포"} 완료 수익: ${campaign.title}`,
  });
}

/**
 * 광고주(본인 캠페인)·관리자의 참여 선발/작업 검수.
 * - applied → accepted | application_rejected
 * - video_submitted/video_approved → completed(지급) | video_rejected
 * - deploy_submitted → completed(지급) | deploy_rejected
 */
export function reviewParticipation(
  db: Database,
  actor: Profile,
  participation: CampaignParticipation,
  decision: "approve" | "reject",
  reason?: string
): WorkflowResult<CampaignParticipation> {
  if (decision !== "approve" && decision !== "reject") return fail(400, "decision은 approve 또는 reject여야 합니다.");
  const campaign = db.ad_campaigns.find((c) => c.id === participation.campaign_id);
  if (!campaign) return fail(404, "캠페인을 찾을 수 없습니다.");
  if (actor.role !== "admin" && !(actor.role === "advertiser" && campaign.advertiser_id === actor.id)) {
    return fail(403, "본인 캠페인만 승인할 수 있습니다.");
  }
  const type = participationTypeOf(participation);
  const trimmedReason = reason?.trim() || "";

  if (participation.status === "applied") {
    if (decision === "approve") {
      if (!isCampaignActive(campaign)) return fail(409, "진행 중인 캠페인이 아닙니다.");
      const cap = participationCapacity(db, campaign, type);
      // 자신(applied)도 active 에 포함되므로, 선발 확정(accepted/진행) 인원 기준으로 다시 계산
      const committed = (db.campaign_participations ?? []).filter(
        (x) =>
          x.campaign_id === campaign.id &&
          participationTypeOf(x) === type &&
          x.id !== participation.id &&
          !["applied", "cancelled", "application_rejected", "rejected"].includes(x.status)
      ).length;
      if (cap.limit > 0 && committed >= cap.limit) return fail(409, "모집 인원이 이미 모두 선발되었습니다.");
      participation.status = "accepted";
    } else {
      participation.status = "application_rejected";
      participation.rejection_reason = trimmedReason || "선발되지 않았습니다.";
      releaseVideo(db, participation.id);
    }
  } else if (participation.status === "video_submitted" || participation.status === "video_approved") {
    if (decision === "approve") {
      participation.status = "completed";
      participation.rejection_reason = undefined;
      syncCampaignVideos(db, campaign);
      payParticipationReward(db, campaign, participation, "");
    } else {
      participation.status = "video_rejected";
      participation.rejection_reason = trimmedReason || "반려 처리되었습니다.";
    }
  } else if (participation.status === "deploy_submitted") {
    if (decision === "approve") {
      if (hasLegacyDelivery(db, campaign.id, participation.creator_id)) {
        return fail(409, "이 크리에이터는 이전 방식 납품으로 이미 정산 대상입니다. 관리자에게 문의하세요.");
      }
      participation.status = "completed";
      participation.rejection_reason = undefined;
      markVideoDistributed(db, participation.id);
      payParticipationReward(db, campaign, participation, "");
    } else {
      participation.status = "deploy_rejected";
      participation.rejection_reason = trimmedReason || "배포가 반려되었습니다.";
    }
  } else {
    return fail(409, `현재 상태(${statusLabel(participation.status)})에서는 처리할 수 없습니다.`);
  }

  participation.updated_at = now();
  const kind = type === "deploy" ? "배포" : "영상 제작";
  const approved = decision === "approve";
  notifyUser(db, {
    recipientId: participation.creator_id,
    title: approved ? "캠페인 참여/작업이 승인되었습니다" : "캠페인 참여/작업이 반려되었습니다",
    message: `${campaign.title} · ${kind} · ${statusLabel(participation.status)}${participation.rejection_reason ? ` · ${participation.rejection_reason}` : ""}`,
    link: "/creator/campaigns",
  });
  if (actor.role === "admin") {
    notifyCampaignOwner(db, campaign, {
      title: approved ? "관리자가 캠페인 작업을 승인했습니다" : "관리자가 캠페인 작업을 반려했습니다",
      message: `${campaign.title} · ${kind} · ${statusLabel(participation.status)}`,
      category: "submission",
    });
  }
  audit(db, { actorId: actor.id, action: `participation_${decision}_${participation.status}`, targetTable: "campaign_participations", targetId: participation.id });

  if (participation.status === "completed") maybeAutoCompleteCampaign(db, campaign, actor.id);
  return { ok: true, status: 200, body: participation, message: approved ? "승인되었습니다." : "반려되었습니다." };
}

// --- 분쟁 신청 / 처리 ----------------------------------------------------------------

const DISPUTABLE_STATUSES = ["video_submitted", "deploy_submitted", "video_rejected", "deploy_rejected", "completed"];

export function openDispute(
  db: Database,
  user: Profile,
  participation: CampaignParticipation,
  reason: string
): WorkflowResult<CampaignParticipation> {
  const text = reason.trim();
  if (text.length < 10 || text.length > 2000) return fail(400, "분쟁 사유는 10~2000자로 입력하세요.");
  const campaign = db.ad_campaigns.find((c) => c.id === participation.campaign_id);
  if (!campaign) return fail(404, "캠페인을 찾을 수 없습니다.");
  const allowed =
    user.role === "admin" ||
    (user.role === "creator" && participation.creator_id === user.id) ||
    (user.role === "advertiser" && campaign.advertiser_id === user.id);
  if (!allowed) return fail(403, "분쟁 신청 권한이 없습니다.");
  if (!DISPUTABLE_STATUSES.includes(participation.status)) return fail(409, "현재 상태에서는 분쟁을 신청할 수 없습니다.");

  participation.dispute_previous_status = participation.status;
  participation.status = "disputed";
  participation.rejection_reason = `분쟁 신청: ${text}`;
  participation.updated_at = now();
  const recipients = new Set<string>([participation.creator_id, campaign.advertiser_id, ...adminIds(db)]);
  recipients.delete(user.id);
  for (const recipientId of recipients) {
    if (!db.profiles.some((p) => p.id === recipientId)) continue;
    notifyUser(db, {
      recipientId,
      title: "캠페인 분쟁이 접수되었습니다",
      message: `${campaign.title} · ${text.slice(0, 150)}`,
      link: campaignLinkFor(db, recipientId, campaign.id),
    });
  }
  audit(db, { actorId: user.id, action: "open_participation_dispute", targetTable: "campaign_participations", targetId: participation.id, after: { reason: text } });
  return { ok: true, status: 200, body: participation, message: "분쟁이 접수되었습니다. 관리자가 확인 후 처리합니다." };
}

// --- 분쟁 처리 -----------------------------------------------------------------------

export function resolveDispute(
  db: Database,
  admin: Profile,
  participation: CampaignParticipation,
  decision: "restore" | "complete" | "cancel",
  memo?: string
): WorkflowResult<CampaignParticipation> {
  if (admin.role !== "admin") return fail(403, "관리자 권한이 필요합니다.");
  if (!["restore", "complete", "cancel"].includes(decision)) return fail(400, "처리 결정을 확인하세요.");
  if (participation.status !== "disputed") return fail(404, "처리할 분쟁을 찾을 수 없습니다.");
  const campaign = db.ad_campaigns.find((c) => c.id === participation.campaign_id);
  if (!campaign) return fail(404, "캠페인을 찾을 수 없습니다.");

  if (decision === "restore") {
    participation.status = participation.dispute_previous_status ?? "accepted";
  } else if (decision === "cancel") {
    const paidReward = db.wallet_transactions.some(
      (t) => t.related_table === "campaign_participations" && t.related_id === participation.id && t.status !== "cancelled"
    );
    if (paidReward) return fail(409, "이미 지급된 수익이 있어 취소 전 관리자 정산 조정이 필요합니다.");
    participation.status = "cancelled";
    releaseVideo(db, participation.id); // 배정 영상을 풀에 반납
  } else {
    if (participationTypeOf(participation) === "deploy" && hasLegacyDelivery(db, campaign.id, participation.creator_id)) {
      return fail(409, "이 크리에이터는 이전 방식 납품으로 이미 정산 대상입니다. 이중 지급을 막기 위해 완료 처리할 수 없습니다.");
    }
    participation.status = "completed";
    if (participationTypeOf(participation) === "video_production") syncCampaignVideos(db, campaign);
    else markVideoDistributed(db, participation.id);
    payParticipationReward(db, campaign, participation, "분쟁 조정 ");
  }
  participation.rejection_reason = memo?.trim() || undefined;
  participation.dispute_previous_status = undefined;
  participation.updated_at = now();

  const label = decision === "restore" ? "이전 상태로 복원" : decision === "complete" ? "완료·정산" : "참여 취소";
  notifyUser(db, {
    recipientId: participation.creator_id,
    title: "캠페인 분쟁 처리가 완료되었습니다",
    message: `${campaign.title} · ${label}`,
    link: "/creator/campaigns",
  });
  notifyCampaignOwner(db, campaign, { title: "캠페인 분쟁 처리가 완료되었습니다", message: `${campaign.title} · ${label}` });
  audit(db, { actorId: admin.id, action: `resolve_participation_dispute_${decision}`, targetTable: "campaign_participations", targetId: participation.id, after: { memo } });
  if (participation.status === "completed") maybeAutoCompleteCampaign(db, campaign, admin.id);
  return { ok: true, status: 200, body: participation, message: "분쟁 처리가 완료되었습니다." };
}

// --- 실행사(대행사 상위) 수수료 -------------------------------------------------------

/** 대행사의 상위 실행사 id (프로필 연결 우선, 없으면 추천 관계) */
export function parentAdvertiserOf(db: Database, agencyId: string): string | null {
  const agency = db.profiles.find((p) => p.id === agencyId);
  if (!agency || agency.role !== "advertiser") return null;
  if (agency.parent_advertiser_id) return agency.parent_advertiser_id;
  const relation = db.referral_relations.find(
    (r) => r.referee_id === agencyId && r.referral_type === "advertiser_hierarchy"
  );
  return relation?.referrer_id ?? null;
}

/**
 * 실행사 수수료를 실행사 "포인트 지갑"에 적립(+) 또는 회수(-)한다.
 * (광고주 계정은 출금 기능이 없으므로 광고 집행에 바로 쓸 수 있는 포인트로 지급)
 */
export function applyAgencyCommission(
  db: Database,
  params: { agencyId: string; baseAmount: number; campaignId?: string; paymentId?: string; memo: string; reverse?: boolean }
): number {
  const parentId = parentAdvertiserOf(db, params.agencyId);
  if (!parentId) return 0;
  const rate = db.settings.advertiser_commission_rate;
  if (!(rate > 0) || !(params.baseAmount > 0)) return 0;
  const commission = Math.floor((params.baseAmount * rate) / 100);
  if (commission <= 0) return 0;
  addPointTx(db, {
    advertiserId: parentId,
    type: "commission",
    amount: params.reverse ? -commission : commission,
    campaignId: params.campaignId,
    paymentId: params.paymentId,
    memo: params.memo,
  });
  return commission;
}

/** 구버전 코드가 만든 수익지갑(pending) 실행사 수수료를 잔액과 함께 취소 */
export function cancelLegacyWalletCommissions(db: Database, campaignId: string): void {
  for (const t of db.wallet_transactions) {
    if (t.related_id !== campaignId || t.type !== "advertiser_commission") continue;
    if (t.status !== "pending" && t.status !== "available") continue;
    const w = db.wallets.find((x) => x.user_id === t.user_id);
    if (w) {
      if (t.status === "pending") w.pending_balance -= t.amount;
      else w.available_balance -= t.amount;
      w.updated_at = now();
    }
    t.status = "cancelled";
    t.updated_at = now();
  }
}

function hasLegacyWalletCommission(db: Database, campaignId: string): boolean {
  return db.wallet_transactions.some(
    (t) => t.related_id === campaignId && t.type === "advertiser_commission" && t.status !== "cancelled"
  );
}

/** 이 캠페인에 대해 실행사에 적립된(포인트) 수수료 순액 */
function netPointCommission(db: Database, campaignId: string): number {
  return db.point_transactions
    .filter((t) => t.type === "commission" && t.campaign_id === campaignId)
    .reduce((s, t) => s + t.amount, 0);
}

/**
 * 캠페인에 적립된 실행사 수수료를 비율(0~1)만큼 회수한다. — 원래 수수료를 받은 계정에서 회수
 * - 포인트 수수료(type=commission): 받은 실행사별 순액 × 비율만큼 음수 거래 생성
 * - 구버전 수익지갑 수수료(advertiser_commission): 금액을 비율만큼 줄이고 지갑 잔액도 함께 조정
 */
function reverseCampaignCommissions(db: Database, campaign: AdCampaign, ratio: number, memo: string): void {
  const r = Math.max(0, Math.min(1, ratio));
  if (r <= 0) return;
  const byRecipient = new Map<string, number>();
  for (const t of db.point_transactions) {
    if (t.type !== "commission" || t.campaign_id !== campaign.id) continue;
    byRecipient.set(t.advertiser_id, (byRecipient.get(t.advertiser_id) ?? 0) + t.amount);
  }
  for (const [recipientId, net] of byRecipient) {
    const amount = r >= 1 ? net : Math.floor(net * r);
    if (amount > 0) addPointTx(db, { advertiserId: recipientId, type: "commission", amount: -amount, campaignId: campaign.id, memo });
  }
  if (r >= 1) {
    cancelLegacyWalletCommissions(db, campaign.id);
    return;
  }
  for (const t of db.wallet_transactions) {
    if (t.related_id !== campaign.id || t.type !== "advertiser_commission") continue;
    if (t.status !== "pending" && t.status !== "available") continue;
    const cut = Math.floor(t.amount * r);
    if (cut <= 0) continue;
    const w = db.wallets.find((x) => x.user_id === t.user_id);
    if (w) {
      if (t.status === "pending") w.pending_balance -= cut;
      else w.available_balance -= cut;
      w.updated_at = now();
    }
    t.amount -= cut;
    t.memo = `${t.memo ?? ""} (미집행분 환불로 ${cut.toLocaleString()}원 차감)`.trim();
    t.updated_at = now();
  }
}

/** 관리자 승인(노출) 시점: '대행사 광고 주문 차감액 기준'이면 수수료 적립 */
export function onCampaignPublished(db: Database, campaign: AdCampaign): void {
  if (db.settings.advertiser_commission_basis !== "agency_spend") return;
  if (hasLegacyWalletCommission(db, campaign.id) || netPointCommission(db, campaign.id) !== 0) return;
  applyAgencyCommission(db, {
    agencyId: campaign.advertiser_id,
    baseAmount: campaign.point_spent,
    campaignId: campaign.id,
    memo: `소속 대행사 광고 주문 수수료 (${campaign.title})`,
  });
}

// --- 캠페인 취소 / 정산 --------------------------------------------------------------

const OPEN_PARTICIPATION_STATUSES = ["applied", "accepted", "video_rejected", "deploy_rejected", "revision_requested"];
const PENDING_REVIEW_STATUSES = ["video_submitted", "video_approved", "deploy_submitted", "disputed"];

function closeOpenParticipations(db: Database, campaign: AdCampaign, message: string): void {
  for (const p of db.campaign_participations ?? []) {
    if (p.campaign_id !== campaign.id || !OPEN_PARTICIPATION_STATUSES.includes(p.status)) continue;
    p.status = "cancelled";
    p.updated_at = now();
    releaseVideo(db, p.id);
    notifyUser(db, { recipientId: p.creator_id, title: message, message: campaign.title, link: "/creator/campaigns" });
  }
}

/** 완료된 작업량 */
export function campaignProgress(db: Database, campaign: AdCampaign) {
  const parts = (db.campaign_participations ?? []).filter((p) => p.campaign_id === campaign.id);
  const completedVideos = parts.filter((p) => participationTypeOf(p) === "video_production" && p.status === "completed").length;
  const completedDeploysNew = parts.filter((p) => participationTypeOf(p) === "deploy" && p.status === "completed").length;
  const completedDeploysLegacy = db.campaign_deliveries.filter((d) => d.campaign_id === campaign.id && d.status === "approved").length;
  const pendingReview =
    parts.filter((p) => PENDING_REVIEW_STATUSES.includes(p.status)).length +
    db.campaign_deliveries.filter((d) => d.campaign_id === campaign.id && d.status === "submitted").length;
  return {
    completedVideos,
    completedDeploys: completedDeploysNew + completedDeploysLegacy,
    pendingReview,
    // 구버전 단순 제작 캠페인은 video_production_count 없이 distribution_count 를 제작 수로 사용했음
    videoTarget: Math.max(0, campaign.video_production_count ?? (campaign.campaign_type === "create_only" ? campaign.distribution_count ?? 0 : 0)),
    deployTarget: campaign.campaign_type === "create_only" ? 0 : Math.max(0, campaign.distribution_count ?? 0),
  };
}

/** 완료 작업량 기준 소진 포인트 (등록 시 결제 금액을 제작/배포 비율로 안분) */
export function consumedCampaignPoints(db: Database, campaign: AdCampaign): number {
  const prog = campaignProgress(db, campaign);
  const cost = computeCampaignCost(db, {
    campaign_type: campaign.campaign_type,
    platforms: campaign.platforms,
    distribution_count: campaign.distribution_count,
    platform_distributions: campaign.platform_distributions,
    // 등록 시와 같은 방식으로 계산 (구버전 데이터는 undefined → 기존 호환 규칙 적용)
    video_production_count: campaign.video_production_count ?? undefined,
    video_duration_tier: campaign.video_duration_tier ?? null,
  });
  const paid = Math.max(0, campaign.point_spent);
  const computedTotal = cost.distributionCost + cost.creationCost;
  if (paid === 0) return 0;
  if (computedTotal <= 0) {
    // 단가 산정 불가(구버전 데이터) → 목표 대비 완료 비율로 안분
    const target = prog.videoTarget + prog.deployTarget;
    const done = Math.min(prog.completedVideos, prog.videoTarget) + Math.min(prog.completedDeploys, prog.deployTarget);
    if (target <= 0) return done > 0 ? paid : 0; // 목표 불명 + 완료 작업 없음 → 전액 환불
    return Math.min(paid, Math.round((paid * done) / target));
  }
  const ratio = paid / computedTotal;
  const unitVideo = prog.videoTarget > 0 ? (cost.creationCost * ratio) / prog.videoTarget : 0;
  const unitDeploy = prog.deployTarget > 0 ? (cost.distributionCost * ratio) / prog.deployTarget : 0;
  const consumed =
    unitVideo * Math.min(prog.completedVideos, prog.videoTarget) +
    unitDeploy * Math.min(prog.completedDeploys, prog.deployTarget);
  return Math.min(paid, Math.round(consumed));
}

/**
 * 캠페인 전액 취소·환불 (광고주 본인 또는 관리자). 제출·완료된 작업이 있으면 정산(settleCampaign)을 써야 한다.
 */
export function cancelCampaign(db: Database, actor: Profile, campaignId: string): WorkflowResult<AdCampaign> {
  const campaign = db.ad_campaigns.find((c) => c.id === campaignId);
  if (!campaign) return fail(404, "캠페인을 찾을 수 없습니다.");
  if (actor.role !== "admin" && !(actor.role === "advertiser" && campaign.advertiser_id === actor.id)) {
    return fail(403, "본인 캠페인만 취소할 수 있습니다.");
  }
  if (["completed", "refunded", "rejected", "cancelled"].includes(campaign.status)) {
    return fail(409, "이미 종료·환불된 캠페인은 취소할 수 없습니다.");
  }
  const prog = campaignProgress(db, campaign);
  const hasWork =
    prog.completedVideos + prog.completedDeploys > 0 ||
    prog.pendingReview > 0 ||
    db.wallet_transactions.some(
      (t) => t.type === "campaign_reward" && t.status !== "cancelled" &&
        ((t.related_table === "campaign_participations" &&
          (db.campaign_participations ?? []).some((p) => p.id === t.related_id && p.campaign_id === campaign.id)) ||
          (t.related_table === "campaign_deliveries" &&
            db.campaign_deliveries.some((d) => d.id === t.related_id && d.campaign_id === campaign.id)))
    );
  if (hasWork) {
    return fail(409, "제출 또는 완료된 작업이 있어 전액 취소할 수 없습니다. 관리자에게 부분 정산(완료 처리)을 요청하세요.");
  }

  const wasPublished = !!campaign.published_at;
  campaign.status = "refunded";
  campaign.updated_at = now();
  closeOpenParticipations(db, campaign, "캠페인이 취소되었습니다");
  if (campaign.point_spent > 0 && db.profiles.some((p) => p.id === campaign.advertiser_id)) {
    addPointTxOnce(db, {
      advertiserId: campaign.advertiser_id,
      type: "refund",
      amount: campaign.point_spent,
      campaignId: campaign.id,
      memo: `캠페인 취소 환불: ${campaign.title}`,
    });
  }
  // 실행사 수수료 전액 회수 (포인트 적립분은 받은 계정에서, 구버전 수익지갑 적립분은 취소)
  reverseCampaignCommissions(db, campaign, 1, `캠페인 취소로 수수료 회수 (${campaign.title})`);

  if (actor.role === "admin") {
    notifyCampaignOwner(db, campaign, { title: "관리자가 캠페인을 취소했습니다", message: `${campaign.title} · 포인트 전액 환불`, category: "campaign_status" });
  } else if (wasPublished) {
    notifyAdmins(db, { title: "광고주가 캠페인을 취소했습니다", message: campaign.title, link: "/admin/campaigns" });
  }
  audit(db, { actorId: actor.id, action: "cancel_and_refund_campaign", targetTable: "ad_campaigns", targetId: campaign.id });
  return { ok: true, status: 200, body: campaign, message: "캠페인이 취소되고 포인트가 환불되었습니다." };
}

/**
 * 캠페인 완료(정산). 완료된 작업분만 소진 처리하고 나머지 포인트는 광고주에게 환불한다.
 * - 검토 대기(제출됨/분쟁) 건이 있으면 먼저 처리해야 한다.
 * - 진행 중(선발·반려 후 재제출 대기) 참여는 종료(cancelled) 처리 + 배정 영상 반납.
 */
export function settleCampaign(
  db: Database,
  actorId: string | null,
  campaignId: string,
  opts: { auto?: boolean } = {}
): WorkflowResult<AdCampaign & { refund_amount: number }> {
  const campaign = db.ad_campaigns.find((c) => c.id === campaignId);
  if (!campaign) return fail(404, "캠페인을 찾을 수 없습니다.");
  if (!isCampaignActive(campaign)) return fail(409, "진행 중인 캠페인만 완료 처리할 수 있습니다.");
  const prog = campaignProgress(db, campaign);
  if (prog.pendingReview > 0) {
    return fail(409, `검토 대기 중인 제출물(분쟁 포함) ${prog.pendingReview}건을 먼저 처리해 주세요.`);
  }

  const consumed = consumedCampaignPoints(db, campaign);
  const refund = Math.max(0, campaign.point_spent - consumed);

  closeOpenParticipations(db, campaign, "캠페인이 종료되었습니다");
  campaign.status = "completed";
  campaign.updated_at = now();

  if (refund > 0 && db.profiles.some((p) => p.id === campaign.advertiser_id)) {
    addPointTxOnce(db, {
      advertiserId: campaign.advertiser_id,
      type: "refund",
      amount: refund,
      campaignId: campaign.id,
      memo: `캠페인 정산 미집행분 환불: ${campaign.title}`,
    });
  }

  // 실행사 수수료: 기준별 처리
  const basis = db.settings.advertiser_commission_basis;
  if (basis === "campaign_completed") {
    if (!hasLegacyWalletCommission(db, campaign.id) && netPointCommission(db, campaign.id) === 0) {
      applyAgencyCommission(db, {
        agencyId: campaign.advertiser_id,
        baseAmount: consumed,
        campaignId: campaign.id,
        memo: `소속 대행사 캠페인 완료 수수료 (${campaign.title})`,
      });
    }
  } else if (refund > 0 && campaign.point_spent > 0) {
    // 주문 차감액 기준으로 이미 적립된 수수료(포인트·구버전 수익지갑) 중 환불분 비율만큼 회수
    reverseCampaignCommissions(db, campaign, refund / campaign.point_spent, `캠페인 미집행분 환불에 따른 수수료 회수 (${campaign.title})`);
  }

  notifyCampaignOwner(db, campaign, {
    title: "캠페인이 완료되었습니다",
    message: `${campaign.title} · 집행 ${consumed.toLocaleString()}P${refund > 0 ? ` · 미집행분 ${refund.toLocaleString()}P 환불` : ""}`,
    category: "campaign_status",
  });
  audit(db, {
    actorId,
    action: opts.auto ? "auto_complete_campaign" : "complete_campaign",
    targetTable: "ad_campaigns",
    targetId: campaign.id,
    after: { consumed, refund },
  });
  return { ok: true, status: 200, body: { ...campaign, refund_amount: refund }, message: refund > 0 ? `완료 처리되었습니다. 미집행분 ${refund.toLocaleString()}P가 환불되었습니다.` : "완료 처리되었습니다." };
}

/** 모든 모집 건이 완료되면 캠페인을 자동 완료 처리 */
export function maybeAutoCompleteCampaign(db: Database, campaign: AdCampaign, actorId: string | null): void {
  if (!isCampaignActive(campaign)) return;
  const prog = campaignProgress(db, campaign);
  const target = prog.videoTarget + prog.deployTarget;
  if (target <= 0 || prog.pendingReview > 0) return;
  if (prog.completedVideos >= prog.videoTarget && prog.completedDeploys >= prog.deployTarget) {
    settleCampaign(db, actorId, campaign.id, { auto: true });
  }
}
