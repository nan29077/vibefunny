import type { Cafe24Settings, Product } from "./schema";

// ===========================================================================
// 카페24 Open API 연동 어댑터 (mock / real)
// ---------------------------------------------------------------------------
// - 설정(enabled=true + mall_id + access_token)이 갖춰지면 실제 카페24 Admin API 호출
// - 아니면 미리보기(mock) 모드로 동작하여 가짜 상품번호를 반환
// - 화면/액션 코드는 동일하게 동작하고, 키만 넣으면 실제 연동으로 전환된다.
// ===========================================================================

export type Cafe24Mode = "real" | "mock";

export interface Cafe24Result {
  ok: boolean;
  mode: Cafe24Mode;
  cafe24_product_no: string | null;
  error: string | null;
  raw?: unknown;
}

/** 실제 연동 가능 여부 (키/토큰이 모두 있고 enabled=true) */
export function isCafe24Configured(s: Cafe24Settings | undefined | null): boolean {
  if (!s) return false;
  return Boolean(s.enabled && s.mall_id?.trim() && s.access_token?.trim());
}

/** 설정 상태를 사람이 읽을 수 있는 요약으로 반환 */
export function cafe24StatusSummary(s: Cafe24Settings | undefined | null): {
  configured: boolean;
  reason: string;
} {
  if (!s) return { configured: false, reason: "설정 없음 (미리보기 모드)" };
  if (!s.enabled) return { configured: false, reason: "연동 비활성화 (미리보기 모드)" };
  if (!s.mall_id?.trim()) return { configured: false, reason: "몰 아이디 미입력" };
  if (!s.access_token?.trim()) return { configured: false, reason: "Access Token 미입력" };
  return { configured: true, reason: "실제 연동 활성화" };
}

/** Product → 카페24 상품 등록 요청 바디로 매핑 */
function toCafe24Body(s: Cafe24Settings, p: Product): Record<string, unknown> {
  return {
    shop_no: s.shop_no || 1,
    request: {
      // 카페24 표준 필드 매핑
      product_name: p.name,
      // 자체 상품코드 (카페24 custom_product_code)
      custom_product_code: p.product_code,
      price: String(p.price),
      retail_price: String(p.retail_price),
      supply_price: String(p.supply_price),
      display: p.display_status === "displayed" ? "T" : "F",
      selling: p.sell_status === "selling" ? "T" : "F",
      description: p.description,
      summary_description: p.summary,
      product_condition: "N",
      brand_code: p.brand ?? undefined,
      origin_place_value: p.origin ?? undefined,
      model_name: p.model_name ?? undefined,
      // 대표 이미지 (URL 업로드 방식은 별도 이미지 API 필요 — 여기서는 detail에 포함)
      // 재고/옵션은 별도 variants API로 등록되나 MVP에서는 옵션 텍스트만 전달
    },
  };
}

/**
 * 상품을 카페24에 등록한다. 실제 키가 없으면 mock 으로 동작.
 */
export async function cafe24CreateProduct(
  settings: Cafe24Settings | undefined | null,
  product: Product
): Promise<Cafe24Result> {
  // ── 미리보기(mock) 모드 ──────────────────────────────────────────────
  if (!isCafe24Configured(settings)) {
    const fakeNo = `MOCK-${Date.now().toString().slice(-8)}`;
    return {
      ok: true,
      mode: "mock",
      cafe24_product_no: fakeNo,
      error: null,
      raw: { mock: true, message: "미리보기 모드: 실제 카페24에 등록되지 않았습니다." },
    };
  }

  // ── 실제 연동 모드 ───────────────────────────────────────────────────
  const s = settings as Cafe24Settings;
  const base = `https://${s.mall_id}.cafe24api.com/api/v2/admin/products`;
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${s.access_token}`,
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": s.api_version || "2024-06-01",
      },
      body: JSON.stringify(toCafe24Body(s, product)),
      // Next 서버 환경에서 캐시 방지
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const err =
        (data as { error?: { message?: string } })?.error?.message ||
        `카페24 API 오류 (HTTP ${res.status})`;
      return { ok: false, mode: "real", cafe24_product_no: null, error: err, raw: data };
    }
    const productNo =
      (data as { product?: { product_no?: number | string } })?.product?.product_no ?? null;
    return {
      ok: true,
      mode: "real",
      cafe24_product_no: productNo != null ? String(productNo) : null,
      error: null,
      raw: data,
    };
  } catch (e) {
    return {
      ok: false,
      mode: "real",
      cafe24_product_no: null,
      error: e instanceof Error ? e.message : "카페24 연동 중 네트워크 오류",
    };
  }
}
