import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, StatCard, Table, Th, Td, Badge, EmptyState, LinkButton, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatKRW } from "@/lib/money";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/schema";
import { updateOrderShippingAction, setOrderStatusAction } from "@/lib/actions/commerce-actions";

export const dynamic = "force-dynamic";

const tone: Record<OrderStatus, "yellow" | "blue" | "purple" | "green" | "gray"> = {
  paid: "yellow", preparing: "blue", shipped: "purple", delivered: "green", cancelled: "gray",
};
const COURIERS = ["CJ대한통운", "한진택배", "롯데택배", "우체국택배", "로젠택배", "쿠팡로지스틱스"];

export default function AdminOrdersPage() {
  requireRole("admin");
  const db = getDb();
  const orders = [...db.product_orders].sort((a, b) => (a.ordered_at < b.ordered_at ? 1 : -1));

  const totalSales = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.amount, 0);
  const toShip = orders.filter((o) => o.status === "paid" || o.status === "preparing").length;
  const totalCommission = orders.filter((o) => o.status !== "cancelled").reduce((s, o) => s + o.creator_commission, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="쇼츠 판매 / 발주 / 배송"
        description="크리에이터가 쇼츠 커머스로 판매한 내역을 확인하고, 발주서를 확인해 배송 처리합니다. (카페24 주문 방식)"
        action={<LinkButton href="/admin/products" variant="outline" size="sm">상품 목록</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="총 판매액" value={formatKRW(totalSales)} accent="purple" />
        <StatCard label="배송 대기" value={`${toShip}건`} accent="pink" />
        <StatCard label="크리에이터 적립 합계" value={formatKRW(totalCommission)} accent="yellow" />
      </div>

      {orders.length === 0 ? (
        <EmptyState title="판매 내역이 없습니다" description="크리에이터가 쇼츠로 상품을 판매하면 여기에 표시됩니다." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>주문번호</Th><Th>상품</Th><Th>수량</Th><Th>결제액</Th>
              <Th>판매 크리에이터</Th><Th>수령인</Th><Th>상태</Th><Th>배송처리</Th><Th>발주서</Th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <Td className="font-mono text-xs">{o.order_no}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    {o.product_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.product_image} alt="" className="h-9 w-9 rounded object-cover" />
                    ) : <div className="h-9 w-9 rounded bg-gray-100" />}
                    <span className="max-w-[160px] truncate font-medium text-gray-900">{o.product_name}</span>
                  </div>
                </Td>
                <Td>{o.quantity}</Td>
                <Td>{formatKRW(o.amount)}</Td>
                <Td className="text-gray-600">{o.creator_name}</Td>
                <Td>
                  <div className="text-gray-900">{o.buyer_name}</div>
                  <div className="max-w-[180px] truncate text-xs text-gray-400">{o.address}</div>
                </Td>
                <Td>
                  <Badge tone={tone[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                  {o.tracking_no && <div className="mt-0.5 text-[10px] text-gray-400">{o.courier} {o.tracking_no}</div>}
                </Td>
                <Td>
                  {o.status === "shipped" || o.status === "delivered" ? (
                    <form action={setOrderStatusAction} className="flex items-center gap-1">
                      <input type="hidden" name="order_id" value={o.id} />
                      <input type="hidden" name="status" value="delivered" />
                      {o.status === "shipped" ? <SubmitButton size="sm" variant="outline">배송완료 처리</SubmitButton> : <span className="text-xs text-green-600">완료</span>}
                    </form>
                  ) : o.status === "cancelled" ? (
                    <span className="text-xs text-gray-400">취소됨</span>
                  ) : (
                    <form action={updateOrderShippingAction} className="flex flex-wrap items-end gap-1">
                      <input type="hidden" name="order_id" value={o.id} />
                      <Select name="courier" defaultValue={COURIERS[0]} className="h-8 w-28 text-xs">
                        {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </Select>
                      <Input name="tracking_no" placeholder="운송장번호" className="h-8 w-28 text-xs" />
                      <SubmitButton size="sm">발송</SubmitButton>
                    </form>
                  )}
                </Td>
                <Td>
                  <LinkButton href={`/admin/products/orders/${o.id}`} size="sm" variant="ghost">발주서</LinkButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
