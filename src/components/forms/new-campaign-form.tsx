"use client";

import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { createCampaignAction } from "@/lib/actions/campaign-actions";
import { Card, Field, Input, Textarea, Select, Button } from "@/components/ui";
import { SubmitButton, FormMessage, FieldError, initialActionState } from "@/components/form";
import { PLATFORM_LABELS, type SocialPlatform } from "@/lib/schema";
import { CAMPAIGN_TYPE_LABELS } from "@/lib/labels";
import { formatPoint } from "@/lib/money";
import { FileUpload } from "./file-upload";
import { CampaignVideoPool } from "./campaign-video-pool";
import {
  IconVideo as Video,
  IconUpload as Upload,
  IconLink as Link2,
  IconPenLine as PenLine,
  IconCheck as Check,
  IconChevronRight as ChevronRight,
} from "@/components/icons";

interface Rate { platform: SocialPlatform; advertiser_charge: number; }
interface Cat { id: string; name: string; platform: SocialPlatform; }
interface VideoTier { key: string; label: string; advertiser_charge: number; amount: number; max_seconds: number | null; }

const YOUTUBE_CATEGORIES = [
  "엔터테인먼트 / 코미디", "뷰티 / 메이크업", "패션 / 스타일",
  "음식 / 먹방 / 요리", "피트니스 / 건강 / 다이어트", "게임",
  "여행 / 브이로그", "교육 / 정보 / 꿀팁", "반려동물",
  "음악 / 댄스", "스포츠", "테크 / IT / 리뷰",
  "라이프스타일", "육아 / 가족", "금융 / 재테크",
];

const INSTAGRAM_CATEGORIES = [
  "패션 / 스타일", "뷰티 / 스킨케어", "음식 / 카페",
  "피트니스 / 운동", "여행 / 감성", "라이프스타일",
  "인테리어 / 홈데코", "반려동물", "육아",
  "아트 / 크리에이티브", "비즈니스 / 자기계발", "음악 / 댄스",
];

const TIKTOK_CATEGORIES = [
  "댄스 / 음악", "먹방 / 쿡", "뷰티 / 패션",
  "피트니스", "코미디 / 유머", "DIY / 핸드메이드",
  "교육 / 꿀팁", "반려동물", "게임",
  "라이프스타일", "여행", "스포츠",
];

const FACEBOOK_CATEGORIES = [
  "브랜드 스토리", "제품 홍보 / 리뷰", "이벤트 / 프로모션",
  "교육 / 정보", "엔터테인먼트", "라이프스타일",
  "뉴스 / 트렌드", "비즈니스",
];

const TONE_OPTIONS = [
  "재미있고 유쾌한 (밈/챌린지형)",
  "트렌디하고 세련된",
  "신뢰감 있고 전문적인",
  "따뜻하고 감성적인",
  "에너지틱하고 역동적인",
  "감각적이고 미니멀한",
  "자연스럽고 일상적인 (브이로그형)",
];

const STYLE_OPTIONS = [
  "스토리텔링형 (서사 구조)",
  "튜토리얼 / 하우투형",
  "언박싱 / 리뷰형",
  "비교 / 랭킹형",
  "챌린지 / 참여 유도형",
  "Q&A / 인터뷰형",
  "감성 영상 / 무드형",
  "Before & After형",
];

const INDUSTRY_OPTIONS = [
  "뷰티", "패션", "식품", "IT", "금융", "교육", "게임", "생활용품", "기타",
];

const MIN_FOLLOWERS_OPTIONS = [
  { value: "none", label: "상관없음" },
  { value: "10k", label: "1만+" },
  { value: "50k", label: "5만+" },
  { value: "100k", label: "10만+" },
  { value: "500k", label: "50만+" },
  { value: "1m", label: "100만+" },
];

const KPI_OPTIONS = [
  { value: "views", label: "조회수" },
  { value: "likes", label: "좋아요" },
  { value: "comments", label: "댓글" },
  { value: "shares", label: "공유" },
  { value: "link_clicks", label: "링크클릭" },
  { value: "conversions", label: "전환수" },
];

const STEP_LABELS = [
  "브랜드 정보",
  "캠페인 설정",
  "영상 브리프",
  "크리에이터 자격",
  "확인 & 제출",
];

