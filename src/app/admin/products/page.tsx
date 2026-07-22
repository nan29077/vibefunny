import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, Table, Th, Td, Badge, EmptyState, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatKRW } from "@/lib/money";
import { categoryPath } from "@/lib/commerce";
import { cafe24StatusSummary } from "@/lib/cafe24";
import { CAFE24_SYNC_LABELS, PRODUCT_DISPLAY_LABELS, PRODUCT_SELL_LABELS } from "@/lib/schema";
import {
  syncProductToCafe24Action,
  toggleProductDisplayAction,
  deleteProductAction,
} from "@/lib/actions/commerce-actions";

export const dynamic = "force-dynamic";

const syncTone: Record<string, "gray" | "yellow" | "green" | "red"> = {
  not_synced: "gray", pending: "yellow", synced: "green", failed: "red",
};

export default function AdminProductsPage() {
  const db = getDb();
  requireRole("admin");
  const products = [...db.products].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const cats = db.product_categories;
  const status = cafe24StatusSummary(db.settings.cafe24);

  return (
    <div className="space-y-6">
      <PageHeader
        title="상품 관리"
        description="최고관리자가 상품을 등록하면 카페24에 연동되고, 크리에이터가 쇼츠에 연동할 수 있습니다."
        action={
          <div className="flex gap-2">
            <LinkButton href="/admin/products/orders" variant="outline" size="sm">판매/발주</LinkButton>
            <LinkButton href="/admin/products/categories" variant="outline" size="sm">카테고리</LinkButton>
            <LinkButton href="/admin/products/cafe24" variant="outline" size="sm">카페24 설정</LinkButton>
            <LinkButton href="/admin/products/new" size="sm">+ 상품 등록</LinkButton>
          </div>
        }
      />

      <Card className={status.configured ? "border-green-200 bg-green-50" : "border-brand-yellow/40 bg-brand-yellow/5"}>
        <p className="text-sm text-gray-700">
          카페24 연동 상태: <b>{status.reason}</b>
          {!status.configured && " — 키를 입력하기 전까지는 미리보기(mock)로 동작하며 실제 카페24에는 등록되지 않습니다."}
        </p>
      </Card>

      {products.length === 0 ? (
        <EmptyState
          title="등록된 상품이 없습니다"
          description="첫 상품을 등록해 쇼츠 커머스를 시작하세요."
          action={<LinkButton href="/admin/products/new" size="sm">상품 등록</LinkButton>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>상품</Th><Th>카테고리</Th><Th>판매가</Th><Th>재고</Th>
              <Th>수수료</Th><Th>상태</Th><Th>카페24</Th><Th>관리</Th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    {p.main_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.main_image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-gray-100" />
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-400">{p.product_code}</div>
                    </div>
                  </div>
                </Td>
                <Td className="text-xs">{categoryPath(cats, p.category_id)}</Td>
                <Td>{formatKRW(p.price)}</Td>
                <Td>{p.stock.toLocaleString("ko-KR")}</Td>
                <Td>{p.commission_rate}%</Td>
                <Td>
                  <div className="flex flex-col gap-1">
                    <Badge tone={p.display_status === "displayed" ? "green" : "gray"}>
                      {PRODUCT_DISPLAY_LABELS[p.display_status]}
                    </Badge>
                    <Badge tone={p.sell_status === "selling" ? "blue" : "gray"}>
                      {PRODUCT_SELL_LABELS[p.sell_status]}
                    </Badge>
                  </div>
                </Td>
                <Td>
                  <Badge tone={syncTone[p.cafe24_sync_status]}>
                    {CAFE24_SYNC_LABELS[p.cafe24_sync_status]}
                    {p.cafe24_mode === "mock" && p.cafe24_sync_status === "synced" ? " (미리보기)" : ""}
                  </Badge>
                  {p.cafe24_product_no && (
                    <div className="mt-0.5 text-[10px] text-gray-400">No.{p.cafe24_product_no}</div>
                  )}
                  {p.cafe24_sync_error && (
                    <div className="mt-0.5 max-w-[160px] truncate text-[10px] text-red-500" title={p.cafe24_sync_error}>
                      {p.cafe24_sync_error}
                    </div>
                  )}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    <form action={syncProductToCafe24Action}>
                      <input type="hidden" name="product_id" value={p.id} />
                      <SubmitButton size="sm" variant="outline">카페24 연동</SubmitButton>
                    </form>
                    <form action={toggleProductDisplayAction}>
                      <input type="hidden" name="product_id" value={p.id} />
                      <SubmitButton size="sm" variant="ghost">
                        {p.display_status === "displayed" ? "숨김" : "진열"}
                      </SubmitButton>
                    </form>
                    <form action={deleteProductAction}>
                      <input type="hidden" name="product_id" value={p.id} />
                      <SubmitButton size="sm" variant="danger">삭제</SubmitButton>
                    </form>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
