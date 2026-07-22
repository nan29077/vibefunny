import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, PageHeader, StatusBadge, Badge, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { PLATFORM_LABELS } from "@/lib/schema";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/labels";
import { formatKRW } from "@/lib/money";
import { nameOf } from "@/lib/queries";
import {
  decideCampaignApplicationAction,
  reviewCampaignProofAction,
  reviewParticipationAction,
} from "@/lib/actions/campaign-actions";
import {
  IconSearch,
  IconMegaphone,
  IconUsers,
  IconClipboard,
  IconCheckCircle,
} from "@/components/icons";

export const dynamic = "force-dynamic";

function IcPenLine() {
  return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>;
}
function IcFilm() {
  return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>;
}
function IcXCircle() {
  return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>;
}

type CampaignStatusStep = { status: string; label: string; description: string; icon: string; };

function StatusIcon({ icon }: { icon: string }) {
  switch (icon) {
    case "draft": return <IcPenLine />;
    case "admin_review": return <IconSearch size={18} strokeWidth={1.75} />;
    case "published": return <IconMegaphone size={18} strokeWidth={1.75} />;
    case "recruiting": return <IconUsers size={18} strokeWidth={1.75} />;
    case "in_progress": return <IcFilm />;
    case "submitted": return <IconClipboard size={18} strokeWidth={1.75} />;
    case "completed": return <IconCheckCircle size={18} strokeWidth={1.75} />;
    default: return null;
  }
}

const STATUS_TIMELINE: CampaignStatusStep[] = [
  { status: "draft", label: "초안", description: "캠페인 작성 중", icon: "draft" },
  { status: "admin_review", label: "검토 중", description: "관리자 검토 대기", icon: "admin_review" },
  { status: "published", label: "공개됨", description: "크리에이터에게 노출 중", icon: "published" },
  { status: "recruiting", label: "모집 중", description: "크리에이터 참여 신청 접수", icon: "recruiting" },
  { status: "in_progress", label: "진행 중", description: "크리에이터 콘텐츠 제작 중", icon: "in_progress" },
  { status: "submitted", label: "납품 검수", description: "크리에이터 납품물 검수 중", icon: "submitted" },
  { status: "completed", label: "완료", description: "캠페인 완료", icon: "completed" },
];

const REJECTED_STATUSES = ["rejected", "cancelled", "refunded"];
function getStatusIndex(status: string): number {
  return STATUS_TIMELINE.findIndex((s) => s.status === status);
}

