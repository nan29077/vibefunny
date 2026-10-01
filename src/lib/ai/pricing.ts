import type { AiCapability, AiModel, AiShortsSettings } from "../schema";
import { FUNNY_WON } from "../funny";
import { videoSeconds, type AiInput } from "./providers";

// ===========================================================================
// 퍼니 가격 계산
//   단위당 퍼니 = (관리자 고정가) 또는 원가USD × 환율 × 마진% ÷ 1퍼니 원화(10원)
//   작업 퍼니   = 올림(단위 × 단위당 퍼니), 최소 1퍼니
// 단위: 대본 1천 토큰 · 이미지 1장 · 영상 1초(모델이 실제로 만드는 길이) · 음성 1천 자 · 음악 1초
// ===========================================================================

export function funnyPerUnit(model: Pick<AiModel, "price_funny" | "cost_usd">, settings: Pick<AiShortsSettings, "usd_krw_rate" | "margin_rate">): number {
  const fixed = Number(model.price_funny || 0);
  if (fixed > 0) return fixed;
  const margin = Math.max(100, Number(settings.margin_rate) || 100);
  return (Number(model.cost_usd || 0) * Number(settings.usd_krw_rate || 0) * margin) / 100 / FUNNY_WON;
}

export function unitsFor(capability: AiCapability, input: AiInput, model?: Pick<AiModel, "model_id" | "max_seconds"> | null): number {
  if (capability === "text") {
    const chars = String(input.system || "").length + String(input.prompt || "").length;
    return (chars / 2 + (input.maxTokens || 3000) * 0.6) / 1000;
  }
  if (capability === "image") return 1;
  if (capability === "video") return model?.model_id ? videoSeconds(model.model_id, input.seconds) : Math.max(1, Number(input.seconds) || 5);
  if (capability === "tts") return Math.max(0.1, String(input.text || "").length / 1000);
  if (capability === "music") {
    const s = Math.max(5, Math.round(Number(input.seconds) || 30));
    return model?.max_seconds ? Math.min(s, model.max_seconds) : s;
  }
  return 1;
}

export function funnyFor(model: Pick<AiModel, "price_funny" | "cost_usd">, settings: Pick<AiShortsSettings, "usd_krw_rate" | "margin_rate">, units: number): number {
  return Math.max(1, Math.ceil(units * funnyPerUnit(model, settings) - 1e-9));
}

export function costWonFor(model: Pick<AiModel, "cost_usd">, settings: Pick<AiShortsSettings, "usd_krw_rate">, units: number): number {
  return Math.round(units * Number(model.cost_usd || 0) * Number(settings.usd_krw_rate || 0));
}

/** 관리자 화면: 단위당 판매가·원가·마진 */
export function priceSummary(model: AiModel, settings: AiShortsSettings) {
  const perUnit = funnyPerUnit(model, settings);
  const costWon = Number(model.cost_usd || 0) * Number(settings.usd_krw_rate || 0);
  const saleWon = perUnit * FUNNY_WON;
  return {
    perUnitFunny: Math.round(perUnit * 100) / 100,
    costWon: Math.round(costWon * 100) / 100,
    saleWon: Math.round(saleWon * 100) / 100,
    marginWon: Math.round((saleWon - costWon) * 100) / 100,
    belowCost: saleWon < costWon,
  };
}
