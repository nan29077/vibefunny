import { getDb } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { Card, PageHeader, StatusBadge, EmptyState, Badge, Input } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatKRW } from "@/lib/money";
import { nameOf } from "@/lib/queries";
import { PLATFORM_LABELS } from "@/lib/schema";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/labels";
import {
  reviewCampaignAction,
  reviewCampaignProofAction,
  completeCampaignAction,
  adminCancelCampaignAction,
  reviewParticipationAction,
  resolveParticipationDisputeAction,
} from "@/lib/actions/campaign-actions";
import { AdminCampaignComments } from "@/components/campaigns/admin-campaign-comments";
import { safeHref } from "@/lib/url";
import { campaignProgress, consumedCampaignPoints, isCampaignActive, isPastDeadline } from "@/lib/campaign-workflow";
import Link from "next/link";
import type { AdCampaign, Database } from "@/lib/schema";

type TabKey = "review" | "active" | "closed" | "all";
const TABS: { key: TabKey; label: string }[] = [
  { key: "review", label: "검토 필요" },
  { key: "active", label: "진행 중" },
  { key: "closed", label: "종료" },
  { key: "all", label: "전체" },
];
const CLOSED = ["completed", "rejected", "cancelled", "refunded"];

/** 관리자 확인이 필요한 캠페인: 등록 검토 대기 또는 진행 중 검토 대기 작업·분쟁이 있는 캠페인 */
function needsReview(db: Database, c: AdCampaign): boolean {
  if (c.status === "admin_review") return true;
  if (!isCampaignActive(c)) return false;
  return campaignProgress(db, c).pendingReview > 0 ||
    (db.campaign_participations ?? []).some((p) => p.campaign_id === c.id && p.status === "applied");
}

/** 캠페인 소유자(광고주) 이름 — 탈퇴 등으로 계정이 없으면 "(알 수 없음)" */
function ownerName(db: Database, c: AdCampaign): string {
  const owner = db.profiles.find((p) => p.id === c.advertiser_id);
  if (owner) return owner.name;
  return "(알 수 없음)";
}

export const dynamic = "force-dynamic";

