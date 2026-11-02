import type { Database, Payment } from "../schema";
import {
  addPointTx,
  addWalletTx,
  audit,
  createSignupReferralReward,
} from "../services";
import { applyAgencyCommission, notifyAdmins } from "../campaign-workflow";
import { creditFunnyCharge, FUNNY_WON, formatFunny } from "../funny";
import { funnyChargeAllowed } from "../ai/settings";
import { notifyUser } from "../services";

// ===========================================================================
// 결제 성공 시 비즈니스 효과 (요구사항 13). db.tx() 내부에서 호출.
// 멱등 처리를 위해 payment.status === "paid" 로 바뀐 직후 1회만 실행한다.
// ===========================================================================

const now = () => new Date().toISOString();

export function applyPaymentEffects(db: Database, payment: Payment): void {
  switch (payment.payment_type) {
    case "signup_fee": {
      // 가입비 결제 성공 -> 회원 active(+ 크리에이터는 바이브회원 전환) + 멘토(추천인) 수당 생성
      const user = db.profiles.find((p) => p.id === payment.user_id);
      if (user && user.role === "creator" && user.vibe_member_at) {
        // 이미 바이브회원인데 결제가 또 들어온 경우(중복 결제): 수당 없이 결제를 취소 처리
        // (실 PG 연동 시 이 지점에서 승인 취소 API 호출 필요)
        payment.status = "cancelled";
        payment.paid_at = null;
        payment.metadata_json = { ...payment.metadata_json, cancel_reason: "already_vibe_member" };
        audit(db, { actorId: user.id, action: "signup_fee_duplicate_cancelled", targetTable: "payments", targetId: payment.id });
        break;
      }
      if (user) {
        // 결제 대기(pending)만 활성으로 바꾼다 — 정지·탈퇴 회원이 결제했다고 해서 정지가 풀리면 안 된다
        const blocked = user.status === "suspended" || user.status === "withdrawn";
        if (user.status === "pending") user.status = "active";
        if (user.role === "creator") user.vibe_member_at = now();
        user.updated_at = now();
        if (blocked) {
          notifyAdmins(db, {
            title: "정지·탈퇴 회원의 가입비 결제가 확인되었습니다",
            message: `${user.nickname || user.name} (${user.email}) · ${payment.amount.toLocaleString()}원 · 계정 상태(${user.status})는 그대로입니다. 환불 또는 정지 해제를 검토하세요.`,
            link: `/admin/members/${user.id}`,
          });
        }
        // 멘토에게 멘티 결제 완료 알림
        const mentor = user.referred_by_user_id ? db.profiles.find((p) => p.id === user.referred_by_user_id) : null;
        if (user.role === "creator" && mentor && mentor.role === "creator") {
          notifyUser(db, {
            recipientId: mentor.id,
            title: "멘티가 가입비를 결제했습니다",
            message: `${user.nickname || user.name}님이 가입비를 결제해 바이브회원이 되었습니다.`,
            link: "/creator/referrals",
          });
        }
        // 정지·탈퇴 회원 결제는 관리자 검토(환불 등) 대상 — 멘토 수당은 만들지 않는다
        if (!blocked) createSignupReferralReward(db, user.id, payment.amount);
        audit(db, {
          actorId: user.id,
          action: "signup_fee_paid",
          targetTable: "profiles",
          targetId: user.id,
        });
      }
      break;
    }

    case "point_charge": {
      // 포인트 충전 성공 -> 포인트 증가 (ledger)
      addPointTx(db, {
        advertiserId: payment.user_id,
        type: "charge",
        amount: payment.amount,
        paymentId: payment.id,
        memo: "포인트 충전",
      });
      // 수수료 기준이 '대행사 포인트 충전액'일 때만 → 상위 실행사 포인트 지갑에 수수료 적립
      // (다른 기준일 때는 캠페인 승인/완료 시점에 적립되므로 여기서 적립하면 이중 적립)
      if (db.settings.advertiser_commission_basis === "agency_charge") {
        applyAgencyCommission(db, {
          agencyId: payment.user_id,
          baseAmount: payment.amount,
          paymentId: payment.id,
          memo: `소속 대행사 포인트 충전 수수료 (충전액 ${payment.amount.toLocaleString()}원)`,
        });
      }
      break;
    }

    case "funny_charge": {
      // 결제 확인 직전에 스위치가 꺼졌거나 AI 준비가 해제된 경우: 퍼니를 지급하지 않고 결제를 취소 처리
      // (실 PG 연동 시 이 지점에서 승인 취소 API 호출 필요)
      {
        const owner = db.profiles.find((p) => p.id === payment.user_id) ?? null;
        const allowed = funnyChargeAllowed(db, owner);
        if (!allowed.ok) {
          payment.status = "cancelled";
          payment.paid_at = null;
          payment.metadata_json = { ...payment.metadata_json, cancel_reason: "funny_charge_not_allowed" };
          audit(db, { actorId: payment.user_id, action: "funny_charge_cancelled_at_confirm", targetTable: "payments", targetId: payment.id });
          notifyUser(db, {
            recipientId: payment.user_id,
            title: "퍼니 충전이 취소되었습니다",
            message: `${allowed.reason ?? "지금은 퍼니를 충전할 수 없습니다."} 결제 금액은 청구되지 않습니다.`,
            link: "/creator/funny",
          });
          break;
        }
      }
      // 퍼니 충전 성공 → 충전 퍼니 + 보너스 퍼니 지급 (결제 1건당 1회, 결제 시점 환산 기준 사용)
      const meta = payment.metadata_json as { funny?: number; bonus?: number; won_per_funny?: number };
      const rate = Number(meta.won_per_funny) > 0 ? Number(meta.won_per_funny) : FUNNY_WON;
      const funny = Math.floor(Number(meta.funny) > 0 ? Number(meta.funny) : payment.amount / rate);
      const bonus = Math.max(0, Math.floor(Number(meta.bonus) || 0));
      creditFunnyCharge(db, { userId: payment.user_id, paid: funny, bonus, paymentId: payment.id, memo: `퍼니 충전 (${payment.amount.toLocaleString()}원)` });
      notifyUser(db, {
        recipientId: payment.user_id,
        title: "퍼니 충전 완료",
        message: `${formatFunny(funny)}${bonus > 0 ? ` + 보너스 ${formatFunny(bonus)}` : ""}가 충전되었습니다.`,
        link: "/creator/funny",
      });
      break;
    }

    case "custom_video_order": {
      // 제작 의뢰 결제 성공 -> 의뢰 open (escrow 보관)
      const requestId = String(payment.metadata_json.request_id ?? "");
      const req = db.custom_video_requests.find((r) => r.id === requestId);
      if (req) {
        req.status = "open";
        req.payment_id = payment.id;
        req.updated_at = now();
      }
      break;
    }
  }
}
