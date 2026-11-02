"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb, tx } from "../db";
import { getCurrentUser } from "../auth";
import { getPaymentProvider, paymentProviderReady } from "../payment/provider";
import { applyPaymentEffects } from "../payment/effects";
import { audit, createPayment } from "../services";
import { funnyChargeAllowed } from "../ai/settings";
import { notifyAdmins } from "../campaign-workflow";

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
  // 운영 환경에서 PG가 연동되지 않았으면 결제를 시도하지 않는다 (Mock은 항상 실패 → '결제 실패' 기록만 쌓이는 문제)
  if (!paymentProviderReady()) return;

  const db0 = getDb();
  const payment0 = db0.payments.find((p) => p.id === paymentId);
  if (!payment0) return;
  // 본인 결제만 처리 (관리자 제외)
  if (payment0.user_id !== user.id && user.role !== "admin") return;
  if (payment0.status !== "pending") return;

  // 퍼니 충전: AI 숏츠 스위치가 꺼졌거나(또는 대상이 아니거나) AI 준비가 안 됐으면 실제 결제 승인 전에 취소한다
  const owner = db0.profiles.find((p) => p.id === payment0.user_id) ?? null;
  if (payment0.payment_type === "funny_charge" && !funnyChargeAllowed(db0, owner).ok) {
    tx((db) => {
      const payment = db.payments.find((p) => p.id === paymentId);
      if (!payment || payment.status !== "pending") return;
      payment.status = "cancelled";
      payment.metadata_json = { ...payment.metadata_json, cancel_reason: "ai_shorts_closed" };
      audit(db, { actorId: user.id, action: "funny_charge_blocked", targetTable: "payments", targetId: payment.id });
    });
    revalidatePath("/", "layout");
    return;
  }

  // 가입비: 결제 대기 중 관리자가 가입비 금액을 바꾸거나 제도를 껐다면 옛 금액으로 승인하지 않는다
  if (payment0.payment_type === "signup_fee") {
    const fee = db0.settings.fees[(owner?.role === "advertiser" ? "advertiser" : "creator")];
    const current = fee?.signup_fee_enabled ? fee.signup_fee_amount ?? 0 : 0;
    if (current <= 0 || current !== payment0.amount) {
      tx((db) => {
        const payment = db.payments.find((p) => p.id === paymentId);
        if (!payment || payment.status !== "pending") return;
        payment.status = "cancelled";
        payment.metadata_json = { ...payment.metadata_json, cancel_reason: "fee_changed" };
        audit(db, { actorId: user.id, action: "signup_fee_stale_cancelled", targetTable: "payments", targetId: payment.id });
      });
      revalidatePath("/", "layout");
      redirect("/payment/activate");
    }
  }

  // 동시 승인 방지: 승인 중 표시를 먼저 걸어 두고(10분 유효, 승인 예외 시 즉시 해제), 이미 다른 요청이 승인 중이면 중단한다
  const lockToken = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const claimed = tx((db) => {
    const payment = db.payments.find((p) => p.id === paymentId);
    if (!payment || payment.status !== "pending") return false;
    const lockAt = Number(payment.metadata_json?.confirm_lock_at ?? 0);
    if (lockAt && Date.now() - lockAt < 10 * 60 * 1000) return false;
    payment.metadata_json = { ...payment.metadata_json, confirm_lock_at: Date.now(), confirm_lock: lockToken };
    return true;
  });
  if (!claimed) return;

  // 프로바이더 승인 시도 (Mock)
  const provider = getPaymentProvider();
  let result: Awaited<ReturnType<typeof provider.confirm>>;
  // 이전 시도에서 PG 승인은 됐지만 반영(tx)이 실패한 건: 승인을 다시 부르지 않고 반영만 다시 한다 (이중 승인·실패 처리 방지)
  const approvedBefore = typeof payment0.metadata_json?.provider_payment_id_pending === "string" ? String(payment0.metadata_json.provider_payment_id_pending) : "";
  try {
    result = approvedBefore ? { providerPaymentId: approvedBefore, success: true } : await provider.confirm(
      { paymentId, amount: payment0.amount, orderName: payment0.payment_type },
      { forceFail }
    );
  } catch (error) {
    // 승인 호출이 예외로 끝나면 승인 중 표시를 풀어 다시 시도할 수 있게 한다
    tx((db) => {
      const payment = db.payments.find((p) => p.id === paymentId);
      if (!payment || payment.metadata_json?.confirm_lock !== lockToken) return;
      const { confirm_lock: _l, confirm_lock_at: _a, ...rest } = payment.metadata_json ?? {};
      void _l; void _a;
      payment.metadata_json = rest;
    });
    throw error;
  }

  try {
  tx((db) => {
    const payment = db.payments.find((p) => p.id === paymentId);
    if (!payment || payment.status !== "pending") return; // 멱등성 보장
    if (payment.metadata_json?.confirm_lock !== lockToken) return; // 다른 요청이 승인 표시를 가져감
    const { confirm_lock: _lock, confirm_lock_at: _lockAt, provider_payment_id_pending: _pending, ...restMeta } = payment.metadata_json ?? {};
    void _lock; void _lockAt; void _pending;
    payment.metadata_json = restMeta;

    payment.provider_payment_id = result.providerPaymentId;
    if (!result.success) {
      payment.status = "failed";
      // 제작 의뢰 결제가 실패하면 의뢰가 결제대기로 남아 정리할 수 없던 문제 — 의뢰도 함께 취소한다
      if (payment.payment_type === "custom_video_order") {
        const reqId = String(payment.metadata_json?.request_id ?? "");
        const req = db.custom_video_requests.find((r) => r.id === reqId);
        if (req && req.status === "payment_pending") { req.status = "cancelled"; req.updated_at = now(); }
      }
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
    // 결제 성공 효과 (회원활성·바이브회원 전환/포인트충전/의뢰open/퍼니)
    applyPaymentEffects(db, payment);
    audit(db, {
      actorId: user.id,
      // 결제 효과 적용 중 취소된 경우(이미 바이브회원·충전 불가 등)는 '결제 완료'로 기록하지 않는다
      action: payment.status === "paid" ? "payment_paid" : "payment_confirmed_but_cancelled",
      targetTable: "payments",
      targetId: payment.id,
      after: { type: payment.payment_type, amount: payment.amount, status: payment.status },
    });
  });
  } catch (error) {
    // 승인 후 반영(tx)이 실패하면 저장된 것이 없으므로 승인 중 표시를 풀고 관리자에게 알린다
    // (실 PG 연동 시: 승인은 됐는데 반영이 안 된 상태 → 관리자 확인·승인취소 필요)
    try {
      tx((db) => {
        const payment = db.payments.find((p) => p.id === paymentId);
        if (payment && payment.metadata_json?.confirm_lock === lockToken) {
          const { confirm_lock: _l, confirm_lock_at: _a, ...rest } = payment.metadata_json ?? {};
          void _l; void _a;
          payment.metadata_json = { ...rest, last_apply_error_at: new Date().toISOString(), ...(result.success ? { provider_payment_id_pending: result.providerPaymentId } : {}) };
        }
        notifyAdmins(db, { title: "결제 승인 후 반영에 실패했습니다", message: `결제 ${paymentId} · ${result.success ? "PG 승인됨 — 확인 필요" : "승인 실패 건"}`, link: "/admin/payments" });
      });
    } catch { /* 저장 자체가 안 되는 상황 — 원래 오류를 그대로 던진다 */ }
    throw error;
  }

  revalidatePath("/", "layout");
}

