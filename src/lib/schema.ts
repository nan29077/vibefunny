// ===========================================================================
// VIBEFUNNY 도메인 타입 정의 (DB 스키마와 1:1 대응)
// 모든 금액은 KRW 정수(원) 단위로 저장한다.
// ===========================================================================

export type Role = "admin" | "creator" | "advertiser";
export type AdvertiserType = "execution_company" | "agency";
export type UserStatus = "pending" | "active" | "suspended" | "withdrawn";

// 알림 분류 (광고주 알림 설정에서 분류별로 끌 수 있음. 분쟁·정산 등 중요 알림은 분류 없이 항상 발송)
export type NotificationCategory = "participation" | "submission" | "campaign_status" | "message";
export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, { label: string; desc: string }> = {
  participation: { label: "참여 신청", desc: "크리에이터가 캠페인에 참여 신청하거나 배포 영상을 배정받았을 때" },
  submission: { label: "작업물 제출·검수", desc: "크리에이터가 영상/배포 링크를 제출하거나 관리자가 검수했을 때" },
  campaign_status: { label: "캠페인 상태", desc: "캠페인 승인·반려·완료(정산)·취소 등 상태가 바뀌었을 때" },
  message: { label: "메시지·댓글", desc: "1:1 메시지나 캠페인 댓글이 도착했을 때" },
};

// ── 라벨 상수 (UI용) ─────────────────────────────────────────────────────────
export const ROLE_LABELS: Record<Role, string> = {
  admin: "관리자",
  creator: "크리에이터",
  advertiser: "광고주",
};

export const ADVERTISER_TYPE_LABELS: Record<AdvertiserType, string> = {
  execution_company: "실행사",
  agency: "대행사",
};

export const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

export const SOCIAL_PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
};

export const SOCIAL_PLATFORM_COLORS: Record<string, { color: string; bg: string }> = {
  youtube:   { color: "#FF0000", bg: "#FFF0F0" },
  instagram: { color: "#C13584", bg: "#FFF0F8" },
  tiktok:    { color: "#010101", bg: "#F0F0F0" },
  facebook:  { color: "#1877F2", bg: "#F0F5FF" },
};

export const ALL_SOCIAL_PLATFORMS: Array<"youtube" | "instagram" | "tiktok" | "facebook"> = [
  "youtube", "instagram", "tiktok", "facebook",
];

// 6.1 profiles ------------------------------------------------------------
export interface Profile {
  id: string;
  email: string;
  password_hash: string; // 로컬 모드 전용. Supabase 전환 시 auth.users로 이관.
  email_verified_at?: string | null;
  name: string;          // 실제 이름 (설정에서만 노출)
  nickname?: string | null; // 닉네임 (이름이 표기되는 모든 화면에 표시)
  notification_prefs?: Partial<Record<NotificationCategory, boolean>> | null; // 알림 수신 설정 (false = 끔, 미설정 = 받음)
  phone: string | null;
  role: Role;
  advertiser_type: AdvertiserType | null;
  parent_advertiser_id: string | null; // 대행사 -> 상위 실행사
  referral_code: string; // 본인 추천 코드
  referred_by_user_id: string | null; // 나를 가입시킨 추천인
  status: UserStatus;
  avatar_url: string | null;
  creator_gender?: "female" | "male" | "other" | null;
  creator_age_group?: "teens" | "20s" | "30s" | "40plus" | null;
  // 크리에이터 회원 등급: 가입비를 결제해 '바이브회원'이 된 시각. null 이면 '일반회원'(결제 전)
  // (가입비 제도가 꺼져 있으면 가입 즉시 바이브회원)
  vibe_member_at?: string | null;
  session_version?: number; // 로그아웃·비밀번호 변경 시 증가 → 이전 세션 토큰 무효화
  created_at: string;
  updated_at: string;
}

export interface SupportThread {
  id: string;
  user_id: string;
  status: "open" | "waiting" | "resolved";
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  thread_id: string;
  sender: "user" | "admin" | "bot";
  sender_id: string | null;
  content: string;
  created_at: string;
}

export interface EmailVerification {
  id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  verified_at: string | null;
  consumed_at: string | null;
  attempts: number;
  requested_at: string;
  /** 인증을 마친 브라우저 쿠키 토큰의 해시 (가입 시 같은 브라우저인지 확인) */
  verify_token_hash?: string | null;
}

/** 화면 표시용 이름: 닉네임이 있으면 닉네임, 없으면 실제 이름 */
export function displayName(p: { nickname?: string | null; name: string } | null | undefined): string {
  if (!p) return "";
  const nick = (p.nickname ?? "").trim();
  return nick.length > 0 ? nick : p.name;
}

// 6.3 fee_settings (역할별) ----------------------------------------------
export interface FeeSetting {
  target_role: Role; // creator | buyer | advertiser
  signup_fee_enabled: boolean;
  signup_fee_amount: number;
  referral_reward_amount: number;    // 고정 추천 수당 금액 (원)
}

// 영상 제작 단가 구간
export interface VideoPricingTier {
  key: string; // e.g. "15s"
  label: string; // "15초 이하"
  max_seconds: number | null; // null = 직접 입력/상한 없음
  amount: number; // 크리에이터 제작 단가 (크리에이터에게 지급)
  advertiser_charge: number; // 광고주 청구 단가 (광고주 포인트에서 차감)
}

