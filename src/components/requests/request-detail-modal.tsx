"use client";

import { daysUntilDeadline, deadlineEndMs } from "@/lib/date";
import { useNow } from "@/lib/use-now";
import { ModalShell } from "@/components/modal-shell";
import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyRequestAction } from "@/lib/actions/request-actions";
import type { CustomVideoRequest } from "@/lib/schema";
import { formatKRW } from "@/lib/money";
import { safeHref } from "@/lib/url";

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
};

const STATUS_LABELS: Record<string, string> = {
  open: "모집중",
  in_progress: "진행중",
  submitted: "제출됨",
  completed: "완료",
  cancelled: "취소",
  revision_requested: "수정 요청",
  approved: "승인됨",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-yellow-100 text-yellow-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  revision_requested: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
};

function DeadlineCountdown({ deadline }: { deadline: string }) {
  const now = useNow();
  const end = new Date(deadlineEndMs(deadline) ?? deadline);
  if (!now) return <span className="text-gray-700">{end.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</span>;
  const diffDays = daysUntilDeadline(deadline, now.getTime()) ?? 0;

  if (diffDays < 0) return <span className="text-red-600 font-semibold">마감됨</span>;
  if (diffDays <= 7) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        D-{diffDays} 마감임박
      </span>
    );
  }
  return (
    <span className="text-gray-700">
      {end.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} (D-{diffDays})
    </span>
  );
}

