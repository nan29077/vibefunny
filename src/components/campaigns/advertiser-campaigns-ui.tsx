"use client";

import { useState, useTransition } from "react";
import type { AdCampaign, CampaignParticipation, CampaignDirectMessage } from "@/lib/schema";
import { formatKRW } from "@/lib/money";
import { PLATFORM_LABELS } from "@/lib/schema";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/labels";
import { DirectMessageThread } from "@/components/campaigns/direct-message-thread";
import { ParticipationCommentThread } from "@/components/campaigns/participation-comment-thread";
import {
  IconChevronDown,
  IconChevronRight,
  IconVideo,
  IconLink,
  IconCheck,
  IconX,
  IconMessageSquare,
  IconDownload,
  IconEye,
  IconClock,
  IconCheckCircle,
  IconXCircle,
  IconPlus,
  IconBarChart,
} from "@/components/icons";

// ─── 타입 ──────────────────────────────────────────────────────────────────

export interface AdvertiserCampaignRow {
  campaign: AdCampaign;
  participations: {
    participation: CampaignParticipation;
    creatorName: string;
    directMessages: CampaignDirectMessage[];
  }[];
}

interface Props {
  rows: AdvertiserCampaignRow[];
  advertiserId: string;
  advertiserName: string;
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const PENDING_STATUSES = new Set(["draft", "point_pending", "paid", "admin_review"]);
const ACTIVE_STATUSES = new Set(["published", "recruiting", "in_progress", "active", "submitted", "completed"]);

const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  point_pending: "포인트 결제 대기",
  paid: "결제 완료",
  admin_review: "관리자 검토 중",
  published: "게시됨",
  recruiting: "모집 중",
  in_progress: "진행 중",
  active: "활성",
  submitted: "제출됨",
  completed: "완료",
  rejected: "반려",
  cancelled: "취소",
  refunded: "환불",
};

const CAMPAIGN_STATUS_COLOR: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  point_pending: "bg-yellow-100 text-yellow-700",
  paid: "bg-blue-100 text-blue-700",
  admin_review: "bg-orange-100 text-orange-700",
  published: "bg-green-100 text-green-700",
  recruiting: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-indigo-100 text-indigo-700",
  active: "bg-indigo-100 text-indigo-700",
  submitted: "bg-purple-100 text-purple-700",
  completed: "bg-gray-200 text-gray-600",
  rejected: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-600",
};

const PARTICIPATION_STATUS_LABELS: Record<string, string> = {
  applied: "신청",
  accepted: "선발됨",
  video_submitted: "영상 제출됨",
  video_approved: "영상 승인됨",
  video_rejected: "영상 반려",
  deploy_submitted: "배포 승인요청",
  deploy_approved: "배포 승인됨",
  deploy_rejected: "배포 반려",
  completed: "완료",
};

function participationStatusColor(status: string) {
  if (["video_approved", "deploy_approved", "completed"].includes(status))
    return "bg-green-100 text-green-700";
  if (["video_rejected", "deploy_rejected"].includes(status))
    return "bg-red-100 text-red-700";
  if (["video_submitted", "deploy_submitted"].includes(status))
    return "bg-amber-100 text-amber-700";
  if (status === "applied")
    return "bg-blue-100 text-blue-700";
  if (status === "accepted")
    return "bg-emerald-100 text-emerald-700";
  return "bg-gray-100 text-gray-600";
}

// ─── 참여자 행 ──────────────────────────────────────────────────────────────

