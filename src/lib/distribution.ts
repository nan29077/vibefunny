// ===========================================================================
// 배포용 영상 풀(campaign_videos) — 영상 1개당 1크리에이터 배타 분배 로직
// ---------------------------------------------------------------------------
// 적용 대상(풀 모델):
//   - distribute_own_video / distribute_existing_video
//       → 광고주가 등록 시 직접 올린 영상(1~N개)이 풀이 된다.
//   - create_and_distribute (video_production_count > 0)
//       → 영상제작 참여자가 제작·승인받은 영상이 풀로 들어온다(순차 의존).
// 그 외 캠페인은 풀 모델이 아니므로(레거시/공유 영상) 기존 동작을 유지한다.
// ===========================================================================

import { genId } from "./crypto";
import type { AdCampaign, CampaignVideo, Database } from "./schema";

const now = () => new Date().toISOString();

/** 이 캠페인이 "영상 풀 + 배타 분배" 모델을 사용하는가 */
export function hasVideoPool(campaign: AdCampaign): boolean {
  if (campaign.campaign_type === "distribute_own_video") return true;
  if (campaign.campaign_type === "distribute_existing_video") return true;
  if (campaign.campaign_type === "create_and_distribute") {
    return (campaign.video_production_count ?? 0) > 0;
  }
  return false;
}

/** 캠페인의 풀 영상 목록 */
export function campaignPoolVideos(db: Database, campaignId: string): CampaignVideo[] {
  return (db.campaign_videos ?? []).filter((v) => v.campaign_id === campaignId);
}

/**
 * 제작 승인된 영상 / 광고주 업로드 영상을 풀(campaign_videos)에 동기화한다.
 * - create_and_distribute: video_production 참여가 video_approved/completed 이고
 *   제출 영상(video_url 또는 video_file_data)이 있으면 풀 항목을 보장 생성.
 * - distribute_own/existing_video: 풀이 비어 있고 레거시 uploaded_video_url 이 있으면
 *   단일 풀 항목으로 백필(기존 단일 영상 데모 호환).
 * @returns 변경이 발생했으면 true
 */
export function syncCampaignVideos(db: Database, campaign: AdCampaign): boolean {
  if (!db.campaign_videos) db.campaign_videos = [];
  if (!hasVideoPool(campaign)) return false;
  let dirty = false;
  const existing = campaignPoolVideos(db, campaign.id);

  if (campaign.campaign_type === "create_and_distribute") {
    const approvedParts = (db.campaign_participations ?? []).filter(
      (p) =>
        p.campaign_id === campaign.id &&
        (p.participation_type ?? "deploy") === "video_production" &&
        (p.status === "video_approved" || p.status === "completed") &&
        (!!p.video_url || !!p.video_file_data)
    );
    for (const p of approvedParts) {
      if (existing.some((v) => v.source_participation_id === p.id)) continue;
      db.campaign_videos.push({
        id: genId(),
        campaign_id: campaign.id,
        source: "produced",
        title: p.video_note ?? null,
        video_url: p.video_url ?? null,
        file_data: p.video_file_data ?? null,
        file_name: p.video_file_name ?? null,
        file_type: p.video_file_type ?? null,
        source_participation_id: p.id,
        produced_by_creator_id: p.creator_id,
        status: "unassigned",
        assigned_creator_id: null,
        assigned_participation_id: null,
        assigned_at: null,
        downloaded_at: null,
        distributed_at: null,
        created_at: now(),
        updated_at: now(),
      });
      dirty = true;
    }
  } else {
    // distribute_own_video / distribute_existing_video 레거시 단일 영상 백필
    if (existing.length === 0 && campaign.uploaded_video_url) {
      db.campaign_videos.push({
        id: genId(),
        campaign_id: campaign.id,
        source: "advertiser_uploaded",
        title: null,
        video_url: campaign.uploaded_video_url,
        file_data: null,
        file_name: null,
        file_type: null,
        source_participation_id: null,
        produced_by_creator_id: null,
        status: "unassigned",
        assigned_creator_id: null,
        assigned_participation_id: null,
        assigned_at: null,
        downloaded_at: null,
        distributed_at: null,
        created_at: now(),
        updated_at: now(),
      });
      dirty = true;
    }
  }
  return dirty;
}

/** 모든 캠페인에 대해 풀 동기화 (구버전 db.json 백필용) */
export function syncAllCampaignVideos(db: Database): boolean {
  let dirty = false;
  for (const c of db.ad_campaigns ?? []) {
    if (syncCampaignVideos(db, c)) dirty = true;
  }
  return dirty;
}

/** 제작 승인 완료된 영상 수 (create_and_distribute 순차 게이트 판정용) */
export function producedApprovedCount(db: Database, campaign: AdCampaign): number {
  return (db.campaign_participations ?? []).filter(
    (p) =>
      p.campaign_id === campaign.id &&
      (p.participation_type ?? "deploy") === "video_production" &&
      (p.status === "video_approved" || p.status === "completed") &&
      (!!p.video_url || !!p.video_file_data)
  ).length;
}