export default function AdvertiserCampaignDetailPage({ params }: { params: { id: string } }) {
  const user = requireRole("advertiser");
  const db = getDb();
  const campaign = db.ad_campaigns.find((c) => c.id === params.id && c.advertiser_id === user.id);
  if (!campaign) notFound();

  const applications = db.campaign_applications.filter((a) => a.campaign_id === campaign.id);
  const deliveries = db.campaign_deliveries.filter((d) => d.campaign_id === campaign.id);
  const submissions = db.campaign_submissions.filter((s) => s.campaign_id === campaign.id);
  const allPts = (db.campaign_participations ?? []).filter((x) => x.campaign_id === campaign.id);
  const deployPts = allPts.filter((x) => x.participation_type === "deploy" || x.participation_type == null);
  const videoPts = allPts.filter((x) => x.participation_type === "video_production");

  const currentStatusIndex = getStatusIndex(campaign.status);
  const isRejected = REJECTED_STATUSES.includes(campaign.status);

  let kpiGoals: string[] = [];
  try { if (campaign.kpi_goals) kpiGoals = JSON.parse(campaign.kpi_goals); } catch { /* ignore */ }

  const followerLabels: Record<string, string> = {
    none: "상관없음", "10k": "1만+", "50k": "5만+", "100k": "10만+", "500k": "50만+", "1m": "100만+",
  };
  const genderLabels: Record<string, string> = { all: "전체", female: "여성", male: "남성" };
  const ageLabels: Record<string, string> = { all: "전체", teens: "10대", "20s": "20대", "30s": "30대", "40plus": "40대+" };

  return (
    <div className="space-y-4">
      <PageHeader
        title={campaign.title}
        description={`${campaign.brand_name ? campaign.brand_name + " · " : ""}${CAMPAIGN_TYPE_LABELS[campaign.campaign_type]}`}
      />

      <Card>
        <div className="font-semibold text-gray-800 mb-4">캠페인 진행 현황</div>
        {isRejected ? (
          <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3">
            <IcXCircle />
            <div>
              <div className="font-semibold text-red-700">
                {campaign.status === "rejected" ? "반려됨" : campaign.status === "cancelled" ? "취소됨" : "환불됨"}
              </div>
              {campaign.admin_memo && <p className="text-sm text-red-600 mt-0.5">사유: {campaign.admin_memo}</p>}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-max items-start gap-0">
              {STATUS_TIMELINE.map((step, i) => {
                const isDone = currentStatusIndex > i;
                const isActive = currentStatusIndex === i;
                return (
                  <div key={step.status} className="flex flex-col items-center">
                    <div className="flex w-full items-center">
                      {i > 0 && <div className={`h-0.5 w-10 ${isDone || isActive ? "bg-brand-purple" : "bg-gray-200"}`} />}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg transition-all ${isActive ? "bg-brand-purple shadow-md ring-4 ring-brand-purple/20" : isDone ? "bg-brand-purple/20" : "bg-gray-100"}`}>
                        <StatusIcon icon={step.icon} />
                      </div>
                      {i < STATUS_TIMELINE.length - 1 && <div className={`h-0.5 w-10 ${isDone ? "bg-brand-purple" : "bg-gray-200"}`} />}
                    </div>
                    <div className="mt-2 w-20 text-center">
                      <div className={`text-xs font-semibold ${isActive ? "text-brand-purple" : isDone ? "text-brand-purple/70" : "text-gray-400"}`}>{step.label}</div>
                      <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{step.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {campaign.admin_memo && !isRejected && (
          <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700">관리자 메모: {campaign.admin_memo}</div>
        )}
        <div className="mt-4 flex gap-4 text-sm">
          <div className="text-center">
            <div className="text-2xl font-bold text-brand-purple">{applications.length}</div>
            <div className="text-xs text-gray-500">신청 크리에이터</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{applications.filter((a) => a.status === "approved").length}</div>
            <div className="text-xs text-gray-500">승인 크리에이터</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{deliveries.length + submissions.length}</div>
            <div className="text-xs text-gray-500">납품 콘텐츠</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="font-semibold text-gray-800 mb-3">캠페인 정보</div>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          {campaign.brand_name && <div><span className="text-gray-500">브랜드명</span><div className="font-medium">{campaign.brand_name}</div></div>}
          {campaign.industry && <div><span className="text-gray-500">업종</span><div className="font-medium">{campaign.industry}</div></div>}
          <div><span className="text-gray-500">캠페인 유형</span><div className="font-medium">{CAMPAIGN_TYPE_LABELS[campaign.campaign_type]}</div></div>
          <div><span className="text-gray-500">플랫폼</span><div className="font-medium">{campaign.platforms.map((pl) => PLATFORM_LABELS[pl]).join(", ")}</div></div>
          <div><span className="text-gray-500">배포 건수</span><div className="font-medium">{campaign.distribution_count}건</div></div>
          <div><span className="text-gray-500">집행 금액</span><div className="font-bold text-brand-purple">{formatKRW(campaign.total_cost)}</div></div>
          {campaign.start_date && <div><span className="text-gray-500">시작 희망일</span><div className="font-medium">{campaign.start_date}</div></div>}
          {campaign.end_date && <div><span className="text-gray-500">종료 희망일</span><div className="font-medium">{campaign.end_date}</div></div>}
        </div>
        {campaign.description && (
          <div className="mt-3 text-sm"><span className="text-gray-500">설명</span><p className="mt-1 text-gray-700">{campaign.description}</p></div>
        )}
      </Card>

      {(campaign.creator_min_followers || campaign.creator_gender || campaign.creator_age_group) && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">크리에이터 자격 요건</div>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            {campaign.creator_min_followers && <div><span className="text-gray-500">최소 팔로워</span><div className="font-medium">{followerLabels[campaign.creator_min_followers] ?? campaign.creator_min_followers}</div></div>}
            {campaign.creator_gender && <div><span className="text-gray-500">선호 성별</span><div className="font-medium">{genderLabels[campaign.creator_gender] ?? campaign.creator_gender}</div></div>}
            {campaign.creator_age_group && <div><span className="text-gray-500">선호 연령대</span><div className="font-medium">{ageLabels[campaign.creator_age_group] ?? campaign.creator_age_group}</div></div>}
          </div>
          {campaign.creator_requirements && (
            <div className="mt-2 text-sm"><span className="text-gray-500">추가 요구사항</span><p className="mt-1 text-gray-700">{campaign.creator_requirements}</p></div>
          )}
        </Card>
      )}

      {(campaign.utm_link || campaign.promo_code || kpiGoals.length > 0) && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">성과 추적</div>
          <div className="space-y-2 text-sm">
            {campaign.utm_link && <div><span className="text-gray-500">UTM 링크</span><div className="font-medium break-all text-brand-purple">{campaign.utm_link}</div></div>}
            {campaign.promo_code && <div><span className="text-gray-500">할인코드</span><div className="font-mono font-bold text-lg text-brand-purple">{campaign.promo_code}</div></div>}
            {kpiGoals.length > 0 && (
              <div><span className="text-gray-500">목표 KPI</span><div className="mt-1 flex flex-wrap gap-1">{kpiGoals.map((k) => <Badge key={k} tone="purple">{k}</Badge>)}</div></div>
            )}
          </div>
        </Card>
      )}

      {applications.length > 0 && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">신청한 크리에이터 ({applications.length}명)</div>
          <div className="space-y-2">
            {applications.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{nameOf(db, a.creator_id)}</span>
                  <StatusBadge status={a.status} />
                </div>
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
        </Card>
      )}

      {deployPts.length > 0 && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">배포 참여자 ({deployPts.length}명)</div>
          <div className="space-y-2">
            {deployPts.map((pt) => (
              <div key={pt.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{nameOf(db, pt.creator_id)}</span>
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
                  {pt.status === "accepted" && <span className="text-xs text-gray-500">배포 링크 제출 대기 중</span>}
                </div>
                {pt.status === "deploy_submitted" && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">배포 링크:</span>
                      {pt.deploy_link
                        ? <a href={pt.deploy_link} target="_blank" rel="noreferrer" className="text-brand-purple underline font-medium break-all">게시물 확인하기</a>
                        : <span className="text-gray-400">링크 없음</span>
                      }
                    </div>
                    {pt.deploy_note && <p className="text-xs text-gray-500">{pt.deploy_note}</p>}
                    <div className="flex gap-1">
                      <form action={reviewParticipationAction}>
                        <input type="hidden" name="participation_id" value={pt.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <SubmitButton size="sm">배포 승인</SubmitButton>
                      </form>
                      <form action={reviewParticipationAction}>
                        <input type="hidden" name="participation_id" value={pt.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <SubmitButton size="sm" variant="outline">반려</SubmitButton>
                      </form>
                    </div>
                  </div>
                )}
                {pt.status === "deploy_rejected" && pt.rejection_reason && (
                  <p className="mt-1 text-xs text-red-600">반려 사유: {pt.rejection_reason}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {videoPts.length > 0 && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">영상제작 참여자 ({videoPts.length}명)</div>
          <div className="space-y-2">
            {videoPts.map((pt) => (
              <div key={pt.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{nameOf(db, pt.creator_id)}</span>
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
                  {pt.status === "accepted" && <span className="text-xs text-gray-500">영상 제출 대기 중</span>}
                </div>
                {pt.status === "video_submitted" && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">제출 영상:</span>
                      {pt.video_url
                        ? <a href={pt.video_url} target="_blank" rel="noreferrer" className="text-brand-purple underline font-medium break-all">영상 확인하기</a>
                        : <span className="text-gray-400">URL 없음</span>
                      }
                    </div>
                    {pt.video_note && <p className="text-xs text-gray-500">{pt.video_note}</p>}
                    <div className="flex gap-1">
                      <form action={reviewParticipationAction}>
                        <input type="hidden" name="participation_id" value={pt.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <SubmitButton size="sm">영상 승인</SubmitButton>
                      </form>
                      <form action={reviewParticipationAction}>
                        <input type="hidden" name="participation_id" value={pt.id} />
                        <input type="hidden" name="decision" value="reject" />
                        <SubmitButton size="sm" variant="outline">반려</SubmitButton>
                      </form>
                    </div>
                  </div>
                )}
                {pt.status === "video_approved" && (
                  <div className="mt-2 flex gap-1">
                    <form action={reviewParticipationAction}>
                      <input type="hidden" name="participation_id" value={pt.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <SubmitButton size="sm">완료 처리 (수익 지급)</SubmitButton>
                    </form>
                  </div>
                )}
                {pt.status === "video_rejected" && pt.rejection_reason && (
                  <p className="mt-1 text-xs text-red-600">반려 사유: {pt.rejection_reason}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {(deliveries.length > 0 || submissions.length > 0) && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">납품 콘텐츠 ({deliveries.length + submissions.length}건)</div>
          <div className="space-y-2">
            {deliveries.map((d) => (
              <div key={d.id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{nameOf(db, d.creator_id)}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-600">{PLATFORM_LABELS[d.platform]}</span>
                    <StatusBadge status={d.status} />
                  </div>
                  {d.post_url && (
                    <a href={d.post_url} target="_blank" rel="noreferrer" className="text-xs text-brand-purple underline">게시물 보기</a>
                  )}
                </div>
                {d.description && <p className="mt-1 text-xs text-gray-500">{d.description}</p>}
                {d.status === "submitted" && (
                  <div className="mt-2 flex gap-1">
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
        </Card>
      )}

      {deliveries.length === 0 && submissions.length === 0 && applications.length === 0 && allPts.length === 0 && (
        <EmptyState title="아직 활동이 없습니다" description="캠페인이 승인되면 크리에이터들이 참여 신청을 시작합니다." />
      )}
    </div>
  );
}
