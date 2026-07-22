import type { Product, ProductCategory } from "./schema";

// ===========================================================================
// 쇼츠 ↔ 상품 추천 엔진 (순수 함수 — 클라이언트/서버 공용)
// ---------------------------------------------------------------------------
// 크리에이터가 입력한 쇼츠 영상 제목/내용(또는 URL 슬러그)을 기반으로,
// 등록된 상품의 상품명·키워드·카테고리·브랜드와 매칭하여 점수순으로 추천한다.
// ===========================================================================

export interface RecommendInput {
  title?: string;
  content?: string;   // 영상 내용 설명
  shortsUrl?: string; // 유튜브 쇼츠 링크 (슬러그에서 힌트 추출)
}

export interface ScoredProduct {
  product: Product;
  score: number;
  matched: string[]; // 매칭된 키워드(설명용)
}

// 한글/영문 토큰화 (2글자 이상 단어)
function tokenize(text: string): string[] {
  if (!text) return [];
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ") // URL 자체는 분해해서 처리
    .replace(/[^0-9a-z가-힣\s]/g, " ");
  return cleaned
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

// URL 슬러그에서 힌트 추출 (예: youtube.com/shorts/xxxx?title=뷰티세럼)
function urlHints(url: string): string[] {
  if (!url) return [];
  try {
    const decoded = decodeURIComponent(url);
    return tokenize(decoded.replace(/[\/\-_=&?.]/g, " "));
  } catch {
    return tokenize(url.replace(/[\/\-_=&?.]/g, " "));
  }
}

/**
 * 상품 점수 계산.
 * - 키워드 정확 매칭: +5
 * - 상품명 부분 포함: +4
 * - 카테고리명 매칭: +3
 * - 브랜드/요약 포함: +2
 */
export function scoreProduct(
  product: Product,
  tokens: string[],
  categoryName: string
): { score: number; matched: string[] } {
  if (tokens.length === 0) return { score: 0, matched: [] };
  const uniq = Array.from(new Set(tokens));
  const name = product.name.toLowerCase();
  const summary = (product.summary || "").toLowerCase();
  const brand = (product.brand || "").toLowerCase();
  const catName = (categoryName || "").toLowerCase();
  const kws = product.keywords.map((k) => k.toLowerCase());

  let score = 0;
  const matched: string[] = [];

  for (const t of uniq) {
    if (kws.some((k) => k === t || k.includes(t) || t.includes(k))) {
      score += 5;
      matched.push(t);
      continue;
    }
    if (name.includes(t)) {
      score += 4;
      matched.push(t);
      continue;
    }
    if (catName && (catName.includes(t) || t.includes(catName))) {
      score += 3;
      matched.push(t);
      continue;
    }
    if (brand.includes(t) || summary.includes(t)) {
      score += 2;
      matched.push(t);
    }
  }
  return { score, matched: Array.from(new Set(matched)) };
}

/**
 * 추천 상품 목록 반환 (점수 내림차순).
 * 판매 가능(진열+판매중) 상품만 대상으로 한다.
 */
export function recommendProducts(
  products: Product[],
  categories: ProductCategory[],
  input: RecommendInput,
  limit = 6
): ScoredProduct[] {
  const tokens = [
    ...tokenize(input.title || ""),
    ...tokenize(input.content || ""),
    ...urlHints(input.shortsUrl || ""),
  ];
  const catMap = new Map(categories.map((c) => [c.id, c.name] as const));

  const sellable = products.filter(
    (p) => p.display_status === "displayed" && p.sell_status === "selling"
  );

  const scored = sellable
    .map((product) => {
      const cName = product.category_id ? catMap.get(product.category_id) || "" : "";
      const { score, matched } = scoreProduct(product, tokens, cName);
      return { product, score, matched };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // 매칭이 전혀 없으면 최신 상품을 폴백으로 제안
  if (scored.length === 0) {
    return sellable
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit)
      .map((product) => ({ product, score: 0, matched: [] }));
  }
  return scored.slice(0, limit);
}
