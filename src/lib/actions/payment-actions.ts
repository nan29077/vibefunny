"use server";

import { revalidatePath } from "next/cache";
import { getDb, tx } from "../db";
import { getCurrentUser } from "../auth";
import { getPaymentProvider } from "../payment/provider";
import { applyPaymentEffects } from "../payment/effects";
import { audit } from "../services";

const now = () => new Date().toISOString();

/**
 * Mock 결제 승인/실패 처리 (요구사항 13).
 * 결제 성공 시 payments.status=paid 로 바꾸고 비즈니스 효과를 적용한다.
 * 동일 결제 중복 처리 방지를 위해 pending 상태에서만 동작한다.
 */
export async function confirmPaymentAction(formData: FormData): Promise<void> {
  const paymentId = String(formData.get("payment_id") || "");
  const forceFail = formData.get("force_fail") === "1";

  const user = getCurrentUser();
  if (!user) return;

  const db0 = getDb();
  const payment0 = db0.payments.find((p) => p.id === paymentId);
  if (!payment0) return;
  // 본인 결제만 처리 (관리자 제외)
  if (payment0.user_id !== user.id && user.role !== "admin") return;
  if (payment0.status !== "pending") return;

  // 프로바이더 승인 시도 (Mock)
  const provider = getPaymentProvider();
  const result = await provider.confirm(
    { paymentId, amount: payment0.amount, orderName: payment0.payment_type },
    { forceFail }
  );

  tx((db) => {
    const payment = db.payments.find((p) => p.id === paymentId);
    if (!payment || payment.status !== "pending") return; // 멱등성 보장

    payment.provider_payment_id = result.providerPaymentId;
    if (!result.success) {
      payment.status = "failed";
      audit(db, {
        actorId: user.id,
        action: "payment_failed",
        targetTable: "payments",
        targetId: payment.id,
      });
      return;
    }

    payment.status = "paid";
    payment.paid_at = now();
    // 결제 성공 효과 (회원활성/포인트충전/영상sold/의뢰open/구독)
    applyPaymentEffects(db, payment);
    audit(db, {
      actorId: user.id,
      action: "payment_paid",
      targetTable: "payments",
      targetId: payment.id,
      after: { type: payment.payment_type, amount: payment.amount },
    });
  });

  revalidatePath("/", "layout");
}