// 플랫폼별 배포 단가
export type Platform = "youtube" | "instagram" | "tiktok";
/** SNS 계정 전용 플랫폼 (배포 플랫폼 + Facebook) */
export type SocialPlatform = Platform | "facebook";
export interface DistributionRate {
  platform: SocialPlatform;
  label: string;
  creator_payout: number; // 배포 1건당 CREATOR 지급액
  advertiser_charge: number; // 광고주 청구액(1건)
}

export type CommissionBasis =
  | "agency_charge" // 대행사 포인트 충전액 기준
  | "agency_spend" // 대행사 광고 주문 차감액 기준 (기본값)
  | "campaign_completed"; // 캠페인 완료 금액 기준


// 6.2-a 사이트 관리 타입 -------------------------------------------------
export interface SiteBanner {
  id: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_href: string;
  gradient: string; // CSS gradient string
  is_active: boolean;
}

export interface SiteHowtoBlock {
  step: number;
  role: "creator" | "advertiser" | "all"; // 대상 역할
  title: string;
  description: string;
}

export interface SiteRevenueStat {
  key: string;
  label: string;
  value: string;
  suffix: string; // 예: "만원", "%", "개"
}

// 6.2 app_settings (key-value 단일 레코드로 묶음 관리) -------------------
export interface AppSettings {
  fees: Record<Role, FeeSetting>;
  video_pricing_tiers: VideoPricingTier[];
  distribution_rates: DistributionRate[];
  // 추천인 제도
  referral_system_enabled: boolean; // 관리자가 ON/OFF – false면 멘티 결제 시 추천 수당을 적립하지 않음
  /** 최소 출금 신청 금액(원). 없으면 DEFAULT_MIN_PAYOUT */
  min_payout_amount?: number;
  is_paid_model: boolean;           // 유료 부업 여부 (true 시 고정 추천 수당 지급)
  referral_bonus: number;           // 고정 추천인 수당 금액 (원, is_paid_model=true 일 때 사용)
  // 광고주 수직 수수료 (실행사 <- 대행사)
  advertiser_commission_rate: number; // 실행사 수수료율 %
  advertiser_commission_basis: CommissionBasis;
  extra_creation_creator_payout: number; // 영상 제작 포함 시 크리에이터 지급액(1건)
  extra_creation_advertiser_charge: number; // 영상 제작 포함 시 광고주 청구액(1건)
  // 사이트 관리
  site_banners: SiteBanner[];
  site_announcement: string | null;
  site_howto_blocks: SiteHowtoBlock[];
  site_revenue_stats: SiteRevenueStat[];
  support_hours_enabled?: boolean;
  support_hours_start?: string;
  support_hours_end?: string;
  support_hours_timezone?: string;
  /** true(기본): 평일에만 문의 접수 (토·일 휴무) */
  support_weekdays_only?: boolean;
  verification_sender_email?: string;
  // ── 유튜브 쇼츠 커머스 ──────────────────────────────────────────────
  cafe24?: Cafe24Settings;                  // 카페24 Open API 연동 설정
  shorts_commerce_default_commission_rate?: number; // 쇼츠 커머스 기본 판매 수수료율 %(크리에이터 수익)
  ai_shorts?: AiShortsSettings;             // AI 숏츠 제작(퍼니 과금) 설정
  updated_at: string;
  updated_by: string | null;
}

// 카페24 Open API 연동 설정 (없거나 enabled=false면 mock 어댑터로 동작)
export interface Cafe24Settings {
  enabled: boolean;          // true면 실제 카페24 API 호출, false면 미리보기(mock)
  mall_id: string;           // 카페24 몰 아이디 (예: myshop -> myshop.cafe24.com)
  client_id: string;         // 앱 Client ID
  client_secret: string;     // 앱 Client Secret
  access_token: string;      // OAuth Access Token
  refresh_token: string;     // OAuth Refresh Token
  api_version: string;       // API 버전 (예: "2024-06-01")
  shop_no: number;           // 멀티쇼핑몰 번호 (기본 1)
}

// 6.4 referral_relations --------------------------------------------------
export interface ReferralRelation {
  id: string;
  referrer_id: string;
  referee_id: string;
  referral_type: "signup" | "advertiser_hierarchy";
  created_at: string;
}

// 6.4-b referral_rewards -----------------------------------------------
export type ReferralRewardStatus = "PENDING" | "PAID" | "CANCELLED";
export interface ReferralReward {
  id: string;
  referrer_id: string;         // 추천인 (크리에이터)
  referee_id: string;          // 피추천인 (신규 가입자)
  amount: number;              // 수당 금액
  status: ReferralRewardStatus;
  wallet_tx_id: string | null; // 연관 wallet_transaction id
  created_at: string;
  paid_at: string | null;
}

// 6.5 wallets -------------------------------------------------------------
export interface Wallet {
  id: string;
  user_id: string;
  pending_balance: number;
  available_balance: number;
  paid_balance: number;
  created_at: string;
  updated_at: string;
}

// 6.6 wallet_transactions (수익/정산 ledger) -----------------------------
export type WalletTxType =
  | "video_sale" // 종료된 영상판매 기능의 과거 적립 내역 표시용 (신규 생성 없음)
  | "custom_video"
  | "campaign_reward"
  | "signup_referral"
  | "advertiser_commission"
  | "commerce_commission" // 쇼츠 커머스 판매 수수료 (배송 완료 시 적립)
  | "payout"
  | "adjustment";
