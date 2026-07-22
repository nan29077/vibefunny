import type { Role, AdvertiserType } from "./schema";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  group?: string;
}

export function navForRole(role: Role, advertiserType?: AdvertiserType | null): NavItem[] {
  switch (role) {
    case "admin":
      return [
        { href: "/admin", label: "대시보드", icon: "IconDashboard" },
        { href: "/admin/videos", label: "영상 승인", icon: "IconFilm", group: "콘텐츠" },
        { href: "/admin/requests", label: "영상의뢰", icon: "IconClipboard" },
        { href: "/admin/campaigns", label: "캠페인 승인", icon: "IconMegaphone" },
        { href: "/admin/products", label: "상품 관리", icon: "IconPackage", group: "상품 관리" },
        { href: "/admin/products/orders", label: "쇼츠 판매/발주", icon: "IconReceipt", group: "쇼츠 판매·배송" },
        { href: "/admin/members", label: "회원 관리", icon: "IconUsers", group: "회원 & 정책" },
        { href: "/admin/settings", label: "정책 설정", icon: "IconSettings" },
        { href: "/admin/categories", label: "카테고리", icon: "IconTag" },
        { href: "/admin/points", label: "포인트", icon: "IconGem", group: "재무" },
        { href: "/admin/payments", label: "결제 내역", icon: "IconCreditCard" },
        { href: "/admin/payouts", label: "출금 신청", icon: "IconWallet" },
        { href: "/admin/referrals", label: "추천 수당", icon: "IconUsers" },
        { href: "/admin/logs", label: "감사 로그", icon: "IconFileText", group: "운영" },
        { href: "/admin/site", label: "사이트 관리", icon: "IconGlobe" },
        { href: "/admin/vibeporter", label: "바이브포터 연동", icon: "IconLink" },
        { href: "/admin/ai-story", label: "AI스토리 연동", icon: "IconPenLine" },
      ];
    case "creator":
      return [
        { href: "/creator", label: "대시보드", icon: "IconDashboard" },
        { href: "/creator/videos", label: "영상판매", icon: "IconFilm", group: "콘텐츠" },
        { href: "/creator/campaigns", label: "캠페인", icon: "IconMegaphone", group: "수익" },
        { href: "/creator/shorts-commerce", label: "쇼츠 커머스", icon: "IconShoppingBag" },
        { href: "/creator/points", label: "포인트 / 출금", icon: "IconGem" },
        { href: "/creator/wallet", label: "수익 현황", icon: "IconWallet" },
        { href: "/creator/community", label: "SNS 맞구독", icon: "IconHeartHandshake", group: "커뮤니티" },
        { href: "/creator/social", label: "내 SNS 계정", icon: "IconLink", group: "계정" },
        { href: "/creator/referrals", label: "내 추천 현황", icon: "IconUsers" },
        { href: "/creator/settings", label: "설정", icon: "IconSettings" },
      ];
    case "advertiser": {
      const baseItems: NavItem[] = [
        { href: "/advertiser", label: "대시보드", icon: "IconDashboard" },
        { href: "/advertiser/campaigns", label: "캠페인", icon: "IconMegaphone", group: "광고" },
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
