import type { Database, Payment } from "../schema";
import { netAfterFee } from "../money";
import {
  addPointTx,
  addWalletTx,
  audit,
  createAgencyPointCommission,
  createSignupReferralReward,
} from "../services";

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
      // 대행사 포인트 충전 시 → 실행사 포인트 지갑에 commission rate% 적립
      createAgencyPointCommission(db, payment.user_id, payment.amount, payment.id);
      break;
    }

    case "video_purchase": {
      // 영상 구매 성공 -> sold 처리 + 다운로드 권한 + 판매자 수익(수수료 차감)
      const videoId = String(payment.metadata_json.video_id ?? "");
      const video = db.videos.find((v) => v.id === videoId);
      if (!video) throw new Error("영상을 찾을 수 없습니다.");
      if (video.status === "sold") throw new Error("이미 판매 완료된 영상입니다.");

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
