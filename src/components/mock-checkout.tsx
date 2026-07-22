"use client";

import { confirmPaymentAction } from "@/lib/actions/payment-actions";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatKRW } from "@/lib/money";

/**
 * Mock 결제창 (요구사항 13). 실제 PG 대신 성공/실패 버튼 제공.
 * 운영 전환 시 이 컴포넌트를 Toss 결제위젯으로 교체한다.
 */
export function MockCheckout({
  paymentId,
  amount,
  orderName,
}: {
  paymentId: string;
  amount: number;
  orderName: string;
}) {
  return (
    <Card className="border-dashed">
      <div className="mb-1 inline-flex rounded-full bg-brand-yellow/30 px-2 py-0.5 text-xs font-semibold text-yellow-800">
        Mock Payment
      </div>
      <h2 className="text-lg font-bold text-gray-900">{orderName}</h2>
      <p className="mt-1 text-3xl font-extrabold text-brand-purple">{formatKRW(amount)}</p>
      <p className="mt-2 text-xs text-gray-500">
        데모용 결제입니다. 실제 금액이 청구되지 않습니다.
      </p>
      <div className="mt-5 flex gap-2">
        <form action={confirmPaymentAction} className="flex-1">
          <input type="hidden" name="payment_id" value={paymentId} />
          <SubmitButton className="w-full">결제 성공</SubmitButton>
        </form>
        <form action={confirmPaymentAction} className="flex-1">
          <input type="hidden" name="payment_id" value={paymentId} />
          <input type="hidden" name="force_fail" value="1" />
          <SubmitButton variant="outline" className="w-full">
            결제 실패
          </SubmitButton>
        </form>
      </div>
    </Card>
  );
}
