"use client";

import { useState, useTransition } from "react";
import type { AdCampaign, CampaignParticipation, CampaignComment, CampaignDirectMessage, CampaignSubmission, SubmissionComment } from "@/lib/schema";
import { formatKRW } from "@/lib/money";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/labels";
import { PLATFORM_LABELS } from "@/lib/schema";
import { DirectMessageThread } from "@/components/campaigns/direct-message-thread";
import { addCommentAction } from "@/lib/actions/submission-actions";
import {
  IconMessageSquare as MessageSquare,
  IconX as X,
  IconCheck as Check,
  IconClipboardList as ClipboardList,
  IconTarget as Target,
  IconPartyPopper as PartyPopper,
  IconCheckCircle as CheckCircle2,
  IconXCircle as XCircle,
  IconClock as Clock,
  IconSend as Send,
} from "@/components/icons";

// ─── 타입 ──────────────────────────────────────────────────────────────────

interface Props {
  campaigns: AdCampaign[];
  myParticipations: CampaignParticipation[];
  initialComments: Record<string, CampaignComment[]>;
  initialDirectMessages: Record<string, CampaignDirectMessage[]>;
  participationCounts: Record<string, number>;
  userId: string;
  userName: string;
  mySubmissions?: CampaignSubmission[];
  initialSubmissionComments?: Record<string, SubmissionComment[]>;
  profileMap?: Record<string, string>;
  /** 캠페인별 건당 예상 수익 (정책설정의 크리에이터 지급액 기준) */
  expectedRewards?: Record<string, { deploy: number; video: number }>;
  /** 캠페인별 배포 영상 풀 정보 (순차 게이트 + 분배/소진) */
  distributionInfo?: Record<string, { pool: boolean; unlocked: boolean; remaining: number; total: number }>;
  /** 내 배포 참여에 분배된 영상 (participation_id -> 영상) */
  myAssignedVideos?: Record<string, { id: string; url: string | null; file_data: string | null; file_name: string | null; status: string }>;
}

type Tab = "available" | "my";
type ParticipationType = "deploy" | "video_production";

/** available 탭에서 사용하는 가상 엔트리 */
interface AvailableEntry {
  campaign: AdCampaign;
  participationType: ParticipationType;
}

// ─── 상수 ──────────────────────────────────────────────────────────────────

const STEPS = ["참여 신청", "영상 제출", "영상 승인", "배포 완료"] as const;

function participationStep(status: CampaignParticipation["status"]): number {
  switch (status) {
    case "applied": return 0;
    case "accepted": return 0;
    case "video_submitted": return 1;
    case "video_approved": return 2;
    case "video_rejected": return 1;
    case "deploy_submitted": return 2;
    case "deploy_approved":
    case "completed": return 3;
    case "deploy_rejected": return 2;
    default: return 0;
  }
}

function statusLabel(status: CampaignParticipation["status"]): string {
  const map: Record<string, string> = {
    applied: "참여 신청 완료",
    accepted: "선발 완료",
    video_submitted: "영상 제출됨 (검토 중)",
    video_approved: "영상 승인됨",
    video_rejected: "영상 반려",
    deploy_submitted: "배포 승인 요청 중",
    deploy_approved: "배포 승인됨",
    deploy_rejected: "배포 반려",
    completed: "완료",
  };
  return map[status] ?? status;
}

function statusGuidance(status: CampaignParticipation["status"]): string {
  switch (status) {
    case "applied": return "광고주 선발 심사 중입니다";
    case "accepted": return "선발 완료! 아래 버튼으로 작업물을 제출해주세요";
    case "video_submitted":
    case "deploy_submitted": return "제출 완료. 광고주 검토 중입니다";
    case "video_approved":
    case "deploy_approved": return "승인 완료! 수익이 지급됩니다";
    case "video_rejected":
    case "deploy_rejected": return "반려됨 — 재제출 가능합니다";
    case "completed": return "완료! 수익이 지갑에 적립되었습니다";
    default: return "";
  }
}

function participationTypeLabel(type: ParticipationType): string {
  return type === "deploy" ? "배포 참여" : "영상제작 참여";
}

function participationTypeBadge(type: ParticipationType) {
  if (type === "deploy") {
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
        배포 참여
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
      영상제작 참여
    </span>
  );
}

/** 동화제작(story_creation) 캠페인이면 동화 라벨, 아니면 기본 참여유형 라벨 */
function slotLabel(isStory: boolean, type: ParticipationType): string {
  return isStory ? "동화 제작 참여" : participationTypeLabel(type);
}
function slotBadge(isStory: boolean, type: ParticipationType) {
  if (isStory) {
    return (
      <span className="inline-flex items-center rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold text-pink-700">
        동화 제작
      </span>
    );
  }
  return participationTypeBadge(type);
}

// ─── 제출 상태 뱃지 ────────────────────────────────────────────────────────

function SubmissionStatusBadge({ status }: { status: CampaignSubmission["status"] }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
        <CheckCircle2 size={11} strokeWidth={2} /> 승인됨
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
        <XCircle size={11} strokeWidth={2} /> 반려됨
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
      <Clock size={11} strokeWidth={2} /> 검토 중
    </span>
  );
}

