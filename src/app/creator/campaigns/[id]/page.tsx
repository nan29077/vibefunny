import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { notFound } from "next/navigation";
import { Card, PageHeader, StatusBadge, Badge, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { PLATFORM_LABELS } from "@/lib/schema";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/labels";
import { formatKRW } from "@/lib/money";
import { creatorDeployPayout, creatorVideoPayout } from "@/lib/queries";
import {
  submitCampaignProofAction,
  joinParticipationAction as _joinParticipationAction,
  submitParticipationWorkAction as _submitParticipationWorkAction,
} from "@/lib/actions/campaign-actions";

async function joinParticipationAction(fd: FormData): Promise<void> { await _joinParticipationAction(fd); }
async function submitParticipationWorkAction(fd: FormData): Promise<void> { await _submitParticipationWorkAction(fd); }

export const dynamic = "force-dynamic";

export default function CreatorCampaignDetailPage({ params }: { params: { id: string } }) {
  const user = requireRole("creator");
  const db = getDb();

  const campaign = db.ad_campaigns.find((c) => c.id === params.id);
  if (!campaign) notFound();

  const myApplication = db.campaign_applications.find(
    (a) => a.campaign_id === campaign.id && a.creator_id === user.id
  );
  const myDeliveries = db.campaign_deliveries.filter(
    (d) => d.campaign_id === campaign.id && d.creator_id === user.id
  );
  const allMyPts = (db.campaign_participations ?? []).filter(
    (x) => x.campaign_id === campaign.id && x.creator_id === user.id
  );
  const myDeployPt = allMyPts.find((x) => x.participation_type === "deploy" || x.participation_type == null);
  const myVideoPt = allMyPts.find((x) => x.participation_type === "video_production");

  const isApproved = myApplication?.status === "approved";
  const canSubmit = isApproved && ["in_progress", "submitted"].includes(campaign.status);

  const followerLabels: Record<string, string> = {
    none: "상관없음", "10k": "1만+", "50k": "5만+", "100k": "10만+", "500k": "50만+", "1m": "100만+",
  };
  const genderLabels: Record<string, string> = { all: "전체", female: "여성", male: "남성" };
  const ageLabels: Record<string, string> = { all: "전체", teens: "10대", "20s": "20대", "30s": "30대", "40plus": "40대+" };

  let kpiGoals: string[] = [];
  try { if (campaign.kpi_goals) kpiGoals = JSON.parse(campaign.kpi_goals); } catch { /* ignore */ }

  return (
    <div className="space-y-4">
      <PageHeader
        title={campaign.title}
        description={`${CAMPAIGN_TYPE_LABELS[campaign.campaign_type]} · ${campaign.platforms.map((pl) => PLATFORM_LABELS[pl]).join(", ")}`}
      />

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusBadge status={campaign.status} />
              {campaign.brand_name && <Badge tone="blue">{campaign.brand_name}</Badge>}
              {campaign.industry && <Badge tone="gray">{campaign.industry}</Badge>}
            </div>
            {campaign.description && <p className="text-sm text-gray-600 mt-2">{campaign.description}</p>}
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">예상 보상</div>
            <div className="text-lg font-bold text-brand-purple">
              {formatKRW(
                (campaign.video_production_count ?? 0) > 0 && campaign.distribution_count === 0
                  ? creatorVideoPayout(db, campaign.video_duration_tier)
                  : creatorDeployPayout(db, campaign.platforms)
              )}
            </div>
            <div className="text-xs text-gray-400">/ 건</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <div><span className="text-gray-500">캠페인 유형</span><div className="font-medium">{CAMPAIGN_TYPE_LABELS[campaign.campaign_type]}</div></div>
          <div><span className="text-gray-500">플랫폼</span><div className="font-medium">{campaign.platforms.map((pl) => PLATFORM_LABELS[pl]).join(", ")}</div></div>
          <div><span className="text-gray-500">배포 건수</span><div className="font-medium">{campaign.distribution_count}건</div></div>
          {campaign.start_date && <div><span className="text-gray-500">시작 희망일</span><div className="font-medium">{campaign.start_date}</div></div>}
          {campaign.end_date && <div><span className="text-gray-500">종료 희망일</span><div className="font-medium">{campaign.end_date}</div></div>}
          {campaign.target_keywords && <div><span className="text-gray-500">타겟 키워드</span><div className="font-medium">{campaign.target_keywords}</div></div>}
        </div>
      </Card>

      {(campaign.creator_min_followers || campaign.creator_gender || campaign.creator_age_group || campaign.creator_requirements) && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">크리에이터 자격 요건</div>
          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            {campaign.creator_min_followers && <div><span className="text-gray-500">최소 팔로워</span><div className="font-medium">{followerLabels[campaign.creator_min_followers] ?? campaign.creator_min_followers}</div></div>}
            {campaign.creator_gender && <div><span className="text-gray-500">선호 성별</span><div className="font-medium">{genderLabels[campaign.creator_gender] ?? campaign.creator_gender}</div></div>}
            {campaign.creator_age_group && <div><span className="text-gray-500">선호 연령대</span><div className="font-medium">{ageLabels[campaign.creator_age_group] ?? campaign.creator_age_group}</div></div>}
          </div>
          {campaign.creator_requirements && (
            <div className="mt-3 text-sm"><span className="text-gray-500">추가 요구사항</span><p className="mt-1 text-gray-700">{campaign.creator_requirements}</p></div>
          )}
        </Card>
      )}

      {(campaign.brief_product_name || campaign.brief_product_detail || campaign.brief_tone) && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">영상 제작 브리프</div>
          <div className="space-y-3 text-sm">
            {campaign.brief_product_name && <div><span className="text-gray-500">제품/서비스명</span><div className="font-medium">{campaign.brief_product_name}</div></div>}
            {campaign.brief_product_detail && <div><span className="text-gray-500">상세 설명</span><p className="mt-1 text-gray-700 whitespace-pre-wrap">{campaign.brief_product_detail}</p></div>}
            <div className="grid gap-3 sm:grid-cols-2">
              {campaign.brief_tone && <div><span className="text-gray-500">톤앤매너</span><div className="font-medium">{campaign.brief_tone}</div></div>}
              {campaign.brief_style && <div><span className="text-gray-500">영상 스타일</span><div className="font-medium">{campaign.brief_style}</div></div>}
              {campaign.brief_target_audience && <div><span className="text-gray-500">타겟 소비자층</span><div className="font-medium">{campaign.brief_target_audience}</div></div>}
            </div>
            {campaign.brief_key_messages && <div><span className="text-gray-500">핵심 메시지</span><p className="mt-1 text-gray-700 whitespace-pre-wrap">{campaign.brief_key_messages}</p></div>}
            {campaign.brief_avoid && <div><span className="text-gray-500">금지 사항</span><p className="mt-1 text-red-600 whitespace-pre-wrap">{campaign.brief_avoid}</p></div>}
            {campaign.brief_hashtags && <div><span className="text-gray-500">해시태그</span><div className="font-medium">{campaign.brief_hashtags}</div></div>}
          </div>
        </Card>
      )}

      {(campaign.utm_link || campaign.promo_code || kpiGoals.length > 0) && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">성과 추적 요청</div>
          <div className="space-y-2 text-sm">
            {campaign.utm_link && <div><span className="text-gray-500">UTM 링크</span><div className="font-medium break-all text-brand-purple">{campaign.utm_link}</div></div>}
            {campaign.promo_code && <div><span className="text-gray-500">할인코드</span><div className="font-mono font-bold text-lg text-brand-purple">{campaign.promo_code}</div></div>}
            {kpiGoals.length > 0 && (
              <div><span className="text-gray-500">목표 KPI</span><div className="mt-1 flex flex-wrap gap-1">{kpiGoals.map((k) => <Badge key={k} tone="purple">{k}</Badge>)}</div></div>
            )}
          </div>
        </Card>
      )}

      {myApplication && (
        <Card>
          <div className="font-semibold text-gray-800 mb-2">내 참여 상태</div>
          <div className="flex items-center gap-2">
            <StatusBadge status={myApplication.status} />
            <span className="text-sm text-gray-600">
              {myApplication.status === "applied" && "신청이 접수되었습니다. 승인을 기다려 주세요."}
              {myApplication.status === "approved" && "승인되었습니다! 납품물을 제출해 주세요."}
              {myApplication.status === "rejected" && "이번 캠페인에는 선발되지 않았습니다."}
            </span>
          </div>
        </Card>
      )}

      {canSubmit && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">납품 제출</div>
          <form action={submitCampaignProofAction} className="space-y-4">
            <input type="hidden" name="campaign_id" value={campaign.id} />
            <Field label="플랫폼">
              <select name="platform" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-purple focus:outline-none">
                {campaign.platforms.map((pl) => (
                  <option key={pl} value={pl}>{PLATFORM_LABELS[pl]}</option>
                ))}
              </select>
            </Field>
            <Field label="게시물 URL" required>
              <Input name="post_url" placeholder="https://youtube.com/shorts/..." required />
            </Field>
            <Field label="설명 메시지">
              <Textarea name="description" placeholder="납품 관련 메모, 특이사항 등을 입력하세요." rows={3} />
            </Field>
            <SubmitButton>납품 제출</SubmitButton>
          </form>
        </Card>
      )}

      {myDeliveries.length > 0 && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">내 납품 내역 ({myDeliveries.length}건)</div>
          <div className="space-y-2">
            {myDeliveries.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{PLATFORM_LABELS[d.platform]}</span>
                  {d.post_url && <a href={d.post_url} target="_blank" rel="noreferrer" className="ml-2 text-brand-purple underline">게시물 보기</a>}
                  {d.description && <p className="mt-0.5 text-xs text-gray-500">{d.description}</p>}
                </div>
                <div className="text-right">
                  <StatusBadge status={d.status} />
                  {d.reward_amount > 0 && <div className="text-xs font-medium text-green-600">{formatKRW(d.reward_amount)}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {["recruiting", "published", "in_progress"].includes(campaign.status) && (campaign.distribution_count > 0 || (campaign.video_production_count ?? 0) > 0) && (
        <Card>
          <div className="font-semibold text-gray-800 mb-3">캠페인 참여</div>
          <div className="space-y-4">

            {campaign.distribution_count > 0 && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-blue-800">배포 참여</div>
                    <div className="text-xs text-blue-600 mt-0.5">배포 건수: {campaign.distribution_count}건</div>
                  </div>
                  {!myDeployPt && (
                    <form action={joinParticipationAction}>
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <input type="hidden" name="participation_type" value="deploy" />
                      <SubmitButton size="sm">배포 참여 신청</SubmitButton>
                    </form>
                  )}
                  {myDeployPt && <StatusBadge status={myDeployPt.status} />}
                </div>

                {myDeployPt && (
                  <div className="mt-2 text-xs text-blue-700">
                    {myDeployPt.status === "applied" && "참여 신청 완료. 광고주의 선발 승인을 기다리세요."}
                    {myDeployPt.status === "deploy_submitted" && "제출 완료. 광고주 검토 중입니다."}
                    {myDeployPt.status === "deploy_approved" && "승인 완료!"}
                    {myDeployPt.status === "completed" && "완료! 수익이 지급되었습니다."}
                  </div>
                )}

                {myDeployPt && myDeployPt.status === "deploy_submitted" && myDeployPt.deploy_link && (
                  <div className="mt-2 text-xs text-gray-600">
                    제출 링크:{" "}
                    <a href={myDeployPt.deploy_link} target="_blank" rel="noreferrer" className="text-brand-purple underline break-all">{myDeployPt.deploy_link}</a>
                  </div>
                )}

                {myDeployPt && myDeployPt.status === "deploy_rejected" && (
                  <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    반려됨: {myDeployPt.rejection_reason ?? "사유 없음"}
                  </div>
                )}

                {myDeployPt && (myDeployPt.status === "accepted" || myDeployPt.status === "deploy_rejected") && (
                  <form action={submitParticipationWorkAction} className="mt-3 space-y-3 border-t border-blue-100 pt-3">
                    <input type="hidden" name="participation_id" value={myDeployPt.id} />
                    <div>
                      <label className="text-xs font-medium text-blue-700 block mb-1">배포 링크 (SNS 게시물 URL)</label>
                      <input name="deploy_link" type="url" placeholder="https://www.instagram.com/p/..." required
                        className="w-full rounded-xl border border-blue-200 px-3 py-2 text-sm focus:border-brand-purple focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-blue-700 block mb-1">메모 (선택)</label>
                      <textarea name="note" rows={2} placeholder="배포 관련 특이사항이 있으면 입력해주세요."
                        className="w-full rounded-xl border border-blue-200 px-3 py-2 text-sm focus:border-brand-purple focus:outline-none" />
                    </div>
                    <SubmitButton size="sm">배포 링크 제출</SubmitButton>
                  </form>
                )}
              </div>
            )}

            {(campaign.video_production_count ?? 0) > 0 && (
              <div className="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-purple-800">영상제작 참여</div>
                    <div className="text-xs text-purple-600 mt-0.5">영상제작 건수: {campaign.video_production_count}건</div>
                  </div>
                  {!myVideoPt && (
                    <form action={joinParticipationAction}>
                      <input type="hidden" name="campaign_id" value={campaign.id} />
                      <input type="hidden" name="participation_type" value="video_production" />
                      <SubmitButton size="sm">영상제작 참여 신청</SubmitButton>
                    </form>
                  )}
                  {myVideoPt && <StatusBadge status={myVideoPt.status} />}
                </div>

                {myVideoPt && (
                  <div className="mt-2 text-xs text-purple-700">
                    {myVideoPt.status === "applied" && "참여 신청 완료. 광고주의 선발 승인을 기다리세요."}
                    {myVideoPt.status === "video_submitted" && "제출 완료. 광고주 검토 중입니다."}
                    {myVideoPt.status === "video_approved" && "영상 승인 완료!"}
                    {myVideoPt.status === "completed" && "완료! 수익이 지급되었습니다."}
                  </div>
                )}

                {myVideoPt && myVideoPt.status === "video_submitted" && myVideoPt.video_url && (
                  <div className="mt-2 text-xs text-gray-600">
                    제출 영상:{" "}
                    <a href={myVideoPt.video_url} target="_blank" rel="noreferrer" className="text-brand-purple underline break-all">{myVideoPt.video_url}</a>
                  </div>
                )}

                {myVideoPt && myVideoPt.status === "video_rejected" && (
                  <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                    반려됨: {myVideoPt.rejection_reason ?? "사유 없음"}
                  </div>
                )}

                {myVideoPt && (myVideoPt.status === "accepted" || myVideoPt.status === "video_rejected") && (
                  <form action={submitParticipationWorkAction} className="mt-3 space-y-3 border-t border-purple-100 pt-3">
                    <input type="hidden" name="participation_id" value={myVideoPt.id} />
                    <div>
                      <label className="text-xs font-medium text-purple-700 block mb-1">영상 URL (Google Drive, Dropbox, YouTube 비공개 링크 등)</label>
                      <input name="video_url" type="url" placeholder="https://drive.google.com/..." required
                        className="w-full rounded-xl border border-purple-200 px-3 py-2 text-sm focus:border-brand-purple focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-purple-700 block mb-1">제작 메모 (선택)</label>
                      <textarea name="note" rows={2} placeholder="영상 제작 관련 특이사항이 있으면 입력해주세요."
                        className="w-full rounded-xl border border-purple-200 px-3 py-2 text-sm focus:border-brand-purple focus:outline-none" />
                    </div>
                    <SubmitButton size="sm">영상 제출</SubmitButton>
                  </form>
                )}
              </div>
            )}

          </div>
        </Card>
      )}
    </div>
  );
}
