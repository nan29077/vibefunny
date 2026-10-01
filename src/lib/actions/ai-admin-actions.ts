"use server";

import { revalidatePath } from "next/cache";
import { getDb, tx } from "../db";
import { requireAdmin } from "../auth";
import { audit, notifyUser } from "../services";
import { decryptSensitive, encryptSensitive, genId } from "../crypto";
import { grantFunny, revokeFunny, FunnyError, formatFunny } from "../funny";
import type { ActionState } from "@/components/form";
import type { AiCapability, AiModel, AiProvider, AiProviderKind, AiShortsChargeProduct } from "../schema";
import { AI_CAPABILITIES, getAiShortsSettings } from "../ai/settings";
import { PRESETS, mockAllowed } from "../ai/providers";
import { adapterFor, aiTables, AiError, cancelJob } from "../ai/engine";
import { publicError } from "../ai/engine";
import { sniffMime } from "../ai/media";

// ===========================================================================
// 최고관리자 — AI 숏츠 제작 설정 · 공급사/모델 · 작업 · 퍼니
// ===========================================================================

const now = () => new Date().toISOString();
const int = (fd: FormData, k: string, min: number, max: number, fallback: number) => {
  const v = Math.floor(Number(fd.get(k)));
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
};
const KINDS: AiProviderKind[] = ["gemini", "openai", "fal", "elevenlabs", "mock"];
const revalidateAll = () => {
  revalidatePath("/admin/ai-shorts");
  revalidatePath("/admin/ai-shorts/providers");
  revalidatePath("/creator", "layout");
};

// --- 켜기/끄기 스위치 -----------------------------------------------------------
export async function toggleAiShortsAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const enabled = fd.get("enabled") === "1";
  tx((db) => {
    const s = getAiShortsSettings(db);
    db.settings.ai_shorts = { ...s, enabled, updated_at: now() };
    audit(db, { actorId: admin.id, action: enabled ? "ai_shorts_enable" : "ai_shorts_disable", targetTable: "settings", before: { enabled: s.enabled }, after: { enabled } });
  });
  revalidateAll();
}

// --- 운영 설정 -------------------------------------------------------------------
export async function saveAiShortsSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = requireAdmin();
  try {
    const db0 = getDb();
    // 지정 크리에이터: 이메일 목록 → 회원 ID
    const emails = String(fd.get("allowed_emails") || "")
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const unknown: string[] = [];
    const ids: string[] = [];
    for (const email of emails) {
      const p = db0.profiles.find((x) => x.email.toLowerCase() === email && x.role === "creator");
      if (p) ids.push(p.id);
      else unknown.push(email);
    }
    if (unknown.length) return { ok: false, message: `크리에이터 계정을 찾을 수 없는 이메일: ${unknown.slice(0, 5).join(", ")}` };

    // 충전 상품 (최대 6개)
    const products: AiShortsChargeProduct[] = [];
    for (let i = 0; i < 6; i++) {
      const won = Math.floor(Number(fd.get(`product_won_${i}`) || 0));
      const bonus = Math.max(0, Math.floor(Number(fd.get(`product_bonus_${i}`) || 0)));
      if (!won) continue;
      if (won < 1_000 || won > 1_000_000 || won % 100 !== 0) return { ok: false, message: "충전 상품 금액은 1,000원~1,000,000원, 100원 단위로 입력하세요." };
      if (bonus > Math.floor(won / 10)) return { ok: false, message: "보너스 퍼니는 충전 퍼니보다 많을 수 없습니다." };
      products.push({ id: `p${won}`, won, bonus });
    }
    if (!products.length) return { ok: false, message: "충전 상품을 1개 이상 입력하세요." };
    if (new Set(products.map((p) => p.won)).size !== products.length) return { ok: false, message: "같은 금액의 충전 상품이 중복되었습니다." };

    const defaults: Partial<Record<AiCapability, string>> = {};
    for (const cap of AI_CAPABILITIES) {
      const v = String(fd.get(`default_${cap}`) || "");
      if (v) defaults[cap] = v;
    }
    const margin = int(fd, "margin_rate", 100, 1000, 180);
    tx((db) => {
      const s = getAiShortsSettings(db);
      for (const [cap, id] of Object.entries(defaults)) {
        const m = (db.ai_models ?? []).find((x) => x.id === id);
        if (!m || m.capability !== cap) throw new AiError("기본 모델 선택이 올바르지 않습니다.");
      }
      db.settings.ai_shorts = {
        ...s,
        audience: fd.get("audience") === "selected" ? "selected" : "all",
        allowed_creator_ids: ids,
        usd_krw_rate: int(fd, "usd_krw_rate", 500, 5000, 1400),
        margin_rate: margin,
        monthly_budget_won: int(fd, "monthly_budget_won", 0, 1_000_000_000, 1_000_000),
        daily_limit_funny: int(fd, "daily_limit_funny", 0, 10_000_000, 20_000),
        max_active_jobs_per_user: int(fd, "max_active_jobs_per_user", 1, 100, 20),
        concurrency: int(fd, "concurrency", 1, 10, 3),
        default_models: defaults,
        charge_products: products.sort((a, b) => a.won - b.won),
        blocked_terms: String(fd.get("blocked_terms") || "").slice(0, 5000),
        updated_at: now(),
      };
      audit(db, { actorId: admin.id, action: "ai_shorts_settings", targetTable: "settings", after: { margin, products: products.length, audience: fd.get("audience") } });
    });
    revalidateAll();
    return { ok: true, message: "AI 숏츠 설정을 저장했습니다." };
  } catch (error) {
    return { ok: false, message: error instanceof AiError ? error.message : "저장하지 못했습니다." };
  }
}