interface Props {
  request: CustomVideoRequest;
  userId: string;
  isAssignedCreator: boolean;
  /** 이미 참여 신청했는지 */
  hasApplied?: boolean;
  /** 바이브회원 여부 — 일반회원은 신청·제출 버튼을 보이지 않는다 */
  canAct?: boolean;
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

export function RequestDetailModal({
  request,
  userId,
  isAssignedCreator,
  hasApplied = false,
  canAct = true,
  onClose,
  onSubmitSuccess,
}: Props) {
  const router = useRouter();
  const [proposal, setProposal] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState(request.submitted_video_url ?? "");
  const [submitMessage, setSubmitMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const status = request.status;
  const statusLabel = STATUS_LABELS[status] ?? status;
  const statusColor = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600";
  const deadline = request.deadline ?? request.due_date;
  const maxC = request.max_creators;
  const curS = request.current_submissions ?? 0;
  const progress = maxC ? Math.min(100, Math.round((curS / maxC) * 100)) : 0;

  const canSubmit = canAct && isAssignedCreator && ["in_progress", "revision_requested"].includes(status);
  const nowTs = useNow();
  const pastDeadline = nowTs !== null && (daysUntilDeadline(deadline, nowTs.getTime()) ?? 0) < 0;
  const canApply = canAct && status === "open" && !hasApplied && request.buyer_id !== userId && !pastDeadline;

  async function handleApply() {
    const price = proposedPrice.trim() ? Math.floor(Number(proposedPrice)) : null;
    if (price !== null && (!Number.isFinite(price) || price < 1 || price > request.budget)) {
      showToast(`제안 금액은 1원 ~ ${request.budget.toLocaleString("ko-KR")}원 사이로 입력하세요`);
      return;
    }
    const fd = new FormData();
    fd.append("request_id", request.id);
    fd.append("proposal_message", proposal);
    if (price !== null) fd.append("proposed_price", String(price));
    startTransition(async () => {
      try {
        const res = await applyRequestAction(fd);
        if (!res.ok) { showToast(res.message); return; }
        showToast(res.message);
        router.refresh();
        setTimeout(onClose, 1200);
      } catch {
        showToast("신청에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleUploadAndSubmit() {
    let finalUrl = videoUrl;

    if (videoFile) {
      setUploading(true);
      const fd = new FormData();
      fd.append("file", videoFile);
      const res = await fetch("/api/creator/requests/upload", { method: "POST", body: fd });
      setUploading(false);
      if (!res.ok) { showToast("업로드 실패"); return; }
      const data = await res.json();
      finalUrl = data.url;
      setVideoUrl(finalUrl);
    }

    if (!finalUrl) { showToast("영상 파일 또는 URL을 입력해주세요"); return; }

    startTransition(async () => {
      const res = await fetch(`/api/creator/requests/${request.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_id: userId, video_url: finalUrl, message: submitMessage }),
      });
      if (res.ok) {
        showToast("결과물을 제출했습니다!");
        router.refresh();
        onSubmitSuccess?.();
        setTimeout(onClose, 1500);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        showToast(data.error ?? "제출에 실패했습니다");
      }
    });
  }

  return (
    <ModalShell
      onClose={onClose}
      label={request.title}
      panelClassName="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
      before={toast && (
        <div className="fixed top-4 left-1/2 z-[200] -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg" role="status">
          {toast}
        </div>
      )}
    >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white px-6 py-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={["inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", statusColor].join(" ")}>
                {statusLabel}
              </span>
              <span className="text-xs text-gray-400">{PLATFORM_LABELS[request.platform]}</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{request.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Info grid */}
          <div className="rounded-xl bg-gray-50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">예산/보상</span>
              <span className="font-bold text-amber-600">{formatKRW(request.budget)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">플랫폼</span>
              <span className="font-medium text-gray-800">{PLATFORM_LABELS[request.platform]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">영상 길이</span>
              <span className="font-medium text-gray-800">{request.duration_seconds}초 이내</span>
            </div>
            {deadline && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">마감일</span>
                <DeadlineCountdown deadline={deadline} />
              </div>
            )}
          </div>

          {/* 의뢰자 정보 */}
          {(request.requester_name || request.requester_company) && (
            <div className="rounded-xl border border-gray-200 p-4">
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">의뢰자 정보</div>
              <div className="text-sm space-y-1">
                {request.requester_name && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-16 shrink-0">담당자</span>
                    <span className="font-medium text-gray-800">{request.requester_name}</span>
                  </div>
                )}
                {request.requester_company && (
                  <div className="flex gap-2">
                    <span className="text-gray-500 w-16 shrink-0">회사</span>
                    <span className="font-medium text-gray-800">{request.requester_company}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 진행 현황 */}
          {maxC != null && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-600">진행 현황</span>
                <span className="text-xs text-gray-500">{curS}/{maxC}명 제출</span>
              </div>
              <div className="w-full rounded-full bg-gray-100 h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* 상세 내용 */}
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">의뢰 내용 상세</div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line rounded-xl bg-gray-50 p-4">
              {request.description ?? request.requirements}
            </div>
          </div>

          {/* 참고 자료 */}
          {(request.reference_url || request.reference_links) && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">참고 자료</div>
              <a
                href={safeHref(request.reference_url ?? request.reference_links ?? "#")}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 underline hover:text-blue-800 break-all"
              >
                {request.reference_url ?? request.reference_links}
              </a>
            </div>
          )}

          {/* 제출된 영상 (기존) */}
          {request.submitted_video_url && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">제출된 결과물</div>
              <a
                href={safeHref(request.submitted_video_url)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
              >
                영상 보기 &rarr;
              </a>
            </div>
          )}

          {/* 참여 신청 폼 */}
          {hasApplied && status === "open" && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              참여 신청을 완료했습니다. 작업자로 선정되면 알림으로 알려드립니다.
            </div>
          )}
          {canApply && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-sm font-semibold text-amber-800">이 의뢰에 참여 신청</div>
              <div>
                <label htmlFor="req-proposal" className="mb-1 block text-xs font-medium text-gray-600">제안 내용 (경력·작업 계획 등)</label>
                <textarea
                  id="req-proposal"
                  value={proposal}
                  maxLength={2000}
                  onChange={(e) => setProposal(e.target.value)}
                  className="min-h-[70px] w-full resize-none rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label htmlFor="req-price" className="mb-1 block text-xs font-medium text-gray-600">제안 금액 (선택, 원) · 비워 두면 예산 {formatKRW(request.budget)}</label>
                <input
                  id="req-price"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={request.budget}
                  value={proposedPrice}
                  onChange={(e) => setProposedPrice(e.target.value)}
                  className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <button
                type="button"
                onClick={handleApply}
                disabled={isPending}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {isPending ? "신청 중..." : "참여 신청하기"}
              </button>
            </div>
          )}

          {/* 결과물 제출 폼 */}
          {canSubmit && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="text-sm font-semibold text-amber-800">결과물 제출</div>

              {/* File upload */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  영상 파일 업로드 (mp4, mov, avi 등)
                </label>
                <div
                  className="flex items-center gap-3 cursor-pointer rounded-xl border-2 border-dashed border-amber-300 bg-white p-3 hover:border-amber-500 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) { setVideoFile(f); setVideoUrl(""); }
                    }}
                  />
                  {videoFile ? (
                    <span className="text-sm text-gray-700 truncate">{videoFile.name}</span>
                  ) : (
                    <span className="text-sm text-gray-400">클릭하여 영상 파일 선택</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400">
                <div className="flex-1 h-px bg-gray-200" />
                또는 URL 직접 입력
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <input
                type="url"
                aria-label="영상 URL"
                placeholder="영상 URL (YouTube, Google Drive 등)"
                value={videoFile ? "" : videoUrl}
                disabled={!!videoFile}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
              />

              <textarea
                aria-label="메모 또는 작업 설명"
                placeholder="메모 또는 작업 설명 (선택)"
                value={submitMessage}
                onChange={(e) => setSubmitMessage(e.target.value)}
                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[60px] resize-none"
              />

              <button
                onClick={handleUploadAndSubmit}
                disabled={isPending || uploading || (!videoFile && !videoUrl.trim())}
                className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "업로드 중..." : isPending ? "제출 중..." : "결과물 제출하기"}
              </button>
            </div>
          )}
        </div>
    </ModalShell>
  );
}