// ─── 제출물 댓글 폼 ────────────────────────────────────────────────────────

function SubmissionCommentForm({
  submissionId,
  onAddComment,
}: {
  submissionId: string;
  onAddComment: (submissionId: string, comment: SubmissionComment) => void;
}) {
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const fd = new FormData();
    fd.append("submission_id", submissionId);
    fd.append("content", text);
    startTransition(async () => {
      const result = await addCommentAction(undefined as never, fd);
      if (result.ok) {
        onAddComment(submissionId, {
          id: `local_${Date.now()}`,
          submission_id: submissionId,
          author_id: "__me__",
          content: text,
          created_at: new Date().toISOString(),
        } as SubmissionComment);
        setText("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="광고주에게 답글 달기..."
        className="flex-1 rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
        disabled={isPending}
      />
      <button
        type="submit"
        disabled={isPending || !text.trim()}
        className="flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
      >
        <Send size={11} /> 전송
      </button>
    </form>
  );
}

// ─── 소스 타입 뱃지 ────────────────────────────────────────────────────────

function SourceBadge({ sourceType }: { sourceType?: string }) {
  if (sourceType === "ai_story") {
    return (
      <span className="inline-flex items-center rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold text-pink-700">
        AI스토리 의뢰
      </span>
    );
  }
  if (sourceType === "vibeporter") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        바이브포터 의뢰
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
      광고주 캠페인
    </span>
  );
}

// ─── 캠페인 상세 라벨 맵 ─────────────────────────────────────────────────────

const DURATION_LABELS: Record<string, string> = {
  "15s": "15초 이하", "30s": "30초 이하", "60s": "60초 이하", "90s": "90초 이하", custom: "직접 입력",
};
const FOLLOWER_LABELS: Record<string, string> = {
  none: "상관없음", "10k": "1만+", "50k": "5만+", "100k": "10만+", "500k": "50만+", "1m": "100만+",
};
const GENDER_LABELS: Record<string, string> = { all: "전체", female: "여성", male: "남성" };
const AGE_LABELS: Record<string, string> = { all: "전체", teens: "10대", "20s": "20대", "30s": "30대", "40plus": "40대+" };

/** 라벨-값 한 줄 (값 없으면 렌더 안 함) */
function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <span className="shrink-0 text-gray-500 sm:w-28">{label}</span>
      <span className="font-medium text-gray-800 break-words">{value}</span>
    </div>
  );
}

// ─── 스텝퍼 ────────────────────────────────────────────────────────────────