// --- 공급사 ---------------------------------------------------------------------
export async function addProviderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = requireAdmin();
  const kind = String(fd.get("kind") || "") as AiProviderKind;
  if (!KINDS.includes(kind)) return { ok: false, message: "공급사 종류를 선택하세요." };
  if (kind === "mock" && !mockAllowed()) return { ok: false, message: "개발용 가짜 AI는 운영 환경에서 사용할 수 없습니다." };
  const key = String(fd.get("api_key") || "").trim();
  if (kind !== "mock" && key.length < 8) return { ok: false, message: "API 키를 입력하세요." };
  const preset = PRESETS[kind];
  tx((db) => {
    const { providers, models } = aiTables(db);
    const provider: AiProvider = {
      id: genId(),
      kind,
      name: String(fd.get("name") || "").trim().slice(0, 60) || preset.name,
      base_url: String(fd.get("base_url") || "").trim().slice(0, 300) || preset.base_url,
      api_key_enc: kind === "mock" ? "" : encryptSensitive(key),
      active: true,
      status: "untested",
      last_test_at: null,
      last_test_message: null,
      fail_streak: 0,
      cooldown_until: null,
      created_at: now(),
      updated_at: now(),
    };
    providers.push(provider);
    for (const m of preset.models) {
      models.push({
        id: genId(),
        provider_id: provider.id,
        capability: m.capability,
        model_id: m.model_id,
        label: m.label,
        cost_usd: m.cost_usd,
        price_funny: 0,
        max_seconds: m.max_seconds ?? null,
        active: m.active !== false,
        created_at: now(),
        updated_at: now(),
      });
    }
    audit(db, { actorId: admin.id, action: "ai_provider_add", targetTable: "ai_providers", targetId: provider.id, after: { kind } });
  });
  revalidateAll();
  return { ok: true, message: `${preset.name} 공급사와 추천 모델을 추가했습니다. "연결 테스트"로 키를 확인하세요.` };
}