/**
 * 가입비 결제 시작/재결제
 * - 크리에이터 일반회원(결제 전) 또는 결제 대기(pending) 회원이 가입비 결제를 시작한다.
 * - 대기 중인 결제가 있고 금액이 현재 가입비와 같으면 그대로 쓰고, 금액이 바뀌었으면 취소 후 새로 만든다.
 * - 관리자가 그 사이 가입비를 껐다면(0원 포함) 결제 없이 바로 활성화(크리에이터는 바이브회원)한다.
 */
export async function retrySignupPaymentAction(): Promise<void> {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  tx((db) => {
    const profile = db.profiles.find((p) => p.id === user.id);
    if (!profile) return;
    const isCreator = profile.role === "creator";
    // 결제할 필요가 없는 회원: 이미 활성인 비(非)크리에이터, 이미 바이브회원인 크리에이터
    if (!isCreator && profile.status !== "pending") return;
    if (isCreator && (profile.vibe_member_at || profile.status !== "active")) return;
    const fee = db.settings.fees[profile.role];
    const needsFee = !!fee && fee.signup_fee_enabled && fee.signup_fee_amount > 0;
    if (!needsFee) {
      profile.status = "active";
      if (isCreator) profile.vibe_member_at = now();
      profile.updated_at = now();
      audit(db, { actorId: profile.id, action: "signup_activated_without_fee", targetTable: "profiles", targetId: profile.id });
      return;
    }
    // 이미 가입비를 낸 기록이 있으면(관리자가 일반회원으로 바꾼 경우 등) 다시 결제시키지 않는다 — 이중 결제 방지
    if (db.payments.some((p) => p.user_id === profile.id && p.payment_type === "signup_fee" && p.status === "paid")) return;
    const pending = db.payments.find((p) => p.user_id === profile.id && p.payment_type === "signup_fee" && p.status === "pending");
    if (pending && pending.amount === fee.signup_fee_amount) return;
    if (pending) {
      pending.status = "cancelled";
      pending.metadata_json = { ...pending.metadata_json, cancel_reason: "fee_amount_changed" };
    }
    const payment = createPayment(db, { userId: profile.id, paymentType: "signup_fee", amount: fee.signup_fee_amount });
    audit(db, { actorId: profile.id, action: "signup_payment_start", targetTable: "payments", targetId: payment.id });
  });
  revalidatePath("/payment/activate");
  redirect("/payment/activate");
}
