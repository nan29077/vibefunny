"use client";

import { useState, useRef, useTransition } from "react";
import type { CustomVideoRequest } from "@/lib/schema";
import { formatKRW } from "@/lib/money";

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
  const now = new Date();
  const end = new Date(deadline);
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

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
  onClose: () => void;
  onSubmitSuccess?: () => void;
}

export function RequestDetailModal({
  request,
  userId,
  isAssignedCreator,
  onClose,
  onSubmitSuccess,
}: Props) {
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

  const canSubmit = isAssignedCreator && ["in_progress", "revision_requested"].includes(status);

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
        onSubmitSuccess?.();
        setTimeout(onClose, 1500);
      } else {
        showToast("제출 실패");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      {toast && (
        <div className="fixed top-4 left-1/2 z-[200] -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
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
            onClick={onClose}
            className="shrink-0 rounded-xl p-1.5 text-gray-400 hover:bg-gray-100"
          >
            X
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
                href={request.reference_url ?? request.reference_links ?? "#"}
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
                href={request.submitted_video_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
              >
                영상 보기 &rarr;
              </a>
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
                placeholder="영상 URL (YouTube, Google Drive 등)"
                value={videoFile ? "" : videoUrl}
                disabled={!!videoFile}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
              />

              <textarea
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
      </div>
    </div>
  );
}