export async function updateProviderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = requireAdmin();
  const id = String(fd.get("provider_id") || "");
  const key = String(fd.get("api_key") || "").trim();
  let message = "공급사 정보를 저장했습니다.";
  try {
    tx((db) => {
      const p = (db.ai_providers ?? []).find((x) => x.id === id);
      if (!p) throw new AiError("공급사를 찾을 수 없습니다.");
      p.name = String(fd.get("name") || p.name).trim().slice(0, 60) || p.name;
      const base = String(fd.get("base_url") ?? "").trim();
      if (base) {
        if (!/^https:\/\//.test(base)) throw new AiError("주소는 https:// 로 시작해야 합니다.");
        p.base_url = base.slice(0, 300);
      }
      p.active = fd.get("active") === "on";
      if (key) {
        if (key.length < 8) throw new AiError("API 키를 확인하세요.");
        p.api_key_enc = encryptSensitive(key);
        p.status = "untested";
        p.fail_streak = 0;
        p.cooldown_until = null;
        message = "API 키를 교체했습니다. 연결 테스트를 실행하세요.";
      }
      if (fd.get("clear_cooldown") === "on") {
        p.fail_streak = 0;
        p.cooldown_until = null;
      }
      p.updated_at = now();
      audit(db, { actorId: admin.id, action: "ai_provider_update", targetTable: "ai_providers", targetId: p.id, after: { active: p.active, keyChanged: !!key } });
    });
  } catch (error) {
    return { ok: false, message: error instanceof AiError ? error.message : "저장하지 못했습니다." };
  }
  revalidateAll();
  return { ok: true, message };
}

export async function deleteProviderAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const id = String(fd.get("provider_id") || "");
  tx((db) => {
    const { providers, models, jobs } = aiTables(db);
    const modelIds = new Set(models.filter((m) => m.provider_id === id).map((m) => m.id));
    // 진행 중 작업이 있으면 삭제하지 않는다 (끄기만 가능)
    if (jobs.some((j) => j.model_ref && modelIds.has(j.model_ref) && (j.status === "queued" || j.status === "running"))) return;
    db.ai_providers = providers.filter((p) => p.id !== id);
    db.ai_models = models.filter((m) => m.provider_id !== id);
    const s = getAiShortsSettings(db);
    const defaults = { ...s.default_models };
    for (const cap of AI_CAPABILITIES) if (defaults[cap] && modelIds.has(defaults[cap]!)) delete defaults[cap];
    db.settings.ai_shorts = { ...s, default_models: defaults, updated_at: now() };
    audit(db, { actorId: admin.id, action: "ai_provider_delete", targetTable: "ai_providers", targetId: id });
  });
  revalidateAll();
}

/** 연결 테스트 (비용이 들지 않는 요청) */
export async function testProviderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = requireAdmin();
  const id = String(fd.get("provider_id") || "");
  const p = (getDb().ai_providers ?? []).find((x) => x.id === id);
  if (!p) return { ok: false, message: "공급사를 찾을 수 없습니다." };
  const adapter = adapterFor(p.kind);
  if (!adapter) return { ok: false, message: "이 환경에서 쓸 수 없는 공급사입니다." };
  let ok = false;
  let message = "";
  try {
    message = await adapter.test({ provider: p, key: p.kind === "mock" ? "" : decryptSensitive(p.api_key_enc) });
    ok = true;
  } catch (error) {
    message = publicError(error);
    const raw = (error as Error).message || "";
    if (/\((401|403)\)/.test(raw)) message = "API 키가 올바르지 않거나 권한이 없습니다.";
  }
  tx((db) => {
    const x = (db.ai_providers ?? []).find((y) => y.id === id);
    if (!x) return;
    x.status = ok ? "ok" : "error";
    x.last_test_at = now();
    x.last_test_message = message.slice(0, 300);
    if (ok) {
      x.fail_streak = 0;
      x.cooldown_until = null;
    }
    x.updated_at = now();
    audit(db, { actorId: admin.id, action: "ai_provider_test", targetTable: "ai_providers", targetId: id, after: { ok } });
  });
  revalidatePath("/admin/ai-shorts/providers");
  return { ok, message: ok ? `연결 성공: ${message}` : `연결 실패: ${message}` };
}

