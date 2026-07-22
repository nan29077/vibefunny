import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, Badge, LinkButton, Table, Th, Td } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatKRW } from "@/lib/money";
import { formatDateTime } from "@/lib/date";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/schema";
import { updateOrderShippingAction, setOrderStatusAction } from "@/lib/actions/commerce-actions";
import { Input, Select } from "@/components/ui";

export const dynamic = "force-dynamic";

const tone: Record<OrderStatus, "yellow" | "blue" | "purple" | "green" | "gray"> = {
  paid: "yellow", preparing: "blue", shipped: "purple", delivered: "green", cancelled: "gray",
};
const COURIERS = ["CJ대한통운", "한진택배", "롯데택배", "우체국택배", "로젠택배", "쿠팡로지스틱스"];

export default function OrderDetailPage({ params }: { params: { id: string } }) {
  requireRole("admin");
  const db = getDb();
  const o = db.product_orders.find((x) => x.id === params.id);
  if (!o) notFound();
  const product = db.products.find((p) => p.id === o.product_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">발주서</h1>
          <p className="mt-1 text-sm text-gray-500">주문번호 {o.order_no} · {formatDateTime(o.ordered_at)}</p>
        </div>
        <LinkButton href="/admin/products/orders" variant="outline" size="sm">목록으로</LinkButton>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold">주문 / 배송 상태</h2>
          <Badge tone={tone[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-bold text-gray-700">받는 사람 (배송지)</h3>
            <dl className="space-y-1.5 text-sm">
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-gray-400">수령인</dt><dd className="text-gray-900">{o.buyer_name}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-gray-400">연락처</dt><dd className="text-gray-900">{o.buyer_phone}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-gray-400">우편번호</dt><dd className="text-gray-900">{o.zipcode}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-gray-400">주소</dt><dd className="text-gray-900">{o.address}</dd></div>
              <div className="flex gap-3"><dt className="w-20 shrink-0 text-gray-400">배송메모</dt><dd className="text-gray-900">{o.delivery_memo || "-"}</dd></div>
            </dl>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold text-gray-700">판매 / 정산 정보</h3>
            <dl className="space-y-1.5 text-sm">
              <div className="flex gap-3"><dt className="w-24 shrink-0 text-gray-400">판매 크리에이터</dt><dd className="text-gray-900">{o.creator_name}</dd></div>
              <div className="flex gap-3"><dt className="w-24 shrink-0 text-gray-400">수수료율</dt><dd className="text-gray-900">{o.commission_rate}%</dd></div>
              <div className="flex gap-3"><dt className="w-24 shrink-0 text-gray-400">크리에이터 적립</dt><dd className="font-semibold text-brand-purple">{formatKRW(o.creator_commission)}</dd></div>
              <div className="flex gap-3"><dt className="w-24 shrink-0 text-gray-400">카페24 주문번호</dt><dd className="text-gray-900">{o.cafe24_order_no ?? "미연동"}</dd></div>
              {o.tracking_no && (
                <div className="flex gap-3"><dt className="w-24 shrink-0 text-gray-400">운송장</dt><dd className="text-gray-900">{o.courier} {o.tracking_no}</dd></div>
              )}
            </dl>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-base font-bold">발주 품목</h2>
        <Table>
          <thead>
            <tr><Th>상품</Th><Th>상품코드</Th><Th>단가</Th><Th>수량</Th><Th>금액</Th><Th>공급가</Th></tr>
          </thead>
          <tbody>
            <tr>
              <Td>
                <div className="flex items-center gap-2">
                  {o.product_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.product_image} alt="" className="h-10 w-10 rounded object-cover" />
                  ) : <div className="h-10 w-10 rounded bg-gray-100" />}
                  <span className="font-medium text-gray-900">{o.product_name}</span>
                </div>
              </Td>
              <Td className="font-mono text-xs">{product?.product_code ?? "-"}</Td>
              <Td>{formatKRW(o.unit_price)}</Td>
              <Td>{o.quantity}</Td>
              <Td className="font-semibold">{formatKRW(o.amount)}</Td>
              <Td className="text-gray-500">{product ? formatKRW(product.supply_price * o.quantity) : "-"}</Td>
            </tr>
          </tbody>
        </Table>
      </Card>

      {/* 배송 처리 */}
      {o.status !== "cancelled" && o.status !== "delivered" && (
        <Card>
          <h2 className="mb-3 text-base font-bold">배송 처리</h2>
          {o.status === "shipped" ? (
            <form action={setOrderStatusAction} className="flex items-center gap-3">
              <input type="hidden" name="order_id" value={o.id} />
              <input type="hidden" name="status" value="delivered" />
              <SubmitButton>배송완료 처리</SubmitButton>
            </form>
          ) : (
            <form action={updateOrderShippingAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="order_id" value={o.id} />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">택배사</label>
                <Select name="courier" defaultValue={COURIERS[0]} className="w-40">
                  {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">운송장 번호</label>
                <Input name="tracking_no" placeholder="숫자만 입력" className="w-48" />
              </div>
              <SubmitButton>발송 처리</SubmitButton>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