function Stepper({ currentStep, rejected }: { currentStep: number; rejected?: boolean }) {
  return (
    <div className="flex items-center gap-0 w-full mt-3">
      {STEPS.map((label, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        const isLast = i === STEPS.length - 1;
        const stepRejected = rejected && active;
        return (
          <div key={label} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={[
                  "h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                  done ? "bg-amber-500 border-amber-500 text-white" :
                  stepRejected ? "bg-red-500 border-red-500 text-white" :
                  active ? "bg-white border-amber-500 text-amber-600" :
                  "bg-white border-gray-300 text-gray-400",
                ].join(" ")}
              >
                {done ? <Check size={13} strokeWidth={2.5} /> : i + 1}
              </div>
              <span className={[
                "mt-1 text-[10px] text-center leading-tight",
                done ? "text-amber-600 font-semibold" :
                stepRejected ? "text-red-600 font-semibold" :
                active ? "text-amber-600 font-semibold" :
                "text-gray-400",
              ].join(" ")}>
                {label}
              </span>
            </div>
            {!isLast && (
              <div className={["h-0.5 flex-1 mt-[-14px]", done ? "bg-amber-400" : "bg-gray-200"].join(" ")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────────────────

export function CreatorCampaignsUI({
  campaigns,
  myParticipations,
  initialComments,
  initialDirectMessages,
  participationCounts,
  userId,
  userName,
  mySubmissions = [],
  initialSubmissionComments = {},
  profileMap = {},
  expectedRewards = {},
  distributionInfo = {},
  myAssignedVideos = {},
}: Props) {
  // 건당 예상 수익 (정책설정 크리에이터 지급액). 미설정 캠페인은 0 표시.
  const rewardFor = (campaignId: string, ptype: ParticipationType): number => {
    const r = expectedRewards[campaignId];
    if (!r) return 0;
    return ptype === "video_production" ? r.video : r.deploy;
  };
  const [tab, setTab] = useState<Tab>("available");
  const [selectedEntry, setSelectedEntry] = useState<{ campaignId: string; participationType: ParticipationType } | null>(null);
  const [participations, setParticipations] = useState(myParticipations);
  const [directMessages, setDirectMessages] = useState(initialDirectMessages);
  const [submissionComments, setSubmissionComments] = useState(initialSubmissionComments);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoNote, setVideoNote] = useState("");
  const [videoFile, setVideoFile] = useState<{ data: string; name: string; type: string } | null>(null);
  const [deployLink, setDeployLink] = useState("");
  const [deployNote, setDeployNote] = useState("");
  const [assignedVideos, setAssignedVideos] = useState(myAssignedVideos);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ─── 가상 available 엔트리 계산 ─────────────────────────────────────────

  const availableEntries: AvailableEntry[] = [];
  for (const c of campaigns) {
    if (!["recruiting", "published", "in_progress", "active"].includes(c.status)) continue;

    // 배포 참여 슬롯
    if ((c.distribution_count ?? 0) > 0) {
      const alreadyDeploy = participations.some(
        (p) =>
          p.campaign_id === c.id &&
          (p.participation_type === "deploy" || p.participation_type == null)
      );
      // 영상 풀 모델: 순차 게이트 미해제 또는 영상 소진 시 배포 카드 숨김
      const dist = distributionInfo[c.id];
      const poolBlocked = dist?.pool && (!dist.unlocked || dist.remaining <= 0);
      if (!alreadyDeploy && !poolBlocked) availableEntries.push({ campaign: c, participationType: "deploy" });
    }

    // 영상제작 참여 슬롯
    if ((c.video_production_count ?? 0) > 0) {
      const alreadyVideo = participations.some(
        (p) => p.campaign_id === c.id && p.participation_type === "video_production"
      );
      if (!alreadyVideo) availableEntries.push({ campaign: c, participationType: "video_production" });
    }
  }

  // ─── 내 참여 아이템 ─────────────────────────────────────────────────────

  const myParticipationItems = participations
    .map((p) => ({ participation: p, campaign: campaigns.find((c) => c.id === p.campaign_id) }))
    .filter((item): item is { participation: CampaignParticipation; campaign: AdCampaign } => item.campaign != null);

  // ─── 현재 선택된 캠페인 / 참여 ──────────────────────────────────────────

  const selectedCampaign = selectedEntry ? campaigns.find((c) => c.id === selectedEntry.campaignId) ?? null : null;
  const selectedParticipation = selectedEntry
    ? participations.find(
        (p) =>
          p.campaign_id === selectedEntry.campaignId &&
          (p.participation_type === selectedEntry.participationType ||
            (p.participation_type == null && selectedEntry.participationType === "deploy"))
      )
    : undefined;

  function handleAddSubmissionComment(submissionId: string, comment: SubmissionComment) {
    setSubmissionComments((prev) => ({
      ...prev,
      [submissionId]: [...(prev[submissionId] ?? []), comment],
    }));
  }

  // ─── 액션 ──────────────────────────────────────────────────────────────

  async function handleJoin(campaignId: string, participationType: ParticipationType) {
    startTransition(async () => {
      const res = await fetch(`/api/creator/campaigns/${campaignId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_id: userId, participation_type: participationType }),
      });
      if (res.ok) {
        const p = await res.json();
        setParticipations((prev) => [...prev, p]);
        // 배포(풀): 분배받은 영상을 즉시 클라이언트 상태에 반영
        if (p.assigned_video) {
          const v = p.assigned_video;
          setAssignedVideos((prev) => ({
            ...prev,
            [p.id]: { id: v.id, url: v.video_url, file_data: v.file_data, file_name: v.file_name, status: v.status },
          }));
          showToast("배포 영상이 분배되었습니다! 영상을 퍼가 배포를 진행하세요.");
        } else {
          showToast(`${participationTypeLabel(participationType)} 신청했습니다!`);
        }
      } else {
        const err = await res.json();
        showToast(err.error ?? "오류가 발생했습니다");
      }
    });
  }

  async function handleVideoSubmit(campaignId: string) {
    if (!videoUrl.trim()) { showToast("영상 URL을 입력해주세요"); return; }
    startTransition(async () => {
      const res = await fetch(`/api/creator/campaigns/${campaignId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator_id: userId,
          type: "video",
          video_url: videoUrl,
          note: videoNote,
          ...(videoFile ? { video_file_data: videoFile.data, video_file_name: videoFile.name, video_file_type: videoFile.type } : {}),
        }),
      });
      if (res.ok) {
        const p = await res.json();
        setParticipations((prev) => prev.map((x) => x.id === p.id ? p : x));
        setVideoUrl(""); setVideoNote(""); setVideoFile(null);
        showToast("영상을 제출했습니다!");
      } else {
        const err = await res.json();
        showToast(err.error ?? "오류가 발생했습니다");
      }
    });
  }

  async function handleDeploySubmit(campaignId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/creator/campaigns/${campaignId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_id: userId, type: "deploy", deploy_link: deployLink, note: deployNote }),
      });
      if (res.ok) {
        const p = await res.json();
        setParticipations((prev) => prev.map((x) => x.id === p.id ? p : x));
        setDeployLink(""); setDeployNote("");
        showToast("배포 승인을 요청했습니다!");
      } else {
        const err = await res.json();
        showToast(err.error ?? "오류가 발생했습니다");
      }
    });
  }

  // ─── 캠페인 카드 (available 탭) ──────────────────────────────────────────

  function AvailableCampaignCard({ entry }: { entry: AvailableEntry }) {
    const { campaign: c, participationType } = entry;
    const currentCount = participationCounts[c.id] ?? 0;
    const limit = c.participation_limit;
    const isFull = limit != null && currentCount >= limit;

    return (
      <div
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setSelectedEntry({ campaignId: c.id, participationType })}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <SourceBadge sourceType={c.source_type} />
              {slotBadge(c.campaign_type === "story_creation", participationType)}
              {isFull && (
                <span className="inline-flex items-center rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-bold text-white">
                  참여마감
                </span>
              )}
            </div>
            <h3 className="font-bold text-gray-900 truncate">{c.title}</h3>
            <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{c.description}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
              <span>{CAMPAIGN_TYPE_LABELS[c.campaign_type]}</span>
              <span>·</span>
              <span>{c.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}</span>
              {participationType === "deploy" && c.distribution_count > 0 && (
                <><span>·</span><span>배포 {c.distribution_count}건</span></>
              )}
              {participationType === "video_production" && (c.video_production_count ?? 0) > 0 && (
                <><span>·</span><span>영상제작 {c.video_production_count}건</span></>
              )}
            </div>
            {limit != null && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-600">참여가능 인원 <span className="text-amber-600">{limit}명</span></span>
                  <span className="text-xs text-gray-500">현재 <span className="font-semibold text-gray-800">{currentCount}</span>명 참여</span>
                </div>
                <div className="w-full rounded-full bg-gray-100 h-2.5 overflow-hidden">
                  <div
                    className={[
                      "h-2.5 rounded-full transition-all",
                      isFull ? "bg-gray-500" : "bg-gradient-to-r from-amber-400 to-amber-500",
                    ].join(" ")}
                    style={{ width: `${Math.min(100, Math.round((currentCount / limit) * 100))}%` }}
                  />
                </div>
                <div className="mt-0.5 text-right text-[10px] text-gray-400">
                  {isFull ? "마감" : `${limit - currentCount}명 남음`}
                </div>
              </div>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-gray-400">건당 예상 수익</div>
            <div className="text-sm font-bold text-amber-600">
              {formatKRW(rewardFor(c.id, participationType))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          {isFull ? (
            <span className="rounded-xl bg-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-500 cursor-not-allowed">
              참여마감
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); handleJoin(c.id, participationType); }}
              disabled={isPending}
              className="rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {slotLabel(c.campaign_type === "story_creation", participationType)} 신청
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── 내 참여 카드 (my 탭) ────────────────────────────────────────────────

  function MyParticipationCard({ participation, campaign: c }: { participation: CampaignParticipation; campaign: AdCampaign }) {
    const ptype = participation.participation_type ?? "deploy";
    const step = participationStep(participation.status);
    const isRejected = participation.status === "video_rejected" || participation.status === "deploy_rejected";

    const pId = participation.id;
    const myDMs = directMessages[pId] ?? [];
    const unreadDMs = myDMs.filter((m) => !m.read && m.from_role !== "creator").length;

    return (
      <div
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setSelectedEntry({ campaignId: c.id, participationType: ptype })}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <SourceBadge sourceType={c.source_type} />
              {slotBadge(c.campaign_type === "story_creation", ptype)}
              {isRejected && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
                  <XCircle size={11} strokeWidth={2} /> 반려됨
                </span>
              )}
              {unreadDMs > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">
                  <MessageSquare size={11} /> 새 메시지 {unreadDMs}
                </span>
              )}
            </div>
            <h3 className="font-bold text-gray-900 truncate">{c.title}</h3>
            <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{c.description}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
              <span>{CAMPAIGN_TYPE_LABELS[c.campaign_type]}</span>
              <span>·</span>
              <span>{c.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-gray-400">건당 예상 수익</div>
            <div className="text-sm font-bold text-amber-600">
              {formatKRW(rewardFor(c.id, ptype))}
            </div>
          </div>
        </div>
        <Stepper currentStep={step} rejected={isRejected} />
        {statusGuidance(participation.status) && (
          <div className={[
            "mt-2 rounded-lg px-3 py-1.5 text-xs font-medium",
            isRejected ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700",
          ].join(" ")}>
            {statusGuidance(participation.status)}
          </div>
        )}
      </div>
    );
  }

  // ─── 상세 모달 ───────────────────────────────────────────────────────────

  function Modal() {
    if (!selectedCampaign || !selectedEntry) return null;
    const c = selectedCampaign;
    const participation = selectedParticipation;
    const ptype = selectedEntry.participationType;
    const step = participation ? participationStep(participation.status) : -1;
    const isRejected = participation && (
      participation.status === "video_rejected" || participation.status === "deploy_rejected"
    );
    const myDMs = participation ? (directMessages[participation.id] ?? []) : [];

    const mySubmission = mySubmissions.find((s) => s.campaign_id === c.id);
    const submissionCmts = mySubmission ? (submissionComments[mySubmission.id] ?? []) : [];

    let kpiGoals: string[] = [];
    try { if (c.kpi_goals) kpiGoals = JSON.parse(c.kpi_goals); } catch { /* ignore */ }
    const brandSafety = [
      c.brand_no_competitor && "경쟁사 언급 금지",
      c.brand_no_adult && "성인 콘텐츠 금지",
      c.brand_no_violence && "폭력적 콘텐츠 금지",
      c.brand_no_politics && "정치적 콘텐츠 금지",
    ].filter(Boolean).join(", ");

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedEntry(null)}>
        <div
          className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-6 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <SourceBadge sourceType={c.source_type} />
                {slotBadge(c.campaign_type === "story_creation", ptype)}
              </div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">{c.title}</h2>
            </div>
            <button
              onClick={() => setSelectedEntry(null)}
              className="shrink-0 rounded-xl p-1.5 text-gray-400 hover:bg-gray-100"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="px-6 py-4 space-y-5">
            <div className="rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">건당 예상 수익</span>
                <span className="font-semibold text-amber-600">
                  {formatKRW(rewardFor(c.id, ptype))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">유형</span>
                <span className="font-medium text-gray-800">{CAMPAIGN_TYPE_LABELS[c.campaign_type]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">플랫폼</span>
                <span className="font-medium text-gray-800">{c.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}</span>
              </div>
              {ptype === "deploy" && c.distribution_count > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">배포 건수</span>
                  <span className="font-medium text-gray-800">{c.distribution_count}건</span>
                </div>
              )}
              {ptype === "video_production" && (c.video_production_count ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">영상제작 건수</span>
                  <span className="font-medium text-gray-800">{c.video_production_count}건</span>
                </div>
              )}
              {c.participation_limit && (
                <div className="flex justify-between">
                  <span className="text-gray-500">참여 제한</span>
                  <span className="font-medium text-gray-800">최대 {c.participation_limit}명</span>
                </div>
              )}
            </div>

            {/* 동화 제작 프롬프트 (AI스토리) — 참여 전/후 모두 표시 */}
            {c.story_brief && (
              <div className="rounded-xl border-2 border-pink-200 bg-pink-50/50">
                <div className="flex items-center gap-2 border-b border-pink-100 px-4 py-2.5">
                  <span className="text-sm font-bold text-pink-700">동화 제작 프롬프트</span>
                  <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-600">AI스토리</span>
                </div>
                <div className="space-y-1.5 px-4 py-3 text-sm">
                  <DetailRow label="주인공(아이)" value={`${c.story_brief.child_name} · 만 ${c.story_brief.child_age}세`} />
                  <DetailRow label="대상 연령" value={c.story_brief.target_age_range} />
                  <DetailRow label="동화 테마" value={c.story_brief.story_theme} />
                  <DetailRow label="줄거리/요청" value={c.story_brief.story_note} />
                  <DetailRow label="그림 스타일" value={c.story_brief.art_style} />
                  <DetailRow label="톤/분위기" value={c.story_brief.tone} />
                  <DetailRow label="페이지 수" value={c.story_brief.page_count ? `${c.story_brief.page_count}장` : undefined} />
                  <DetailRow label="등장 캐릭터" value={c.story_brief.key_characters} />
                  <DetailRow label="교훈/메시지" value={c.story_brief.moral_lesson} />
                  <DetailRow label="언어" value={c.story_brief.language} />
                  <DetailRow label="스타일 요구사항" value={c.story_brief.style_requirements} />
                  <DetailRow label="의뢰자" value={c.story_brief.requester_name} />
                  <DetailRow label="목소리(내레이션)" value={c.story_brief.voice_label} />
                  <DetailRow
                    label="목소리 파일"
                    value={c.story_brief.voice_file_url
                      ? <a href={c.story_brief.voice_file_url} target="_blank" rel="noreferrer" className="text-brand-purple underline break-all">{c.story_brief.voice_file_name ?? "목소리 파일 듣기/다운로드"}</a>
                      : undefined}
                  />
                  <DetailRow
                    label="아이 사진"
                    value={c.story_brief.child_photo_url ? <a href={c.story_brief.child_photo_url} target="_blank" rel="noreferrer" className="text-brand-purple underline break-all">사진 보기</a> : undefined}
                  />
                  {(c.story_brief.reference_image_urls?.length ?? 0) > 0 && (
                    <DetailRow
                      label="참고 이미지"
                      value={c.story_brief.reference_image_urls!.map((u, i) => (
                        <a key={i} href={u} target="_blank" rel="noreferrer" className="mr-2 text-brand-purple underline break-all">이미지{i + 1}</a>
                      ))}
                    />
                  )}
                  {c.story_brief.voice_file_url && (
                    <audio controls src={c.story_brief.voice_file_url} className="mt-2 w-full">
                      브라우저가 오디오를 지원하지 않습니다.
                    </audio>
                  )}
                  <div className="mt-1 text-[11px] text-pink-600/80">※ 위 동화 제작 프롬프트(스타일·내용·목소리 파일 등)를 참고하여 참여 및 제작을 진행하세요. (AI스토리 연동 예정)</div>
                </div>
              </div>
            )}

            {/* 광고주 등록 캠페인 상세 — 영상 제작·배포에 필요한 모든 정보 */}
            <div className="rounded-xl border border-gray-200">
              <div className="border-b border-gray-100 px-4 py-2.5 text-sm font-bold text-gray-800">
                광고주 캠페인 상세 정보
              </div>
              <div className="space-y-4 px-4 py-3 text-sm">
                <div className="space-y-1.5">
                  <DetailRow label="브랜드명" value={c.brand_name} />
                  <DetailRow label="업종" value={c.industry} />
                  <DetailRow
                    label="웹사이트"
                    value={c.website_url ? <a href={c.website_url} target="_blank" rel="noreferrer" className="text-brand-purple underline break-all">{c.website_url}</a> : undefined}
                  />
                  <DetailRow label="캠페인 제목" value={c.title} />
                  <DetailRow label="유형" value={CAMPAIGN_TYPE_LABELS[c.campaign_type]} />
                  <DetailRow label="플랫폼" value={c.platforms.map((p) => PLATFORM_LABELS[p]).join(", ")} />
                  <DetailRow label="영상 길이" value={c.video_duration_tier ? (DURATION_LABELS[c.video_duration_tier] ?? c.video_duration_tier) : undefined} />
                  <DetailRow label="배포 건수" value={c.distribution_count > 0 ? `${c.distribution_count}건` : undefined} />
                  <DetailRow label="영상제작 건수" value={(c.video_production_count ?? 0) > 0 ? `${c.video_production_count}건` : undefined} />
                  <DetailRow label="시작 희망일" value={c.start_date} />
                  <DetailRow label="종료 희망일" value={c.end_date} />
                  <DetailRow label="타겟 키워드" value={c.target_keywords} />
                  <DetailRow
                    label="참고 링크"
                    value={c.reference_links ? <a href={c.reference_links} target="_blank" rel="noreferrer" className="text-brand-purple underline break-all">{c.reference_links}</a> : undefined}
                  />
                </div>

                {c.description && (
                  <div>
                    <div className="mb-1 text-gray-500">캠페인 설명</div>
                    <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{c.description}</p>
                  </div>
                )}

                {c.uploaded_video_url && (
                  <DetailRow
                    label="배포할 영상"
                    value={<a href={c.uploaded_video_url} target="_blank" rel="noreferrer" className="text-brand-purple underline break-all">{c.uploaded_video_url}</a>}
                  />
                )}

                {c.attachment_file_data && (
                  <div>
                    <div className="mb-1 text-gray-500">첨부파일</div>
                    <a
                      href={c.attachment_file_data}
                      download={c.attachment_file_name ?? "attachment"}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200"
                    >
                      ⬇ {c.attachment_file_name ?? "첨부파일 다운로드"}
                    </a>
                  </div>
                )}

                {(c.brief_product_name || c.brief_product_detail || c.brief_tone || c.brief_style ||
                  c.brief_target_audience || c.brief_key_messages || c.brief_avoid || c.brief_hashtags ||
                  c.brief_youtube_category || c.brief_instagram_category || c.brief_tiktok_category || c.brief_facebook_category) && (
                  <div className="space-y-1.5 rounded-xl bg-purple-50 p-3">
                    <div className="text-xs font-bold text-purple-700">영상 제작 브리프</div>
                    <DetailRow label="제품/서비스명" value={c.brief_product_name} />
                    <DetailRow label="상세 설명" value={c.brief_product_detail} />
                    <DetailRow label="톤앤매너" value={c.brief_tone} />
                    <DetailRow label="영상 스타일" value={c.brief_style} />
                    <DetailRow label="타겟 소비자층" value={c.brief_target_audience} />
                    <DetailRow label="핵심 메시지" value={c.brief_key_messages} />
                    <DetailRow label="금지 사항" value={c.brief_avoid ? <span className="text-red-600">{c.brief_avoid}</span> : undefined} />
                    <DetailRow label="해시태그" value={c.brief_hashtags} />
                    <DetailRow label="YouTube 카테고리" value={c.brief_youtube_category} />
                    <DetailRow label="Instagram 카테고리" value={c.brief_instagram_category} />
                    <DetailRow label="TikTok 카테고리" value={c.brief_tiktok_category} />
                    <DetailRow label="Facebook 카테고리" value={c.brief_facebook_category} />
                  </div>
                )}

                {(c.creator_min_followers || c.creator_gender || c.creator_age_group || c.creator_requirements) && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-gray-600">크리에이터 자격</div>
                    <DetailRow label="최소 팔로워" value={c.creator_min_followers ? (FOLLOWER_LABELS[c.creator_min_followers] ?? c.creator_min_followers) : undefined} />
                    <DetailRow label="선호 성별" value={c.creator_gender ? (GENDER_LABELS[c.creator_gender] ?? c.creator_gender) : undefined} />
                    <DetailRow label="선호 연령대" value={c.creator_age_group ? (AGE_LABELS[c.creator_age_group] ?? c.creator_age_group) : undefined} />
                    <DetailRow label="추가 요구사항" value={c.creator_requirements} />
                  </div>
                )}

                {(c.utm_link || c.promo_code || kpiGoals.length > 0) && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-gray-600">성과 추적 요청</div>
                    <DetailRow label="UTM 링크" value={c.utm_link} />
                    <DetailRow label="할인 코드" value={c.promo_code} />
                    <DetailRow label="목표 KPI" value={kpiGoals.length > 0 ? kpiGoals.join(", ") : undefined} />
                  </div>
                )}

                {(c.brand_forbidden_words || brandSafety) && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-gray-600">브랜드 세이프티</div>
                    <DetailRow label="금지 단어" value={c.brand_forbidden_words} />
                    <DetailRow label="제한 사항" value={brandSafety || undefined} />
                  </div>
                )}
              </div>
            </div>

            {participation && (
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-1">내 진행 상황</div>
                <div className={[
                  "rounded-xl border px-4 py-2 text-sm font-medium",
                  isRejected ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700",
                ].join(" ")}>
                  {statusLabel(participation.status)}
                </div>
                <Stepper currentStep={step} rejected={!!isRejected} />
                {statusGuidance(participation.status) && (
                  <div className={[
                    "mt-2 rounded-lg px-3 py-1.5 text-xs font-medium",
                    isRejected ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700",
                  ].join(" ")}>
                    {statusGuidance(participation.status)}
                  </div>
                )}
                {participation.rejection_reason && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="text-xs font-semibold text-red-700 mb-1">반려 사유</div>
                    <p className="text-sm text-red-700">{participation.rejection_reason}</p>
                  </div>
                )}
              </div>
            )}

            {participation && ptype === "video_production" && (participation.status === "accepted" || participation.status === "video_rejected") && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="text-sm font-semibold text-amber-800">영상 제출하기</div>
                <input
                  type="url"
                  placeholder="영상 URL (YouTube, Drive 등)"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <div>
                  <label className="text-xs font-medium text-amber-700 mb-1 block">영상 원본 파일 첨부 (선택)</label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setVideoFile({ data: reader.result as string, name: file.name, type: file.type });
                      };
                      reader.readAsDataURL(file);
                    }}
                    className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs text-gray-600 focus:outline-none"
                  />
                  {videoFile && <p className="mt-1 text-[10px] text-amber-700">첨부됨: {videoFile.name}</p>}
                </div>
                <textarea
                  placeholder="영상 설명 (선택)"
                  value={videoNote}
                  onChange={(e) => setVideoNote(e.target.value)}
                  className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[60px] resize-none"
                />
                <button
                  onClick={() => handleVideoSubmit(c.id)}
                  disabled={isPending}
                  className="w-full rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  영상 제출하기
                </button>
              </div>
            )}

            {ptype === "deploy" && participation && (() => {
              // 분배받은 영상(나에게 배타 분배된 1개). 풀 캠페인은 분배 영상, 레거시는 공유 영상.
              const assigned = assignedVideos[participation.id];
              const isPoolCampaign = distributionInfo[c.id]?.pool;
              const videoSrc = assigned
                ? (assigned.url || assigned.file_data)
                : (isPoolCampaign ? null : c.uploaded_video_url);
              if (!videoSrc) return null;
              const downloaded = assigned?.status === "downloaded" || assigned?.status === "distributed";
              const markDownloaded = () => {
                fetch(`/api/creator/campaigns/${c.id}/download`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ creator_id: userId, participation_id: participation.id }),
                }).catch(() => {});
              };
              return (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-amber-800">📥 배포할 영상 — 퍼가서 내 채널에 올리세요</div>
                  {assigned && (
                    <span className={[
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      downloaded ? "bg-green-100 text-green-700" : "bg-amber-200 text-amber-800",
                    ].join(" ")}>
                      {assigned.status === "distributed" ? "배포완료" : downloaded ? "다운로드됨" : "내게 분배됨"}
                    </span>
                  )}
                </div>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video src={videoSrc} controls className="w-full max-h-72 rounded-lg bg-black" />
                <div className="flex flex-wrap gap-2">
                  <a
                    href={videoSrc}
                    target="_blank"
                    rel="noreferrer"
                    download={assigned?.file_name ?? ""}
                    onClick={markDownloaded}
                    className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
                  >
                    ⬇ 영상 다운로드(퍼가기)
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        navigator.clipboard.writeText(videoSrc || "");
                        showToast("영상 링크를 복사했습니다");
                      }
                    }}
                    className="rounded-lg border border-amber-400 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                  >
                    🔗 영상 링크 복사
                  </button>
                </div>
                <p className="text-xs text-amber-700">
                  이 영상은 회원님에게 배타적으로 분배된 영상입니다. 다운로드해 본인 SNS 채널에 업로드한 뒤, 아래에 게시물 링크를 제출하면 배포 수익이 지급됩니다.
                </p>
              </div>
              );
            })()}

            {participation && (
              participation.status === "video_approved" ||
              participation.status === "deploy_rejected" ||
              (ptype === "deploy" && participation.status === "accepted")
            ) && (
              <div className={[
                "rounded-xl border p-4 space-y-3",
                participation.status === "deploy_rejected"
                  ? "border-red-200 bg-red-50"
                  : "border-green-200 bg-green-50",
              ].join(" ")}>
                <div className={[
                  "text-sm font-semibold",
                  participation.status === "deploy_rejected" ? "text-red-800" : "text-green-800",
                ].join(" ")}>
                  {participation.status === "deploy_rejected" ? "배포 재제출" : "배포 링크 제출"}
                </div>
                {participation.status === "deploy_rejected" && participation.rejection_reason && (
                  <div className="rounded-lg bg-white border border-red-200 px-3 py-2 text-xs text-red-700">
                    <span className="font-semibold">반려 사유:</span> {participation.rejection_reason}
                  </div>
                )}
                <input
                  type="url"
                  placeholder="SNS 게시물 URL (배포 링크)"
                  value={deployLink}
                  onChange={(e) => setDeployLink(e.target.value)}
                  className={[
                    "w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2",
                    participation.status === "deploy_rejected"
                      ? "border-red-300 bg-white focus:ring-red-400"
                      : "border-green-300 bg-white focus:ring-green-400",
                  ].join(" ")}
                />
                <textarea
                  placeholder="메모 (선택)"
                  value={deployNote}
                  onChange={(e) => setDeployNote(e.target.value)}
                  className={[
                    "w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 min-h-[60px] resize-none",
                    participation.status === "deploy_rejected"
                      ? "border-red-300 bg-white focus:ring-red-400"
                      : "border-green-300 bg-white focus:ring-green-400",
                  ].join(" ")}
                />
                <button
                  onClick={() => handleDeploySubmit(c.id)}
                  disabled={isPending || !deployLink.trim()}
                  className={[
                    "w-full rounded-xl py-2 text-sm font-semibold text-white disabled:opacity-50",
                    participation.status === "deploy_rejected"
                      ? "bg-red-500 hover:bg-red-600"
                      : "bg-green-600 hover:bg-green-700",
                  ].join(" ")}
                >
                  {participation.status === "deploy_rejected" ? "배포 재제출하기" : "배포 승인 요청"}
                </button>
              </div>
            )}

            {participation?.status === "completed" && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                <div className="flex justify-center mb-1.5">
                  <PartyPopper size={28} className="text-green-600" strokeWidth={1.5} />
                </div>
                <div className="text-sm font-bold text-green-800">캠페인 완료!</div>
                <div className="mt-1 text-xs text-green-700">
                  수익이 지갑에 적립되었습니다.{" "}
                  <a href="/creator/wallet" className="underline font-semibold">
                    수익 확인하기 →
                  </a>
                </div>
              </div>
            )}

            {!participation && ["recruiting", "published", "in_progress", "active"].includes(c.status) && (
              <button
                onClick={() => handleJoin(c.id, ptype)}
                disabled={isPending}
                className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
              >
                {slotLabel(c.campaign_type === "story_creation", ptype)} 신청하기
              </button>
            )}

            {mySubmission && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-gray-700">내 제출물</div>
                  <SubmissionStatusBadge status={mySubmission.status} />
                </div>
                <p className="text-sm text-gray-600">{mySubmission.description}</p>
                {mySubmission.reject_reason && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="text-xs font-semibold text-red-700 mb-1">반려 사유</div>
                    <p className="text-sm text-red-700">{mySubmission.reject_reason}</p>
                  </div>
                )}
              </div>
            )}

            {participation && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-sm font-semibold text-gray-700">광고주와 채팅</div>
                  {myDMs.filter((m) => !m.read && m.from_role !== "creator").length > 0 && (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
                      {myDMs.filter((m) => !m.read && m.from_role !== "creator").length}
                    </span>
                  )}
                </div>
                <DirectMessageThread
                  participationId={participation.id}
                  campaignId={c.id}
                  creatorId={userId}
                  currentUserId={userId}
                  currentUserName={userName}
                  currentUserRole="creator"
                  initialMessages={myDMs}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── 렌더 ──────────────────────────────────────────────

  return (
    <div>
      {toast && (
        <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-6">
        {(["available", "my"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-all",
              tab === t
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800",
            ].join(" ")}
          >
            {t === "available" ? "참여 가능한 캠페인" : "내 참여 캠페인"}
          </button>
        ))}
      </div>

      {/* 모달 */}
      <Modal />

      {/* 탭 콘텐츠 */}
      {tab === "available" ? (
        availableEntries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center">
            <p className="font-semibold text-gray-400">참여 가능한 캠페인이 없습니다</p>
            <p className="mt-1 text-sm text-gray-400">현재 모집 중인 캠페인이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {availableEntries.map((entry) => (
              <AvailableCampaignCard
                key={`${entry.campaign.id}-${entry.participationType}`}
                entry={entry}
              />
            ))}
          </div>
        )
      ) : (
        myParticipationItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 py-14 text-center">
            <p className="font-semibold text-gray-400">참여 중인 캠페인이 없습니다</p>
            <p className="mt-1 text-sm text-gray-400">캠페인에 신청하면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myParticipationItems.map(({ participation, campaign }) => (
              <MyParticipationCard
                key={participation.id}
                participation={participation}
                campaign={campaign}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
