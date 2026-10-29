import type { Role, AdvertiserType } from "./schema";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  group?: string;
}

export function navForRole(role: Role, advertiserType?: AdvertiserType | null, opts: { aiShorts?: boolean } = {}): NavItem[] {
  switch (role) {
    case "admin":
      return [
        { href: "/admin", label: "대시보드", icon: "IconDashboard" },
        { href: "/admin/notifications", label: "알림", icon: "IconBell" },
        // 자주 처리하는 업무를 위로 (PC에서도 스크롤 없이 보이도록)
        { href: "/admin/campaigns", label: "캠페인 승인", icon: "IconMegaphone", group: "처리 업무" },
        { href: "/admin/payouts", label: "출금 신청", icon: "IconWallet" },
        { href: "/admin/inquiries", label: "회원 문의", icon: "IconMessageSquare" },
        { href: "/admin/requests", label: "영상의뢰", icon: "IconClipboard" },
        { href: "/admin/payments", label: "결제 내역", icon: "IconCreditCard", group: "재무" },
        { href: "/admin/points", label: "포인트", icon: "IconGem" },
        { href: "/admin/referrals", label: "추천 수당", icon: "IconUsers" },
        { href: "/admin/members", label: "회원 관리", icon: "IconUsers", group: "회원 & 정책" },
        { href: "/admin/settings", label: "정책 설정", icon: "IconSettings" },
        { href: "/admin/categories", label: "카테고리", icon: "IconTag" },
        { href: "/admin/ai-shorts", label: "AI 숏츠 설정", icon: "IconZap", group: "AI 숏츠" },
        { href: "/admin/ai-shorts/providers", label: "AI 공급사·모델", icon: "IconSettings" },
        { href: "/admin/ai-shorts/jobs", label: "작업 모니터", icon: "IconClipboardList" },
        { href: "/admin/ai-shorts/funny", label: "퍼니 관리", icon: "IconStar" },
        { href: "/admin/products", label: "상품 관리", icon: "IconPackage", group: "쇼츠 커머스" },
        { href: "/admin/products/orders", label: "쇼츠 판매/발주", icon: "IconReceipt" },
        { href: "/admin/site", label: "사이트 관리", icon: "IconGlobe", group: "운영" },
        { href: "/admin/logs", label: "감사 로그", icon: "IconFileText" },
      ];
    case "creator":
      return [
        { href: "/creator", label: "대시보드", icon: "IconDashboard" },
        // AI 숏츠: 최고관리자 스위치가 켜져 있을 때(또는 이전에 만든 숏츠가 있을 때)만 노출
        ...(opts.aiShorts
          ? [
              { href: "/creator/ai-shorts", label: "AI 숏츠 만들기", icon: "IconZap", group: "콘텐츠" },
              { href: "/creator/funny", label: "퍼니 충전·내역", icon: "IconStar" },
            ]
          : []),
        { href: "/creator/campaigns", label: "캠페인", icon: "IconMegaphone", group: "수익" },
        { href: "/creator/requests", label: "영상 제작 의뢰", icon: "IconClipboard" },
        { href: "/creator/notifications", label: "알림", icon: "IconBell" },
        { href: "/creator/shorts-commerce", label: "쇼츠 커머스", icon: "IconShoppingBag" },
        { href: "/creator/points", label: "캠페인 수익", icon: "IconGem" },
        { href: "/creator/wallet", label: "수익 / 출금", icon: "IconWallet" },
        { href: "/creator/community", label: "SNS 맞구독", icon: "IconHeartHandshake", group: "커뮤니티" },
        { href: "/creator/social", label: "내 SNS 계정", icon: "IconLink", group: "계정" },
        { href: "/creator/referrals", label: "내 멘티 현황", icon: "IconUsers" },
        { href: "/creator/settings", label: "설정", icon: "IconSettings" },
      ];
    case "advertiser": {
      const baseItems: NavItem[] = [
        { href: "/advertiser", label: "대시보드", icon: "IconDashboard" },
        { href: "/advertiser/campaigns", label: "캠페인", icon: "IconMegaphone", group: "광고" },
        { href: "/advertiser/notifications", label: "알림", icon: "IconBell" },
        { href: "/advertiser/points", label: "포인트", icon: "IconGem" },
        { href: "/advertiser/settings", label: "내 계정 정보", icon: "IconUser", group: "설정" },
        { href: "/advertiser/settings/notifications", label: "알림 설정", icon: "IconBell" },
      ];
      if (advertiserType !== "agency") {
        baseItems.push({ href: "/advertiser/agencies", label: "소속 대행사", icon: "IconBuilding" });
      }
      return baseItems;
    }
  }
}
