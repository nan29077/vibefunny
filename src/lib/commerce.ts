import type { Product, ProductCategory } from "./schema";

// ===========================================================================
// 쇼츠 커머스 공용 헬퍼 (순수 함수)
// ===========================================================================

export interface CategoryNode extends ProductCategory {
  children: ProductCategory[];
}

/** 대분류 + 하위 중분류 트리 구성 */
export function buildCategoryTree(categories: ProductCategory[]): CategoryNode[] {
  const majors = categories
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order);
  return majors.map((m) => ({
    ...m,
    children: categories
      .filter((c) => c.parent_id === m.id)
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}

/** 카테고리 경로 문자열 (예: "뷰티 > 스킨케어") */
export function categoryPath(categories: ProductCategory[], id: string | null): string {
  if (!id) return "-";
  const cat = categories.find((c) => c.id === id);
  if (!cat) return "-";
  if (cat.parent_id) {
    const parent = categories.find((c) => c.id === cat.parent_id);
    return parent ? `${parent.name} > ${cat.name}` : cat.name;
  }
  return cat.name;
}

/** 크리에이터 예상 수익 = 판매가 × 수수료율% */
export function creatorCommission(product: Product): number {
  return Math.floor((product.price * (product.commission_rate || 0)) / 100);
}

/** 상품이 판매 가능한지 (진열 + 판매중 + 재고) */
export function isSellable(p: Product): boolean {
  return p.display_status === "displayed" && p.sell_status === "selling";
}
