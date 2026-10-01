"use server";

import { redirect } from "next/navigation";
import { tx } from "../db";
import { requireRole } from "../auth";
import { createPayment, audit } from "../services";
import { FUNNY_WON } from "../funny";
import { aiShortsAccess, getAiShortsSettings } from "../ai/settings";

// === CREATOR: 퍼니 충전 → 결제 (스위치 OFF 면 충전 불가) ======================
export async function chargeFunnyAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const productId = String(fd.get("product_id") || "");
  const custom = Math.floor(Number(fd.get("custom_won") || 0));

  let pid = "";
  let error = "";
  tx((db) => {
    const access = aiShortsAccess(db, user);
    if (!access.open) {
      error = "closed";
      return;
    }
    const settings = getAiShortsSettings(db);
    const product = settings.charge_products.find((p) => p.id === productId);
    let won = 0;
    let bonus = 0;
    if (product) {
      won = product.won;
      bonus = Math.max(0, Math.floor(product.bonus));
    } else {
      // 직접 입력: 1,000원 ~ 1,000,000원, 100원 단위
      if (!Number.isSafeInteger(custom) || custom < 1_000 || custom > 1_000_000 || custom % 100 !== 0) {
        error = "amount";
        return;
      }
      won = custom;
    }
    const funny = Math.floor(won / FUNNY_WON);
    const payment = createPayment(db, {
      userId: user.id,
      paymentType: "funny_charge",
      amount: won,
      // 결제 시점의 환산 기준을 기록 (나중에 상품 구성을 바꿔도 이 결제는 이 기준으로 지급)
      metadata: { funny, bonus, won_per_funny: FUNNY_WON, product_id: product?.id ?? "custom" },
    });
    audit(db, { actorId: user.id, action: "funny_charge_request", targetTable: "payments", targetId: payment.id, after: { won, funny, bonus } });
    pid = payment.id;
  });
  if (error === "closed") redirect("/creator/funny?error=closed");
  if (error === "amount") redirect("/creator/funny?error=amount");
  redirect(`/payment/${pid}?next=/creator/funny`);
}
