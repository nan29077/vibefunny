"use client";

import { useState } from "react";
import type { CustomVideoRequest, CustomVideoApplication } from "@/lib/schema";
import { formatKRW } from "@/lib/money";
import { RequestDetailModal } from "@/components/requests/request-detail-modal";
import { IconClipboardList as ClipboardList, IconVideo as Video } from "@/components/icons";

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
  paid: "지급됨",
  assigned: "배정됨",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-yellow-100 text-yellow-700",
  completed: "bg-gray-200 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  revision_requested: "bg-orange-100 text-orange-700",
  approved: "bg-green-100 text-green-700",
  paid: "bg-emerald-100 text-emerald-700",
  assigned: "bg-indigo-100 text-indigo-700",
};

function DeadlineCountdown({ deadline }: { deadline: string }) {
  const now = new Date();
  const end = new Date(deadline);
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return <span className="inline-flex items-center rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-500">마감</span>;
  }
  if (diffDays <= 7) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
        D-{diffDays} 임박
      </span>
    );
  }
  return (
    <span className="text-[10px] text-gray-400">
      {end.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 마감
    </span>
  );
}

interface Props {
  openRequests: CustomVideoRequest[];
  myWork: CustomVideoRequest[];
  myApplied: CustomVideoApplication[];
  userId: string;
}

export function CreatorRequestsUI({ openRequests, myWork, myApplied, userId }: Props) {
  const [selectedRequest, setSelectedRequest] = useState<CustomVideoRequest | null>(null);
  const [tab, setTab] = useState<"available" | "my">("available");

  const allRequests = [...openRequests, ...myWork];

  // Deduplicate (myWork might overlap openRequests)
  const myWorkIds = new Set(myWork.map((r) => r.id));

  return (
    <div>
      {/* Tab */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-5">
        {(["available", "my"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-all",
              tab === t ? "bg-white text-amber-600 shadow-sm" : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            {t === "available"
              ? `참여 가능한 의뢰 (${openRequests.length})`
              : `내 작업 (${myWork.length})`}
          </button>
        ))}
      </div>

      {tab === "available" && (
        <>
          {openRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
              <ClipboardList size={32} className="mx-auto mb-2 opacity-40" strokeWidth={1.5} />
              <div className="font-semibold">참여 가능한 의뢰가 없습니다</div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {openRequests.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  userId={userId}
                  myApplied={myApplied}
                  onDetail={() => setSelectedRequest(r)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "my" && (
        <>
          {myWork.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-gray-400">
              <Video size={32} className="mx-auto mb-2 opacity-40" strokeWidth={1.5} />
              <div className="font-semibold">배정된 작업이 없습니다</div>
            </div>
          ) : (
            <div className="space-y-3">
              {myWork.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  userId={userId}
                  myApplied={myApplied}
                  onDetail={() => setSelectedRequest(r)}
                  isMyWork
                />
              ))}
            </div>
          )}
        </>
      )}

      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          userId={userId}
          isAssignedCreator={selectedRequest.assigned_creator_id === userId}
          onClose={() => setSelectedRequest(null)}
          onSubmitSuccess={() => {
            // Refresh: optimistically update status label shown
            setSelectedRequest(null);
          }}
        />
      )}
    </div>
  );
}

function RequestCard({
  request: r,
  userId,
  myApplied,
  onDetail,
  isMyWork,
}: {
  request: CustomVideoRequest;
  userId: string;
  myApplied: CustomVideoApplication[];
  onDetail: () => void;
  isMyWork?: boolean;
}) {
  const deadline = r.deadline ?? r.due_date;
  const maxC = r.max_creators;
  const curS = r.current_submissions ?? 0;
  const progress = maxC ? Math.min(100, Math.round((curS / maxC) * 100)) : 0;
  const statusLabel = STATUS_LABELS[r.status] ?? r.status;
  const statusColor = STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600";
  const hasApplied = myApplied.some((a) => a.request_id === r.id);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={["inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", statusColor].join(" ")}>
              {statusLabel}
            </span>
            <span className="text-xs text-gray-400">{PLATFORM_LABELS[r.platform]}</span>
            {deadline && <DeadlineCountdown deadline={deadline} />}
          </div>
          <h3 className="font-bold text-gray-900 leading-tight">{r.title}</h3>
        </div>
        <div className="text-right shrink-0">
          <div className="text-base font-bold text-amber-600">{formatKRW(r.budget)}</div>
          <div className="text-xs text-gray-400">{r.duration_seconds}초</div>
        </div>
      </div>

      {/* Requester info */}
      {r.requester_company && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs text-gray-500">의뢰자:</span>
          <span className="text-xs font-medium text-gray-700">{r.requester_company}</span>
          {r.requester_name && <span className="text-xs text-gray-400">({r.requester_name})</span>}
        </div>
      )}

      <p className="text-sm text-gray-500 line-clamp-2 mb-3">{r.requirements}</p>

      {/* Progress bar */}
      {maxC != null && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-gray-500">참여 현황</span>
            <span className="text-[10px] text-gray-400">{curS}/{maxC}명</span>
          </div>
          <div className="w-full rounded-full bg-gray-100 h-1.5 overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onDetail}
          className="flex-1 rounded-xl border border-gray-300 bg-white py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          상세보기
        </button>
        {isMyWork && ["in_progress", "revision_requested"].includes(r.status) && (
          <button
            onClick={onDetail}
            className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            결과물 제출
          </button>
        )}
        {!isMyWork && (
          <span className={[
            "flex-1 rounded-xl py-2 text-center text-sm font-semibold",
            hasApplied ? "bg-gray-100 text-gray-500 cursor-default" : "bg-gradient-to-r from-amber-400 to-amber-500 text-white",
          ].join(" ")}>
            {hasApplied ? "신청됨" : "신청 중"}
          </span>
        )}
      </div>
    </div>
  );
}
