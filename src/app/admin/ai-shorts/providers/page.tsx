import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, PageHeader, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { deleteProviderAction } from "@/lib/actions/ai-admin-actions";
import { AddModelForm, AddProviderForm, ModelRowForm, ProviderForms } from "@/components/ai-shorts/admin-forms";
import { getAiShortsSettings, UNIT_LABELS } from "@/lib/ai/settings";
import { adapterFor, modelUsable } from "@/lib/ai/engine";
import { KIND_LABELS, mockAllowed } from "@/lib/ai/providers";
import { priceSummary } from "@/lib/ai/pricing";
import { secretHint } from "@/lib/crypto";
import { formatDateTime } from "@/lib/date";
import type { AiProviderKind } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default function AdminAiProvidersPage() {
  requireAdmin();
  const db = getDb();
  const settings = getAiShortsSettings(db);
  const providers = db.ai_providers ?? [];
  const kinds = (["gemini", "openai", "fal", "elevenlabs", "mock"] as AiProviderKind[])
    .filter((k) => k !== "mock" || mockAllowed())
    .map((k) => ({ kind: k, label: KIND_LABELS[k] }));

  return (
    <div className="space-y-6">
      <PageHeader title="AI 공급사·모델" description="숏츠 제작에 꼭 필요한 공급사만 연결합니다. 추천: Google Gemini 키 1개로 대본·이미지·음성·영상까지 가능하며, 저가 영상은 fal.ai를 추가하세요." />

      <Card>
        <h2 className="mb-3 text-base font-bold">공급사 추가</h2>
        <AddProviderForm kinds={kinds} />
        <p className="mt-3 text-xs text-gray-500">모델 ID·가격은 2026년 7월 공개 가격 참고값입니다. 공급사 문서를 확인해 아래에서 바로 고칠 수 있습니다. API 키는 암호화(AES-256-GCM)되어 저장되고 화면에는 끝 4자리만 보입니다.</p>
      </Card>

      {providers.length === 0 && <Card className="text-sm text-gray-500">아직 연결된 공급사가 없습니다.</Card>}

      {providers.map((p) => {
        const models = (db.ai_models ?? []).filter((m) => m.provider_id === p.id);
        const adapter = adapterFor(p.kind);
        const cooling = !!(p.cooldown_until && Date.parse(p.cooldown_until) > Date.now());
        return (
          <Card key={p.id}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold">{p.name}</h2>
              <Badge tone={p.status === "ok" ? "green" : p.status === "error" ? "red" : "gray"}>{p.status === "ok" ? "연결됨" : p.status === "error" ? "연결 실패" : "미확인"}</Badge>
              {!p.active && <Badge tone="gray">꺼짐</Badge>}
              {cooling && <Badge tone="yellow">연속 실패로 사용 중지 중</Badge>}
              {!adapter && <Badge tone="red">이 환경에서 사용 불가</Badge>}
              {p.last_test_at && <span className="text-xs text-gray-400">최근 테스트 {formatDateTime(p.last_test_at)} · {p.last_test_message}</span>}
            </div>
            <ProviderForms provider={{ id: p.id, name: p.name, base_url: p.base_url, active: p.active, keyHint: secretHint(p.api_key_enc), cooling }} />
            <h3 className="mb-2 mt-5 text-sm font-bold text-gray-800">모델 ({models.length})</h3>
            <div className="space-y-2">
              {models.map((m) => {
                const usable = modelUsable(db, m);
                const ps = priceSummary(m, settings);
                return (
                  <ModelRowForm
                    key={m.id}
                    model={{ ...m, usable: usable.ok, reason: usable.reason }}
                    price={{ perUnitFunny: ps.perUnitFunny, costWon: ps.costWon, saleWon: ps.saleWon, belowCost: ps.belowCost, unit: UNIT_LABELS[m.capability] }}
                  />
                );
              })}
            </div>
            {adapter && (
              <div className="mt-3 rounded-xl bg-gray-50 p-3">
                <p className="mb-2 text-xs font-semibold text-gray-600">모델 직접 추가</p>
                <AddModelForm providerId={p.id} capabilities={adapter.capabilities} />
              </div>
            )}
            <form action={deleteProviderAction} className="mt-4 text-right">
              <input type="hidden" name="provider_id" value={p.id} />
              <SubmitButton size="sm" variant="ghost" confirmMessage="이 공급사를 삭제할까요? 연결된 모델 설정도 함께 사용할 수 없게 됩니다.">공급사 삭제 (진행 중 작업이 없을 때만)</SubmitButton>
            </form>
          </Card>
        );
      })}
    </div>
  );
}
