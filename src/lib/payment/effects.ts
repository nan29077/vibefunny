import type { Database, Payment } from "../schema";
import { netAfterFee } from "../money";
import {
  addPointTx,
  addWalletTx,
  audit,
  createSignupReferralReward,
} from "../services";
import { applyAgencyCommission } from "../campaign-workflow";
import { creditFunnyCharge, FUNNY_WON, formatFunny } from "../funny";
import { notifyUser } from "../services";

// ===========================================================================
// 결제 성공 시 비즈니스 효과 (요구사항 13). db.tx() 내부에서 호출.
// 멱등 처리를 위해 payment.status === "paid" 로 바뀐 직후 1회만 실행한다.
// ===========================================================================

const now = () => new Date().toISOString();

export function applyPaymentEffects(db: Database, payment: Payment): void {
  switch (payment.payment_type) {
    case "signup_fee": {
      // 가입비 결제 성공 -> 회원 active + 추천 수당 생성
      const user = db.profiles.find((p) => p.id === payment.user_id);
      if (user) {
        user.status = "active";
        user.updated_at = now();
        createSignupReferralReward(db, user.id, payment.amount);
        audit(db, {
          actorId: user.id,
          action: "signup_fee_paid",
          targetTable: "profiles",
          targetId: user.id,
        });
      }
      break;
    }

    case "subscription": {
      // 구독료 결제 성공 -> 구독 활성(30일 연장)
      const user = db.profiles.find((p) => p.id === payment.user_id);
      if (user) {
        const base =
          user.subscription_active_until &&
          new Date(user.subscription_active_until) > new Date()
            ? new Date(user.subscription_active_until)
            : new Date();
        base.setDate(base.getDate() + 30);
        user.subscription_active_until = base.toISOString();
        user.updated_at = now();
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

    case "video_purchase": {
      // 영상 구매 성공 -> sold 처리 + 다운로드 권한 + 판매자 수익(수수료 차감)
      const videoId = String(payment.metadata_json.video_id ?? "");
      const video = db.videos.find((v) => v.id === videoId);
      if (!video || video.status === "sold" || video.creator_id === payment.user_id) {
        // 동시 결제 등으로 이미 판매된 영상: 예외로 트랜잭션 전체가 롤백되어 결제가 영구 대기 상태로
        // 남던 문제를 막기 위해 결제를 취소 처리한다. (실 PG 연동 시 이 지점에서 승인 취소 API 호출 필요)
        payment.status = "cancelled";
        payment.paid_at = null;
        payment.metadata_json = { ...payment.metadata_json, cancel_reason: !video ? "video_not_found" : video.status === "sold" ? "already_sold" : "own_video" };
        const pending = db.video_purchases.find((p) => p.video_id === videoId && p.buyer_id === payment.user_id && p.status === "pending");
        if (pending) { pending.status = "refunded"; pending.updated_at = now(); }
        audit(db, { actorId: payment.user_id, action: "video_purchase_cancelled", targetTable: "payments", targetId: payment.id });
        break;
      }

      video.status = "sold";
      video.sold_to_user_id = payment.user_id;
      video.sold_at = now();
      video.updated_at = now();

      const purchase = db.video_purchases.find(
        (p) => p.video_id === videoId && p.buyer_id === payment.user_id && p.status === "pending"
      );
      if (purchase) {
        purchase.status = "completed";
        purchase.payment_id = payment.id;
        purchase.updated_at = now();
      }

      // 판매자 정산: 플랫폼 수수료 차감 후 (판매는 즉시 완결 → available)
      const fee = db.settings.video_sale_platform_fee_rate;
      const net = netAfterFee(payment.amount, fee);
      addWalletTx(db, {
        userId: video.creator_id,
        type: "video_sale",
        amount: net,
        status: "available",
        relatedTable: "videos",
        relatedId: video.id,
        memo: `영상 판매 수익 (플랫폼 수수료 ${fee}% 차감)`,
      });
      break;
    }

    case "funny_charge": {
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
