import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, LinkButton } from "@/components/ui";
import { buildCategoryTree } from "@/lib/commerce";
import { isCafe24Configured } from "@/lib/cafe24";
import { AdminProductForm } from "@/components/forms/admin-product-form";

export const dynamic = "force-dynamic";

export default function AdminNewProductPage() {
  requireRole("admin");
  const db = getDb();
  const tree = buildCategoryTree(db.product_categories);
  const defaultCommission = db.settings.shorts_commerce_default_commission_rate ?? 10;
  const cafe24Configured = isCafe24Configured(db.settings.cafe24);

  return (
    <div className="space-y-6">
      <PageHeader
        title="상품 등록"
        description="카페24 표준 상품 등록 폼과 동일한 구성입니다. 등록 시 카페24에 연동됩니다."
        action={<LinkButton href="/admin/products" variant="outline" size="sm">목록으로</LinkButton>}
      />
      <AdminProductForm
        categoryTree={tree}
        defaultCommission={defaultCommission}
        cafe24Configured={cafe24Configured}
      />
    </div>
  );
}
