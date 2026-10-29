import type { AiCapability, AiModel, AiProvider, Database } from "../schema";
import { ADAPTERS, mockAllowed, type Adapter } from "./providers";
import { mockAdapter } from "./mock";

// ===========================================================================
// AI 모델 준비 상태 (engine·settings 가 함께 쓰므로 순환 참조가 없게 따로 둔다)
// ===========================================================================

export function adapterFor(kind: AiProvider["kind"]): Adapter | null {
  if (kind === "mock") return mockAllowed() ? mockAdapter : null;
  return ADAPTERS[kind] ?? null;
}

/** 지금 실제로 쓸 수 있는 모델인가 (모델·공급사 켜짐 + 키 등록 + 장애 차단 아님) */
export function modelUsable(db: Database, model: AiModel): { ok: boolean; reason: string } {
  if (!model.active) return { ok: false, reason: "모델이 꺼져 있습니다." };
  const provider = (db.ai_providers ?? []).find((p) => p.id === model.provider_id);
  if (!provider) return { ok: false, reason: "공급사가 없습니다." };
  if (!provider.active) return { ok: false, reason: "공급사가 꺼져 있습니다." };
  if (!adapterFor(provider.kind)) return { ok: false, reason: "이 환경에서 쓸 수 없는 공급사입니다." };
  if (provider.kind !== "mock" && !provider.api_key_enc) return { ok: false, reason: "API 키가 등록되지 않았습니다." };
  if (provider.cooldown_until && Date.parse(provider.cooldown_until) > Date.now()) return { ok: false, reason: "연속 실패로 잠시 사용 중지 중입니다." };
  return { ok: true, reason: "" };
}

/** 작업별로 쓸 모델: 관리자가 고른 기본 모델 → 없거나 못 쓰면 같은 종류의 사용 가능한 첫 모델 */
export function resolveModel(db: Database, capability: AiCapability): AiModel | null {
  const defaults = db.settings.ai_shorts?.default_models ?? {};
  const models = (db.ai_models ?? []).filter((m) => m.capability === capability);
  const chosen = models.find((m) => m.id === defaults[capability]);
  if (chosen && modelUsable(db, chosen).ok) return chosen;
  return models.find((m) => modelUsable(db, m).ok) ?? null;
}

/** 크리에이터 화면: 작업별 사용 가능 여부 */
export function capabilityStatus(db: Database) {
  const out = {} as Record<AiCapability, { ready: boolean; model: string | null; maxSeconds: number | null }>;
  for (const cap of ["text", "image", "tts", "video", "music"] as AiCapability[]) {
    const m = resolveModel(db, cap);
    out[cap] = { ready: !!m, model: m?.label ?? null, maxSeconds: m?.max_seconds ?? null };
  }
  return out;
}

/** 공급사 종류 (가격 계산에서 모델별 실제 생성 길이를 맞추는 데 쓴다) */
export function providerKindOf(db: Database, model: Pick<AiModel, "provider_id"> | null | undefined): AiProvider["kind"] | undefined {
  if (!model) return undefined;
  return (db.ai_providers ?? []).find((p) => p.id === model.provider_id)?.kind;
}