export type WalletTxStatus =
  | "pending"
  | "available"
  | "requested"
  | "paid"
  | "cancelled";
export interface WalletTransaction {
  id: string;
  user_id: string;
  type: WalletTxType;
  amount: number; // +수익 / -출금
  status: WalletTxStatus;
  related_table: string | null;
  related_id: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

// 6.7 advertiser_point_wallets -------------------------------------------
export interface PointWallet {
  id: string;
  advertiser_id: string;
  point_balance: number;
  created_at: string;
  updated_at: string;
}

// 6.8 point_transactions (포인트 ledger) ---------------------------------
export type PointTxType = "charge" | "spend" | "refund" | "adjustment" | "commission"; // commission: 소속 대행사 기준 실행사 수수료 적립/회수
export interface PointTransaction {
  id: string;
  advertiser_id: string;
  type: PointTxType;
  amount: number; // +충전/환불 / -사용
  balance_after: number;
  payment_id: string | null;
  campaign_id: string | null;
  memo: string | null;
  created_at: string;
}

// 6.9 payments ------------------------------------------------------------
export type PaymentType =
  | "signup_fee"
  | "custom_video_order"
  | "point_charge"
  | "funny_charge";
export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded";
export interface Payment {
  id: string;
  user_id: string;
  payment_type: PaymentType;
  amount: number;
  status: PaymentStatus;
  provider: string; // mock | toss ...
  provider_payment_id: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  paid_at: string | null;
}

// 6.10 categories ---------------------------------------------------------
export interface Category {
  id: string;
  platform: Platform;
  name: string;
  slug: string;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

// 6.13 custom_video_requests ---------------------------------------------
export type RequestStatus =
  | "draft"
  | "payment_pending"
  | "paid"
  | "open"
  | "assigned"
  | "in_progress"
  | "submitted"
  | "revision_requested"
  | "approved"
  | "completed"
  | "cancelled"
  | "refunded";
export interface CustomVideoRequest {
  id: string;
  buyer_id: string;
  assigned_creator_id: string | null;
  title: string;
  requirements: string;
  description?: string | null;          // 상세 설명 (의뢰자 작성 전체 텍스트)
  reference_links?: string | null;
  platform: Platform;
  category_id?: string | null;
  duration_seconds: number;
  budget: number;
  due_date?: string | null;
  deadline?: string | null;             // 마감일 (ISO string)
  attachment_urls?: string[];
  is_public: boolean;
  designated_creator_id: string | null;
  status: RequestStatus;
  payment_id?: string | null;
  // 의뢰자 정보
  requester_name?: string | null;
  requester_company?: string | null;
  // 진행 현황
  max_creators?: number | null;         // 최대 크리에이터 수
  current_submissions?: number;         // 현재 제출 수
  reference_url?: string | null;        // 참고 URL
  submitted_video_url?: string | null;  // 크리에이터가 제출한 영상 파일 경로
  created_at: string;
  updated_at: string;
}

// 6.14 custom_video_applications -----------------------------------------
export type ApplicationStatus = "applied" | "accepted" | "rejected" | "cancelled";
export interface CustomVideoApplication {
  id: string;
  request_id: string;
  creator_id: string;
  proposal_message: string;
  proposed_price: number | null;
  status: ApplicationStatus;
  created_at: string;
}

// 6.15 custom_video_deliveries -------------------------------------------
export type DeliveryStatus = "submitted" | "revision_requested" | "approved" | "rejected";
export interface CustomVideoDelivery {
  id: string;
  request_id: string;
  creator_id: string;
  video_url: string;
  message: string | null;
  status: DeliveryStatus;
  created_at: string;
  updated_at: string;
}

// 6.16 ad_campaigns -------------------------------------------------------
export type CampaignType =
  | "create_and_distribute"
  | "distribute_own_video"
  | "distribute_existing_video"
  | "create_only";

export type CampaignStatus =
  | "draft"
  | "point_pending"
  | "paid"
  | "admin_review"
  | "published"
  | "recruiting"
  | "in_progress"
  | "submitted"
  | "completed"
  | "rejected"
  | "cancelled"
  | "refunded";
export interface AdCampaign {
  id: string;
  advertiser_id: string;
  title: string;
  description: string;
  campaign_type: CampaignType;
  platforms: SocialPlatform[];
  category_id: string | null;
  video_required: boolean;
  uploaded_video_url: string | null;
  distribution_count: number;
  platform_distributions?: Partial<Record<SocialPlatform, number>>;
  target_keywords: string | null;
  reference_links: string | null;
  start_date: string | null;
  end_date: string | null;
  total_cost: number; // 서버 계산 결과
  point_spent: number;
  status: CampaignStatus;
  admin_memo: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  published_at: string | null;
  // 영상 제작 브리프 (create_and_distribute / create_only 시 선택 입력)
  brief_product_name?: string | null;
  brief_product_detail?: string | null;
  brief_youtube_category?: string | null;
  brief_instagram_category?: string | null;
  brief_tiktok_category?: string | null;
  brief_tone?: string | null;
  brief_style?: string | null;
  brief_target_audience?: string | null;
  brief_key_messages?: string | null;
  brief_avoid?: string | null;
  brief_hashtags?: string | null;
  // 파일 첨부 (Base64)
  attachment_file_data?: string | null;  // Base64-encoded
  attachment_file_name?: string | null;  // 원본 파일명
  attachment_file_type?: string | null;  // MIME type
  // 참여 제한
  participation_limit?: number;
  // 브랜드 정보
  brand_name?: string | null;
  industry?: string | null;
  website_url?: string | null;
  // 크리에이터 자격
  creator_min_followers?: string | null;  // "none"|"10k"|"50k"|"100k"|"500k"|"1m"
  creator_gender?: string | null;          // "all"|"female"|"male"
  creator_age_group?: string | null;       // "all"|"teens"|"20s"|"30s"|"40plus"
  creator_requirements?: string | null;
  // 브랜드 세이프티
  brand_forbidden_words?: string | null;
  brand_no_competitor?: boolean;
  brand_no_adult?: boolean;
  brand_no_violence?: boolean;
  brand_no_politics?: boolean;
  // 성과 추적
  utm_link?: string | null;
  promo_code?: string | null;
  kpi_goals?: string | null;               // JSON array string
  // 약관 동의
  terms_agreed?: boolean;
  // brief facebook category (previously missing)
  brief_facebook_category?: string | null;
  // 영상제작 건수 (0이면 영상제작 없음, create_and_distribute / create_only에 사용)
  video_production_count?: number;
  // 영상 길이 구간 키 (15s|30s|60s|90s) — 광고주 청구단가/크리에이터 제작단가 산정 기준
  video_duration_tier?: string | null;
  expired_review_notified_at?: string | null; // 마감 후 검토 대기 알림 발송 시각 (자동 정산 대기)
  // 등록(결제) 시점의 크리에이터 지급 단가 — 이후 관리자가 단가를 바꿔도 이 캠페인 지급액은 그대로
  creator_rate_snapshot?: {
    video_payout: number;
    deploy_payouts: Partial<Record<SocialPlatform, number>>;
    captured_at: string;
  } | null;
  /** 등록(결제) 시점의 광고주 청구 단가 — 정산 소진액·환불 계산은 이 값으로 (이후 관리자 단가 변경 영향 없음) */
  advertiser_rate_snapshot?: {
    video_charge: number;
    deploy_charges: Partial<Record<SocialPlatform, number>>;
    captured_at: string;
  } | null;
}

// 6.17 campaign_applications ---------------------------------------------
export type CampaignAppStatus = "applied" | "approved" | "rejected" | "cancelled";
export interface CampaignApplication {
  id: string;
  campaign_id: string;
  creator_id: string;
  status: CampaignAppStatus;
  created_at: string;
  updated_at: string;
}

// 6.18 campaign_deliveries -----------------------------------------------
export type CampaignDeliveryStatus =
  | "submitted"
  | "approved"
  | "rejected"
  | "revision_requested";
export interface CampaignDelivery {
  id: string;
  campaign_id: string;
  creator_id: string;
  platform: Platform;
  post_url: string;
  proof_image_url: string | null;
  submitted_video_url: string | null;
  description: string | null;
  status: CampaignDeliveryStatus;
  reward_amount: number;
  created_at: string;
  updated_at: string;
}

// 6.19 social_accounts ----------------------------------------------------
export interface SocialAccount {
  id: string;
  creator_id: string;
  platform: SocialPlatform;
  account_name: string;
  channel_url: string;
  follower_count: number;
  verified_status: "unverified" | "pending" | "verified";
  created_at: string;
  updated_at: string;
}

// 6.20 payout_requests ----------------------------------------------------
export type PayoutStatus = "requested" | "approved" | "rejected" | "paid";
export interface PayoutRequest {
  id: string;
  user_id: string;
  amount: number;
  bank_name: string;
  bank_account_number: string;
  account_holder: string;
  resident_id_number?: string | null; // 원천징수 3.3% 처리 후 즉시 폐기
  status: PayoutStatus;
  admin_memo: string | null;
  requested_at: string;
  processed_at: string | null;
}

// 6.21 audit_logs ---------------------------------------------------------
export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  target_table: string | null;
  target_id: string | null;
  before_json: unknown;
  after_json: unknown;
  created_at: string;
}


// ===========================================================================
// NEW: Campaign Submission System (크리에이터 제출 + 댓글 + 광고주 승인/반려)
// ===========================================================================

// 6.22 campaign_submissions -----------------------------------------------
export type SubmissionStatus = "pending" | "approved" | "rejected";
export interface CampaignSubmission {
  id: string;
  campaign_id: string;
  creator_id: string;
  description: string;
  file_data: string | null;      // Base64-encoded file (image or video)
  file_name: string | null;      // 원본 파일명
  file_type: string | null;      // MIME type e.g. "image/jpeg", "video/mp4"
  status: SubmissionStatus;
  reject_reason: string | null;  // 반려 시 이유 (필수)
  created_at: string;
  updated_at: string;
}

// 6.23 submission_comments ------------------------------------------------
export interface SubmissionComment {
  id: string;
  submission_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

// 6.24 campaign_participations (새 참여 워크플로우) -----------------------
export type CampaignParticipationStatus =
  | "applied"               // 참여 신청
  | "application_rejected"  // 선발 단계 반려 (작업물 제출 불가)
  | "accepted"              // 광고주/관리자가 크리에이터 선발 승인 (제출 대기)
  | "video_submitted"       // 영상 제출 완료
  | "video_approved"        // 영상 승인됨
  | "video_rejected"        // 영상 반려 (재제출 허용)
  | "deploy_submitted"      // 배포 승인요청
  | "deploy_approved"       // 배포 승인됨
  | "deploy_rejected"       // 배포 반려 (재제출 허용)
  | "revision_requested"
  | "disputed"
  | "cancelled"
  | "completed";            // 완료

export interface CampaignParticipation {
  id: string;
  campaign_id: string;
  creator_id: string;
  status: CampaignParticipationStatus;
  participation_type?: "deploy" | "video_production"; // 참여 유형
  platform?: SocialPlatform; // 배포 참여 시 배정된 플랫폼 (플랫폼별 배포 건수·단가 적용. 구버전 데이터는 없음)
  video_url?: string;
  video_note?: string;
  deploy_link?: string;  // 배포 참여자가 제출한 SNS 게시물 URL
  deploy_note?: string;
  // 영상제작 참여자 원본 파일
  video_file_data?: string | null;   // Base64-encoded 원본 영상
  video_file_name?: string | null;
  video_file_type?: string | null;
  rejection_reason?: string;
  dispute_previous_status?: CampaignParticipationStatus;
  /** 분쟁을 이미 신청한 회원 역할 — 크리에이터·광고주 각각 참여당 1회 (반복 분쟁으로 정산을 무기한 막는 것 방지) */
  disputed_by?: Array<"creator" | "advertiser">;
  /** 취소 주체 — creator(본인 취소)만 재신청 가능. reviewer(광고주·관리자 선발 취소)·admin(분쟁 취소)·system(캠페인 종료)은 재신청 불가 */
  cancelled_by?: "creator" | "reviewer" | "admin" | "system";
  applied_at: string;
  updated_at: string;
}

export interface CampaignFavorite {
  id: string;
  campaign_id: string;
  creator_id: string;
  created_at: string;
}

// 6.24-b campaign_videos (배포용 영상 풀 — 영상 1개당 1크리에이터 배타 분배) ----
// 출처:
//  - "advertiser_uploaded": 광고주가 캠페인 등록 시 직접 등록한 영상(1~N개)
//  - "produced": 영상제작 참여자가 제작·승인받은 영상이 배포 풀로 들어온 것
export type CampaignVideoSource = "advertiser_uploaded" | "produced";
// 상태: 미분배 → 분배됨 → 다운로드됨 → 배포완료
export type CampaignVideoStatus = "unassigned" | "assigned" | "downloaded" | "distributed";
export interface CampaignVideo {
  id: string;
  campaign_id: string;
  source: CampaignVideoSource;
  title: string | null;
  // 영상 데이터 (URL 또는 Base64 파일 — 둘 중 하나 이상)
  video_url: string | null;
  file_data: string | null;   // Base64 data URI
  file_name: string | null;
  file_type: string | null;   // MIME
  // 제작 출처 정보 (source === "produced")
  source_participation_id: string | null; // 제작 참여(CampaignParticipation) id
  produced_by_creator_id: string | null;  // 제작한 크리에이터 id
  // 분배 상태
  status: CampaignVideoStatus;
  assigned_creator_id: string | null;
  assigned_participation_id: string | null; // 배포 참여(CampaignParticipation) id
  clone_of?: string | null; // 영상 수보다 배포 건수가 많을 때 재사용 배정된 복제 항목이면 원본 id
  assigned_at: string | null;
  downloaded_at: string | null;
  distributed_at: string | null;
  created_at: string;
  updated_at: string;
}

// 6.25 campaign_comments --------------------------------------------------
export interface CampaignComment {
  id: string;
  campaign_id: string;
  author_id: string;
  author_name: string;
  author_role: "admin" | "creator" | "advertiser";
  content: string;
  created_at: string;
}

// 6.26 campaign_direct_messages (광고주↔크리에이터 1:1 DM) ---------------
export interface CampaignDirectMessage {
  id: string;
  campaign_id: string;
  participation_id: string;  // links to specific creator's participation
  creator_id: string;
  from_role: "advertiser" | "admin" | "creator";
  from_name: string;
  content: string;
  created_at: string;
  read: boolean;
}

// 6.27 participation_comments (참여별 댓글 스레드) -----------------------
export interface ParticipationComment {
  id: string;
  participation_id: string;
  campaign_id: string;
  author_id: string;
  author_name: string;
  author_role: "advertiser" | "creator" | "admin";
  content: string;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface PrivateFile {
  id: string;
  owner_id: string;
  storage_name: string;
  original_name: string;
  mime_type: string;
  size: number;
  source?: "upload" | "ai_shorts"; // ai_shorts: AI 숏츠 제작 결과물(업로드 용량 제한에서 제외)
  created_at: string;
}

// ===========================================================================
// NEW: 유튜브 쇼츠 커머스 (Shorts Commerce)
// 최고관리자가 상품 등록(카페24 연동) → 크리에이터가 운영 채널/쇼츠에 상품 연동
// ===========================================================================

// 6.28 product_categories (종합쇼핑몰 카테고리 트리: 대분류~소분류) --------
export interface ProductCategory {
  id: string;
  name: string;
  parent_id: string | null;  // null = 대분류
  level: 1 | 2 | 3;          // 1=대분류, 2=중분류, 3=소분류
  sort_order: number;
  is_active: boolean;
}

// 6.29 products (카페24 표준 상품 등록 폼과 동일 구성) --------------------
export type ProductDisplayStatus = "displayed" | "hidden"; // 진열 상태
export type ProductSellStatus = "selling" | "stopped" | "soldout"; // 판매 상태
export type Cafe24SyncStatus = "not_synced" | "pending" | "synced" | "failed";

export interface ProductOption {
  name: string;       // 옵션명 (예: 색상)
  values: string[];   // 옵션값 (예: ["블랙","화이트"])
}

export interface Product {
  id: string;
  product_code: string;            // 자체 상품코드 (카페24 product_code)
  cafe24_product_no: string | null; // 카페24 상품번호 (연동 후 채번)
  name: string;                    // 상품명
  category_id: string | null;      // ProductCategory.id (소분류 권장)
  // 가격 (모두 KRW 정수)
  retail_price: number;            // 소비자가(정가)
  price: number;                   // 판매가
  supply_price: number;            // 공급가
  // 재고/옵션
  stock: number;
  options: ProductOption[];
  // 설명/이미지
  summary: string;                 // 간단 설명(상품 요약)
  description: string;             // 상세 설명 (HTML/텍스트)
  main_image_url: string;          // 대표이미지
  additional_image_urls: string[]; // 추가이미지
  // 배송
  shipping_fee_type: "free" | "fixed" | "conditional"; // 무료/유료/조건부무료
  shipping_fee: number;            // 배송비(유료/조건부)
  shipping_info: string;           // 배송 안내 문구
  // 부가 정보
  brand: string | null;
  manufacturer: string | null;
  origin: string | null;           // 원산지
  model_name: string | null;       // 모델명
  keywords: string[];              // 검색어 / 추천 매칭 태그
  // 상태
  display_status: ProductDisplayStatus; // 진열 여부
  sell_status: ProductSellStatus;       // 판매 여부
  // 쇼츠 커머스 수익
  commission_rate: number;         // 크리에이터 판매 수수료율 %
  // 카페24 연동 상태
  cafe24_sync_status: Cafe24SyncStatus;
  cafe24_synced_at: string | null;
  cafe24_sync_error: string | null;
  cafe24_mode: "real" | "mock" | null; // 마지막 동기화가 실제/미리보기 중 무엇이었는지
  created_at: string;
  updated_at: string;
  created_by: string;              // 등록한 관리자 id
}

// 6.30 creator_youtube_channels (채널 운영용 유튜브 계정 — 광고용과 별개) -
export interface CreatorYoutubeChannel {
  id: string;
  creator_id: string;
  channel_name: string;            // 채널명
  channel_url: string;             // 채널 URL
  channel_handle: string | null;   // @handle
  subscriber_count: number;        // 구독자 수
  description: string | null;      // 채널 소개/주제
  verified_status: "unverified" | "pending" | "verified";
  created_at: string;
  updated_at: string;
}

// 6.31 creator_shorts_links (크리에이터 쇼츠 + 연동 상품) ----------------
export type ShortsCommerceStatus = "draft" | "linked" | "active";
export interface CreatorShortsLink {
  id: string;
  creator_id: string;
  channel_id: string | null;       // CreatorYoutubeChannel.id (운영 채널)
  shorts_url: string;              // 유튜브 쇼츠 링크
  title: string;                   // 영상 제목/메모
  content_note: string;            // 영상 내용 설명 (추천 매칭 기준)
  linked_product_ids: string[];    // 연동된 상품 id 목록
  status: ShortsCommerceStatus;
  created_at: string;
  updated_at: string;
}

// 라벨 상수 (쇼츠 커머스)
export const PRODUCT_DISPLAY_LABELS: Record<ProductDisplayStatus, string> = {
  displayed: "진열함",
  hidden: "진열안함",
};
export const PRODUCT_SELL_LABELS: Record<ProductSellStatus, string> = {
  selling: "판매함",
  stopped: "판매안함",
  soldout: "품절",
};
export const CAFE24_SYNC_LABELS: Record<Cafe24SyncStatus, string> = {
  not_synced: "미연동",
  pending: "연동중",
  synced: "연동완료",
  failed: "연동실패",
};

// 6.32 product_orders (쇼츠 커머스 판매/주문 — 카페24 주문 구조) ----------
export type OrderStatus = "paid" | "preparing" | "shipped" | "delivered" | "cancelled";
export interface ProductOrder {
  id: string;
  order_no: string;              // 주문번호 (카페24 스타일: 20260623-0000001)
  product_id: string;
  product_name: string;          // 상품명 스냅샷
  product_image: string;         // 대표이미지 스냅샷
  creator_id: string;            // 판매한 크리에이터
  creator_name: string;          // 크리에이터명 스냅샷
  shorts_link_id: string | null; // 판매 유입 쇼츠
  quantity: number;
  unit_price: number;            // 판매 단가
  amount: number;                // 결제 금액 (unit_price * quantity)
  commission_rate: number;       // 크리에이터 수수료율 %
  creator_commission: number;    // 크리에이터 적립액
  // 구매자/배송지 정보
  buyer_name: string;
  buyer_phone: string;
  zipcode: string;
  address: string;
  delivery_memo: string;
  // 배송 처리
  status: OrderStatus;
  courier: string | null;        // 택배사
  tracking_no: string | null;    // 운송장 번호
  cafe24_order_no: string | null; // 카페24 주문번호 (연동 시)
  ordered_at: string;
  shipped_at: string | null;
  updated_at: string;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  paid: "결제완료",
  preparing: "상품준비중",
  shipped: "배송중",
  delivered: "배송완료",
  cancelled: "취소",
};

// ===========================================================================
// AI 숏츠 제작 + 퍼니(크리에이터 AI 제작 크레딧)
// ---------------------------------------------------------------------------
// - 퍼니: 크리에이터가 충전해 AI 숏츠 제작에 쓰는 선불 크레딧. 1퍼니 = 10원.
//   수익 지갑(wallets, 출금 대상)과 완전히 분리된 별도 잔액이며 출금·이전 불가.
// - 충전 퍼니(paid)와 관리자 지급 퍼니(bonus)를 나눠 관리하고, 보너스부터 사용.
// - AI 작업을 시작할 때 예상 퍼니를 예약(held)하고, 성공하면 실제 사용량만 차감 후 나머지 반환,
//   실패·취소하면 전액 반환.
// ===========================================================================
export type AiCapability = "text" | "image" | "video" | "tts" | "music";
export type AiProviderKind = "gemini" | "openai" | "fal" | "elevenlabs" | "mock";

export interface AiShortsChargeProduct {
  id: string;
  won: number;    // 결제 금액(원)
  bonus: number;  // 추가 지급 퍼니(보너스)
}

export interface AiShortsSettings {
  enabled: boolean;                  // 최고관리자 스위치: 켜면 크리에이터에게 AI 숏츠 제작 활성화
  audience: "all" | "selected";      // 전체 크리에이터 / 지정한 크리에이터만(베타)
  allowed_creator_ids: string[];
  won_per_funny: number;             // 1퍼니 = 10원 (고정)
  usd_krw_rate: number;              // 원가 계산 환율
  margin_rate: number;               // 판매가 = 원가 × margin_rate% (최소 100)
  monthly_budget_won: number;        // 플랫폼 월 AI 원가 한도 (0 = 제한 없음). 넘으면 신규 작업 자동 차단
  daily_limit_funny: number;         // 크리에이터 1인 하루 사용 한도 (0 = 제한 없음)
  max_active_jobs_per_user: number;  // 크리에이터 1인 동시 대기·진행 작업 수
  concurrency: number;               // 서버 전체 동시 AI 작업 수
  default_models: Partial<Record<AiCapability, string>>; // 작업별 사용할 모델(AiModel.id)
  charge_products: AiShortsChargeProduct[];
  blocked_terms: string;             // 금칙어 (줄바꿈/쉼표 구분)
  budget_alert_sent_month?: string | null; // 월 예산 초과 알림 1회 발송 기록 (YYYY-MM)
  updated_at: string | null;
}

export interface AiProvider {
  id: string;
  kind: AiProviderKind;
  name: string;
  base_url: string;
  api_key_enc: string;        // 암호화 저장 (enc:v1:...)
  active: boolean;
  status: "untested" | "ok" | "error";
  last_test_at: string | null;
  last_test_message: string | null;
  fail_streak: number;
  cooldown_until: string | null; // 연속 실패 시 잠시 사용 중지
  created_at: string;
  updated_at: string;
}

export interface AiModel {
  id: string;
  provider_id: string;
  capability: AiCapability;
  model_id: string;
  label: string;
  cost_usd: number;           // 단위당 원가(USD) — text: 1천 토큰, image: 1장, video: 1초, tts: 1천 자, music: 1초
  price_funny: number;        // 단위당 판매가(퍼니). 0 = 원가×환율×마진으로 자동 계산
  max_seconds: number | null; // 영상·음악 최대 길이
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type AiJobKind = "script" | "shot_image" | "shot_tts" | "shot_video" | "music" | "compose";
export type AiJobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export interface AiJob {
  id: string;
  user_id: string;
  project_id: string;
  shot_id: string | null;
  kind: AiJobKind;
  capability: AiCapability | null; // compose 는 null (AI 미사용, 무료)
  model_ref: string | null;        // AiModel.id
  input: Record<string, unknown>;
  status: AiJobStatus;
  attempts: number;
  vendor_ref: string | null;       // 공급사 비동기 작업 번호(영상 등)
  next_poll_at: string | null;
  lease_until: string | null;      // 작업을 잡은 워커의 임대 만료 시각 (만료 시 다른 워커가 이어받음)
  worker_id: string | null;
  heartbeat_at?: string | null;    // 실행 중인 워커가 마지막으로 임대를 연장한 시각 (2분 넘게 끊기면 회수)
  units: number;                   // 예상 사용량(단위)
  hold_paid: number;
  hold_bonus: number;
  charged_funny: number;           // 실제 차감 퍼니
  cost_won: number;                // 실제 원가(원)
  vendor_cost_won?: number;        // 공급사에 실제로 보낸 요청의 누적 원가(원, 재시도·실패·취소 포함) — 월 예산 집계용
  progress: number;                // 0~1 (합성)
  error: string | null;            // 크리에이터에게 보여줄 정리된 오류
  error_detail: string | null;     // 관리자 전용 원문
  result_file_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  updated_at: string;
}

export interface ShortsShot {
  id: string;
  narration: string;      // 내레이션(음성으로 읽을 문장)
  caption: string;        // 화면 자막
  visual: string;         // 장면 묘사(이미지·영상 프롬프트)
  camera_move: string;    // 정지 이미지 움직임 연출
  seconds: number;        // 컷 길이(초)
  use_video: boolean;     // 합성 시 AI 영상 클립 사용 여부(있을 때)
  image_file_id: string | null;
  audio_file_id: string | null;
  audio_seconds: number | null;
  audio_text?: string | null; // 음성을 만들 때의 내레이션 (지금 내레이션과 다르면 다시 만들라고 안내)
  video_file_id: string | null;
}

export type ShortsProjectStatus = "draft" | "scripted" | "composing" | "composed" | "failed";

export interface ShortsProject {
  id: string;
  user_id: string;
  title: string;
  template: string;
  topic: string;
  tone: string;
  target_seconds: number; // 15 / 30 / 45 / 60
  voice: string;          // 음성 이름(공급사별)
  hook: string;
  description: string;
  hashtags: string[];
  shots: ShortsShot[];
  bgm_prompt: string;
  bgm_file_id: string | null;
  bgm_volume: number;
  subtitle_position: "bottom" | "middle" | "top";
  status: ShortsProjectStatus;
  output_file_id: string | null;
  output_seconds: number | null;
  compose_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface FunnyWallet {
  id: string;
  user_id: string;
  paid_balance: number;   // 사용 가능 충전 퍼니
  bonus_balance: number;  // 사용 가능 보너스(관리자 지급·충전 보너스) 퍼니
  held_paid: number;      // 작업 진행 중 예약된 충전 퍼니
  held_bonus: number;     // 작업 진행 중 예약된 보너스 퍼니
  created_at: string;
  updated_at: string;
}

export type FunnyTxType = "charge" | "charge_bonus" | "grant" | "revoke" | "hold" | "spend" | "release" | "refund";
export interface FunnyTransaction {
  id: string;
  user_id: string;
  type: FunnyTxType;
  paid_delta: number;   // 사용 가능 충전 퍼니 변화량
  bonus_delta: number;  // 사용 가능 보너스 퍼니 변화량
  held_delta: number;   // 예약 퍼니 변화량
  paid_after: number;
  bonus_after: number;
  held_after: number;
  charged: number;      // spend: 실제 사용 퍼니
  payment_id: string | null;
  job_id: string | null;
  memo: string | null;
  actor_id: string | null;
  created_at: string;
}

// 전체 DB 스냅샷 (로컬 JSON 스토어) --------------------------------------
export interface Database {

