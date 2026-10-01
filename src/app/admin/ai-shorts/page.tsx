import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, PageHeader, StatCard, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { toggleAiShortsAction } from "@/lib/actions/ai-admin-actions";
import { AiShortsSettingsForm } from "@/components/ai-shorts/admin-forms";
import { AI_CAPABILITIES, CAPABILITY_LABELS, getAiShortsSettings, kstMonthStartIso } from "@/lib/ai/settings";
import { capabilityStatus, modelUsable, monthCostWon } from "@/lib/ai/engine";
import { formatFunny } from "@/lib/funny";
import { formatKRW } from "@/lib/money";

export const dynamic = "force-dynamic";

export default function AdminAiShortsPage() {
  requireAdmin();
  const db = getDb();
  const s = getAiShortsSettings(db);
  const caps = capabilityStatus(db);
  const from = kstMonthStartIso();
  const jobs = db.ai_jobs ?? [];
  const monthJobs = jobs.filter((j) => j.created_at >= from);
  const spentFunny = monthJobs.reduce((a, j) => a + (j.status === "succeeded" ? j.charged_funny : 0), 0);
  const cost = monthCostWon(db);
  const chargeWon = db.payments.filter((p) => p.payment_type === "funny_charge" && p.status === "paid" && (p.paid_at ?? "") >= from).reduce((a, p) => a + p.amount, 0);
  const active = jobs.filter((j) => j.status === "queued" || j.status === "running").length;
  const failed = monthJobs.filter((j) => j.status === "failed").length;
  const creators = new Set((db.shorts_projects ?? []).map((p) => p.user_id)).size;
  const outstanding = (db.funny_wallets ?? []).reduce((a, w) => a + w.paid_balance + w.held_paid, 0);
  const allowedEmails = s.allowed_creator_ids.map((id) => db.profiles.find((p) => p.id === id)?.email).filter(Boolean).join("\n");
  const modelOptions = Object.fromEntries(
    AI_CAPABILITIES.map((cap) => [
      cap,
      (db.ai_models ?? [])
        .filter((m) => m.capability === cap)
        .map((m) => ({ id: m.id, label: `${m.label} · ${(db.ai_providers ?? []).find((p) => p.id === m.provider_id)?.name ?? ""}`, usable: modelUsable(db, m).ok })),
    ])
  ) as Record<(typeof AI_CAPABILITIES)[number], Array<{ id: string; label: string; usable: boolean }>>;
  const notReady = !caps.text.ready || !caps.image.ready || !caps.tts.ready;

  return (
    <div className="space-y-6">
      <PageHeader title="AI 숏츠 설정" description="크리에이터가 퍼니를 충전해 AI로 숏츠를 만드는 기능을 켜고 끄고, 가격·한도·모델을 정합니다." />

      {/* 메인 스위치 */}
      <Card className={s.enabled ? "border-green-200 bg-green-50" : "border-gray-200"}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-gray-900">AI 숏츠 제작</h2>
              {s.enabled ? <Badge tone="green">켜짐 · {s.audience === "all" ? "전체 크리에이터" : `지정 ${s.allowed_creator_ids.length}명`}</Badge> : <Badge tone="gray">꺼짐</Badge>}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              {s.enabled
                ? "크리에이터 메뉴에 'AI 숏츠 만들기'와 '퍼니 충전'이 보이고 새 작업·충전이 가능합니다."
                : "크리에이터는 새 숏츠 제작과 퍼니 충전을 할 수 없습니다. 이미 진행 중인 작업은 끝까지 처리되고, 만든 숏츠는 계속 보고 내려받을 수 있습니다."}
            </p>
            {!s.enabled && notReady && <p className="mt-1 text-xs text-orange-700">켜기 전에: 대본·이미지·음성 AI가 모두 준비돼야 합니다. <Link href="/admin/ai-shorts/providers" className="underline">공급사·모델 설정</Link></p>}
          </div>
          <form action={toggleAiShortsAction}>
            <input type="hidden" name="enabled" value={s.enabled ? "0" : "1"} />
            <SubmitButton variant={s.enabled ? "danger" : "primary"} size="lg">{s.enabled ? "끄기" : "켜기"}</SubmitButton>
          </form>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="이번 달 퍼니 충전" value={formatKRW(chargeWon)} accent="purple" />
        <StatCard label="이번 달 사용 퍼니" value={formatFunny(spentFunny)} accent="pink" />
        <StatCard label={`이번 달 AI 원가${s.monthly_budget_won ? ` / 한도 ${formatKRW(s.monthly_budget_won)}` : ""}`} value={formatKRW(cost)} accent={s.monthly_budget_won && cost > s.monthly_budget_won * 0.8 ? "yellow" : "gray"} />
        <StatCard label="진행 중 작업 / 이번 달 실패" value={`${active} / ${failed}`} accent="gray" />
      </div>
      <p className="text-xs text-gray-500">이용 크리에이터 {creators}명 · 미사용 충전 퍼니 잔액(선수금) {formatFunny(outstanding)} = {formatKRW(outstanding * 10)}</p>

      <Card>
        <h2 className="mb-2 text-base font-bold">작업별 준비 상태</h2>
        <div className="grid gap-2 sm:grid-cols-5">
          {AI_CAPABILITIES.map((cap) => (
            <div key={cap} className={`rounded-xl border p-3 text-sm ${caps[cap].ready ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
              <div className="font-semibold">{CAPABILITY_LABELS[cap]}{cap === "video" || cap === "music" ? " (선택)" : ""}</div>
              <div className="mt-0.5 truncate text-xs text-gray-600">{caps[cap].ready ? caps[cap].model : "준비 안 됨"}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-base font-bold">운영 설정</h2>
        <AiShortsSettingsForm
          settings={{ ...s, charge_products: s.charge_products.map((p) => ({ won: p.won, bonus: p.bonus })) }}
          allowedEmails={allowedEmails}
          modelOptions={modelOptions}
        />
      </Card>
    </div>
  );
}
