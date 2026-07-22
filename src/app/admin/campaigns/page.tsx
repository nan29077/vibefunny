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
  decideCampaignApplicationAction,
  reviewCampaignProofAction,
  completeCampaignAction,
  reviewParticipationAction,
} from "@/lib/actions/campaign-actions";
import { AdminCampaignComments } from "@/components/campaigns/admin-campaign-comments";

export const dynamic = "force-dynamic";

export default function AdminCampaignsPage() {
  const user = requireRole("admin");
  const db = getDb();
  const campaigns = [...db.ad_campaigns].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const commentsBycampaign: Record<string, import("@/lib/schema").CampaignComment[]> = {};
  for (const c of campaigns) {
    commentsBycampaign[c.id] = (db.campaign_comments ?? []).filter((cm) => cm.campaign_id === c.id);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="광고 캠페인 승인/노출 관리" description="캠페인 검토, 참여자/증빙 승인, 완료 처리" />
      {campaigns.length === 0 ? (
        <EmptyState title="캠페인이 없습니다" />
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{c.title}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {nameOf(db, c.advertiser_id)} · {CAMPAIGN_TYPE_LABELS[c.campaign_type]} ·{" "}
                    {c.platforms.map((pl) => PLATFORM_LABELS[pl]).join(", ")} · {c.distribution_count}건
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
                  <div className="mb-1 text-sm font-semibold text-gray-700">참여자 ({apps.length})</div>
                  <div className="space-y-1">
                    {apps.map((a) => (
                      <div key={a.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                        <span>{nameOf(db, a.creator_id)} <StatusBadge status={a.status} /></span>
                        {a.status === "applied" && (
                          <div className="flex gap-1">
                            <form action={decideCampaignApplicationAction}>
                              <input type="hidden" name="application_id" value={a.id} />
                              <input type="hidden" name="decision" value="approve" />
                              <SubmitButton size="sm">승인</SubmitButton>
                            </form>
                            <form action={decideCampaignApplicationAction}>
                              <input type="hidden" name="application_id" value={a.id} />
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

              {dels.length > 0 && (
                <div className="mt-3">
                  <div className="mb-1 text-sm font-semibold text-gray-700">제출된 증빙 ({dels.length})</div>
                  <div className="space-y-1">
                    {dels.map((d) => (
                      <div key={d.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm">
                        <span className="truncate">
                          {nameOf(db, d.creator_id)} · {PLATFORM_LABELS[d.platform]} ·{" "}
                          <a href={d.post_url} target="_blank" rel="noreferrer" className="text-brand-purple underline">증빙링크</a>{" "}
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
                              {pt.participation_type === "deploy" ? "배포" : "영상제작"}
                            </Badge>
                            <StatusBadge status={pt.status} />
                          </div>
                          {pt.status === "applied" && (
                            <div className="flex gap-1">
                              <form action={reviewParticipationAction}>
                                <input type="hidden" name="participation_id" value={pt.id} />
                                <input type="hidden" name="decision" value="approve" />
                                <SubmitButton size="sm">선발 승인</SubmitButton>
                              </form>
                              <form action={reviewParticipationAction}>
                                <input type="hidden" name="participation_id" value={pt.id} />
                                <input type="hidden" name="decision" value="reject" />
                                <SubmitButton size="sm" variant="outline">반려</SubmitButton>
                              </form>
                            </div>
                          )}
                        </div>
                        {pt.deploy_link && (
                          <a href={pt.deploy_link} target="_blank" rel="noreferrer" className="mt-1 text-xs text-brand-purple underline block">
                            배포 링크 확인
                          </a>
                        )}
                        {pt.video_url && (
                          <a href={pt.video_url} target="_blank" rel="noreferrer" className="mt-1 text-xs text-brand-purple underline block">
                            제출 영상 확인
                          </a>
                        )}
                        {(pt.status === "deploy_submitted" || pt.status === "video_submitted") && (
                          <div className="flex gap-1 mt-2">
                            <form action={reviewParticipationAction}>
                              <input type="hidden" name="participation_id" value={pt.id} />
                              <input type="hidden" name="decision" value="approve" />
                              <SubmitButton size="sm">승인</SubmitButton>
                            </form>
                            <form action={reviewParticipationAction}>
                              <input type="hidden" name="participation_id" value={pt.id} />
                              <input type="hidden" name="decision" value="reject" />
                              <SubmitButton size="sm" variant="outline">반려</SubmitButton>
                            </form>
                          </div>
                        )}
                        {pt.status === "video_approved" && (
                          <div className="mt-2">
                            <form action={reviewParticipationAction}>
                              <input type="hidden" name="participation_id" value={pt.id} />
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

              {["in_progress", "submitted", "recruiting"].includes(c.status) && (
                <form action={completeCampaignAction} className="mt-3">
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton size="sm" variant="secondary">캠페인 완료 처리</SubmitButton>
                </form>
              )}

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
