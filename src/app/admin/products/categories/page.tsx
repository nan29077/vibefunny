import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, Field, Input, Select, Badge, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { buildCategoryTree } from "@/lib/commerce";
import { addProductCategoryAction, toggleProductCategoryAction } from "@/lib/actions/commerce-actions";

export const dynamic = "force-dynamic";

export default function AdminProductCategoriesPage() {
  requireRole("admin");
  const db = getDb();
  const tree = buildCategoryTree(db.product_categories);

  return (
    <div className="space-y-6">
      <PageHeader
        title="상품 카테고리"
        description="종합쇼핑몰형 카테고리(대분류 > 중분류)를 관리합니다."
        action={<LinkButton href="/admin/products" variant="outline" size="sm">상품 목록</LinkButton>}
      />

      <Card>
        <h2 className="mb-3 text-base font-bold">카테고리 추가</h2>
        <form action={addProductCategoryAction} className="flex flex-wrap items-end gap-3">
          <Field label="상위 분류" hint="비우면 대분류로 추가됩니다">
            <Select name="parent_id" defaultValue="">
              <option value="">— 대분류로 추가 —</option>
              {tree.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="카테고리명">
            <Input name="name" placeholder="예: 스킨케어" required />
          </Field>
          <SubmitButton size="sm">추가</SubmitButton>
        </form>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {tree.map((major) => (
          <Card key={major.id}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">{major.name}</h3>
              <form action={toggleProductCategoryAction}>
                <input type="hidden" name="id" value={major.id} />
                <button className="transition hover:opacity-80">
                  <Badge tone={major.is_active ? "purple" : "gray"}>
                    {major.is_active ? "활성" : "비활성"}
                  </Badge>
                </button>
              </form>
            </div>
            <div className="flex flex-wrap gap-2">
              {major.children.map((sub) => (
                <form key={sub.id} action={toggleProductCategoryAction}>
                  <input type="hidden" name="id" value={sub.id} />
                  <button className="transition hover:opacity-80">
                    <Badge tone={sub.is_active ? "blue" : "gray"}>
                      {sub.name}{sub.is_active ? "" : " (비활성)"}
                    </Badge>
                  </button>
                </form>
              ))}
              {major.children.length === 0 && (
                <span className="text-xs text-gray-400">하위 분류 없음</span>
              )}
            </div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-gray-400">카테고리를 클릭하면 활성/비활성이 전환됩니다.</p>
    </div>
  );
}
