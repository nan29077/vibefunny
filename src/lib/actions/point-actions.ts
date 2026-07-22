"use server";

import { redirect } from "next/navigation";
import { tx } from "../db";
import { requireRole } from "../auth";
import { createPayment } from "../services";

// === ADVERTISER: 포인트 충전 (5.4) -> Mock 결제 =======================
export async function chargePointsAction(fd: FormData): Promise<void> {
  const user = requireRole("advertiser");
  // 프리셋 또는 직접 입력
  const preset = Math.floor(Number(fd.get("preset") || 0));
  const custom = Math.floor(Number(fd.get("custom") || 0));
  const amount = preset > 0 ? preset : custom;
  if (!amount || amount < 1000) {
    redirect("/advertiser/points?error=amount");
  }

  let pid = "";
  tx((db) => {
    const payment = createPayment(db, {
      userId: user.id,
      paymentType: "point_charge",
      amount,
    });
    pid = payment.id;
  });
  redirect(`/payment/${pid}?next=/advertiser/points`);
}
