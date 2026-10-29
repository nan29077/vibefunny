import { getDb } from "@/lib/db";
import { Card, PageHeader, Field, Input, Select, Label } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { ROLE_LABELS, type Role } from "@/lib/schema";
import {
  updateFeesAction,
  updateVideoPricingAction,
  updateDistributionAction,
  updateAdvertiserCommissionAction,
  updateReferralSystemAction,
} from "@/lib/actions/admin-actions";
import { IconUsers, IconZap, IconCheckCircle } from "@/components/icons";
import { requireAdmin } from "@/lib/auth";

export default function AdminSettingsPage() {
  requireAdmin();
  const db = getDb();
  const s = db.settings;
  const roles: Role[] = ["creator", "advertiser"];

  return (
    <div className="space-y-6">
      <PageHeader title="정책 설정" description="가입비, 추천 수당, 단가, 수수료를 관리합니다. (모든 금액은 원 단위)" />

      {/* 추천인 제도 + 유료 부업 통합 설정 */}
      <Card>
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100">
            <IconUsers size={18} className="text-brand-purple" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">추천인 제도 설정</h2>
            <p className="text-sm text-gray-500">
              추천인 제도 및 유료 부업 활성화 여부와 수당 금액을 설정합니다.
            </p>
          </div>
          {s.referral_system_enabled ? (
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
              <IconCheckCircle size={12} />
              사용 중
            </span>
          ) : (
            <span className="ml-auto rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
              비활성
            </span>
          )}
        </div>

        <form action={updateReferralSystemAction} className="space-y-4">
          <div className="rounded-xl border border-gray-200 p-4 space-y-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="referral_system_enabled"
                defaultChecked={s.referral_system_enabled}
                className="mt-0.5 h-4 w-4 rounded"
              />
              <div>
                <div className="font-semibold text-gray-800">추천인 제도 사용</div>
                <div className="mt-0.5 text-sm text-gray-500">
                  바이브회원 크리에이터에게 추천 코드가 표시되고, 멘티가 가입비를 결제하면 멘토에게 역할별 고정 수당을 1회 적립합니다. 수당 금액은 아래 역할별 설정에서 변경하세요. (끄면 추천 관계는 계속 등록되지만 수당은 적립되지 않습니다)
                </div>
              </div>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <SubmitButton successMessage="저장되었습니다">저장</SubmitButton>
            {s.referral_system_enabled && (
              <div className="flex items-center gap-1.5 text-sm text-green-600">
                <IconZap size={14} />
                현재 추천인 관계 {db.referral_relations.filter((r) => r.referral_type === "signup").length}건
              </div>
            )}
          </div>
        </form>
      </Card>

      {/* 크리에이터 가입비 · 추천 수당 */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900">가입비 · 추천 수당</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">크리에이터 가입비와 역할별 추천인 고정 수당을 설정합니다. (광고주는 가입비 없음)</p>
        <form action={updateFeesAction} className="space-y-5">
          {roles.map((role) => {
            const f = s.fees[role];
            return (
              <div key={role} className="rounded-xl border border-gray-200 p-4">
                <div className="mb-3 font-semibold text-gray-800">{ROLE_LABELS[role]}</div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {role === "creator" && (
                    <>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name={`${role}_signup_enabled`} defaultChecked={f.signup_fee_enabled} />
                        가입비 사용 (결제하면 바이브회원)
                      </label>
                      <Field label="가입비 금액(원)" hint="결제 전에는 일반회원으로 로그인만 가능, 결제 후 바이브회원으로 수익 기능 이용">
                        <Input type="number" name={`${role}_signup_amount`} defaultValue={f.signup_fee_amount} min={0} />
                      </Field>
                    </>
                  )}
                  <Field label="추천 수당(원)" hint="이 역할로 가입 시 추천인에게 지급">
                    <Input type="number" name={`${role}_referral_amount`} defaultValue={f.referral_reward_amount} min={0} />
                  </Field>
                </div>
              </div>
            );
          })}
          <SubmitButton successMessage="저장되었습니다">저장</SubmitButton>
        </form>
      </Card>

      {/* 영상 제작 단가 */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900">영상 제작 단가</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          영상 길이 구간별로 <strong>광고주 청구 단가</strong>(광고주 포인트에서 차감)와 <strong>크리에이터 제작 단가</strong>(완료 시 크리에이터에게 적립)를 설정합니다.
          광고주가 광고 의뢰 시 청구 단가가 차감되고, 캠페인 참여 크리에이터에게는 제작 단가가 건당 예상 수익으로 표시·적립되며, 차액은 회사 수익이 됩니다.
        </p>
        <form action={updateVideoPricingAction} className="mt-4 space-y-3">
          <div className="hidden sm:grid sm:grid-cols-[120px_1fr_1fr_1fr] gap-3 px-1 text-xs font-semibold text-gray-400">
            <span>구간</span><span>광고주 청구 단가(원)</span><span>크리에이터 제작 단가(원)</span><span>회사 수익(건당)</span>
          </div>
          {s.video_pricing_tiers.map((t) => (
            <div key={t.key} className="grid items-end gap-3 sm:grid-cols-[120px_1fr_1fr_1fr] rounded-xl border border-gray-100 p-3 sm:border-0 sm:p-1">
              <Label>{t.label}{t.max_seconds === null ? " (기준가)" : ""}</Label>
              <Field label="광고주 청구 단가">
                <Input type="number" name={`tier_${t.key}_charge`} defaultValue={t.advertiser_charge ?? 0} min={0} />
              </Field>
              <Field label="크리에이터 제작 단가">
                <Input type="number" name={`tier_${t.key}`} defaultValue={t.amount} min={0} />
              </Field>
              <div className="text-sm font-semibold text-green-600 pb-2">
                {((t.advertiser_charge ?? 0) - t.amount).toLocaleString()}원
              </div>
            </div>
          ))}
          <SubmitButton successMessage="저장되었습니다">저장</SubmitButton>
        </form>
      </Card>

      {/* 숏폼 배포 단가 */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900">숏폼 배포 단가 (1건 기준)</h2>
        <form action={updateDistributionAction} className="mt-4 space-y-3">
          <div className="hidden sm:grid sm:grid-cols-4 gap-3 px-1 text-xs font-semibold text-gray-400">
            <span>플랫폼</span><span>CREATOR 지급액(원)</span><span>광고주 청구액(원)</span><span>회사 수익(건당)</span>
          </div>
          {s.distribution_rates.map((r) => (
            <div key={r.platform} className="grid items-end gap-3 sm:grid-cols-4 rounded-xl border border-gray-100 p-3 sm:border-0 sm:p-1">
              <Label>{r.label}</Label>
              <Field label="CREATOR 지급액(원)">
                <Input type="number" name={`${r.platform}_payout`} defaultValue={r.creator_payout} min={0} />
              </Field>
              <Field label="광고주 청구액(원)">
                <Input type="number" name={`${r.platform}_charge`} defaultValue={r.advertiser_charge} min={0} />
              </Field>
              <div className="text-sm font-semibold text-green-600 pb-2">
                {(r.advertiser_charge - r.creator_payout).toLocaleString()}원
              </div>
            </div>
          ))}
          <div className="grid items-end gap-3 sm:grid-cols-4 rounded-xl border border-gray-100 p-3 sm:border-0 sm:p-1">
            <Label>영상 제작 포함 시 추가 제작비</Label>
            <Field label="크리에이터 지급액 (원)">
              <Input type="number" name="extra_creation_creator_payout" defaultValue={s.extra_creation_creator_payout} min={0} />
            </Field>
            <Field label="광고주 청구액 (원)">
              <Input type="number" name="extra_creation_advertiser_charge" defaultValue={s.extra_creation_advertiser_charge} min={0} />
            </Field>
            <div className="text-sm font-semibold text-green-600 pb-2">
              {(s.extra_creation_advertiser_charge - s.extra_creation_creator_payout).toLocaleString()}원
            </div>
          </div>
          <SubmitButton successMessage="저장되었습니다">저장</SubmitButton>
        </form>
      </Card>

      {/* 실행사/대행사 수수료 */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900">실행사 / 대행사 수수료</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          대행사는 실행사의 추천인 코드로만 가입할 수 있습니다.
          대행사가 결제하는 금액의 일정 비율을 실행사 수익으로 자동 적립합니다.
        </p>
        <form action={updateAdvertiserCommissionAction} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="실행사 수수료율(%)">
              <Input type="number" name="commission_rate" defaultValue={s.advertiser_commission_rate} min={0} max={100} />
            </Field>
            <Field label="수수료 적립 기준">
              <Select name="commission_basis" defaultValue={s.advertiser_commission_basis}>
                <option value="agency_charge">대행사 포인트 충전액 기준</option>
                <option value="agency_spend">대행사 광고 주문 차감액 기준 (기본)</option>
                <option value="campaign_completed">캠페인 완료 금액 기준</option>
              </Select>
            </Field>
          </div>
          <SubmitButton successMessage="저장되었습니다">저장</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
