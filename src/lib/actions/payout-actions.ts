"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { tx } from "../db";
import { requireUser } from "../auth";
import { genId } from "../crypto";
import { addWalletTx, audit, ensureWallet } from "../services";
import type { ActionState } from "@/components/form";

const now = () => new Date().toISOString();

const payoutSchema = z.object({
  amount: z.coerce.number().int().min(1, "출금액을 입력하세요."),
  bank_name: z.string().min(1, "은행명을 입력하세요."),
  bank_account_number: z.string().min(1, "계좌번호를 입력하세요."),
  account_holder: z.string().min(1, "예금주를 입력하세요."),
  resident_id_number: z.string().optional(),
});

// === 회원: 출금 신청 (5.6) ============================================
export async function requestPayoutAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = requireUser();
  const parsed = payoutSchema.safeParse({
    amount: fd.get("amount"),
    bank_name: fd.get("bank_name"),
    bank_account_number: fd.get("bank_account_number"),
    account_holder: fd.get("account_holder"),
    resident_id_number: fd.get("resident_id_number") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] = i.message;
    return { ok: false, message: "입력값을 확인하세요.", fieldErrors };
  }
  const d = parsed.data;

  const result = tx<ActionState>((db) => {
    const w = ensureWallet(db, user.id);
    if (d.amount > w.available_balance) {
      return { ok: false, message: "지급 가능 잔액을 초과했습니다." };
    }
    // 지급가능 잔액에서 차감하여 보류
    w.available_balance -= d.amount;
    w.updated_at = now();
    const pr = {
      id: genId(),
      user_id: user.id,
      amount: d.amount,
      bank_name: d.bank_name,
      bank_account_number: d.bank_account_number,
      account_holder: d.account_holder,
      resident_id_number: d.resident_id_number ?? null,
      status: "requested" as const,
      admin_memo: null,
      requested_at: now(),
      processed_at: null,
    };
    db.payout_requests.push(pr);
    addWalletTx(db, {
      userId: user.id,
      type: "payout",
      amount: -d.amount,
      status: "requested",
      relatedTable: "payout_requests",
      relatedId: pr.id,
      memo: "출금 신청",
    });
    audit(db, { actorId: user.id, action: "request_payout", targetTable: "payout_requests", targetId: pr.id });
    return { ok: true, message: "출금 신청이 접수되었습니다." };
  });

  if (result.ok) revalidatePath("/creator/wallet");
  return result;
}