function ParticipantRow({
  participation: p,
  creatorName,
  directMessages,
  campaignId,
  advertiserId,
  advertiserName,
  onUpdate,
}: {
  participation: CampaignParticipation;
  creatorName: string;
  directMessages: CampaignDirectMessage[];
  campaignId: string;
  advertiserId: string;
  advertiserName: string;
  onUpdate: (updated: CampaignParticipation) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const unread = directMessages.filter((m) => !m.read && m.from_role === "creator").length;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  async function review(action: "approve" | "reject", reason?: string) {
    startTransition(async () => {
      const res = await fetch(`/api/participations/${p.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: action, reason }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
        showToast(action === "approve" ? "승인했습니다" : "반려했습니다");
      } else {
        showToast("오류가 발생했습니다");
      }
    });
  }

  const hasWork =
    p.video_url ||
    p.video_file_data ||
    p.deploy_link;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      {toast && (
        <div className="fixed top-4 left-1/2 z-[200] -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* 참여자 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-xs font-bold text-white">
            {creatorName.slice(0, 1)}
          </div>
          <span className="font-semibold text-sm text-gray-800 truncate">{creatorName}</span>
          <span className={["inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", participationStatusColor(p.status)].join(" ")}>
            {PARTICIPATION_STATUS_LABELS[p.status] ?? p.status}
          </span>
          {p.participation_type && (
            <span className={[
              "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
              p.participation_type === "deploy" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700",
            ].join(" ")}>
              {p.participation_type === "deploy" ? "배포" : "영상제작"}
            </span>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 작업물 버튼 */}
          {hasWork && (
            <button
              onClick={() => setWorkOpen(!workOpen)}
              className={[
                "flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
                workOpen
                  ? "border-amber-400 bg-amber-50 text-amber-700"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
              ].join(" ")}
            >
              <IconEye size={12} /> 작업물
            </button>
          )}

          {/* 선발 승인/반려 (신청 단계) */}
          {p.status === "applied" && (
            <>
              <button
                onClick={() => review("approve")}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                <IconCheck size={11} /> 선발 승인
              </button>
              <button
                onClick={() => setRejectOpen(true)}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <IconX size={11} /> 선발 반려
              </button>
            </>
          )}

          {/* 영상 승인/반려 */}
          {p.status === "video_submitted" && (
            <>
              <button
                onClick={() => review("approve")}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                <IconCheck size={11} /> 영상 승인
              </button>
              <button
                onClick={() => setRejectOpen(true)}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <IconX size={11} /> 반려
              </button>
            </>
          )}

          {/* 배포 승인/반려 */}
          {p.status === "deploy_submitted" && (
            <>
              <button
                onClick={() => review("approve")}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                <IconCheck size={11} /> 배포 승인 (완료)
              </button>
              <button
                onClick={() => setRejectOpen(true)}
                disabled={isPending}
                className="flex items-center gap-1 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <IconX size={11} /> 반려
              </button>
            </>
          )}

          {/* DM 버튼 */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className={[
              "relative flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
              chatOpen
                ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            <IconMessageSquare size={12} /> DM
            {unread > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 작업물 패널 */}
      {workOpen && hasWork && (
        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 space-y-2">
          <div className="text-xs font-semibold text-amber-800 mb-1">제출된 작업물</div>

          {/* 영상 URL */}
          {p.video_url && (
            <div className="flex items-center gap-2">
              <IconVideo size={13} className="shrink-0 text-amber-600" />
              <span className="text-xs text-gray-600 shrink-0">영상 링크:</span>
              <a
                href={p.video_url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate text-xs font-medium text-indigo-600 underline hover:text-indigo-800"
              >
                {p.video_url}
              </a>
            </div>
          )}

          {/* 영상 원본 파일 다운로드 */}
          {p.video_file_data && (
            <div className="flex items-center gap-2">
              <IconDownload size={13} className="shrink-0 text-amber-600" />
              <span className="text-xs text-gray-600 shrink-0">원본 파일:</span>
              <a
                href={p.video_file_data}
                download={p.video_file_name ?? "video"}
                className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
              >
                <IconDownload size={11} /> {p.video_file_name ?? "다운로드"}
              </a>
            </div>
          )}

          {/* 배포 링크 */}
          {p.deploy_link && (
            <div className="flex items-center gap-2">
              <IconLink size={13} className="shrink-0 text-green-600" />
              <span className="text-xs text-gray-600 shrink-0">배포 링크:</span>
              <a
                href={p.deploy_link}
                target="_blank"
                rel="noreferrer"
                className="flex-1 truncate text-xs font-medium text-green-700 underline hover:text-green-900"
              >
                {p.deploy_link}
              </a>
            </div>
          )}

          {p.video_note && (
            <p className="text-xs text-gray-500 italic">메모: {p.video_note}</p>
          )}
          {p.deploy_note && (
            <p className="text-xs text-gray-500 italic">배포 메모: {p.deploy_note}</p>
          )}
        </div>
      )}

      {/* 반려 사유 */}
      {p.rejection_reason && (
        <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2.5">
          <p className="text-xs font-semibold text-red-700">반려 사유: <span className="font-normal">{p.rejection_reason}</span></p>
          <button
            onClick={() => setCommentsOpen(!commentsOpen)}
            className="mt-1.5 text-xs font-semibold text-indigo-600 hover:underline"
          >
            {commentsOpen ? "댓글 닫기 ▲" : "댓글로 소통하기 ▼"}
          </button>
          {commentsOpen && (
            <div className="mt-2">
              <ParticipationCommentThread
                participationId={p.id}
                currentUserId={advertiserId}
                currentUserName={advertiserName}
                currentUserRole="advertiser"
              />
            </div>
          )}
        </div>
      )}

      {p.status === "completed" && (
        <p className="mt-1.5 text-xs font-semibold text-green-600">✓ 완료 — 크리에이터 수익 지급됨</p>
      )}

      {/* 반려 모달 */}
      {rejectOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { setRejectOpen(false); setRejectReason(""); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-1">반려 사유 입력</h3>
            <p className="text-sm text-gray-500 mb-3">크리에이터에게 전달될 사유를 입력하세요.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 영상 품질이 기준 미달입니다. 다시 제출해주세요."
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 min-h-[90px] resize-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setRejectOpen(false); setRejectReason(""); }}
                className="flex-1 rounded-xl border border-gray-300 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >취소</button>
              <button
                onClick={() => { review("reject", rejectReason); setRejectOpen(false); setRejectReason(""); }}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >반려하기</button>
            </div>
          </div>
        </div>
      )}

      {/* DM 패널 */}
      {chatOpen && (
        <div className="mt-3 border-t border-indigo-100 pt-3">
          <p className="text-xs font-semibold text-indigo-800 mb-2">{creatorName}님과의 DM</p>
          <DirectMessageThread
            participationId={p.id}
            campaignId={campaignId}
            creatorId={p.creator_id}
            currentUserId={advertiserId}
            currentUserName={advertiserName}
            currentUserRole="advertiser"
            initialMessages={directMessages}
          />
        </div>
      )}
    </div>
  );
}

// ─── 캠페인 카드 ─────────────────────────────────────────────────────────────

function CampaignCard({
  row,
  advertiserId,
  advertiserName,
}: {
  row: AdvertiserCampaignRow;
  advertiserId: string;
  advertiserName: string;
}) {
  const { campaign: c } = row;
  const [expanded, setExpanded] = useState(false);
  const [participations, setParticipations] = useState(row.participations);

  const videoProducers = participations.filter(
    (r) => r.participation.participation_type === "video_production"
  );
  const deployers = participations.filter(
    (r) =>
      r.participation.participation_type === "deploy" ||
      r.participation.participation_type == null
  );

  const totalParticipants = participations.length;
  const pendingCount = participations.filter((r) =>
    ["applied", "video_submitted", "deploy_submitted"].includes(r.participation.status)
  ).length;

  function handleUpdate(updated: CampaignParticipation) {
    setParticipations((prev) =>
      prev.map((r) =>
        r.participation.id === updated.id ? { ...r, participation: updated } : r
      )
    );
  }

  const isActive = ACTIVE_STATUSES.has(c.status);

  return (
    <div className={[
      "rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md",
      pendingCount > 0 ? "border-amber-300" : "border-gray-200",
    ].join(" ")}>
      {/* 카드 헤더 */}
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className={["inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", CAMPAIGN_STATUS_COLOR[c.status] ?? "bg-gray-100 text-gray-600"].join(" ")}>
                {CAMPAIGN_STATUS_LABELS[c.status] ?? c.status}
              </span>
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">
                  <IconClock size={11} /> 검토 대기 {pendingCount}건
                </span>
              )}
            </div>
            <a
              href={`/advertiser/campaigns/${c.id}`}
              className="font-bold text-gray-900 hover:text-indigo-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {c.title}
            </a>
            <p className="mt-0.5 text-xs text-gray-400">
              {CAMPAIGN_TYPE_LABELS[c.campaign_type]} ·{" "}
              {c.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")} ·{" "}
              배포 {c.distribution_count}건
              {(c.video_production_count ?? 0) > 0 && ` · 영상제작 ${c.video_production_count}건`}
            </p>
            {c.brand_name && (
              <p className="mt-0.5 text-xs text-gray-400">브랜드: {c.brand_name}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-base font-bold text-gray-900">{formatKRW(c.total_cost)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">총 예산</div>
          </div>
        </div>

        {/* 참여 현황 요약 */}
        {isActive && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-4 w-full flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <IconBarChart size={14} className="text-gray-500" />
              참여자 현황
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs">{totalParticipants}명</span>
              {videoProducers.length > 0 && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">영상제작 {videoProducers.length}</span>
              )}
              {deployers.length > 0 && (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">배포 {deployers.length}</span>
              )}
            </span>
            {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
          </button>
        )}

        {/* 진행예정 캠페인 관리자 메모 */}
        {!isActive && c.admin_memo && (
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700">
            <span className="font-semibold">관리자 메모:</span> {c.admin_memo}
          </div>
        )}
      </div>

      {/* 참여자 목록 (확장 시) */}
      {expanded && isActive && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-4">
          {totalParticipants === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-3">아직 참여 신청자가 없습니다.</p>
          )}

          {/* 영상제작 참여자 */}
          {videoProducers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">
                  <IconVideo size={11} /> 영상제작 참여자 {videoProducers.length}명
                </span>
              </div>
              <div className="space-y-2">
                {videoProducers.map(({ participation, creatorName, directMessages }) => (
                  <ParticipantRow
                    key={participation.id}
                    participation={participation}
                    creatorName={creatorName}
                    directMessages={directMessages}
                    campaignId={c.id}
                    advertiserId={advertiserId}
                    advertiserName={advertiserName}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 배포 참여자 */}
          {deployers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                  <IconLink size={11} /> 배포 참여자 {deployers.length}명
                </span>
              </div>
              <div className="space-y-2">
                {deployers.map(({ participation, creatorName, directMessages }) => (
                  <ParticipantRow
                    key={participation.id}
                    participation={participation}
                    creatorName={creatorName}
                    directMessages={directMessages}
                    campaignId={c.id}
                    advertiserId={advertiserId}
                    advertiserName={advertiserName}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────

export function AdvertiserCampaignsUI({ rows, advertiserId, advertiserName }: Props) {
  const [tab, setTab] = useState<"pending" | "active">("active");

  const pendingRows = rows.filter((r) => PENDING_STATUSES.has(r.campaign.status));
  const activeRows = rows.filter((r) => ACTIVE_STATUSES.has(r.campaign.status));

  const displayRows = tab === "pending" ? pendingRows : activeRows;

  // 검토 대기 중인 캠페인 수 (뱃지용) — applied 포함
  const reviewNeeded = activeRows.reduce(
    (sum, r) =>
      sum +
      r.participations.filter((p) =>
        ["applied", "video_submitted", "deploy_submitted"].includes(p.participation.status)
      ).length,
    0
  );

  return (
    <div>
      {/* 탭 */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-6">
        {(["active", "pending"] as const).map((t) => {
          const label = t === "active" ? "진행 중" : "진행 예정";
          const count = t === "active" ? activeRows.length : pendingRows.length;
          const badge = t === "active" && reviewNeeded > 0 ? reviewNeeded : 0;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "relative flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all flex items-center justify-center gap-2",
                tab === t
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {label}
              <span className={[
                "rounded-full px-2 py-0.5 text-xs font-bold",
                tab === t ? "bg-gray-100 text-gray-600" : "bg-gray-200 text-gray-500",
              ].join(" ")}>
                {count}
              </span>
              {badge > 0 && (
                <span className="absolute -top-1 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 탭 설명 */}
      <p className="mb-4 text-sm text-gray-500">
        {tab === "active"
          ? "관리자 승인 후 크리에이터에게 노출된 캠페인입니다. 참여자를 선발하고 작업물을 검수하세요."
          : "관리자 승인을 기다리거나 결제 대기 중인 캠페인입니다."}
      </p>

      
      {/* 캠페인 목록 */}
      {displayRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center">
          <IconPlus size={28} className="mx-auto mb-2 text-gray-300" strokeWidth={1.5} />
          <p className="font-semibold text-gray-400">
            {tab === "active" ? "진행 중인 캠페인이 없습니다" : "진행 예정 캠페인이 없습니다"}
          </p>
          {tab === "active" && (
            <p className="mt-1 text-sm text-gray-400">캠페인을 만들면 관리자 승인 후 여기에 표시됩니다.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayRows.map((r) => (
            <CampaignCard
              key={r.campaign.id}
              row={r}
              advertiserId={advertiserId}
              advertiserName={advertiserName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
