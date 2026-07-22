"use client";

import { useState, useTransition } from "react";
import type { CampaignParticipation, CampaignDirectMessage } from "@/lib/schema";
import { DirectMessageThread } from "@/components/campaigns/direct-message-thread";
import { ParticipationCommentThread } from "@/components/campaigns/participation-comment-thread";

interface CreatorRow {
  participation: CampaignParticipation;
  creatorName: string;
  directMessages: CampaignDirectMessage[];
}

interface Props {
  campaignId: string;
  rows: CreatorRow[];
  advertiserId: string;
  advertiserName: string;
}

const STATUS_LABELS: Record<string, string> = {
  applied: "신청",
  video_submitted: "영상 제출됨",
  video_approved: "영상 승인",
  video_rejected: "영상 반려",
  deploy_submitted: "배포 요청",
  deploy_approved: "배포 승인",
  deploy_rejected: "배포 반려",
  completed: "완료",
};

function statusColor(status: string) {
  if (["video_approved", "deploy_approved", "completed"].includes(status)) return "text-green-700 bg-green-100";
  if (["video_rejected", "deploy_rejected"].includes(status)) return "text-red-700 bg-red-100";
  if (["video_submitted", "deploy_submitted"].includes(status)) return "text-amber-700 bg-amber-100";
  return "text-gray-600 bg-gray-100";
}

export function ParticipationReview({ campaignId, rows: initialRows, advertiserId, advertiserName }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [rejectModal, setRejectModal] = useState<{ creatorId: string; type: "video" | "deploy" } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expandedChat, setExpandedChat] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  async function review(creatorId: string, type: "video" | "deploy", action: "approve" | "reject", reason?: string) {
    startTransition(async () => {
      const res = await fetch(`/api/advertiser/campaigns/${campaignId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creator_id: creatorId, type, action, reason }),
      });
      if (res.ok) {
        const updated = await res.json();
        setRows((prev) =>
          prev.map((r) =>
            r.participation.creator_id === creatorId
              ? { ...r, participation: updated }
              : r
          )
        );
        showToast(action === "approve" ? "승인했습니다" : "반려했습니다");
      } else {
        showToast("오류가 발생했습니다");
      }
    });
  }

  function handleApprove(creatorId: string, type: "video" | "deploy") {
    review(creatorId, type, "approve");
  }

  function handleReject() {
    if (!rejectModal) return;
    review(rejectModal.creatorId, rejectModal.type, "reject", rejectReason);
    setRejectModal(null);
    setRejectReason("");
  }

  if (rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic">아직 참여 신청자가 없습니다.</p>
    );
  }

  return (
    <div>
      {toast && (
        <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="space-y-3">
        {rows.map(({ participation: p, creatorName, directMessages }) => {
          const unread = directMessages.filter((m) => !m.read && m.from_role === "creator").length;
          const isChatOpen = expandedChat === p.id;

          return (
            <div key={p.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm text-gray-800">{creatorName}</span>
                  <span className={["inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", statusColor(p.status)].join(" ")}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setExpandedChat(isChatOpen ? null : p.id)}
                    className={[
                      "relative rounded-lg border px-3 py-1 text-xs font-semibold transition-colors",
                      isChatOpen
                        ? "border-amber-400 bg-amber-50 text-amber-700"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    채팅하기
                    {unread > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                        {unread}
                      </span>
                    )}
                  </button>

                  {p.status === "video_submitted" && (
                    <>
                      {p.video_url && (
                        <a
                          href={p.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          영상 보기
                        </a>
                      )}
                      <button
                        onClick={() => handleApprove(p.creator_id, "video")}
                        disabled={isPending}
                        className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        영상 승인
                      </button>
                      <button
                        onClick={() => setRejectModal({ creatorId: p.creator_id, type: "video" })}
                        disabled={isPending}
                        className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        반려
                      </button>
                    </>
                  )}

                  {p.status === "deploy_submitted" && (
                    <>
                      <button
                        onClick={() => handleApprove(p.creator_id, "deploy")}
                        disabled={isPending}
                        className="rounded-lg bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        배포 승인 (완료)
                      </button>
                      <button
                        onClick={() => setRejectModal({ creatorId: p.creator_id, type: "deploy" })}
                        disabled={isPending}
                        className="rounded-lg border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        반려
                      </button>
                    </>
                  )}
                </div>
              </div>

              {p.video_note && (
                <p className="mt-1 text-xs text-gray-500">영상 메모: {p.video_note}</p>
              )}
              {p.deploy_note && (
                <p className="mt-1 text-xs text-gray-500">배포 메모: {p.deploy_note}</p>
              )}

              {p.rejection_reason && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">반려 사유</p>
                  <p className="text-xs text-red-700">{p.rejection_reason}</p>
                  <button
                    onClick={() => setExpandedComments(expandedComments === p.id ? null : p.id)}
                    className="mt-2 text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    {expandedComments === p.id ? "댓글 닫기 ▲" : "댓글로 소통하기 ▼"}
                  </button>
                  {expandedComments === p.id && (
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
                <p className="mt-1 text-xs text-green-600 font-semibold">
                  ✓ 배포 완료 — 크리에이터 수익이 지급되었습니다.
                </p>
              )}

              {isChatOpen && (
                <div className="mt-3 border-t border-amber-100 pt-3">
                  <div className="mb-2 text-xs font-semibold text-amber-800">
                    {creatorName}님과의 채팅
                  </div>
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
        })}
      </div>

      {rejectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => { setRejectModal(null); setRejectReason(""); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-gray-900 mb-1">반려 사유 입력</h3>
            <p className="text-sm text-gray-500 mb-4">
              크리에이터에게 전달될 반려 사유를 입력하세요.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 영상 품질이 기준 미달입니다. 다시 제출해주세요."
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 min-h-[100px] resize-none"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(""); }}
                className="flex-1 rounded-xl border border-gray-300 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={isPending}
                className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                반려하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