export default function AdminCampaignsPage({
  searchParams,
}: {
  searchParams?: { notice?: string; tone?: string; tab?: string; q?: string };
}) {
  const user = requireRole("admin");
  const notice = searchParams?.notice;
  const noticeIsError = searchParams?.tone === "error";
  const db = getDb();
  const sorted = [...db.ad_campaigns].sort((a, b) => {
    // 등록 검토 대기를 맨 위로, 그 다음 최신순
    const ra = a.status === "admin_review" ? 0 : 1;
    const rb = b.status === "admin_review" ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return a.created_at < b.created_at ? 1 : -1;
  });
  const counts: Record<TabKey, number> = {
    review: sorted.filter((c) => needsReview(db, c)).length,
    active: sorted.filter((c) => isCampaignActive(c)).length,
    closed: sorted.filter((c) => CLOSED.includes(c.status)).length,
    all: sorted.length,
  };
  const requestedTab = TABS.some((t) => t.key === searchParams?.tab) ? (searchParams?.tab as TabKey) : null;
  const tab: TabKey = requestedTab ?? (counts.review > 0 ? "review" : "active");
  const q = (searchParams?.q ?? "").trim().toLowerCase();
  const campaigns = sorted.filter((c) => {
    if (tab === "review" && !needsReview(db, c)) return false;
    if (tab === "active" && !isCampaignActive(c)) return false;
    if (tab === "closed" && !CLOSED.includes(c.status)) return false;
    if (q) {
      const hay = `${c.title} ${c.brand_name ?? ""} ${ownerName(db, c)}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const tabHref = (key: TabKey) => `/admin/campaigns?tab=${key}${q ? `&q=${encodeURIComponent(searchParams?.q ?? "")}` : ""}`;

  const commentsBycampaign: Record<string, import("@/lib/schema").CampaignComment[]> = {};
  for (const c of campaigns) {
    commentsBycampaign[c.id] = (db.campaign_comments ?? []).filter((cm) => cm.campaign_id === c.id);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="광고 캠페인 승인/노출 관리" description="캠페인 검토, 참여자/증빙 승인, 완료(정산) 처리" />
      {notice && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium ${noticeIsError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {notice}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1" aria-label="캠페인 상태">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              aria-current={tab === t.key ? "page" : undefined}
              className={`inline-flex min-h-[40px] items-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold ${tab === t.key ? "bg-white text-amber-700 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
            >
              {t.label} <span className="ml-1 text-xs text-gray-400">{counts[t.key]}</span>
            </Link>
          ))}
        </nav>
        <form action="/admin/campaigns" className="flex w-full gap-2 sm:w-auto">
          <input type="hidden" name="tab" value={tab} />
          <label htmlFor="campaign-search" className="sr-only">캠페인 검색</label>
          <input id="campaign-search" name="q" defaultValue={searchParams?.q ?? ""} placeholder="캠페인명·브랜드·광고주 검색" className="min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm sm:w-64" />
          <button type="submit" className="whitespace-nowrap rounded-xl bg-gray-900 px-4 text-sm font-semibold text-white">검색</button>
        </form>
      </div>
      {campaigns.length === 0 ? (
        <EmptyState title={q ? "검색 결과가 없습니다" : "해당하는 캠페인이 없습니다"} />
      ) : (
        campaigns.map((c) => {
          const apps = db.campaign_applications.filter((a) => a.campaign_id === c.id);
          const dels = db.campaign_deliveries.filter((d) => d.campaign_id === c.id);
          const initialComments = commentsBycampaign[c.id] ?? [];
          const pts = (db.campaign_participations ?? []).filter((x) => x.campaign_id === c.id);
          return (
            <Card key={c.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-gray-900">{c.title}</h3>
                    <StatusBadge status={c.status} />
                    {isCampaignActive(c) && isPastDeadline(c.end_date) && <Badge tone="yellow">마감됨</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {ownerName(db, c)} · {CAMPAIGN_TYPE_LABELS[c.campaign_type]}
                    {c.platforms.length > 0 && <> · {c.platforms.map((pl) => PLATFORM_LABELS[pl]).join(", ")}</>}
                    {c.distribution_count > 0 && <> · 배포 {c.distribution_count}건</>}
                    {c.platform_distributions && Object.keys(c.platform_distributions).length > 0 && (
                      <span className="ml-1 text-gray-400">
                        ({Object.entries(c.platform_distributions)
                          .filter(([, v]) => v > 0)
                          .map(([pl, v]) => `${PLATFORM_LABELS[pl as keyof typeof PLATFORM_LABELS]} ${v}건`)
                          .join(" / ")})
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">집행 금액</div>
                  <div className="text-lg font-bold text-brand-purple">{formatKRW(c.total_cost)}</div>
                </div>
              </div>

              {c.status === "admin_review" && (
                <form action={reviewCampaignAction} className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3">
                  <input type="hidden" name="id" value={c.id} />
                  <Input name="admin_memo" placeholder="관리자 메모 (선택)" className="max-w-xs" />
                  <button name="decision" value="publish" className="rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 py-2 text-sm font-semibold text-white">
                    승인 및 노출
                  </button>
                  <button name="decision" value="reject" className="rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white">
                    반려 (포인트 환불)
                  </button>
                </form>
              )}

              {apps.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-sm font-semibold text-gray-700">이전 방식 참여자 ({apps.length})</div>
                  <div className="space-y-1">
                    {apps.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                        <span>{nameOf(db, a.creator_id)} <StatusBadge status={a.status} /></span>
                        {a.status === "applied" && <span className="whitespace-nowrap text-xs text-gray-400">이전 방식 · 처리 불필요</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dels.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-sm font-semibold text-gray-700">이전 방식 제출 증빙 ({dels.length})</div>
                  <div className="space-y-1">
                    {dels.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                        <span className="truncate">
                          {nameOf(db, d.creator_id)} · {PLATFORM_LABELS[d.platform]} ·{" "}
                          <a href={safeHref(d.post_url)} target="_blank" rel="noreferrer" className="text-brand-purple underline">증빙링크</a>{" "}
                          <StatusBadge status={d.status} />
                          {d.reward_amount > 0 && <Badge tone="green">{formatKRW(d.reward_amount)}</Badge>}
                        </span>
                        {d.status === "submitted" && (
                          <div className="flex gap-1">
                            <form action={reviewCampaignProofAction}>
                              <input type="hidden" name="delivery_id" value={d.id} />
                              <input type="hidden" name="decision" value="approve" />
                              <SubmitButton size="sm">승인</SubmitButton>
                            </form>
                            <form action={reviewCampaignProofAction}>
                              <input type="hidden" name="delivery_id" value={d.id} />
                              <input type="hidden" name="decision" value="reject" />
                              <SubmitButton size="sm" variant="outline">반려</SubmitButton>
                            </form>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pts.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3">
                  <div className="mb-2 text-xs font-bold text-gray-500">참여자 검토</div>
                  <div className="space-y-2">
                    {pts.map((pt) => (
                      <div key={pt.id} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{nameOf(db, pt.creator_id)}</span>
                            <Badge tone={pt.participation_type === "deploy" ? "blue" : "purple"}>
                              {pt.participation_type === "deploy" ? `배포${pt.platform ? ` · ${PLATFORM_LABELS[pt.platform] ?? pt.platform}` : ""}` : "영상제작"}
                            </Badge>
                            <StatusBadge status={pt.status} />
                          </div>
                          {pt.status === "applied" && (
                            <div className="flex gap-1">
                              <form action={reviewParticipationAction}>
                                <input type="hidden" name="participation_id" value={pt.id} />
                                <input type="hidden" name="expected_status" value={pt.status} />
                                <input type="hidden" name="decision" value="approve" />
                                <SubmitButton size="sm">선발 승인</SubmitButton>
                              </form>
                              <form action={reviewParticipationAction}>
                                <input type="hidden" name="participation_id" value={pt.id} />
                                <input type="hidden" name="expected_status" value={pt.status} />
                                <input type="hidden" name="decision" value="reject" />
                                <SubmitButton size="sm" variant="outline">반려</SubmitButton>
                              </form>
                            </div>
                          )}
                          {["accepted", "video_rejected", "deploy_rejected"].includes(pt.status) && (
                            <form action={reviewParticipationAction}>
                              <input type="hidden" name="participation_id" value={pt.id} />
                              <input type="hidden" name="expected_status" value={pt.status} />
                              <input type="hidden" name="decision" value="reject" />
                              <input type="hidden" name="reason" value="관리자가 선발을 취소했습니다." />
                              <SubmitButton size="sm" variant="outline" confirmMessage="이 크리에이터의 선발을 취소하고 자리를 비울까요?">선발 취소</SubmitButton>
                            </form>
                          )}
                          {pt.status === "disputed" && (
                            <div className="flex gap-1">
                              {(["restore", "complete", "cancel"] as const).map((decision) => <form action={resolveParticipationDisputeAction} key={decision}>
                                <input type="hidden" name="participation_id" value={pt.id}/><input type="hidden" name="decision" value={decision}/>
                                <SubmitButton size="sm" variant={decision === "complete" ? undefined : "outline"}>{decision === "restore" ? "이전 상태 복원" : decision === "complete" ? "완료·정산" : "취소"}</SubmitButton>
                              </form>)}
                            </div>
                          )}
                        </div>
                        {pt.deploy_link && (
                          <a href={safeHref(pt.deploy_link)} target="_blank" rel="noreferrer" className="mt-1 text-xs text-brand-purple underline block">
                            배포 링크 확인
                          </a>
                        )}
                        {pt.video_url && (
                          <a href={safeHref(pt.video_url)} target="_blank" rel="noreferrer" className="mt-1 text-xs text-brand-purple underline block">
                            제출 영상 확인
                          </a>
                        )}
                        {(pt.status === "deploy_submitted" || pt.status === "video_submitted") && (
                          <div className="flex gap-1 mt-2">
                            <form action={reviewParticipationAction}>
                              <input type="hidden" name="participation_id" value={pt.id} />
                              <input type="hidden" name="expected_status" value={pt.status} />
                              <input type="hidden" name="decision" value="approve" />
                              <SubmitButton size="sm">승인</SubmitButton>
                            </form>
                            <form action={reviewParticipationAction}>
                              <input type="hidden" name="participation_id" value={pt.id} />
                              <input type="hidden" name="expected_status" value={pt.status} />
                              <input type="hidden" name="decision" value="reject" />
                              <SubmitButton size="sm" variant="outline">반려</SubmitButton>
                            </form>
                          </div>
                        )}
                        {pt.status === "video_approved" && (
                          <div className="mt-2">
                            <form action={reviewParticipationAction}>
                              <input type="hidden" name="participation_id" value={pt.id} />
                              <input type="hidden" name="expected_status" value={pt.status} />
                              <input type="hidden" name="decision" value="approve" />
                              <SubmitButton size="sm">완료 처리 (수익 지급)</SubmitButton>
                            </form>
                          </div>
                        )}
                        {pt.rejection_reason && (pt.status === "deploy_rejected" || pt.status === "video_rejected") && (
                          <p className="mt-1 text-xs text-red-600">반려 사유: {pt.rejection_reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {c.admin_memo && (
                <p className="mt-2 text-xs text-gray-500">관리자 메모: {c.admin_memo}</p>
              )}

              {isCampaignActive(c) && (() => {
                const prog = campaignProgress(db, c);
                const consumed = consumedCampaignPoints(db, c);
                return (
                  <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
                    <div className="text-gray-600">
                      진행 현황 · 영상 제작 {prog.completedVideos}/{prog.videoTarget} · 배포 {prog.completedDeploys}/{prog.deployTarget}
                      {prog.pendingReview > 0 && <span className="ml-2 text-yellow-700">검토 대기 {prog.pendingReview}건</span>}
                    </div>
                    {c.point_spent > 0 ? (
                    <>
                    <div className="mt-1 text-xs text-gray-500">
                      지금 완료 처리 시: 집행 {formatKRW(consumed)} · 미집행분 {formatKRW(Math.max(0, c.point_spent - consumed))} 환불
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <form action={completeCampaignAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <SubmitButton size="sm" variant="secondary" confirmMessage={`캠페인을 완료 처리할까요?\n집행 ${formatKRW(consumed)} · 미집행분 ${formatKRW(Math.max(0, c.point_spent - consumed))}은 광고주에게 환불됩니다.`}>캠페인 완료(정산) 처리</SubmitButton>
                      </form>
                      {prog.completedVideos + prog.completedDeploys === 0 && prog.pendingReview === 0 && (
                        <form action={adminCancelCampaignAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <SubmitButton size="sm" variant="outline" confirmMessage="캠페인을 취소하고 사용 포인트를 전액 환불할까요?">캠페인 취소 (전액 환불)</SubmitButton>
                        </form>
                      )}
                    </div>
                    </>
                    ) : (
                      <div className="mt-1 text-xs text-gray-500">포인트 결제가 없는 캠페인이라 정산·환불할 금액이 없습니다.</div>
                    )}
                  </div>
                );
              })()}

              <div className="mt-4 border-t border-gray-100 pt-4">
                <AdminCampaignComments
                  campaignId={c.id}
                  initialComments={initialComments}
                  authorId={user.id}
                  authorName={user.name}
                />
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
