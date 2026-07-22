// ===========================================================================
// 상태값 -> 한글 라벨 + 뱃지 색상 (클라이언트/서버 공용, 순수 함수)
// ===========================================================================

export type BadgeTone = "gray" | "green" | "yellow" | "red" | "blue" | "purple";

interface LabelDef {
  label: string;
  tone: BadgeTone;
}

const M: Record<string, LabelDef> = {
  // user status
  pending: { label: "대기", tone: "yellow" },
  active: { label: "활성", tone: "green" },
  suspended: { label: "정지", tone: "red" },
  withdrawn: { label: "탈퇴", tone: "gray" },

  // payment
  paid: { label: "결제완료", tone: "green" },
  failed: { label: "결제실패", tone: "red" },
  cancelled: { label: "취소", tone: "gray" },
  refunded: { label: "환불", tone: "blue" },

  // video
  draft: { label: "임시저장", tone: "gray" },
  pending_review: { label: "승인대기", tone: "yellow" },
  available: { label: "판매중", tone: "green" },
  sold: { label: "판매완료", tone: "purple" },
  rejected: { label: "반려", tone: "red" },
  hidden: { label: "숨김", tone: "gray" },

  // request / campaign shared
  payment_pending: { label: "결제대기", tone: "yellow" },
  point_pending: { label: "포인트결제대기", tone: "yellow" },
  open: { label: "모집중", tone: "blue" },
  assigned: { label: "작업자선정", tone: "blue" },
  in_progress: { label: "진행중", tone: "blue" },
  submitted: { label: "제출됨", tone: "purple" },
  revision_requested: { label: "수정요청", tone: "yellow" },
  approved: { label: "승인", tone: "green" },
  completed: { label: "완료", tone: "green" },
  admin_review: { label: "관리자검토", tone: "yellow" },
  published: { label: "노출중", tone: "green" },
  recruiting: { label: "모집중", tone: "blue" },

  // applications
  applied: { label: "신청됨", tone: "yellow" },
  accepted: { label: "수락됨", tone: "green" },

  // wallet tx status
  available_balance: { label: "지급가능", tone: "green" },
  requested: { label: "출금신청", tone: "yellow" },

  // verified
  unverified: { label: "미인증", tone: "gray" },
  verified: { label: "인증완료", tone: "green" },
};

export function statusLabel(status: string): string {
  return M[status]?.label ?? status;
}

export function statusTone(status: string): BadgeTone {
  return M[status]?.tone ?? "gray";
}

export const WALLET_TX_TYPE_LABELS: Record<string, string> = {
  video_sale: "영상 판매",
  custom_video: "제작 의뢰",
  campaign_reward: "캠페인 수익",
  signup_referral: "가입 추천 수당",
  advertiser_commission: "실행사 수수료",
  payout: "출금",
  adjustment: "관리자 조정",
};

export const POINT_TX_TYPE_LABELS: Record<string, string> = {
  charge: "충전",
  spend: "사용",
  refund: "환불",
  adjustment: "조정",
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  signup_fee: "가입비",
  subscription: "구독료",
  video_purchase: "영상 구매",
  custom_video_order: "제작 의뢰",
  point_charge: "포인트 충전",
};

export const CAMPAIGN_TYPE_LABELS: Record<string, string> = {
  create_and_distribute: "영상 제작 + 배포",
  distribute_own_video: "자체 영상 배포",
  distribute_existing_video: "기존 영상 기반 배포",
  create_only: "단순 영상 제작",
  story_creation: "동화 제작 의뢰",
};
