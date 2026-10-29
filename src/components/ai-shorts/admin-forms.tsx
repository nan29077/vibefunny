"use client";

import { useFormState } from "react-dom";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, initialActionState, type ActionState } from "@/components/form";
import {
  adminCancelJobAction,
  addModelAction,
  addProviderAction,
  adjustFunnyAction,
  saveAiShortsSettingsAction,
  testModelAction,
  testProviderAction,
  updateModelAction,
  updateProviderAction,
} from "@/lib/actions/ai-admin-actions";

type Cap = "text" | "image" | "tts" | "video" | "music";
const CAP_LABEL: Record<Cap, string> = { text: "대본 작성", image: "컷 이미지", tts: "내레이션 음성", video: "AI 영상 클립", music: "배경음악" };

// --- 운영 설정 ---------------------------------------------------------------
export function AiShortsSettingsForm({
  settings,
  allowedEmails,
  modelOptions,
}: {
  settings: {
    audience: "all" | "selected";
    usd_krw_rate: number;
    margin_rate: number;
    monthly_budget_won: number;
    daily_limit_funny: number;
    max_active_jobs_per_user: number;
    concurrency: number;
    default_models: Partial<Record<Cap, string>>;
    charge_products: Array<{ won: number; bonus: number }>;
    blocked_terms: string;
  };
  allowedEmails: string;
  modelOptions: Record<Cap, Array<{ id: string; label: string; usable: boolean }>>;
}) {
  const [state, action] = useFormState(saveAiShortsSettingsAction, initialActionState);
  const products = [...settings.charge_products, ...Array.from({ length: Math.max(0, 6 - settings.charge_products.length) }, () => ({ won: 0, bonus: 0 }))].slice(0, 6);
  return (
    <form action={action} className="space-y-6">
      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-800">이용 대상</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="audience" value="all" defaultChecked={settings.audience === "all"} /> 전체 크리에이터</label>
          <label className="flex items-center gap-2"><input type="radio" name="audience" value="selected" defaultChecked={settings.audience === "selected"} /> 지정한 크리에이터만 (베타)</label>
        </div>
        <Field label="지정 크리에이터 이메일" htmlFor="ai-allowed" hint="'지정한 크리에이터만'일 때 사용. 쉼표·줄바꿈으로 구분" className="mt-2">
          <Textarea id="ai-allowed" name="allowed_emails" defaultValue={allowedEmails} className="min-h-[60px]" />
        </Field>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-800">작업별 사용할 AI 모델</h3>
        <p className="mb-2 text-xs text-gray-500">공급사·모델 화면에서 켜 둔 모델 중에서 고릅니다. 고른 모델을 쓸 수 없으면 같은 작업의 사용 가능한 다른 모델로 자동 대체됩니다.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(CAP_LABEL) as Cap[]).map((cap) => (
            <Field key={cap} label={CAP_LABEL[cap]} htmlFor={`ai-default-${cap}`}>
              <Select id={`ai-default-${cap}`} name={`default_${cap}`} defaultValue={settings.default_models[cap] ?? ""}>
                <option value="">{modelOptions[cap].length ? "자동 (사용 가능한 첫 모델)" : "등록된 모델 없음 — 이 기능 꺼짐"}</option>
                {modelOptions[cap].map((m) => (
                  <option key={m.id} value={m.id}>{m.label}{m.usable ? "" : " (사용 불가)"}</option>
                ))}
              </Select>
            </Field>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-800">가격 · 한도</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="1퍼니" hint="고정"><Input value="10원" disabled /></Field>
          <Field label="환율 (원/USD)" htmlFor="ai-usd"><Input id="ai-usd" name="usd_krw_rate" type="number" min={500} max={5000} defaultValue={settings.usd_krw_rate} /></Field>
          <Field label="마진율 (%)" htmlFor="ai-margin" hint="판매가 = 원가 × 마진율 (100 이상)"><Input id="ai-margin" name="margin_rate" type="number" min={100} max={1000} defaultValue={settings.margin_rate} /></Field>
          <Field label="월 AI 원가 한도 (원)" htmlFor="ai-budget" hint="넘으면 새 작업 자동 차단 · 0 = 제한 없음"><Input id="ai-budget" name="monthly_budget_won" type="number" min={0} defaultValue={settings.monthly_budget_won} /></Field>
          <Field label="1인 하루 사용 한도 (퍼니)" htmlFor="ai-daily" hint="0 = 제한 없음"><Input id="ai-daily" name="daily_limit_funny" type="number" min={0} defaultValue={settings.daily_limit_funny} /></Field>
          <Field label="1인 동시 작업 수" htmlFor="ai-active"><Input id="ai-active" name="max_active_jobs_per_user" type="number" min={1} max={100} defaultValue={settings.max_active_jobs_per_user} /></Field>
          <Field label="서버 동시 AI 작업 수" htmlFor="ai-conc"><Input id="ai-conc" name="concurrency" type="number" min={1} max={10} defaultValue={settings.concurrency} /></Field>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-800">퍼니 충전 상품</h3>
        <p className="mb-2 text-xs text-gray-500">결제 금액(원) ÷ 10 = 충전 퍼니. 보너스 퍼니는 추가로 지급됩니다(관리자 지급분과 같이 &apos;보너스&apos;로 관리, 먼저 사용).</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2">
              <Input aria-label={`상품 ${i + 1} 금액(원)`} name={`product_won_${i}`} type="number" min={0} step={100} defaultValue={p.won || ""} placeholder="금액(원)" />
              <Input aria-label={`상품 ${i + 1} 보너스 퍼니`} name={`product_bonus_${i}`} type="number" min={0} defaultValue={p.bonus || ""} placeholder="보너스" />
            </div>
          ))}
        </div>
      </section>

      <Field label="금칙어" htmlFor="ai-blocked" hint="주제·대본·프롬프트에 들어 있으면 작업을 막습니다. 쉼표·줄바꿈 구분">
        <Textarea id="ai-blocked" name="blocked_terms" defaultValue={settings.blocked_terms} className="min-h-[60px]" />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>설정 저장</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// --- 공급사 추가 ---------------------------------------------------------------
