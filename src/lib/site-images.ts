const MARGIN_PRESETS = [
  { id: "margin-creator-studio", label: "크리에이터 스튜디오" },
  { id: "margin-product-shoot", label: "제품 촬영 작업실" },
  { id: "margin-editing-room", label: "영상 편집실" },
  { id: "margin-daylight-loft", label: "햇살 드는 스튜디오" },
  { id: "margin-team-production", label: "숏폼 제작팀" },
];

const BANNER_PRESETS = [
  { id: "banner-first-shoot", label: "첫 숏폼 촬영" },
  { id: "banner-edit-and-publish", label: "편집하는 크리에이터" },
  { id: "banner-commerce", label: "쇼츠 커머스 촬영" },
  { id: "banner-creative-team", label: "캠페인 기획 회의" },
  { id: "banner-mobile-studio", label: "스마트폰 촬영 현장" },
];

export const MARGIN_IMAGE_SLOTS = [
  { id: "home-margin", label: "홈 PC 여백", original: "/images/site-presets/margin-home-default.jpg" },
  { id: "advertiser-margin", label: "광고주 센터 PC 여백", original: "/images/site-presets/margin-advertiser-default.jpg" },
] as const;

export const BANNER_IMAGE_SLOTS = [
  { id: "home-banner-1", label: "1번 슬라이드 · 숏폼 수익 시작", original: "/images/hero/side-income-generated-1.webp" },
  { id: "home-banner-2", label: "2번 슬라이드 · 하루 한 편", original: "/images/hero/side-income-generated-2.webp" },
  { id: "home-banner-3", label: "3번 슬라이드 · 월 수익 로드맵", original: "/images/hero/side-income-generated-3.webp" },
] as const;

export type SiteImageSlot = (typeof MARGIN_IMAGE_SLOTS | typeof BANNER_IMAGE_SLOTS)[number];
export type SiteImageSelections = Partial<Record<SiteImageSlot["id"], string>>;

export function getSiteImageOptions(slot: SiteImageSlot) {
  const isMargin = slot.id.endsWith("-margin");
  const presets = isMargin ? MARGIN_PRESETS : BANNER_PRESETS;
  return [
    { id: "default", label: isMargin ? "기본 이미지" : "기존 이미지", src: slot.original },
    ...presets.map((preset) => ({ ...preset, src: `/images/site-presets/${preset.id}.jpg` })),
  ];
}

export function getSiteImage(slot: SiteImageSlot, selections?: SiteImageSelections) {
  const options = getSiteImageOptions(slot);
  return options.find((option) => option.id === selections?.[slot.id]) ?? options[0];
}