const CAMPAIGN_TYPE_CARDS = [
  {
    value: "create_and_distribute",
    label: "영상 제작 + 배포",
    description: "크리에이터가 직접 제작하고 자신의 채널에 배포합니다.",
    Icon: Video,
    badge: "인기",
  },
  {
    value: "distribute_own_video",
    label: "자체 영상 배포",
    description: "광고주가 제공한 영상을 크리에이터 채널에서 배포합니다.",
    Icon: Upload,
    badge: null,
  },
  {
    value: "distribute_existing_video",
    label: "기존 영상 기반 배포",
    description: "기존 제작 영상 URL을 기반으로 크리에이터가 배포합니다.",
    Icon: Link2,
    badge: null,
  },
  {
    value: "create_only",
    label: "단순 영상 제작",
    description: "영상 배포 없이 제작만 의뢰합니다.",
    Icon: PenLine,
    badge: null,
  },
];

const ALL_CAMPAIGN_PLATFORMS: SocialPlatform[] = ["youtube", "instagram", "tiktok", "facebook"];

// ── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="mb-8">
      {/* Progress bar */}
      <div className="relative mb-4">
        <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-gray-200">
          <div
            className="h-full bg-brand-purple transition-all duration-500"
            style={{ width: `${((current - 1) / (STEP_LABELS.length - 1)) * 100}%` }}
          />
        </div>
        <div className="relative flex justify-between">
          {STEP_LABELS.map((label, i) => {
            const stepNum = i + 1;
            const isActive = stepNum === current;
            const isDone = stepNum < current;
            return (
              <div key={stepNum} className="flex flex-col items-center">
                <div
                  className={[
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300",
                    isActive
                      ? "border-brand-purple bg-brand-purple text-white shadow-md shadow-purple-200"
                      : isDone
                      ? "border-brand-purple bg-brand-purple/15 text-brand-purple"
                      : "border-gray-300 bg-white text-gray-400",
                  ].join(" ")}
                >
                  {isDone ? <Check size={13} strokeWidth={2.5} /> : stepNum}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Label row */}
      <div className="flex justify-between">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === current;
          const isDone = stepNum < current;
          return (
            <div key={stepNum} className="flex-1 text-center">
              <span
                className={[
                  "text-[11px] leading-tight",
                  isActive
                    ? "font-semibold text-brand-purple"
                    : isDone
                    ? "text-brand-purple/60"
                    : "text-gray-400",
                ].join(" ")}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-5 border-b border-gray-100 pb-3">
      <h2 className="text-base font-bold text-gray-900">{children}</h2>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

// ── SubCard ─────────────────────────────────────────────────────────────────

function SubCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4">
      <div className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">{label}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ── Nav Buttons ─────────────────────────────────────────────────────────────

function NavRow({
  onPrev,
  onNext,
  nextDisabled,
  isLast,
}: {
  onPrev?: () => void;
  onNext?: () => void;
  nextDisabled?: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      {onPrev ? (
        <button
          type="button"
          onClick={onPrev}
          className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          ← 이전
        </button>
      ) : (
        <div />
      )}
      {!isLast && onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex items-center gap-1.5 rounded-xl bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-purple/90 disabled:opacity-40 transition-colors"
        >
          다음 단계 <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

// ── Main Form ───────────────────────────────────────────────────────────────

export function NewCampaignForm({
  rates,
  extraCreationFee,
  categories,
  balance,
  videoPricingTiers = [],
}: {
  rates: Rate[];
  extraCreationFee: number;
  categories: Cat[];
  balance: number;
  videoPricingTiers?: VideoTier[];
}) {
  const [state, formAction] = useFormState(createCampaignAction, initialActionState);
  const [step, setStep] = useState(1);

  // Step 1
  const [brandName, setBrandName] = useState("");
  const [industry, setIndustry] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Step 2
  const [type, setType] = useState("create_and_distribute");
  const [platforms, setPlatforms] = useState<SocialPlatform[]>(["youtube"]);
  const [deployCount, setDeployCount] = useState(10);
  const [videoProductionCount, setVideoProductionCount] = useState(10);
  // 영상 길이 구간 (광고주 청구단가 산정 기준). 15s/30s/60s/90s 중 선택
  const durationTierOptions = videoPricingTiers.filter((t) => t.max_seconds !== null);
  const [durationTier, setDurationTier] = useState<string>(durationTierOptions[0]?.key ?? "15s");
  const [distributions, setDistributions] = useState<Record<string, number>>({
    youtube: 10, instagram: 0, tiktok: 0, facebook: 0,
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetKeywords, setTargetKeywords] = useState("");
  const [referenceLinks, setReferenceLinks] = useState("");
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState("");

  // Step 3
  const [briefProductName, setBriefProductName] = useState("");
  const [briefProductDetail, setBriefProductDetail] = useState("");
  const [briefYoutubeCategory, setBriefYoutubeCategory] = useState("");
  const [briefInstagramCategory, setBriefInstagramCategory] = useState("");
  const [briefTiktokCategory, setBriefTiktokCategory] = useState("");
  const [briefFacebookCategory, setBriefFacebookCategory] = useState("");
  const [briefTone, setBriefTone] = useState("");
  const [briefStyle, setBriefStyle] = useState("");
  const [briefTargetAudience, setBriefTargetAudience] = useState("");
  const [briefKeyMessages, setBriefKeyMessages] = useState("");
  const [briefAvoid, setBriefAvoid] = useState("");
  const [briefHashtags, setBriefHashtags] = useState("");

  // Step 4
  const [creatorMinFollowers, setCreatorMinFollowers] = useState("none");
  const [creatorGender, setCreatorGender] = useState("all");
  const [creatorAgeGroup, setCreatorAgeGroup] = useState("all");
  const [creatorRequirements, setCreatorRequirements] = useState("");
  const [brandForbiddenWords, setBrandForbiddenWords] = useState("");
  const [brandNoCompetitor, setBrandNoCompetitor] = useState(false);
  const [brandNoAdult, setBrandNoAdult] = useState(true);
  const [brandNoViolence, setBrandNoViolence] = useState(true);
  const [brandNoPolitics, setBrandNoPolitics] = useState(false);
  const [useUtm, setUseUtm] = useState(false);
  const [utmLink, setUtmLink] = useState("");
  const [usePromoCode, setUsePromoCode] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [kpiGoals, setKpiGoals] = useState<string[]>([]);

  // Step 5 terms
  const [termsPlatform, setTermsPlatform] = useState(false);
  const [termsCopyright, setTermsCopyright] = useState(false);
  const [termsAd, setTermsAd] = useState(false);
  const [termsFalse, setTermsFalse] = useState(false);
  const allTermsAgreed = termsPlatform && termsCopyright && termsAd && termsFalse;

  void categories;

  const showVideoUpload = type === "distribute_own_video";

  // 영상 길이 구간별 광고주 청구단가 (구간 미지정/없을 시 기존 플랫 단가로 폴백)
  const perCreation = useMemo(() => {
    const tier = videoPricingTiers.find((t) => t.key === durationTier);
    return tier ? tier.advertiser_charge : extraCreationFee;
  }, [videoPricingTiers, durationTier, extraCreationFee]);

  const estimate = useMemo(() => {
    const selected = rates.filter((r) => platforms.includes(r.platform));
    const perDist = selected.length > 0
      ? Math.round(selected.reduce((s, r) => s + r.advertiser_charge, 0) / selected.length)
      : 0;
    let distributionCost = 0;
    let creationCost = 0;
    if (type === "create_only") {
      creationCost = perCreation * videoProductionCount;
    } else {
      distributionCost = perDist * deployCount;
      if (type === "create_and_distribute") creationCost = perCreation * videoProductionCount;
    }
    return { perDist, distributionCost, creationCost, total: distributionCost + creationCost };
  }, [rates, platforms, type, deployCount, videoProductionCount, perCreation]);

  // 배포 건수를 선택된 플랫폼들에 최대한 균등하게 분배
  const distributeEven = (count: number, plats: SocialPlatform[]): Record<string, number> => {
    const result: Record<string, number> = {};
    const n = plats.length;
    if (n === 0) return result;
    const base = Math.floor(count / n);
    let rem = count - base * n;
    for (const p of plats) {
      result[p] = base + (rem > 0 ? 1 : 0);
      if (rem > 0) rem--;
    }
    return result;
  };

  const togglePlatform = (p: SocialPlatform) => {
    setPlatforms((prev) => {
      const next = prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p];
      // 플랫폼 변경 시 배포 건수를 자동으로 균등 분배 → 별도 건수 재입력 없이 바로 진행 가능
      setDistributions(distributeEven(deployCount, next));
      return next;
    });
  };

  const needsDeployment = type !== "create_only";
  const needsVideoProduction = type === "create_and_distribute" || type === "create_only";
  const distSum = platforms.reduce((s, p) => s + (distributions[p] ?? 0), 0);
  const distValid = !needsDeployment || distSum === deployCount;
  const insufficient = estimate.total > balance;

  const toggleKpi = (val: string) => {
    setKpiGoals((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);
  };

  const goNext = () => setStep((s) => Math.min(5, s + 1));
  const goPrev = () => setStep((s) => Math.max(1, s - 1));

  const kpiGoalsJson = JSON.stringify(kpiGoals);

  return (
    <div>
      <StepIndicator current={step} />
      <Card>
        <form action={formAction} className="space-y-5">
          {/* Hidden fields */}
          <input type="hidden" name="title" value={title} />
          <input type="hidden" name="description" value={description} />
          <input type="hidden" name="brand_name" value={brandName} />
          <input type="hidden" name="industry" value={industry} />
          <input type="hidden" name="website_url" value={websiteUrl} />
          <input type="hidden" name="campaign_type" value={type} />
          <input type="hidden" name="distribution_count" value={needsDeployment ? deployCount : 0} />
          <input type="hidden" name="video_production_count" value={needsVideoProduction ? videoProductionCount : 0} />
          {needsVideoProduction && <input type="hidden" name="video_duration_tier" value={durationTier} />}
          {platforms.map((p) => (
            <input key={p} type="hidden" name="platforms" value={p} />
          ))}
          {platforms.map((p) => (
            <input key={`dist_${p}`} type="hidden" name={`platform_distribution_${p}`} value={distributions[p] ?? 0} />
          ))}
          <input type="hidden" name="start_date" value={startDate} />
          <input type="hidden" name="end_date" value={endDate} />
          <input type="hidden" name="target_keywords" value={targetKeywords} />
          <input type="hidden" name="reference_links" value={referenceLinks} />
          <input type="hidden" name="uploaded_video_url" value={uploadedVideoUrl} />
          <input type="hidden" name="brief_product_name" value={briefProductName} />
          <input type="hidden" name="brief_product_detail" value={briefProductDetail} />
          <input type="hidden" name="brief_youtube_category" value={briefYoutubeCategory} />
          <input type="hidden" name="brief_instagram_category" value={briefInstagramCategory} />
          <input type="hidden" name="brief_tiktok_category" value={briefTiktokCategory} />
          <input type="hidden" name="brief_facebook_category" value={briefFacebookCategory} />
          <input type="hidden" name="brief_tone" value={briefTone} />
          <input type="hidden" name="brief_style" value={briefStyle} />
          <input type="hidden" name="brief_target_audience" value={briefTargetAudience} />
          <input type="hidden" name="brief_key_messages" value={briefKeyMessages} />
          <input type="hidden" name="brief_avoid" value={briefAvoid} />
          <input type="hidden" name="brief_hashtags" value={briefHashtags} />
          <input type="hidden" name="creator_min_followers" value={creatorMinFollowers} />
          <input type="hidden" name="creator_gender" value={creatorGender} />
          <input type="hidden" name="creator_age_group" value={creatorAgeGroup} />
          <input type="hidden" name="creator_requirements" value={creatorRequirements} />
          <input type="hidden" name="brand_forbidden_words" value={brandForbiddenWords} />
          {brandNoCompetitor && <input type="hidden" name="brand_no_competitor" value="on" />}
          {brandNoAdult && <input type="hidden" name="brand_no_adult" value="on" />}
          {brandNoViolence && <input type="hidden" name="brand_no_violence" value="on" />}
          {brandNoPolitics && <input type="hidden" name="brand_no_politics" value="on" />}
          {useUtm && <input type="hidden" name="utm_link" value={utmLink} />}
          {usePromoCode && <input type="hidden" name="promo_code" value={promoCode} />}
          <input type="hidden" name="kpi_goals" value={kpiGoalsJson} />
          {allTermsAgreed && <input type="hidden" name="terms_agreed" value="on" />}

          {/* ── STEP 1: 브랜드 기본 정보 ───────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <SectionHeader sub="광고주 브랜드 및 캠페인 기본 정보를 입력해 주세요.">
                브랜드 기본 정보
              </SectionHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="브랜드명" required>
                  <Input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="예: 클리오 코스메틱"
                  />
                </Field>
                <Field label="업종">
                  <Select value={industry} onChange={(e) => setIndustry(e.target.value)} defaultValue="">
                    <option value="">선택 안함</option>
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="공식 웹사이트 URL">
                <Input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                />
              </Field>
              <Field label="캠페인 제목" required>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2026 여름 신제품 홍보 캠페인"
                />
                <FieldError state={state} name="title" />
              </Field>
              <Field label="캠페인 설명">
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="캠페인 목적, 배경, 특이사항 등을 간략히 설명해 주세요."
                  rows={3}
                />
              </Field>
              <NavRow onNext={goNext} nextDisabled={!brandName.trim() || !title.trim()} />
            </div>
          )}

          {/* ── STEP 2: 캠페인 설정 ────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <SectionHeader sub="캠페인 유형, 플랫폼, 배포 건수, 일정을 설정해 주세요.">
                캠페인 설정
              </SectionHeader>

              {/* 유형 카드 */}
              <div>
                <label className="mb-2.5 block text-sm font-semibold text-gray-700">
                  캠페인 유형 <span className="text-red-500">*</span>
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CAMPAIGN_TYPE_CARDS.map((card) => {
                    const isSelected = type === card.value;
                    const CardIcon = card.Icon;
                    return (
                      <button
                        key={card.value}
                        type="button"
                        onClick={() => setType(card.value)}
                        className={[
                          "relative flex flex-col gap-1.5 rounded-2xl border-2 px-4 py-3.5 text-left transition-all",
                          isSelected
                            ? "border-brand-purple bg-gradient-to-br from-purple-50 to-white shadow-sm"
                            : "border-gray-200 bg-white hover:border-brand-purple/40 hover:bg-gray-50/80",
                        ].join(" ")}
                      >
                        {card.badge && (
                          <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            {card.badge}
                          </span>
                        )}
                        <div className="flex items-center gap-2.5">
                          <span
                            className={[
                              "flex h-8 w-8 items-center justify-center rounded-xl",
                              isSelected ? "bg-brand-purple/10 text-brand-purple" : "bg-gray-100 text-gray-500",
                            ].join(" ")}
                          >
                            <CardIcon size={16} strokeWidth={1.75} />
                          </span>
                          <span className={`text-sm font-bold ${isSelected ? "text-brand-purple" : "text-gray-800"}`}>
                            {card.label}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed text-gray-500 pl-[2.625rem]">
                          {card.description}
                        </p>
                        {isSelected && (
                          <span className="absolute right-3 bottom-3 flex h-4 w-4 items-center justify-center rounded-full bg-brand-purple text-white">
                            <Check size={10} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 건수 & 플랫폼 */}
              <SubCard label="건수 & 플랫폼">
                {/* 배포 건수 — create_only 제외 */}
                {needsDeployment && (
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      배포 건수 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={deployCount === 0 ? "" : String(deployCount)}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/[^0-9]/g, "");
                          const v = digits === "" ? 0 : parseInt(digits, 10);
                          setDeployCount(v);
                          // 입력한 배포 건수를 선택된 플랫폼들에 자동 분배
                          setDistributions(distributeEven(v, platforms));
                        }}
                        className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right focus:border-brand-purple focus:outline-none"
                      />
                      <span className="text-sm text-gray-500">건</span>
                    </div>
                  </div>
                )}
                {/* 영상제작 건수 — create_and_distribute, create_only */}
                {needsVideoProduction && (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">
                        영상제작 건수 <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={videoProductionCount === 0 ? "" : String(videoProductionCount)}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^0-9]/g, "");
                            setVideoProductionCount(digits === "" ? 0 : parseInt(digits, 10));
                          }}
                          className="w-20 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right focus:border-brand-purple focus:outline-none"
                        />
                        <span className="text-sm text-gray-500">건</span>
                      </div>
                    </div>
                    {/* 영상 길이 선택 — 광고주 청구단가 산정 기준 */}
                    {durationTierOptions.length > 0 && (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          영상 길이 <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {durationTierOptions.map((t) => {
                            const sel = durationTier === t.key;
                            return (
                              <button
                                key={t.key}
                                type="button"
                                onClick={() => setDurationTier(t.key)}
                                className={[
                                  "rounded-xl border-2 px-2 py-2 text-center transition-all",
                                  sel ? "border-brand-purple bg-purple-50" : "border-gray-200 bg-white hover:border-brand-purple/40",
                                ].join(" ")}
                              >
                                <div className={`text-sm font-bold ${sel ? "text-brand-purple" : "text-gray-700"}`}>{t.label}</div>
                                <div className="text-[11px] text-gray-500">{formatPoint(t.advertiser_charge)}/건</div>
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-xs text-gray-400">선택한 영상 길이에 따라 제작비(광고주 청구단가)가 자동 계산됩니다.</p>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    플랫폼 선택 <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {ALL_CAMPAIGN_PLATFORMS.map((p) => {
                      const checked = platforms.includes(p);
                      return (
                        <div key={p} className="flex items-center gap-3">
                          <label className="flex w-32 cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePlatform(p)}
                              className="h-4 w-4 rounded border-gray-300 accent-brand-purple"
                            />
                            <span className={checked ? "font-semibold text-gray-900" : "text-gray-500"}>
                              {PLATFORM_LABELS[p]}
                            </span>
                          </label>
                          {checked && needsDeployment ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={(distributions[p] ?? 0) === 0 ? "" : String(distributions[p])}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/[^0-9]/g, "");
                                  setDistributions((prev) => ({ ...prev, [p]: digits === "" ? 0 : parseInt(digits, 10) }));
                                }}
                                className="w-20 rounded-lg border border-gray-300 px-2.5 py-1 text-sm text-right focus:border-brand-purple focus:outline-none"
                              />
                              <span className="text-xs text-gray-400">건</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">{checked ? "선택됨" : "—"}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {platforms.length > 0 && needsDeployment && (
                    <div className={`mt-2 flex items-center gap-1.5 text-sm ${distValid ? "text-green-600" : "text-red-500"}`}>
                      {distValid ? (
                        <><Check size={14} strokeWidth={2.5} /><span>합계 {distSum}건 · 맞습니다</span></>
                      ) : (
                        <span className="text-xs">합계 {distSum} / {deployCount} (배포 건수와 같아야 합니다)</span>
                      )}
                    </div>
                  )}
                </div>
              </SubCard>

              {/* 일정 & 키워드 */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="시작 희망일">
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </Field>
                <Field label="종료 희망일">
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </Field>
                <Field label="타겟 키워드">
                  <Input value={targetKeywords} onChange={(e) => setTargetKeywords(e.target.value)} placeholder="예: 신상, 할인" />
                </Field>
                <Field label="참고 링크">
                  <Input value={referenceLinks} onChange={(e) => setReferenceLinks(e.target.value)} placeholder="https://..." />
                </Field>
              </div>

              {(showVideoUpload || type === "distribute_existing_video") && (
                <SubCard label="배포할 영상 등록">
                  <CampaignVideoPool
                    maxCount={deployCount}
                    hint={`배포 건수(${deployCount}건)까지 영상을 등록할 수 있습니다. 등록한 영상은 신청한 크리에이터에게 1개씩 배타 분배됩니다.`}
                  />
                </SubCard>
              )}
              {!showVideoUpload && type !== "distribute_existing_video" && (
                <Field label="참고 파일 첨부 (선택)" hint="이미지 또는 영상 파일을 첨부할 수 있습니다.">
                  <FileUpload name="attachment" accept="image/*,video/*" label="파일 업로드" hint="이미지 또는 동영상 (선택)" />
                </Field>
              )}
              <NavRow
                onPrev={goPrev}
                onNext={goNext}
                nextDisabled={
                  platforms.length === 0 ||
                  !distValid ||
                  (needsDeployment && deployCount < 1) ||
                  (needsVideoProduction && videoProductionCount < 1)
                }
              />
            </div>
          )}

          {/* ── STEP 3: 영상 브리프 ────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <SectionHeader sub="구체적일수록 완성도 높은 영상이 제작됩니다.">
                영상 제작 브리프
              </SectionHeader>
              <SubCard label="제품 / 서비스 정보">
                <Field label="제품 또는 서비스명">
                  <Input value={briefProductName} onChange={(e) => setBriefProductName(e.target.value)} placeholder="예: 클렌징 폼 X, 구독 서비스 Y" />
                </Field>
                <Field label="상세 설명">
                  <Textarea value={briefProductDetail} onChange={(e) => setBriefProductDetail(e.target.value)} placeholder="제품 특징, USP(차별점), 홍보 포인트를 자유롭게 입력하세요." rows={3} />
                </Field>
              </SubCard>
              <SubCard label="플랫폼별 카테고리">
                {platforms.includes("youtube") && (
                  <Field label="YouTube Shorts 카테고리">
                    <Select value={briefYoutubeCategory} onChange={(e) => setBriefYoutubeCategory(e.target.value)} defaultValue="">
                      <option value="">선택 안함</option>
                      {YOUTUBE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                )}
                {platforms.includes("instagram") && (
                  <Field label="Instagram Reels 카테고리">
                    <Select value={briefInstagramCategory} onChange={(e) => setBriefInstagramCategory(e.target.value)} defaultValue="">
                      <option value="">선택 안함</option>
                      {INSTAGRAM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                )}
                {platforms.includes("tiktok") && (
                  <Field label="TikTok 카테고리">
                    <Select value={briefTiktokCategory} onChange={(e) => setBriefTiktokCategory(e.target.value)} defaultValue="">
                      <option value="">선택 안함</option>
                      {TIKTOK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                )}
                {platforms.includes("facebook") && (
                  <Field label="Facebook 카테고리">
                    <Select value={briefFacebookCategory} onChange={(e) => setBriefFacebookCategory(e.target.value)} defaultValue="">
                      <option value="">선택 안함</option>
                      {FACEBOOK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </Select>
                  </Field>
                )}
                {platforms.length === 0 && (
                  <p className="text-sm text-gray-400">2단계에서 플랫폼을 선택해 주세요.</p>
                )}
              </SubCard>
              <SubCard label="크리에이티브 방향">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="톤앤매너">
                    <Select value={briefTone} onChange={(e) => setBriefTone(e.target.value)} defaultValue="">
                      <option value="">선택 안함</option>
                      {TONE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </Select>
                  </Field>
                  <Field label="영상 스타일">
                    <Select value={briefStyle} onChange={(e) => setBriefStyle(e.target.value)} defaultValue="">
                      <option value="">선택 안함</option>
                      {STYLE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </Field>
                </div>
              </SubCard>
              <SubCard label="타겟 & 핵심 메시지">
                <Field label="타겟 소비자층">
                  <Input value={briefTargetAudience} onChange={(e) => setBriefTargetAudience(e.target.value)} placeholder="예: 20~30대 여성, 뷰티 관심, 서울/수도권 거주" />
                </Field>
                <Field label="반드시 포함할 내용 (핵심 메시지)">
                  <Textarea value={briefKeyMessages} onChange={(e) => setBriefKeyMessages(e.target.value)} placeholder="예: 성분 강조, 할인 코드 노출, 특정 해시태그 언급 등" rows={2} />
                </Field>
                <Field label="포함하면 안 되는 내용 (금지 사항)">
                  <Textarea value={briefAvoid} onChange={(e) => setBriefAvoid(e.target.value)} placeholder="예: 경쟁사 비교, 특정 단어 사용 금지, 신체 노출 불가 등" rows={2} />
                </Field>
                <Field label="추천 해시태그">
                  <Input value={briefHashtags} onChange={(e) => setBriefHashtags(e.target.value)} placeholder="예: #뷰티 #피부관리 #클렌징추천" />
                </Field>
              </SubCard>
              <NavRow onPrev={goPrev} onNext={goNext} />
            </div>
          )}

          {/* ── STEP 4: 크리에이터 자격 ────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5">
              <SectionHeader sub="원하는 크리에이터 조건과 브랜드 안전 기준을 설정하세요.">
                크리에이터 자격 & 브랜드 세이프티
              </SectionHeader>
              <SubCard label="크리에이터 자격 요건">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="최소 팔로워 / 구독자">
                    <Select value={creatorMinFollowers} onChange={(e) => setCreatorMinFollowers(e.target.value)} defaultValue="none">
                      {MIN_FOLLOWERS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="선호 크리에이터 성별">
                    <Select value={creatorGender} onChange={(e) => setCreatorGender(e.target.value)} defaultValue="all">
                      <option value="all">전체</option>
                      <option value="female">여성</option>
                      <option value="male">남성</option>
                    </Select>
                  </Field>
                  <Field label="선호 크리에이터 연령대">
                    <Select value={creatorAgeGroup} onChange={(e) => setCreatorAgeGroup(e.target.value)} defaultValue="all">
                      <option value="all">전체</option>
                      <option value="teens">10대</option>
                      <option value="20s">20대</option>
                      <option value="30s">30대</option>
                      <option value="40plus">40대+</option>
                    </Select>
                  </Field>
                </div>
                <Field label="특이사항 / 추가 요구사항">
                  <Textarea value={creatorRequirements} onChange={(e) => setCreatorRequirements(e.target.value)} placeholder="예: 뷰티 전문 크리에이터, 제품 리뷰 경험 보유 등" rows={2} />
                </Field>
              </SubCard>
              <SubCard label="브랜드 세이프티">
                <Field label="금지 단어 / 내용">
                  <Textarea value={brandForbiddenWords} onChange={(e) => setBrandForbiddenWords(e.target.value)} placeholder="콘텐츠에 포함되면 안 되는 단어나 내용을 입력하세요." rows={2} />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { val: brandNoCompetitor, set: setBrandNoCompetitor, label: "경쟁사 언급 금지" },
                    { val: brandNoAdult, set: setBrandNoAdult, label: "성인 콘텐츠 금지" },
                    { val: brandNoViolence, set: setBrandNoViolence, label: "폭력적 콘텐츠 금지" },
                    { val: brandNoPolitics, set: setBrandNoPolitics, label: "정치적 콘텐츠 금지" },
                  ].map(({ val, set, label }) => (
                    <label key={label} className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-brand-purple/30 hover:bg-gray-50/80 transition-colors">
                      <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-brand-purple" />
                      {label}
                    </label>
                  ))}
                </div>
              </SubCard>
              <SubCard label="성과 추적">
                <div className="space-y-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={useUtm} onChange={(e) => setUseUtm(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-brand-purple" />
                    UTM 링크 포함 요청
                  </label>
                  {useUtm && (
                    <Input value={utmLink} onChange={(e) => setUtmLink(e.target.value)} placeholder="https://example.com?utm_source=vibefunny" />
                  )}
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" checked={usePromoCode} onChange={(e) => setUsePromoCode(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-brand-purple" />
                    할인코드 포함 요청
                  </label>
                  {usePromoCode && (
                    <Input value={promoCode} onChange={(e) => setPromoCode(e.target.value)} placeholder="예: VIBE2024" />
                  )}
                </div>
                <div>
                  <div className="mb-2.5 text-sm font-medium text-gray-700">목표 KPI <span className="text-gray-400 font-normal">(복수 선택 가능)</span></div>
                  <div className="flex flex-wrap gap-2">
                    {KPI_OPTIONS.map((k) => {
                      const isK = kpiGoals.includes(k.value);
                      return (
                        <button key={k.value} type="button" onClick={() => toggleKpi(k.value)}
                          className={[
                            "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                            isK
                              ? "bg-brand-purple text-white shadow-sm"
                              : "bg-white border border-gray-200 text-gray-600 hover:border-brand-purple/30",
                          ].join(" ")}>
                          {isK && <Check size={11} strokeWidth={2.5} />}
                          {k.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </SubCard>
              <NavRow onPrev={goPrev} onNext={goNext} />
            </div>
          )}

          {/* ── STEP 5: 확인 & 제출 ────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-5">
              <SectionHeader sub="입력 내용을 확인하고 캠페인을 신청하세요.">
                확인 & 제출
              </SectionHeader>

              {/* 요약 */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3 text-sm">
                <div className="font-semibold text-gray-800">입력 내용 요약</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "브랜드명", value: brandName || "—" },
                    { label: "업종", value: industry || "—" },
                    { label: "캠페인 제목", value: title || "—" },
                    { label: "캠페인 유형", value: CAMPAIGN_TYPE_LABELS[type as keyof typeof CAMPAIGN_TYPE_LABELS] || type },
                    { label: "플랫폼", value: platforms.map((p) => PLATFORM_LABELS[p]).join(", ") || "—" },
                    ...(needsDeployment ? [{ label: "배포 건수", value: `${deployCount}건` }] : []),
                    ...(needsVideoProduction ? [{ label: "영상제작 건수", value: `${videoProductionCount}건` }] : []),
                    ...(briefProductName ? [{ label: "제품/서비스명", value: briefProductName }] : []),
                    { label: "최소 팔로워", value: MIN_FOLLOWERS_OPTIONS.find((o) => o.value === creatorMinFollowers)?.label || "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
                      <div className="font-medium text-gray-800 text-sm">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 비용 */}
              <div className="rounded-2xl border border-brand-purple/20 bg-gradient-to-br from-purple-50/60 to-white p-4">
                <div className="text-sm font-semibold text-gray-800 mb-3">예상 집행 비용</div>
                <div className="space-y-2 text-sm text-gray-600">
                  {estimate.distributionCost > 0 && (
                    <div className="flex justify-between">
                      <span>배포 ({deployCount}건 × {formatPoint(estimate.perDist)})</span>
                      <span className="font-medium text-gray-800">{formatPoint(estimate.distributionCost)}</span>
                    </div>
                  )}
                  {estimate.creationCost > 0 && (
                    <div className="flex justify-between">
                      <span>영상제작비 ({videoProductionCount}건 × {formatPoint(perCreation)})</span>
                      <span className="font-medium text-gray-800">{formatPoint(estimate.creationCost)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-brand-purple/20 pt-2 text-base font-bold text-brand-purple">
                    <span>합계</span>
                    <span>{formatPoint(estimate.total)}</span>
                  </div>
                  <div className="text-xs text-gray-400">보유 포인트: {formatPoint(balance)}</div>
                </div>
              </div>

              {insufficient && (
                <div className="flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
                  <span className="font-semibold">⚠ 포인트 부족</span>
                  <span>충전이 필요합니다. 부족 금액: {formatPoint(estimate.total - balance)}</span>
                </div>
              )}

              {/* 이용약관 */}
              <div className="space-y-2">
                <div className="text-sm font-semibold text-gray-700">이용약관 동의</div>
                {[
                  { val: termsPlatform, set: setTermsPlatform, label: "플랫폼 광고 정책을 준수하겠습니다." },
                  { val: termsCopyright, set: setTermsCopyright, label: "저작권법 및 초상권 관련 법령을 준수하겠습니다." },
                  { val: termsAd, set: setTermsAd, label: "표시·광고의 공정화에 관한 법률을 준수하겠습니다." },
                  { val: termsFalse, set: setTermsFalse, label: "허위·과장 광고를 하지 않겠습니다." },
                ].map(({ val, set, label }) => (
                  <label key={label} className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={val}
                      onChange={(e) => set(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-brand-purple"
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={!allTermsAgreed || insufficient || !distValid}
                  className="w-full"
                >
                  캠페인 신청하기
                </Button>
                {state?.message && (
                  <p className={["mt-2 text-center text-sm", state.ok ? "text-green-600" : "text-red-500"].join(" ")}>
                    {state.message}
                  </p>
                )}
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