export function AddProviderForm({ kinds }: { kinds: Array<{ kind: string; label: string }> }) {
  const [state, action] = useFormState(addProviderAction, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="공급사" htmlFor="pv-kind" required>
          <Select id="pv-kind" name="kind" required defaultValue="">
            <option value="" disabled>선택</option>
            {kinds.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
          </Select>
        </Field>
        <Field label="API 키" htmlFor="pv-key" hint="암호화되어 저장되며 다시 표시되지 않습니다 (가짜 AI는 비워 두세요)" className="sm:col-span-2">
          <Input id="pv-key" name="api_key" type="password" autoComplete="off" />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>공급사 + 추천 모델 추가</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// --- 공급사 수정 · 연결 테스트 ----------------------------------------------------
export function ProviderForms({ provider }: { provider: { id: string; name: string; base_url: string; active: boolean; keyHint: string; cooling: boolean } }) {
  const [state, action] = useFormState(updateProviderAction, initialActionState);
  const [testState, testAction] = useFormState(testProviderAction, initialActionState);
  return (
    <div className="space-y-3">
      <form action={action} className="grid gap-3 sm:grid-cols-4">
        <input type="hidden" name="provider_id" value={provider.id} />
        <Field label="이름" htmlFor={`pv-name-${provider.id}`}><Input id={`pv-name-${provider.id}`} name="name" defaultValue={provider.name} /></Field>
        <Field label="API 주소" htmlFor={`pv-base-${provider.id}`} className="sm:col-span-2"><Input id={`pv-base-${provider.id}`} name="base_url" defaultValue={provider.base_url} /></Field>
        <Field label={`API 키 교체 ${provider.keyHint ? `(저장됨 ${provider.keyHint})` : ""}`} htmlFor={`pv-key-${provider.id}`}>
          <Input id={`pv-key-${provider.id}`} name="api_key" type="password" autoComplete="off" placeholder="변경할 때만 입력" />
        </Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={provider.active} className="h-4 w-4" /> 사용</label>
        {provider.cooling && <label className="flex items-center gap-2 text-sm text-orange-700"><input type="checkbox" name="clear_cooldown" className="h-4 w-4" /> 사용 중지 해제</label>}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
          <SubmitButton size="sm" variant="outline">저장</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
      <form action={testAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="provider_id" value={provider.id} />
        <SubmitButton size="sm" variant="secondary">연결 테스트</SubmitButton>
        <FormMessage state={testState} />
      </form>
    </div>
  );
}

// --- 모델 한 줄 ---------------------------------------------------------------
export function ModelRowForm({
  model,
  price,
}: {
  model: { id: string; label: string; model_id: string; capability: Cap; cost_usd: number; price_funny: number; max_seconds: number | null; active: boolean; usable: boolean; reason: string };
  price: { perUnitFunny: number; costWon: number; saleWon: number; belowCost: boolean; unit: string };
}) {
  const [state, action] = useFormState(updateModelAction, initialActionState);
  const [testState, testAction] = useFormState(testModelAction, initialActionState as ActionState & { preview?: string; previewType?: string });
  const media = model.capability === "video" || model.capability === "music";
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <form action={action} className="grid gap-2 sm:grid-cols-12">
        <input type="hidden" name="model_id_ref" value={model.id} />
        <div className="sm:col-span-3">
          <span className="text-[11px] font-semibold text-gray-500">{CAP_LABEL[model.capability]}</span>
          <Input aria-label="표시 이름" name="label" defaultValue={model.label} className="py-1.5" />
        </div>
        <div className="sm:col-span-3">
          <span className="text-[11px] text-gray-500">모델 ID</span>
          <Input aria-label="모델 ID" name="model_id" defaultValue={model.model_id} className="py-1.5 text-xs" />
        </div>
        <div className="sm:col-span-2">
          <span className="text-[11px] text-gray-500">원가 USD / {price.unit}</span>
          <Input aria-label="원가 USD" name="cost_usd" type="number" step="0.0001" min={0} defaultValue={model.cost_usd} className="py-1.5" />
        </div>
        <div className="sm:col-span-2">
          <span className="text-[11px] text-gray-500">판매가 퍼니 / {price.unit}</span>
          <Input aria-label="판매가 퍼니" name="price_funny" type="number" step="0.01" min={0} defaultValue={model.price_funny || ""} placeholder={`자동 ${price.perUnitFunny}`} className="py-1.5" />
        </div>
        <div className="sm:col-span-2">
          {media ? (
            <>
              <span className="text-[11px] text-gray-500">최대 초</span>
              <Input aria-label="최대 길이(초)" name="max_seconds" type="number" min={1} max={600} defaultValue={model.max_seconds ?? ""} className="py-1.5" />
            </>
          ) : (
            <input type="hidden" name="max_seconds" value="" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-12">
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" name="active" defaultChecked={model.active} className="h-4 w-4" /> 사용</label>
          <span className={`text-xs ${price.belowCost ? "font-bold text-red-600" : "text-gray-500"}`}>
            판매 {price.saleWon.toLocaleString()}원 / 원가 {price.costWon.toLocaleString()}원 {price.belowCost ? "· 원가보다 쌉니다!" : ""}
          </span>
          {!model.usable && <span className="text-xs text-orange-600">{model.reason}</span>}
          <SubmitButton size="sm" variant="outline">저장</SubmitButton>
          <FormMessage state={state} />
        </div>
      </form>
      {!media && (
        <form action={testAction} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="model_id_ref" value={model.id} />
          <SubmitButton size="sm" variant="ghost">시험 생성 (퍼니 차감 없음)</SubmitButton>
          <FormMessage state={testState} />
          {testState.preview && testState.previewType?.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={testState.preview} alt="시험 생성 결과" className="h-32 rounded-lg border" />
          )}
          {testState.preview && testState.previewType?.startsWith("audio/") && <audio src={testState.preview} controls />}
        </form>
      )}
    </div>
  );
}

export function AddModelForm({ providerId, capabilities }: { providerId: string; capabilities: Cap[] }) {
  const [state, action] = useFormState(addModelAction, initialActionState);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-12">
      <input type="hidden" name="provider_id" value={providerId} />
      <Select aria-label="작업 종류" name="capability" className="py-1.5 sm:col-span-2" defaultValue={capabilities[0]}>
        {capabilities.map((c) => <option key={c} value={c}>{CAP_LABEL[c]}</option>)}
      </Select>
      <Input aria-label="모델 ID" name="model_id" placeholder="모델 ID" className="py-1.5 sm:col-span-4" required />
      <Input aria-label="표시 이름" name="label" placeholder="표시 이름" className="py-1.5 sm:col-span-3" />
      <Input aria-label="원가 USD" name="cost_usd" type="number" step="0.0001" min={0} placeholder="원가 USD" className="py-1.5 sm:col-span-2" required />
      <SubmitButton size="sm" variant="outline" className="sm:col-span-1">추가</SubmitButton>
      <div className="sm:col-span-12"><FormMessage state={state} /></div>
    </form>
  );
}

// --- 퍼니 지급·회수 -------------------------------------------------------------
export function AdjustFunnyForm() {
  const [state, action] = useFormState(adjustFunnyAction, initialActionState);
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-5">
      <Field label="크리에이터 이메일" htmlFor="fa-email" className="sm:col-span-2"><Input id="fa-email" name="email" type="email" required /></Field>
      <Field label="퍼니" htmlFor="fa-amount"><Input id="fa-amount" name="amount" type="number" min={1} required /></Field>
      <Field label="구분" htmlFor="fa-mode">
        <Select id="fa-mode" name="mode" defaultValue="grant">
          <option value="grant">지급 (보너스)</option>
          <option value="revoke">회수</option>
        </Select>
      </Field>
      <Field label="사유" htmlFor="fa-memo"><Input id="fa-memo" name="memo" required minLength={2} maxLength={200} /></Field>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-5">
        <SubmitButton>처리</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

// --- 작업 강제 취소 (실패 이유를 화면에 표시) ----------------------------------------
export function AdminCancelJobForm({ jobId }: { jobId: string }) {
  const [state, action] = useFormState(adminCancelJobAction, initialActionState);
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="job_id" value={jobId} />
      <SubmitButton size="sm" variant="outline">취소·환불</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