  profile_character_migration_version?: number;
  membership_migrated_at?: string; // 구독료 제거 · 일반/바이브회원 등급 도입 마이그레이션 완료 시각

  profiles: Profile[];
  settings: AppSettings;
  referral_rewards: ReferralReward[];
  referral_relations: ReferralRelation[];
  wallets: Wallet[];
  wallet_transactions: WalletTransaction[];
  point_wallets: PointWallet[];
  point_transactions: PointTransaction[];
  payments: Payment[];
  categories: Category[];
  custom_video_requests: CustomVideoRequest[];
  custom_video_applications: CustomVideoApplication[];
  custom_video_deliveries: CustomVideoDelivery[];
  ad_campaigns: AdCampaign[];
  campaign_applications: CampaignApplication[];
  campaign_deliveries: CampaignDelivery[];
  social_accounts: SocialAccount[];
  payout_requests: PayoutRequest[];
  campaign_submissions: CampaignSubmission[];
  submission_comments: SubmissionComment[];
  campaign_participations: CampaignParticipation[];
  campaign_favorites?: CampaignFavorite[];
  campaign_videos: CampaignVideo[];
  campaign_comments: CampaignComment[];
  campaign_direct_messages: CampaignDirectMessage[];
  participation_comments: ParticipationComment[];
  notifications?: Notification[];
  private_files?: PrivateFile[];
  audit_logs: AuditLog[];
  // 유튜브 쇼츠 커머스
  product_categories: ProductCategory[];
  products: Product[];
  creator_youtube_channels: CreatorYoutubeChannel[];
  creator_shorts_links: CreatorShortsLink[];
  product_orders: ProductOrder[];
  support_threads: SupportThread[];
  support_messages: SupportMessage[];
  email_verifications: EmailVerification[];
  // AI 숏츠 제작 + 퍼니 (구버전 db.json 에는 없을 수 있음 → json-provider 에서 빈 배열로 채움)
  ai_providers?: AiProvider[];
  ai_models?: AiModel[];
  ai_jobs?: AiJob[];
  shorts_projects?: ShortsProject[];
  funny_wallets?: FunnyWallet[];
  funny_transactions?: FunnyTransaction[];
}

/** 최소 출금 신청 금액 기본값(원) */
export const DEFAULT_MIN_PAYOUT = 10_000;

/** 다른 회원에게 보여 줄 때의 이메일 가림 표시: "ab***@domain.com" */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  return `${local.slice(0, Math.min(2, local.length))}***${email.slice(at)}`;
}
