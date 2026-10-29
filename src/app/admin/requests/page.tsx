import { getDb } from "@/lib/db";
import { PageHeader, EmptyState, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatKRW } from "@/lib/money";
import { nameOf } from "@/lib/queries";
import { PLATFORM_LABELS } from "@/lib/schema";
import { reviewDeliveryAction, acceptApplicationAction, cancelRequestAction } from "@/lib/actions/request-actions";
import { requireAdmin } from "@/lib/auth";
import { safeHref } from "@/lib/url";

export const dynamic = "force-dynamic";

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
  payment_pending: "결제 대기",
  refunded: "환불됨",
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  in_progress: "bg-blue-100 text-blue-700",
  submitted: "bg-yellow-100 text-yellow-700",
  completed: "bg-gray-200 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
  revision_requested: "bg-orange-100 text-orange-700",
  approved: "bg-emerald-100 text-emerald-700",
};

function DeadlineCountdown({ deadline }: { deadline: string }) {
  const now = new Date();
  const end = new Date(deadline);
  const diffMs = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return <span className="text-xs text-red-500 font-semibold">마감됨</span>;
  if (diffDays <= 7) {
    return <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">D-{diffDays} 임박</span>;
  }
  return <span className="text-xs text-gray-500">{end.toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 마감</span>;
}

export default function AdminRequestsPage() {
  requireAdmin();
  const db = getDb();
  const requests = [...db.custom_video_requests].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return (
    <div className="space-y-4">
      <PageHeader title="제작 의뢰 관리" description="영상 제작 의뢰 진행 현황, 크리에이터 제출물 검수" />
      {requests.length === 0 ? (
        <EmptyState title="제작 의뢰가 없습니다" />
      ) : (
        requests.map((r) => {
          const deliveries = db.custom_video_deliveries.filter((d) => d.request_id === r.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
          const deadline = r.deadline ?? r.due_date;
          const statusColor = STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-600";
          const statusLabel = STATUS_LABELS[r.status] ?? r.status;
          const maxC = r.max_creators;
          const curS = r.current_submissions ?? 0;
          const applications = db.custom_video_applications.filter((a) => a.request_id === r.id);
          const cancellable = ["payment_pending", "open", "assigned", "in_progress", "submitted", "revision_requested"].includes(r.status);

          return (
            <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={["inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", statusColor].join(" ")}>
                      {statusLabel}
                    </span>
                    <span className="text-xs text-gray-400">{PLATFORM_LABELS[r.platform]}</span>
                    {deadline && <DeadlineCountdown deadline={deadline} />}
                  </div>
                  <h3 className="font-bold text-gray-900">{r.title}</h3>
                  <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{r.requirements}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm text-gray-500">예산</div>
                  <div className="text-lg font-bold text-amber-600">{formatKRW(r.budget)}</div>
                </div>
              </div>

              {/* Info row */}
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <div className="flex gap-1.5">
                  <span className="text-gray-500">의뢰자</span>
                  <span className="font-medium text-gray-800">
                    {r.requester_company ?? nameOf(db, r.buyer_id)}
                    {r.requester_name && ` (${r.requester_name})`}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-gray-500">작업자</span>
                  <span className="font-medium text-gray-800">{nameOf(db, r.assigned_creator_id)}</span>
                </div>
                {maxC != null && (
                  <div className="flex gap-1.5">
                    <span className="text-gray-500">진행</span>
                    <span className="font-medium text-gray-800">{curS}/{maxC}명</span>
                  </div>
                )}
                {r.reference_url && (
                  <a href={safeHref(r.reference_url)} target="_blank" rel="noreferrer" className="text-blue-600 underline text-sm">
                    참고 자료
                  </a>
                )}
              </div>

              {/* Progress bar */}
              {maxC != null && (
                <div className="mt-3">
                  <div className="w-full rounded-full bg-gray-100 h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 transition-all"
                      style={{ width: `${Math.min(100, Math.round((curS / maxC) * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 참여 신청자 (모집중일 때 작업자 선정) */}
              {applications.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <div className="mb-2 text-sm font-semibold text-gray-700">참여 신청 ({applications.length})</div>
                  <div className="space-y-2">
                    {applications.map((a) => (
                      <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{nameOf(db, a.creator_id)}</span>
                            <span className="whitespace-nowrap rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                              {{ applied: "신청", accepted: "선정", rejected: "미선정", cancelled: "취소" }[a.status] ?? a.status}
                            </span>
                            <span className="text-xs text-gray-500">제안가 {formatKRW(a.proposed_price ?? r.budget)}</span>
                          </div>
                          {a.proposal_message && <p className="mt-0.5 text-xs text-gray-500">{a.proposal_message}</p>}
                        </div>
                        {r.status === "open" && a.status === "applied" && (
                          <form action={acceptApplicationAction}>
                            <input type="hidden" name="application_id" value={a.id} />
                            <SubmitButton size="sm">작업자로 선정</SubmitButton>
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deliveries */}
              {deliveries.length > 0 && (
                <div className="mt-4 border-t border-gray-100 pt-3">
                  <div className="mb-2 text-sm font-semibold text-gray-700">제출된 결과물 ({deliveries.length})</div>
                  <div className="space-y-2">
                    {deliveries.map((d) => (
                      <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-medium text-gray-800">{nameOf(db, d.creator_id)}</span>
                            <span className={["inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", STATUS_COLORS[d.status] ?? "bg-gray-100 text-gray-600"].join(" ")}>
                              {STATUS_LABELS[d.status] ?? d.status}
                            </span>
                          </div>
                          {d.video_url && (
                            <a href={safeHref(d.video_url)} target="_blank" rel="noreferrer" className="text-sm text-blue-600 underline truncate block max-w-xs">
                              {d.video_url.startsWith("/api/files/") || d.video_url.startsWith("/uploads/") ? "업로드된 파일 보기" : d.video_url}
                            </a>
                          )}
                          {d.message && <p className="text-xs text-gray-500 mt-0.5">{d.message}</p>}
                        </div>
                        {d.status === "submitted" && (
                          <div className="flex gap-1 shrink-0">
                            <form action={reviewDeliveryAction}>
                              <input type="hidden" name="delivery_id" value={d.id} />
                              <input type="hidden" name="decision" value="approve" />
                              <SubmitButton size="sm">승인</SubmitButton>
                            </form>
                            <form action={reviewDeliveryAction}>
                              <input type="hidden" name="delivery_id" value={d.id} />
                              <input type="hidden" name="decision" value="revision" />
                              <SubmitButton size="sm" variant="outline">수정요청</SubmitButton>
                            </form>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {cancellable && (
                <form action={cancelRequestAction} className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                  <input type="hidden" name="request_id" value={r.id} />
                  <label htmlFor={`cancel-reason-${r.id}`} className="sr-only">취소 사유</label>
                  <input id={`cancel-reason-${r.id}`} name="reason" aria-label="취소 사유" placeholder="취소 사유 (의뢰자에게 전달)" className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm" />
                  <SubmitButton size="sm" variant="outline" confirmMessage={r.payment_id ? `의뢰를 취소하고 결제액 ${r.budget.toLocaleString("ko-KR")}원을 환불 처리할까요?` : "의뢰를 취소할까요?"}>
                    {r.payment_id ? "의뢰 취소·환불" : "의뢰 취소"}
                  </SubmitButton>
                </form>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