// --- 모델 -----------------------------------------------------------------------
export async function updateModelAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = requireAdmin();
  const id = String(fd.get("model_id_ref") || "");
  const cost = Number(fd.get("cost_usd"));
  const price = Number(fd.get("price_funny") || 0);
  const maxSec = fd.get("max_seconds") ? Math.floor(Number(fd.get("max_seconds"))) : null;
  if (!Number.isFinite(cost) || cost < 0 || cost > 100) return { ok: false, message: "원가(USD)를 확인하세요." };
  if (!Number.isFinite(price) || price < 0 || price > 1_000_000) return { ok: false, message: "판매가(퍼니)를 확인하세요." };
  const modelId = String(fd.get("model_id") || "").trim();
  if (!/^[\w.:/@-]{2,200}$/.test(modelId)) return { ok: false, message: "모델 ID 형식을 확인하세요." };
  tx((db) => {
    const m = (db.ai_models ?? []).find((x) => x.id === id);
    if (!m) return;
    m.label = String(fd.get("label") || m.label).trim().slice(0, 80) || m.label;
    m.model_id = modelId;
    m.cost_usd = cost;
    m.price_funny = Math.round(price * 100) / 100;
    m.max_seconds = maxSec && maxSec > 0 ? Math.min(600, maxSec) : null;
    m.active = fd.get("active") === "on";
    m.updated_at = now();
    audit(db, { actorId: admin.id, action: "ai_model_update", targetTable: "ai_models", targetId: m.id, after: { cost, price, active: m.active } });
  });
  revalidateAll();
  return { ok: true, message: "모델을 저장했습니다." };
}

export async function addModelAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = requireAdmin();
  const providerId = String(fd.get("provider_id") || "");
  const capability = String(fd.get("capability") || "") as AiCapability;
  const modelId = String(fd.get("model_id") || "").trim();
  const cost = Number(fd.get("cost_usd"));
  if (!AI_CAPABILITIES.includes(capability)) return { ok: false, message: "작업 종류를 선택하세요." };
  if (!/^[\w.:/@-]{2,200}$/.test(modelId)) return { ok: false, message: "모델 ID 형식을 확인하세요." };
  if (!Number.isFinite(cost) || cost < 0 || cost > 100) return { ok: false, message: "원가(USD)를 확인하세요." };
  let error = "";
  tx((db) => {
    const p = (db.ai_providers ?? []).find((x) => x.id === providerId);
    if (!p) {
      error = "공급사를 찾을 수 없습니다.";
      return;
    }
    if (!adapterFor(p.kind)?.capabilities.includes(capability)) {
      error = "이 공급사는 해당 작업을 지원하지 않습니다.";
      return;
    }
    const m: AiModel = {
      id: genId(),
      provider_id: p.id,
      capability,
      model_id: modelId,
      label: String(fd.get("label") || modelId).trim().slice(0, 80),
      cost_usd: cost,
      price_funny: 0,
      max_seconds: capability === "video" || capability === "music" ? Math.max(1, Math.floor(Number(fd.get("max_seconds") || 10))) : null,
      active: true,
      created_at: now(),
      updated_at: now(),
    };
    aiTables(db).models.push(m);
    audit(db, { actorId: admin.id, action: "ai_model_add", targetTable: "ai_models", targetId: m.id });
  });
  if (error) return { ok: false, message: error };
  revalidateAll();
  return { ok: true, message: "모델을 추가했습니다." };
}