/**
 * 배포 캠페인이 크리에이터에게 노출 가능한 상태인가(순차 게이트).
 * - distribute_own/existing_video: 등록 시 영상이 올라가 있으므로 항상 해제.
 * - create_and_distribute: 계획된 영상제작 건수만큼 제작·승인이 끝나야 해제.
 */
export function isDistributionUnlocked(db: Database, campaign: AdCampaign): boolean {
  if (!hasVideoPool(campaign)) return true; // 레거시(풀 없음)는 기존대로 노출
  if (campaign.campaign_type === "create_and_distribute") {
    const target = campaign.video_production_count ?? 0;
    if (target <= 0) return true;
    return producedApprovedCount(db, campaign) >= target;
  }
  return true; // distribute_own/existing_video
}

export interface PoolStats {
  total: number;
  unassigned: number;
  assigned: number;
  downloaded: number;
  distributed: number;
}

/** 풀 영상 상태 집계 */
export function poolStats(db: Database, campaignId: string): PoolStats {
  const vids = campaignPoolVideos(db, campaignId);
  return {
    total: vids.length,
    unassigned: vids.filter((v) => v.status === "unassigned").length,
    assigned: vids.filter((v) => v.status === "assigned").length,
    downloaded: vids.filter((v) => v.status === "downloaded").length,
    distributed: vids.filter((v) => v.status === "distributed").length,
  };
}

export interface AllocationResult {
  ok: boolean;
  video?: CampaignVideo;
  reason?: "locked" | "exhausted" | "not_pool";
}

/**
 * 미분배 영상 1개를 해당 크리에이터(참여)에게 원자적으로 배타 분배한다.
 * 반드시 tx() 내부에서 호출하여 동시성(같은 영상 중복 분배)을 막는다.
 * - 게이트 미해제 시 reason="locked"
 * - 남은 영상 없으면 reason="exhausted"
 */
export function allocateVideoForParticipation(
  db: Database,
  campaign: AdCampaign,
  creatorId: string,
  participationId: string
): AllocationResult {
  if (!hasVideoPool(campaign)) return { ok: false, reason: "not_pool" };
  // 분배 직전에 제작 승인분/레거시 영상을 풀에 반영
  syncCampaignVideos(db, campaign);
  if (!isDistributionUnlocked(db, campaign)) return { ok: false, reason: "locked" };

  // 이미 이 참여에 분배된 영상이 있으면 그대로 반환 (중복 분배 방지)
  const already = (db.campaign_videos ?? []).find(
    (v) => v.campaign_id === campaign.id && v.assigned_participation_id === participationId
  );
  if (already) return { ok: true, video: already };

  // 미분배 영상 중 가장 먼저 등록된 것을 선택 (결정적 순서)
  const candidates = (db.campaign_videos ?? [])
    .filter((v) => v.campaign_id === campaign.id && v.status === "unassigned")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const target = candidates[0];
  if (!target) return { ok: false, reason: "exhausted" };

  target.status = "assigned";
  target.assigned_creator_id = creatorId;
  target.assigned_participation_id = participationId;
  target.assigned_at = now();
  target.updated_at = now();
  return { ok: true, video: target };
}

/** 분배받은 영상을 다운로드(퍼가기) 처리 */
export function markVideoDownloaded(db: Database, participationId: string): CampaignVideo | null {
  const v = (db.campaign_videos ?? []).find(
    (x) => x.assigned_participation_id === participationId
  );
  if (!v) return null;
  if (v.status === "assigned") {
    v.status = "downloaded";
    v.downloaded_at = now();
    v.updated_at = now();
  }
  return v;
}

/** 배포 승인 시 분배 영상을 배포완료 처리 */
export function markVideoDistributed(db: Database, participationId: string): CampaignVideo | null {
  const v = (db.campaign_videos ?? []).find(
    (x) => x.assigned_participation_id === participationId
  );
  if (!v) return null;
  if (v.status !== "distributed") {
    v.status = "distributed";
    v.distributed_at = now();
    v.updated_at = now();
  }
  return v;
}

/** 배포 참여가 반려/취소될 때 분배 영상을 다시 풀로 반납 */
export function releaseVideo(db: Database, participationId: string): CampaignVideo | null {
  const v = (db.campaign_videos ?? []).find(
    (x) => x.assigned_participation_id === participationId
  );
  if (!v) return null;
  if (v.status !== "distributed") {
    v.status = "unassigned";
    v.assigned_creator_id = null;
    v.assigned_participation_id = null;
    v.assigned_at = null;
    v.downloaded_at = null;
    v.updated_at = now();
  }
  return v;
}