/** 관리자 시험 생성 (퍼니 차감 없음 · 플랫폼 비용) — 대본·이미지·음성만 */
export async function testModelAction(_prev: ActionState & { preview?: string; previewType?: string }, fd: FormData): Promise<ActionState & { preview?: string; previewType?: string }> {
  requireAdmin();
  const id = String(fd.get("model_id_ref") || "");
  const db = getDb();
  const m = (db.ai_models ?? []).find((x) => x.id === id);
  const p = m ? (db.ai_providers ?? []).find((x) => x.id === m.provider_id) : undefined;
  if (!m || !p) return { ok: false, message: "모델을 찾을 수 없습니다." };
  if (m.capability === "video" || m.capability === "music") return { ok: false, message: "영상·음악은 비용과 시간이 많이 들어 시험 생성을 지원하지 않습니다. 크리에이터 베타 계정으로 확인하세요." };
  const adapter = adapterFor(p.kind);
  if (!adapter) return { ok: false, message: "이 환경에서 쓸 수 없는 공급사입니다." };
  try {
    const input =
      m.capability === "text"
        ? { prompt: '한 문장으로 자기소개를 JSON {"text":""} 으로 답해 주세요.', maxTokens: 200, json: true }
        : m.capability === "image"
          ? { prompt: "A cute honey bee mascot waving, vertical 9:16, bright, no text", aspect: "9:16" }
          : { text: "안녕하세요, 바이브퍼니 AI 숏츠 음성 시험입니다." };
    const out = await adapter.run({ provider: p, model: m, capability: m.capability, input, key: p.kind === "mock" ? "" : decryptSensitive(p.api_key_enc) });
    if (out.status !== "done") return { ok: true, message: "요청이 접수되었습니다(비동기 처리 모델)." };
    if (m.capability === "text") return { ok: true, message: `응답: ${String(out.result.text || "").slice(0, 300)}` };
    const buf = out.result.data;
    if (!buf) return { ok: true, message: "결과가 주소로 반환되었습니다(정상)." };
    const sniff = sniffMime(buf);
    if (!sniff) return { ok: false, message: "결과 형식을 확인할 수 없습니다." };
    if (buf.length > 3 * 1024 * 1024) return { ok: true, message: `생성 성공 (${Math.round(buf.length / 1024)}KB)` };
    return { ok: true, message: "생성 성공", preview: `data:${sniff.mime};base64,${buf.toString("base64")}`, previewType: sniff.mime };
  } catch (error) {
    return { ok: false, message: `실패: ${publicError(error)}` };
  }
}

// --- 작업 강제 취소 -----------------------------------------------------------------
export async function adminCancelJobAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const id = String(fd.get("job_id") || "");
  try {
    tx((db) => {
      const job = cancelJob(db, id, admin);
      notifyUser(db, { recipientId: job.user_id, title: "AI 숏츠 작업 취소", message: "관리자가 작업을 취소해 예약한 퍼니를 모두 돌려드렸습니다.", link: `/creator/ai-shorts/${job.project_id}` });
    });
  } catch {
    /* 이미 끝난 작업 */
  }
  revalidatePath("/admin/ai-shorts/jobs");
}

// --- 퍼니 지급·회수 ---------------------------------------------------------------
export async function adjustFunnyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const admin = requireAdmin();
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const amount = Math.floor(Number(fd.get("amount") || 0));
  const mode = fd.get("mode") === "revoke" ? "revoke" : "grant";
  const memo = String(fd.get("memo") || "").trim();
  if (!email) return { ok: false, message: "크리에이터 이메일을 입력하세요." };
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 10_000_000) return { ok: false, message: "퍼니 수량을 확인하세요." };
  if (memo.length < 2) return { ok: false, message: "사유를 입력하세요. (감사 로그에 남습니다)" };
  try {
    tx((db) => {
      const user = db.profiles.find((p) => p.email.toLowerCase() === email && p.role === "creator");
      if (!user) throw new FunnyError("크리에이터 계정을 찾을 수 없습니다.");
      if (mode === "grant") grantFunny(db, { userId: user.id, amount, memo: `관리자 지급: ${memo}`, actorId: admin.id });
      else revokeFunny(db, { userId: user.id, amount, memo: `관리자 회수: ${memo}`, actorId: admin.id });
      audit(db, { actorId: admin.id, action: mode === "grant" ? "funny_grant" : "funny_revoke", targetTable: "funny_wallets", targetId: user.id, after: { amount, memo } });
      notifyUser(db, {
        recipientId: user.id,
        title: mode === "grant" ? "퍼니 지급" : "퍼니 회수",
        message: `${formatFunny(amount)}가 ${mode === "grant" ? "지급" : "회수"}되었습니다. 사유: ${memo}`,
        link: "/creator/funny",
      });
    });
  } catch (error) {
    return { ok: false, message: error instanceof FunnyError ? error.message : "처리하지 못했습니다." };
  }
  revalidatePath("/admin/ai-shorts/funny");
  return { ok: true, message: `${email} 에게 ${formatFunny(amount)}를 ${mode === "grant" ? "지급" : "회수"}했습니다.` };
}

export async function getKinds() {
  requireAdmin();
  return KINDS.filter((k) => k !== "mock" || mockAllowed());
}
