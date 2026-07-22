import type {
  AdCampaign,
  AppSettings,
  CampaignApplication,
  CampaignComment,
  CampaignDelivery,
  CampaignParticipation,
  CampaignSubmission,
  Category,
  CustomVideoRequest,
  Database,
  PayoutRequest,
  Platform,
  PointTransaction,
  PointWallet,
  Product,
  ProductCategory,
  ProductOrder,
  Profile,
  SocialAccount,
  SubmissionComment,
  Video,
  VideoPurchase,
  VibeporterRequest,
  Wallet,
  WalletTransaction,
} from "./schema";
import { genId, genReferralCode, hashPassword } from "./crypto";

// ===========================================================================
// 초기 시드 데이터
// ===========================================================================

export function defaultSettings(): AppSettings {
  const now = new Date().toISOString();
  return {
    fees: {
      admin: {
        target_role: "admin",
        signup_fee_enabled: false,
        signup_fee_amount: 0,
        referral_reward_amount: 5000,
        subscription_enabled: false,
        subscription_amount: 0,
      },
      creator: {
        target_role: "creator",
        signup_fee_enabled: false,
        signup_fee_amount: 0,
        referral_reward_amount: 5000,
        subscription_enabled: false,
        subscription_amount: 30000,
      },
      advertiser: {
        target_role: "advertiser",
        signup_fee_enabled: false,
        signup_fee_amount: 0,
        referral_reward_amount: 5000,
        subscription_enabled: false,
        subscription_amount: 0,
      },
    },
    video_pricing_tiers: [
      { key: "15s", label: "15초 이하", max_seconds: 15, amount: 3000, advertiser_charge: 10000 },
      { key: "30s", label: "30초 이하", max_seconds: 30, amount: 5000, advertiser_charge: 15000 },
      { key: "60s", label: "60초 이하", max_seconds: 60, amount: 8000, advertiser_charge: 25000 },
      { key: "90s", label: "90초 이하", max_seconds: 90, amount: 12000, advertiser_charge: 35000 },
      { key: "custom", label: "직접 입력", max_seconds: null, amount: 0, advertiser_charge: 0 },
    ],
    distribution_rates: [
      {
        platform: "youtube",
        label: "YouTube Shorts",
        creator_payout: 10000,
        advertiser_charge: 15000,
      },
      {
        platform: "instagram",
        label: "Instagram Reels",
        creator_payout: 10000,
        advertiser_charge: 15000,
      },
      {
        platform: "tiktok",
        label: "TikTok",
        creator_payout: 10000,
        advertiser_charge: 15000,
      },
      {
        platform: "facebook",
        label: "Facebook Reels",
        creator_payout: 10000,
        advertiser_charge: 15000,
      },
    ],
    video_sale_platform_fee_rate: 20,
    video_auto_approve: false,
    member_video_sale_price_tiers: [
      { key: "30s",  label: "30초 이하", max_seconds: 30,   price: 3000,  creator_payout: 1500 },
      { key: "60s",  label: "60초 이하", max_seconds: 60,   price: 5000,  creator_payout: 2500 },
      { key: "90s",  label: "90초 이하", max_seconds: 90,   price: 7000,  creator_payout: 3500 },
      { key: "long", label: "90초 초과", max_seconds: null, price: 10000, creator_payout: 5000 },
    ],
    referral_system_enabled: false,
    is_paid_model: false,
    referral_bonus: 5000,
    advertiser_commission_rate: 5,
    advertiser_commission_basis: "agency_spend",
    extra_creation_creator_payout: 15000,
    extra_creation_advertiser_charge: 20000,
    site_banners: [
      {
        id: "banner-1",
        title: "영상 제작 부업, VIBEFUNNY에서 시작하세요",
        subtitle: "숏폼 영상 제작부터 배포, 판매까지 한 곳에서",
        cta_label: "무료로 시작하기",
        cta_href: "/register",
        gradient: "from-purple-600 to-pink-500",
        is_active: true,
      },
    ],
    site_announcement: null,
    site_howto_blocks: [
      { step: 1, role: "creator" as const, title: "회원가입", description: "크리에이터로 가입하세요." },
      { step: 2, role: "creator" as const, title: "영상 업로드", description: "숏폼 영상을 업로드하세요." },
      { step: 3, role: "creator" as const, title: "수익 창출", description: "배포 수익과 판매 수익을 받으세요." },
    ],
    site_revenue_stats: [
      { key: "creators", label: "등록 크리에이터", value: "1,200", suffix: "명" },
      { key: "videos", label: "제작된 영상", value: "8,500", suffix: "개" },
      { key: "avg_income", label: "크리에이터 평균 월 수익", value: "32", suffix: "만원" },
    ],
    // 유튜브 쇼츠 커머스
    cafe24: defaultCafe24Settings(),
    shorts_commerce_default_commission_rate: 10,
    ai_story: defaultAiStorySettings(),
    updated_at: now,
    updated_by: null,
  };
}

/** 카페24 기본 설정 (키 없음 = 미리보기/mock 모드) */
export function defaultCafe24Settings() {
  return {
    enabled: false,
    mall_id: "",
    client_id: "",
    client_secret: "",
    access_token: "",
    refresh_token: "",
    api_version: "2024-06-01",
    shop_no: 1,
  };
}

/** AI스토리 기본 설정 (키 없음 = 연동 준비/미리보기) */
export function defaultAiStorySettings() {
  return {
    enabled: false,
    api_base: "",
    api_key: "",
    webhook_secret: "",
    auto_import: false,
  };
}

// 종합쇼핑몰형 상품 카테고리 트리 (대분류 > 중분류) ----------------------
export function seedProductCategories(): ProductCategory[] {
  const TREE: Array<[string, string[]]> = [
    ["패션의류", ["여성의류", "남성의류", "언더웨어", "빅사이즈"]],
    ["패션잡화", ["신발", "가방", "지갑/벨트", "모자/액세서리", "시계/주얼리"]],
    ["뷰티", ["스킨케어", "메이크업", "헤어/바디", "향수", "네일"]],
    ["디지털/가전", ["휴대폰/액세서리", "노트북/PC", "카메라", "음향기기", "생활가전", "주방가전"]],
    ["가구/인테리어", ["침실가구", "거실가구", "수납/정리", "조명", "홈데코", "패브릭"]],
    ["식품", ["신선식품", "가공식품", "건강식품", "간식/과자", "음료/커피", "밀키트"]],
    ["출산/육아", ["기저귀/물티슈", "분유/이유식", "유아의류", "유아완구", "유아용품"]],
    ["스포츠/레저", ["운동복/운동화", "헬스/요가", "등산/캠핑", "자전거", "골프", "수영"]],
    ["생활/건강", ["생활용품", "세제/위생", "건강관리", "마스크/구급"]],
    ["도서/취미", ["국내도서", "전자책", "문구/오피스", "악기", "DIY/공예"]],
    ["반려동물", ["강아지", "고양이", "사료/간식", "위생용품", "장난감/하우스"]],
    ["자동차/공구", ["자동차용품", "공구/철물", "산업용품"]],
  ];
  const cats: ProductCategory[] = [];
  TREE.forEach(([major, subs], mi) => {
    const majorId = genId();
    cats.push({ id: majorId, name: major, parent_id: null, level: 1, sort_order: mi, is_active: true });
    subs.forEach((sub, si) => {
      cats.push({ id: genId(), name: sub, parent_id: majorId, level: 2, sort_order: si, is_active: true });
    });
  });
  return cats;
}

// 데모 상품 (관리자 등록 상품 예시) -------------------------------------
export function seedDemoProducts(productCategories: ProductCategory[], adminId: string): Product[] {
  const catByName = (n: string) => productCategories.find((c) => c.name === n);
  const data = [
    { name: "데일리 수분 세럼 50ml", code: "VF-BTY-0001", cat: "스킨케어",
      retail: 38000, price: 24900, supply: 14000, stock: 320,
      summary: "끈적임 없이 빠르게 흡수되는 데일리 수분 세럼",
      brand: "글로우랩", origin: "대한민국", commission: 12,
      keywords: ["수분","세럼","스킨케어","뷰티","보습","화장품"],
      img: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&q=80" },
    { name: "무선 블루투스 이어폰 Pro", code: "VF-DIG-0002", cat: "음향기기",
      retail: 89000, price: 59000, supply: 38000, stock: 150,
      summary: "노이즈 캔슬링 + 30시간 재생 무선 이어폰",
      brand: "사운드웨이브", origin: "중국", commission: 8,
      keywords: ["이어폰","블루투스","무선","음향","가전","디지털","노이즈캔슬링"],
      img: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&q=80" },
    { name: "오버핏 코튼 후드 티셔츠", code: "VF-FSH-0003", cat: "여성의류",
      retail: 49000, price: 32000, supply: 18000, stock: 210,
      summary: "데일리로 입기 좋은 부드러운 오버핏 후드",
      brand: "무드웨어", origin: "대한민국", commission: 15,
      keywords: ["후드","티셔츠","패션","의류","오버핏","데일리룩"],
      img: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&q=80" },
    { name: "프리미엄 원두 커피 1kg", code: "VF-FOO-0004", cat: "음료/커피",
      retail: 32000, price: 21900, supply: 12000, stock: 500,
      summary: "갓 볶은 스페셜티 원두, 균형 잡힌 바디감",
      brand: "데일리빈", origin: "콜롬비아", commission: 10,
      keywords: ["커피","원두","음료","식품","카페","홈카페"],
      img: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&q=80" },
    { name: "강아지 관절 영양제 90정", code: "VF-PET-0005", cat: "사료/간식",
      retail: 45000, price: 29000, supply: 16000, stock: 180,
      summary: "반려견 관절 건강을 위한 글루코사민 영양제",
      brand: "펫케어플러스", origin: "대한민국", commission: 14,
      keywords: ["강아지","반려동물","영양제","관절","펫","건강"],
      img: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600&q=80" },
  ];
  return data.map((p, i) => ({
    id: genId(),
    product_code: p.code,
    cafe24_product_no: null,
    name: p.name,
    category_id: catByName(p.cat)?.id ?? null,
    retail_price: p.retail,
    price: p.price,
    supply_price: p.supply,
    stock: p.stock,
    options: [],
    summary: p.summary,
    description: `${p.name} 상세 설명입니다. ${p.summary}`,
    main_image_url: p.img,
    additional_image_urls: [],
    shipping_fee_type: "conditional",
    shipping_fee: 3000,
    shipping_info: "3만원 이상 무료배송 / 평균 1~3일 소요",
    brand: p.brand,
    manufacturer: p.brand,
    origin: p.origin,
    model_name: null,
    keywords: p.keywords,
    display_status: "displayed",
    sell_status: "selling",
    commission_rate: p.commission,
    cafe24_sync_status: "not_synced",
    cafe24_synced_at: null,
    cafe24_sync_error: null,
    cafe24_mode: null,
    created_at: daysAgo(10 - i),
    updated_at: daysAgo(10 - i),
    created_by: adminId,
  }));
}


// 데모 판매/주문 (쇼츠 커머스 발주/배송 데모용) ------------------------
export function seedDemoOrders(products: Product[], creatorId: string, creatorName: string): ProductOrder[] {
  if (products.length === 0) return [];
  const pick = (i: number) => products[i % products.length];
  const buyers = [
    { name: "김민지", phone: "010-1234-5678", zip: "06236", addr: "서울시 강남구 테헤란로 123, 4층", memo: "부재시 경비실에 맡겨주세요" },
    { name: "박서준", phone: "010-2222-3333", zip: "13529", addr: "경기도 성남시 분당구 판교로 256", memo: "" },
    { name: "이하은", phone: "010-9876-5432", zip: "48058", addr: "부산시 해운대구 센텀로 99, 1203호", memo: "배송 전 연락 바랍니다" },
    { name: "최도윤", phone: "010-5555-7777", zip: "34126", addr: "대전시 유성구 대학로 77", memo: "" },
    { name: "정유나", phone: "010-4444-1111", zip: "61945", addr: "광주시 서구 상무대로 312", memo: "" },
  ];
  const statuses: ProductOrder["status"][] = ["paid", "preparing", "shipped", "delivered", "paid"];
  const today = new Date();
  const yyyymmdd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return buyers.map((b, i) => {
    const p = pick(i);
    const qty = (i % 2) + 1;
    const d = new Date(today.getTime() - (i + 1) * 86400000);
    const status = statuses[i];
    const shipped = status === "shipped" || status === "delivered";
    return {
      id: genId(),
      order_no: `${yyyymmdd(d)}-${String(1000001 + i)}`,
      product_id: p.id,
      product_name: p.name,
      product_image: p.main_image_url,
      creator_id: creatorId,
      creator_name: creatorName,
      shorts_link_id: null,
      quantity: qty,
      unit_price: p.price,
      amount: p.price * qty,
      commission_rate: p.commission_rate,
      creator_commission: Math.floor((p.price * qty * p.commission_rate) / 100),
      buyer_name: b.name,
      buyer_phone: b.phone,
      zipcode: b.zip,
      address: b.addr,
      delivery_memo: b.memo,
      status,
      courier: shipped ? "CJ대한통운" : null,
      tracking_no: shipped ? `6${String(100000000000 + i * 7777)}` : null,
      cafe24_order_no: null,
      ordered_at: d.toISOString(),
      shipped_at: shipped ? new Date(d.getTime() + 86400000).toISOString() : null,
      updated_at: d.toISOString(),
    };
  });
}

function seedCategories(): Category[] {
  const data: Record<Platform, string[]> = {
    youtube: ["유머", "뷰티", "맛집", "여행", "제품리뷰", "생활꿀팁", "반려동물", "교육", "게임", "패션"],
    instagram: ["뷰티", "패션", "감성", "맛집", "여행", "제품홍보", "라이프스타일"],
    tiktok: ["유머", "챌린지", "댄스", "제품리뷰", "밈", "숏드라마", "정보성 콘텐츠"],
  };
  const cats: Category[] = [];
  (Object.keys(data) as Platform[]).forEach((platform) => {
    data[platform].forEach((name, i) => {
      cats.push({
        id: genId(),
        platform,
        name,
        slug: `${platform}-${i}`,
        parent_id: null,
        sort_order: i,
        is_active: true,
      });
    });
  });
  return cats;
}

// ── 날짜 헬퍼 ──────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

// ===========================================================================
// 시드 데이터베이스
// ===========================================================================

export function seedDatabase(): Database {
  const now = new Date().toISOString();
  const categories = seedCategories();

  // ── 프로필 ────────────────────────────────────────────────────────────────

  const admin: Profile = {
    id: genId(),
    email: "admin@vibefunny.com",
    password_hash: hashPassword("Admin1234!"),
    name: "최고관리자",
    phone: "010-0000-0001",
    role: "admin",
    advertiser_type: null,
    parent_advertiser_id: null,
    referral_code: genReferralCode(),
    referred_by_user_id: null,
    status: "active",
    avatar_url: null,
    subscription_active_until: null,
    created_at: daysAgo(365),
    updated_at: now,
  };

  const creatorTest: Profile = {
    id: genId(),
    email: "creator_test@vibefunny.com",
    password_hash: hashPassword("Test1234!"),
    name: "김지현 (크리에이터)",
    phone: "010-1234-5678",
    role: "creator",
    advertiser_type: null,
    parent_advertiser_id: null,
    referral_code: genReferralCode(),
    referred_by_user_id: null,
    status: "active",
    avatar_url: "https://images.unsplash.com/photo-1494790108755-2616b612b59c?w=80&h=80&fit=crop&crop=face",
    subscription_active_until: null,
    created_at: daysAgo(120),
    updated_at: now,
  };

  const advertiserTest: Profile = {
    id: genId(),
    email: "advertiser_test@vibefunny.com",
    password_hash: hashPassword("Test1234!"),
    name: "박수진 광고 (실행사)",
    phone: "010-3456-7890",
    role: "advertiser",
    advertiser_type: "execution_company",
    parent_advertiser_id: null,
    referral_code: genReferralCode(),
    referred_by_user_id: null,
    status: "active",
    avatar_url: null,
    subscription_active_until: null,
    created_at: daysAgo(60),
    updated_at: now,
  };

  const agencyTest: Profile = {
    id: genId(),
    email: "agency_test@vibefunny.com",
    password_hash: hashPassword("Test1234!"),
    name: "미디어픽스 대행사",
    phone: "010-4567-8901",
    role: "advertiser",
    advertiser_type: "agency",
    parent_advertiser_id: advertiserTest.id,
    referral_code: genReferralCode(),
    referred_by_user_id: null,
    status: "active",
    avatar_url: null,
    subscription_active_until: null,
    created_at: daysAgo(45),
    updated_at: now,
  };

  const creator2: Profile = {
    id: genId(),
    email: "creator2@vibefunny.com",
    password_hash: hashPassword("Test1234!"),
    name: "박현우",
    phone: "010-5678-9012",
    role: "creator",
    advertiser_type: null,
    parent_advertiser_id: null,
    referral_code: genReferralCode(),
    referred_by_user_id: creatorTest.id,
    status: "active",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
    subscription_active_until: null,
    created_at: daysAgo(80),
    updated_at: now,
  };

  const creator3: Profile = {
    id: genId(),
    email: "creator3@vibefunny.com",
    password_hash: hashPassword("Test1234!"),
    name: "최예린",
    phone: "010-6789-0123",
    role: "creator",
    advertiser_type: null,
    parent_advertiser_id: null,
    referral_code: genReferralCode(),
    referred_by_user_id: null,
    status: "active",
    avatar_url: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
    subscription_active_until: null,
    created_at: daysAgo(55),
    updated_at: now,
  };

  const suspendedUser: Profile = {
    id: genId(),
    email: "suspended@vibefunny.com",
    password_hash: hashPassword("Test1234!"),
    name: "정지된 사용자",
    phone: null,
    role: "creator",
    advertiser_type: null,
    parent_advertiser_id: null,
    referral_code: genReferralCode(),
    referred_by_user_id: null,
    status: "suspended",
    avatar_url: null,
    subscription_active_until: null,
    created_at: daysAgo(200),
    updated_at: daysAgo(10),
  };

  const profiles = [admin, creatorTest, advertiserTest, agencyTest, creator2, creator3, suspendedUser];

  // ── 영상 ──────────────────────────────────────────────────────────────────

  const ytCat = categories.find((c) => c.platform === "youtube" && c.name === "유머")!;
  const igCat = categories.find((c) => c.platform === "instagram" && c.name === "뷰티")!;
  const tkCat = categories.find((c) => c.platform === "tiktok" && c.name === "유머")!;

  const video1: Video = {
    id: genId(),
    creator_id: creatorTest.id,
    title: "2024 최신 AI 생성 유머 영상 - 직장인 공감",
    description: "Gemini로 제작한 직장인 공감 유머 숏폼. 30초 이하, 4K 해상도.",
    platform: "youtube",
    category_id: ytCat?.id ?? null,
    tags: ["유머", "직장인", "AI영상", "숏폼"],
    duration_seconds: 28,
    price: 50000,
    original_video_url: "https://storage.vibefunny.com/videos/v1.mp4",
    preview_video_url: null,
    thumbnail_url: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&q=80",
    status: "available",
    copyright_confirmed: true,
    sold_to_user_id: null,
    sold_at: null,
    created_at: daysAgo(30),
    updated_at: daysAgo(25),
    vibeporter_enabled: true,
    vibeporter_approved: true,
    vibeporter_approved_at: daysAgo(23),
    vibeporter_price: 45000,
  };

  const video2: Video = {
    id: genId(),
    creator_id: creatorTest.id,
    title: "뷰티 브랜드 AI 광고 영상 15초",
    description: "뷰티 제품 홍보용 AI 영상. 자연스러운 제품 소개 형식.",
    platform: "instagram",
    category_id: igCat?.id ?? null,
    tags: ["뷰티", "광고", "인스타그램", "AI"],
    duration_seconds: 15,
    price: 30000,
    original_video_url: "https://storage.vibefunny.com/videos/v2.mp4",
    preview_video_url: null,
    thumbnail_url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&q=80",
    status: "available",
    copyright_confirmed: true,
    sold_to_user_id: null,
    sold_at: daysAgo(15),
    created_at: daysAgo(40),
    updated_at: daysAgo(15),
  };

  const video3: Video = {
    id: genId(),
    creator_id: creatorTest.id,
    title: "TikTok 챌린지 AI 영상 - 댄스 버전",
    description: "트렌디한 TikTok 댄스 챌린지 형식 AI 영상.",
    platform: "tiktok",
    category_id: tkCat?.id ?? null,
    tags: ["챌린지", "댄스", "TikTok", "트렌드"],
    duration_seconds: 22,
    price: 50000,
    original_video_url: "https://storage.vibefunny.com/videos/v3.mp4",
    preview_video_url: null,
    thumbnail_url: "https://images.unsplash.com/photo-1626785774625-ddcddc3445e9?w=400&q=80",
    status: "pending_review",
    copyright_confirmed: true,
    sold_to_user_id: null,
    sold_at: null,
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
  };

  const video4: Video = {
    id: genId(),
    creator_id: creator2.id,
    title: "맛집 탐방 AI 브이로그 - 서울 강남",
    description: "강남 핫플레이스 맛집 소개 AI 제작 영상. 식당 홍보에 최적.",
    platform: "youtube",
    category_id: ytCat?.id ?? null,
    tags: ["맛집", "서울", "강남", "AI브이로그"],
    duration_seconds: 55,
    price: 100000,
    original_video_url: "https://storage.vibefunny.com/videos/v4.mp4",
    preview_video_url: null,
    thumbnail_url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80",
    status: "available",
    copyright_confirmed: true,
    sold_to_user_id: null,
    sold_at: null,
    created_at: daysAgo(20),
    updated_at: daysAgo(18),
    vibeporter_enabled: true,
    vibeporter_approved: false,
  };

  const video5: Video = {
    id: genId(),
    creator_id: creator2.id,
    title: "반려동물 귀여운 일상 - 포메라니안 영상",
    description: "반려동물 AI 일상 영상. 펫 브랜드 광고에 활용 가능.",
    platform: "instagram",
    category_id: igCat?.id ?? null,
    tags: ["반려동물", "포메라니안", "귀여움", "펫"],
    duration_seconds: 18,
    price: 30000,
    original_video_url: "https://storage.vibefunny.com/videos/v5.mp4",
    preview_video_url: null,
    thumbnail_url: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=80",
    status: "available",
    copyright_confirmed: true,
    sold_to_user_id: null,
    sold_at: null,
    created_at: daysAgo(15),
    updated_at: daysAgo(15),
  };

  const video6: Video = {
    id: genId(),
    creator_id: creator3.id,
    title: "생활꿀팁 AI 정보성 콘텐츠 60초",
    description: "다이어트 생활꿀팁 60초 영상. 정보성 콘텐츠 채널용.",
    platform: "youtube",
    category_id: ytCat?.id ?? null,
    tags: ["생활꿀팁", "다이어트", "정보", "AI"],
    duration_seconds: 58,
    price: 100000,
    original_video_url: "https://storage.vibefunny.com/videos/v6.mp4",
    preview_video_url: null,
    thumbnail_url: "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&q=80",
    status: "rejected",
    copyright_confirmed: false,
    sold_to_user_id: null,
    sold_at: null,
    created_at: daysAgo(25),
    updated_at: daysAgo(20),
  };

  const video7: Video = {
    id: genId(),
    creator_id: creator3.id,
    title: "패션 룩북 AI 영상 - 2024 봄 컬렉션",
    description: "봄 시즌 패션 룩북 AI 영상. 패션 브랜드 홍보용.",
    platform: "instagram",
    category_id: igCat?.id ?? null,
    tags: ["패션", "룩북", "봄", "2024"],
    duration_seconds: 30,
    price: 50000,
    original_video_url: "https://storage.vibefunny.com/videos/v7.mp4",
    preview_video_url: null,
    thumbnail_url: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&q=80",
    status: "available",
    copyright_confirmed: true,
    sold_to_user_id: null,
    sold_at: null,
    created_at: daysAgo(10),
    updated_at: daysAgo(10),
  };

  const videos: Video[] = [video1, video2, video3, video4, video5, video6, video7];

  const video_purchases: VideoPurchase[] = [];

  const campaign1: AdCampaign = {
    id: genId(),
    advertiser_id: advertiserTest.id,
    title: "봄 시즌 뷰티 브랜드 YouTube 광고 캠페인",
    description: "20~30대 여성 타겟 뷰티 제품 YouTube Shorts 배포 캠페인.",
    campaign_type: "create_and_distribute",
    platforms: ["youtube", "instagram"],
    category_id: igCat?.id ?? null,
    video_required: true,
    uploaded_video_url: null,
    distribution_count: 50,
    target_keywords: "뷰티,화장품,스킨케어,2024봄",
    reference_links: "https://example.com/ref1",
    start_date: daysAgo(10),
    end_date: new Date(Date.now() + 20 * 86400000).toISOString(),
    total_cost: 750000,
    point_spent: 750000,
    status: "in_progress",
    admin_memo: null,
    created_at: daysAgo(15),
    updated_at: daysAgo(10),
    approved_at: daysAgo(12),
    published_at: daysAgo(10),
    source_type: "advertiser",
    participation_limit: 10,
  };

  const campaign2: AdCampaign = {
    id: genId(),
    advertiser_id: advertiserTest.id,
    title: "TikTok 챌린지 바이럴 캠페인 - 음료 브랜드",
    description: "MZ 세대 타겟 TikTok 바이럴 챌린지.",
    campaign_type: "distribute_existing_video",
    platforms: ["tiktok"],
    category_id: tkCat?.id ?? null,
    video_required: false,
    uploaded_video_url: "https://storage.vibefunny.com/campaigns/c2.mp4",
    distribution_count: 30,
    target_keywords: "챌린지,음료,MZ,바이럴",
    reference_links: null,
    start_date: daysAgo(5),
    end_date: new Date(Date.now() + 25 * 86400000).toISOString(),
    total_cost: 450000,
    point_spent: 450000,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(8),
    updated_at: daysAgo(5),
    approved_at: daysAgo(6),
    published_at: daysAgo(5),
    source_type: "advertiser",
    participation_limit: 5,
  };

  const campaign3: AdCampaign = {
    id: genId(),
    advertiser_id: agencyTest.id,
    title: "식품 브랜드 Instagram Reels 캠페인",
    description: "식품 건강 브랜드 인스타그램 릴스 배포. 20~40대 타겟.",
    campaign_type: "create_and_distribute",
    platforms: ["instagram"],
    category_id: igCat?.id ?? null,
    video_required: true,
    uploaded_video_url: null,
    distribution_count: 20,
    target_keywords: "건강식품,다이어트,건강",
    reference_links: null,
    start_date: null,
    end_date: null,
    total_cost: 300000,
    point_spent: 0,
    status: "admin_review",
    admin_memo: "심사 중",
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
    approved_at: null,
    published_at: null,
    source_type: "advertiser",
  };

  const campaign4: AdCampaign = {
    id: genId(),
    advertiser_id: advertiserTest.id,
    title: "게임 앱 출시 홍보 YouTube Shorts",
    description: "신규 모바일 게임 앱 출시 홍보 영상.",
    campaign_type: "create_only",
    platforms: ["youtube"],
    category_id: null,
    video_required: true,
    uploaded_video_url: null,
    distribution_count: 0,
    target_keywords: "게임,앱,모바일게임",
    reference_links: null,
    start_date: null,
    end_date: null,
    total_cost: 200000,
    point_spent: 200000,
    status: "completed",
    admin_memo: null,
    created_at: daysAgo(40),
    updated_at: daysAgo(20),
    approved_at: daysAgo(38),
    published_at: daysAgo(35),
    source_type: "advertiser",
  };

  const campaignVP: AdCampaign = {
    id: "camp_vp_001",
    advertiser_id: "vibeporter_system",
    title: "브랜드 소개 영상 제작 (바이브포터 의뢰)",
    description: "중소기업 브랜드 소개용 60초 AI 영상 제작 의뢰",
    campaign_type: "create_only",
    platforms: ["youtube", "instagram"],
    category_id: null,
    video_required: true,
    uploaded_video_url: null,
    distribution_count: 1,
    target_keywords: "브랜드,소개영상,AI영상",
    reference_links: null,
    start_date: daysAgo(5),
    end_date: new Date(Date.now() + 30 * 86400000).toISOString(),
    total_cost: 150000,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(5),
    updated_at: daysAgo(5),
    approved_at: daysAgo(5),
    published_at: daysAgo(5),
    source_type: "vibeporter",
    participation_limit: 3,
  };

  // ── 추가 더미 캠페인 (참여가능) — 다양한 유형/출처 ───────────────────────
  const soon = () => new Date(Date.now() + 25 * 86400000).toISOString();

  // 광고주 — 영상 제작 + 배포 (상세 브리프 풍부)
  const campA: AdCampaign = {
    id: genId(),
    advertiser_id: advertiserTest.id,
    title: "여름 신상 스니커즈 멀티플랫폼 런칭 캠페인",
    description: "MZ세대 타겟 신상 스니커즈 출시. 제작부터 4개 플랫폼 동시 배포까지 진행합니다.",
    campaign_type: "create_and_distribute",
    platforms: ["youtube", "instagram", "tiktok", "facebook"],
    category_id: igCat?.id ?? null,
    video_required: true,
    uploaded_video_url: null,
    distribution_count: 40,
    video_production_count: 10,
    video_duration_tier: "30s",
    target_keywords: "스니커즈,신상,여름패션,데일리룩",
    reference_links: "https://example.com/sneakers",
    start_date: daysAgo(2),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(3),
    updated_at: daysAgo(1),
    approved_at: daysAgo(2),
    published_at: daysAgo(2),
    source_type: "advertiser",
    participation_limit: 15,
    brand_name: "STRIDE",
    industry: "패션",
    website_url: "https://stride.example.com",
    brief_product_name: "STRIDE 에어플로우 2026",
    brief_product_detail: "초경량 메쉬 어퍼와 반발 쿠션을 적용한 여름용 러닝 스니커즈.",
    brief_tone: "트렌디하고 세련된",
    brief_style: "언박싱 / 리뷰형",
    brief_target_audience: "20~30대, 러닝·데일리룩 관심층",
    brief_key_messages: "초경량, 통기성, 데일리 코디 강조",
    brief_avoid: "경쟁사 브랜드 직접 비교 금지",
    brief_hashtags: "#STRIDE #신상스니커즈 #여름신발",
    brief_youtube_category: "패션 / 스타일",
    brief_instagram_category: "패션 / 스타일",
    creator_min_followers: "10k",
    creator_gender: "all",
    creator_age_group: "20s",
    creator_requirements: "패션/뷰티 콘텐츠 경험자 우대",
    utm_link: "https://stride.example.com?utm_source=vibefunny",
    promo_code: "STRIDE10",
    kpi_goals: JSON.stringify(["views", "link_clicks", "conversions"]),
  };

  // 광고주 — 자체 영상 배포
  const campB: AdCampaign = {
    id: genId(),
    advertiser_id: agencyTest.id,
    title: "프랜차이즈 카페 신메뉴 릴스 배포",
    description: "본사 제작 영상을 크리에이터 채널에 배포하는 캠페인입니다.",
    campaign_type: "distribute_own_video",
    platforms: ["instagram", "facebook"],
    category_id: igCat?.id ?? null,
    video_required: false,
    uploaded_video_url: "https://storage.vibefunny.com/campaigns/cafe-reels.mp4",
    distribution_count: 25,
    video_production_count: 0,
    target_keywords: "카페,신메뉴,여름음료,디저트",
    reference_links: null,
    start_date: daysAgo(1),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
    approved_at: daysAgo(1),
    published_at: daysAgo(1),
    source_type: "advertiser",
    participation_limit: 25,
    brand_name: "데일리빈 카페",
    industry: "식품",
  };

  // 광고주 — 기존 영상 기반 배포 (TikTok)
  const campC: AdCampaign = {
    id: genId(),
    advertiser_id: advertiserTest.id,
    title: "헬스 보충제 TikTok 숏폼 배포",
    description: "기존 제작 영상 URL을 기반으로 틱톡 배포 진행.",
    campaign_type: "distribute_existing_video",
    platforms: ["tiktok"],
    category_id: tkCat?.id ?? null,
    video_required: false,
    uploaded_video_url: "https://storage.vibefunny.com/campaigns/protein.mp4",
    distribution_count: 35,
    video_production_count: 0,
    target_keywords: "헬스,보충제,단백질,운동",
    reference_links: null,
    start_date: daysAgo(1),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
    approved_at: daysAgo(1),
    published_at: daysAgo(1),
    source_type: "advertiser",
    participation_limit: 20,
    brand_name: "MUSCLE LAB",
    industry: "식품",
  };

  // 광고주 — 단순 영상 제작
  const campD: AdCampaign = {
    id: genId(),
    advertiser_id: agencyTest.id,
    title: "스타트업 앱 소개 60초 AI 영상 제작",
    description: "배포 없이 제작만 의뢰합니다. 60초 분량 앱 소개 영상.",
    campaign_type: "create_only",
    platforms: [],
    category_id: null,
    video_required: true,
    uploaded_video_url: null,
    distribution_count: 0,
    video_production_count: 8,
    video_duration_tier: "60s",
    target_keywords: "앱소개,스타트업,핀테크",
    reference_links: null,
    start_date: daysAgo(1),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
    approved_at: daysAgo(1),
    published_at: daysAgo(1),
    source_type: "advertiser",
    participation_limit: 8,
    brand_name: "페이루프",
    industry: "IT",
    brief_product_name: "페이루프 가계부 앱",
    brief_product_detail: "자동 가계부 + 소비 분석 핀테크 앱. 핵심 기능 3가지를 60초에 담아주세요.",
    brief_tone: "신뢰감 있고 전문적인",
    brief_style: "튜토리얼 / 하우투형",
  };

  // 바이브포터 — 제작 + 배포 의뢰
  const campVP2: AdCampaign = {
    id: genId(),
    advertiser_id: "vibeporter_system",
    title: "지역 농산물 브랜드 홍보 영상 제작·배포 (바이브포터)",
    description: "바이브포터 제작 의뢰. 지역 농산물 브랜드 스토리 영상 제작 후 배포.",
    campaign_type: "create_and_distribute",
    platforms: ["youtube", "instagram"],
    category_id: null,
    video_required: true,
    uploaded_video_url: null,
    distribution_count: 12,
    video_production_count: 4,
    video_duration_tier: "30s",
    target_keywords: "농산물,로컬푸드,친환경",
    reference_links: null,
    start_date: daysAgo(3),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(4),
    updated_at: daysAgo(2),
    approved_at: daysAgo(3),
    published_at: daysAgo(3),
    source_type: "vibeporter",
    participation_limit: 6,
    brand_name: "들녘이야기",
  };

  // 바이브포터 — 단순 제작 의뢰
  const campVP3: AdCampaign = {
    id: genId(),
    advertiser_id: "vibeporter_system",
    title: "온라인 클래스 홍보 숏폼 제작 (바이브포터)",
    description: "바이브포터 제작 의뢰. 온라인 클래스 홍보용 15초 숏폼 제작.",
    campaign_type: "create_only",
    platforms: [],
    category_id: null,
    video_required: true,
    uploaded_video_url: null,
    distribution_count: 0,
    video_production_count: 6,
    video_duration_tier: "15s",
    target_keywords: "온라인클래스,교육,자기계발",
    reference_links: null,
    start_date: daysAgo(2),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(3),
    updated_at: daysAgo(1),
    approved_at: daysAgo(2),
    published_at: daysAgo(2),
    source_type: "vibeporter",
    participation_limit: 6,
  };

  // 바이브포터 — 동화 제작 의뢰 1 (AI스토리 연동 대비)
  const campStory1: AdCampaign = {
    id: "camp_story_001",
    advertiser_id: "vibeporter_system",
    title: "우리 아이 맞춤 동화 제작 - 우주 탐험 이야기",
    description: "AI스토리에서 의뢰된 맞춤 동화 제작 건입니다. 아이가 주인공인 그림동화를 제작해주세요.",
    campaign_type: "story_creation",
    platforms: [],
    category_id: null,
    video_required: false,
    uploaded_video_url: null,
    distribution_count: 0,
    video_production_count: 1,
    video_duration_tier: null,
    target_keywords: "동화,그림책,맞춤동화,우주",
    reference_links: null,
    start_date: daysAgo(1),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
    approved_at: daysAgo(1),
    published_at: daysAgo(1),
    source_type: "ai_story",
    participation_limit: 3,
    story_brief: {
      source: "ai_story",
      source_request_id: "req-001",
      child_name: "지유",
      child_age: 5,
      child_photo_url: "",
      story_theme: "우주 탐험",
      story_note: "강아지 캐릭터와 함께 별나라를 여행하는 따뜻한 모험 이야기로 만들어주세요.",
      art_style: "부드러운 수채화풍, 파스텔 톤",
      tone: "따뜻하고 잔잔한",
      page_count: 12,
      target_age_range: "4~7세",
      key_characters: "주인공 지유, 우주 강아지 '뭉치', 별나라 친구들",
      moral_lesson: "용기를 내어 새로운 것에 도전하기",
      language: "한국어",
      requester_name: "김지은",
      style_requirements: "각 장면마다 아이 얼굴이 또렷하게 보이도록, 무섭지 않고 밝은 색감 유지",
      reference_image_urls: [],
      voice_label: "엄마 목소리",
      voice_file_name: "지유_엄마목소리.mp3",
      voice_file_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
    },
  };

  // 바이브포터 — 동화 제작 의뢰 2
  const campStory2: AdCampaign = {
    id: "camp_story_002",
    advertiser_id: "vibeporter_system",
    title: "우리 아이 맞춤 동화 제작 - 바닷속 친구들",
    description: "AI스토리 맞춤 동화 의뢰. 바닷속 탐험을 주제로 한 그림동화 제작.",
    campaign_type: "story_creation",
    platforms: [],
    category_id: null,
    video_required: false,
    uploaded_video_url: null,
    distribution_count: 0,
    video_production_count: 1,
    video_duration_tier: null,
    target_keywords: "동화,그림책,맞춤동화,바다",
    reference_links: null,
    start_date: daysAgo(1),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    approved_at: daysAgo(1),
    published_at: daysAgo(1),
    source_type: "ai_story",
    participation_limit: 3,
    story_brief: {
      source: "ai_story",
      source_request_id: "req-002",
      child_name: "도윤",
      child_age: 6,
      child_photo_url: "",
      story_theme: "바닷속 탐험",
      story_note: "거북이와 함께 바닷속 보물을 찾아 떠나는 신나는 모험 이야기.",
      art_style: "3D 픽사풍, 선명하고 생동감 있는 색감",
      tone: "밝고 신나는",
      page_count: 10,
      target_age_range: "5~8세",
      key_characters: "주인공 도윤, 바다거북 '바다', 물고기 삼총사",
      moral_lesson: "친구와 협동하면 어려움을 이겨낼 수 있다",
      language: "한국어",
      requester_name: "박서연",
      style_requirements: "물속 표현은 투명하고 푸른 톤, 캐릭터는 귀엽고 친근하게",
      reference_image_urls: [],
      voice_label: "아빠 목소리",
      voice_file_name: "도윤_아빠목소리.mp3",
      voice_file_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    },
  };

  // 바이브포터 — 동화 제작 의뢰 3
  const campStory3: AdCampaign = {
    id: "camp_story_003",
    advertiser_id: "vibeporter_system",
    title: "우리 아이 맞춤 동화 제작 - 공룡 시대 모험",
    description: "AI스토리 맞춤 동화 의뢰. 공룡 시대로 떠나는 모험 그림동화 제작.",
    campaign_type: "story_creation",
    platforms: [],
    category_id: null,
    video_required: false,
    uploaded_video_url: null,
    distribution_count: 0,
    video_production_count: 1,
    video_duration_tier: null,
    target_keywords: "동화,그림책,맞춤동화,공룡",
    reference_links: null,
    start_date: daysAgo(1),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    approved_at: daysAgo(1),
    published_at: daysAgo(1),
    source_type: "ai_story",
    participation_limit: 3,
    story_brief: {
      source: "ai_story",
      source_request_id: "req-003",
      child_name: "하준",
      child_age: 7,
      child_photo_url: "",
      story_theme: "공룡 시대 모험",
      story_note: "용감한 주인공이 공룡 친구들과 함께 화산 폭발을 막는 모험 이야기.",
      art_style: "만화풍, 선명하고 역동적인 색감",
      tone: "신나고 박진감 있는",
      page_count: 14,
      target_age_range: "6~9세",
      key_characters: "주인공 하준, 아기 공룡 '쿵쿵', 트리케라톱스 무리",
      moral_lesson: "겁이 나도 친구를 도우면 용기가 생긴다",
      language: "한국어",
      requester_name: "이수민",
      style_requirements: "공룡은 무섭지 않고 친근하게, 화산 장면도 위협적이지 않게 표현",
      reference_image_urls: [],
    },
  };

  // 바이브포터 — 동화 제작 의뢰 4
  const campStory4: AdCampaign = {
    id: "camp_story_004",
    advertiser_id: "vibeporter_system",
    title: "우리 아이 맞춤 동화 제작 - 마법의 숲 친구들",
    description: "AI스토리 맞춤 동화 의뢰. 마법의 숲에서 펼쳐지는 따뜻한 우정 이야기.",
    campaign_type: "story_creation",
    platforms: [],
    category_id: null,
    video_required: false,
    uploaded_video_url: null,
    distribution_count: 0,
    video_production_count: 1,
    video_duration_tier: null,
    target_keywords: "동화,그림책,맞춤동화,마법,숲",
    reference_links: null,
    start_date: daysAgo(1),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    approved_at: daysAgo(1),
    published_at: daysAgo(1),
    source_type: "ai_story",
    participation_limit: 3,
    story_brief: {
      source: "ai_story",
      source_request_id: "req-004",
      child_name: "서아",
      child_age: 4,
      child_photo_url: "",
      story_theme: "마법의 숲",
      story_note: "작은 요정과 함께 마법의 숲 동물들을 도와주는 잔잔하고 따뜻한 이야기.",
      art_style: "동화풍 수채화, 은은한 파스텔 톤",
      tone: "포근하고 다정한",
      page_count: 10,
      target_age_range: "3~6세",
      key_characters: "주인공 서아, 숲의 요정 '반디', 토끼와 다람쥐",
      moral_lesson: "작은 친절이 큰 행복을 만든다",
      language: "한국어",
      requester_name: "정하늘",
      style_requirements: "잠자기 전 읽어주기 좋은 부드러운 분위기, 글밥은 짧게",
      reference_image_urls: [],
    },
  };

  // 바이브포터 — 영상 제작 + 배포 의뢰 (추가)
  const campVP4: AdCampaign = {
    id: "camp_demo_vp4",
    advertiser_id: "vibeporter_system",
    title: "동물병원 브랜드 홍보 숏폼 제작·배포 (바이브포터)",
    description: "바이브포터 제작 의뢰. 반려동물 병원 브랜드 홍보 영상 제작 후 인스타·틱톡 배포.",
    campaign_type: "create_and_distribute",
    platforms: ["instagram", "tiktok"],
    category_id: null,
    video_required: true,
    uploaded_video_url: null,
    distribution_count: 16,
    video_production_count: 4,
    video_duration_tier: "30s",
    target_keywords: "반려동물,동물병원,펫케어",
    reference_links: null,
    start_date: daysAgo(1),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    approved_at: daysAgo(1),
    published_at: daysAgo(1),
    source_type: "vibeporter",
    participation_limit: 8,
    brand_name: "행복한동물병원",
  };

  // AI스토리 — 동화 제작 의뢰 (추가)
  const campStory5: AdCampaign = {
    id: "camp_story_005",
    advertiser_id: "vibeporter_system",
    title: "우리 아이 맞춤 동화 제작 - 구름나라 여행",
    description: "AI스토리 맞춤 동화 의뢰. 구름나라를 여행하는 상상력 가득한 그림동화 제작.",
    campaign_type: "story_creation",
    platforms: [],
    category_id: null,
    video_required: false,
    uploaded_video_url: null,
    distribution_count: 0,
    video_production_count: 1,
    video_duration_tier: null,
    target_keywords: "동화,그림책,맞춤동화,구름",
    reference_links: null,
    start_date: daysAgo(1),
    end_date: soon(),
    total_cost: 0,
    point_spent: 0,
    status: "recruiting",
    admin_memo: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    approved_at: daysAgo(1),
    published_at: daysAgo(1),
    source_type: "ai_story",
    participation_limit: 3,
    story_brief: {
      source: "ai_story",
      source_request_id: "req-005",
      child_name: "유나",
      child_age: 5,
      child_photo_url: "",
      story_theme: "구름나라 여행",
      story_note: "솜사탕 구름을 타고 하늘나라 친구들을 만나는 상상 가득한 이야기.",
      art_style: "몽환적인 파스텔 수채화",
      tone: "포근하고 몽글몽글한",
      page_count: 12,
      target_age_range: "4~7세",
      key_characters: "주인공 유나, 구름 친구 '몽실', 무지개 새",
      moral_lesson: "상상력은 무엇이든 가능하게 한다",
      language: "한국어",
      requester_name: "최은영",
      style_requirements: "전체적으로 부드럽고 따뜻한 색감, 잠자기 전 읽기 좋은 분위기",
      reference_image_urls: [],
      voice_label: "엄마 목소리",
      voice_file_name: "유나_엄마목소리.mp3",
      voice_file_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
    },
  };

  const ad_campaigns: AdCampaign[] = [
    campaign1, campaign2, campaign3, campaign4, campaignVP,
    campA, campB, campC, campD, campVP2, campVP3, campVP4,
    campStory1, campStory2, campStory3, campStory4, campStory5,
  ];

  const campApp1: CampaignApplication = {
    id: genId(),
    campaign_id: campaign1.id,
    creator_id: creatorTest.id,
    status: "approved",
    created_at: daysAgo(9),
    updated_at: daysAgo(9),
  };

  const campApp2: CampaignApplication = {
    id: genId(),
    campaign_id: campaign1.id,
    creator_id: creator2.id,
    status: "applied",
    created_at: daysAgo(8),
    updated_at: daysAgo(8),
  };

  const campApp3: CampaignApplication = {
    id: genId(),
    campaign_id: campaign2.id,
    creator_id: creator3.id,
    status: "applied",
    created_at: daysAgo(4),
    updated_at: daysAgo(4),
  };

  const campaign_applications: CampaignApplication[] = [campApp1, campApp2, campApp3];

  const campDel1: CampaignDelivery = {
    id: genId(),
    campaign_id: campaign1.id,
    creator_id: creatorTest.id,
    platform: "youtube",
    post_url: "https://youtube.com/shorts/sample1",
    proof_image_url: null,
    submitted_video_url: null,
    description: "YouTube Shorts 업로드 완료. 조회수 1,200회.",
    status: "approved",
    reward_amount: 10000,
    created_at: daysAgo(7),
    updated_at: daysAgo(6),
  };

  const campaign_deliveries: CampaignDelivery[] = [campDel1];

  const req1: CustomVideoRequest = {
    id: genId(),
    buyer_id: creatorTest.id,
    assigned_creator_id: creatorTest.id,
    title: "카페 홍보 15초 숏폼 제작 의뢰",
    requirements: "서울 합정동 카페 홍보용 Instagram Reels 15초.",
    reference_links: "https://instagram.com/sample_cafe",
    platform: "instagram",
    category_id: igCat?.id ?? null,
    duration_seconds: 15,
    budget: 80000,
    due_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    attachment_urls: [],
    is_public: true,
    designated_creator_id: null,
    status: "in_progress",
    payment_id: null,
    created_at: daysAgo(7),
    updated_at: daysAgo(5),
  };

  const req2: CustomVideoRequest = {
    id: genId(),
    buyer_id: creator2.id,
    assigned_creator_id: null,
    title: "피트니스 앱 홍보 YouTube Shorts 30초",
    requirements: "피트니스 앱 홍보 YouTube Shorts. 다이어트 성공 스토리 형식.",
    reference_links: null,
    platform: "youtube",
    category_id: ytCat?.id ?? null,
    duration_seconds: 30,
    budget: 120000,
    due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
    attachment_urls: [],
    is_public: true,
    designated_creator_id: null,
    status: "open",
    payment_id: null,
    created_at: daysAgo(3),
    updated_at: daysAgo(3),
  };

  const custom_video_requests: CustomVideoRequest[] = [req1, req2];

  const social1: SocialAccount = {
    id: genId(),
    creator_id: creatorTest.id,
    platform: "youtube",
    account_name: "김지현 숏폼",
    channel_url: "https://youtube.com/@jihyun_shortform",
    follower_count: 12400,
    verified_status: "verified",
    created_at: daysAgo(100),
    updated_at: daysAgo(30),
  };

  const social2: SocialAccount = {
    id: genId(),
    creator_id: creatorTest.id,
    platform: "instagram",
    account_name: "jihyun.creates",
    channel_url: "https://instagram.com/jihyun.creates",
    follower_count: 8700,
    verified_status: "verified",
    created_at: daysAgo(100),
    updated_at: daysAgo(20),
  };

  const social3: SocialAccount = {
    id: genId(),
    creator_id: creator2.id,
    platform: "youtube",
    account_name: "박현우TV",
    channel_url: "https://youtube.com/@hyunwoo_tv",
    follower_count: 5200,
    verified_status: "pending",
    created_at: daysAgo(70),
    updated_at: daysAgo(10),
  };

  const social4: SocialAccount = {
    id: genId(),
    creator_id: creator3.id,
    platform: "tiktok",
    account_name: "yerin_vibe",
    channel_url: "https://tiktok.com/@yerin_vibe",
    follower_count: 22000,
    verified_status: "verified",
    created_at: daysAgo(50),
    updated_at: daysAgo(5),
  };

  const social_accounts: SocialAccount[] = [social1, social2, social3, social4];

  const wallet1: Wallet = {
    id: genId(),
    user_id: creatorTest.id,
    pending_balance: 30000,
    available_balance: 410000,
    paid_balance: 350000,
    created_at: daysAgo(120),
    updated_at: now,
  };

  const wallet2: Wallet = {
    id: genId(),
    user_id: creator2.id,
    pending_balance: 0,
    available_balance: 80000,
    paid_balance: 0,
    created_at: daysAgo(80),
    updated_at: now,
  };

  const wallets: Wallet[] = [wallet1, wallet2];

  const walletTx1: WalletTransaction = {
    id: genId(),
    user_id: creatorTest.id,
    type: "video_sale",
    amount: 24000,
    status: "available",
    related_table: "video_purchases",
    related_id: "n/a",
    memo: "뷰티 브랜드 AI 광고 영상 판매",
    created_at: daysAgo(15),
    updated_at: daysAgo(15),
  };

  const walletTx2: WalletTransaction = {
    id: genId(),
    user_id: creatorTest.id,
    type: "campaign_reward",
    amount: 10000,
    status: "available",
    related_table: "campaign_deliveries",
    related_id: campDel1.id,
    memo: "YouTube Shorts 배포 완료 - 봄 시즌 뷰티",
    created_at: daysAgo(6),
    updated_at: daysAgo(6),
  };

  const walletTx3: WalletTransaction = {
    id: genId(),
    user_id: creatorTest.id,
    type: "payout",
    amount: -200000,
    status: "paid",
    related_table: "payout_requests",
    related_id: null,
    memo: "출금 처리 완료",
    created_at: daysAgo(30),
    updated_at: daysAgo(28),
  };

  const walletTx4: WalletTransaction = {
    id: genId(),
    user_id: creatorTest.id,
    type: "video_sale",
    amount: 400000,
    status: "available",
    related_table: null,
    related_id: null,
    memo: "영상 판매 수익 (누적)",
    created_at: daysAgo(60),
    updated_at: daysAgo(60),
  };

  const walletTx5: WalletTransaction = {
    id: genId(),
    user_id: creator2.id,
    type: "campaign_reward",
    amount: 80000,
    status: "available",
    related_table: null,
    related_id: null,
    memo: "캠페인 배포 보상",
    created_at: daysAgo(20),
    updated_at: daysAgo(20),
  };

  const wallet_transactions: WalletTransaction[] = [walletTx1, walletTx2, walletTx3, walletTx4, walletTx5];

  const pointWallet1: PointWallet = {
    id: genId(),
    advertiser_id: advertiserTest.id,
    point_balance: 500000,
    created_at: daysAgo(60),
    updated_at: now,
  };

  const pointWallet2: PointWallet = {
    id: genId(),
    advertiser_id: agencyTest.id,
    point_balance: 150000,
    created_at: daysAgo(45),
    updated_at: now,
  };

  const point_wallets: PointWallet[] = [pointWallet1, pointWallet2];

  const ptTx1: PointTransaction = {
    id: genId(),
    advertiser_id: advertiserTest.id,
    type: "charge",
    amount: 1000000,
    balance_after: 1000000,
    payment_id: null,
    campaign_id: null,
    memo: "포인트 충전 (신용카드)",
    created_at: daysAgo(55),
  };

  const ptTx2: PointTransaction = {
    id: genId(),
    advertiser_id: advertiserTest.id,
    type: "spend",
    amount: -750000,
    balance_after: 250000,
    payment_id: null,
    campaign_id: campaign1.id,
    memo: "봄 시즌 뷰티 캠페인 집행",
    created_at: daysAgo(15),
  };

  const ptTx3: PointTransaction = {
    id: genId(),
    advertiser_id: advertiserTest.id,
    type: "charge",
    amount: 500000,
    balance_after: 750000,
    payment_id: null,
    campaign_id: null,
    memo: "포인트 추가 충전",
    created_at: daysAgo(10),
  };

  const ptTx4: PointTransaction = {
    id: genId(),
    advertiser_id: advertiserTest.id,
    type: "spend",
    amount: -450000,
    balance_after: 300000,
    payment_id: null,
    campaign_id: campaign2.id,
    memo: "TikTok 챌린지 캠페인 집행",
    created_at: daysAgo(5),
  };

  const ptTx5: PointTransaction = {
    id: genId(),
    advertiser_id: agencyTest.id,
    type: "charge",
    amount: 500000,
    balance_after: 500000,
    payment_id: null,
    campaign_id: null,
    memo: "초기 포인트 충전",
    created_at: daysAgo(40),
  };

  const ptTx6: PointTransaction = {
    id: genId(),
    advertiser_id: agencyTest.id,
    type: "spend",
    amount: -350000,
    balance_after: 150000,
    payment_id: null,
    campaign_id: campaign3.id,
    memo: "식품 브랜드 캠페인 예약",
    created_at: daysAgo(2),
  };

  const point_transactions: PointTransaction[] = [ptTx1, ptTx2, ptTx3, ptTx4, ptTx5, ptTx6];

  const payout1: PayoutRequest = {
    id: genId(),
    user_id: creatorTest.id,
    amount: 200000,
    bank_name: "국민은행",
    bank_account_number: "123456-78-901234",
    account_holder: "김지현",
    status: "paid",
    admin_memo: "정산 완료",
    requested_at: daysAgo(30),
    processed_at: daysAgo(28),
  };

  const payout2: PayoutRequest = {
    id: genId(),
    user_id: creatorTest.id,
    amount: 150000,
    bank_name: "신한은행",
    bank_account_number: "110-234-567890",
    account_holder: "김지현",
    status: "requested",
    admin_memo: null,
    requested_at: daysAgo(2),
    processed_at: null,
  };

  const payout3: PayoutRequest = {
    id: genId(),
    user_id: creator2.id,
    amount: 80000,
    bank_name: "커카오뱅크",
    bank_account_number: "3333-12-3456789",
    account_holder: "박현우",
    status: "approved",
    admin_memo: null,
    requested_at: daysAgo(5),
    processed_at: daysAgo(3),
  };

  const payout_requests: PayoutRequest[] = [payout1, payout2, payout3];

  const vibeporter_requests: VibeporterRequest[] = [
    {
      id: genId(),
      title: "스타트업 브랜드 소개 영상 60초",
      description: "2인 창업 팀의 AI 헬스케어 스타트업 소개용 영상. YouTube 및 LinkedIn 업로드 예정.",
      budget: 200000,
      platform: ["youtube", "instagram"],
      status: "open",
      buyer_name: "김민준",
      buyer_id: "vp_buyer_001",
      created_at: daysAgo(3),
      source: "vibeporter",
    },
    {
      id: genId(),
      title: "쇼핑몰 신상품 홍보 릴스 15초",
      description: "여름 신상 의류 3종 릴스 제작. 경쾌하고 밝은 톤 요청.",
      platform: ["instagram"],
      budget: 80000,
      status: "in_progress",
      buyer_name: "이수진",
      buyer_id: "vp_buyer_002",
      accepted_creator_id: creatorTest.id,
      accepted_at: daysAgo(1),
      created_at: daysAgo(7),
      source: "vibeporter",
    },
  ];

  // ── 유튜브 쇼츠 커머스: 카테고리 + 데모 상품 ──────────────────────────
  const productCategories = seedProductCategories();
  const shortsAdminId = profiles.find((p) => p.role === "admin")?.id ?? "admin";
  const demoProducts = seedDemoProducts(productCategories, shortsAdminId);
  const demoOrders = seedDemoOrders(demoProducts, creatorTest.id, creatorTest.name);

  return {
    profiles,
    settings: defaultSettings(),
    referral_rewards: [],
    referral_relations: [
      {
        id: genId(),
        referrer_id: creatorTest.id,
        referee_id: creator2.id,
        referral_type: "signup",
        created_at: daysAgo(80),
      },
    ],
    wallets,
    wallet_transactions,
    point_wallets,
    point_transactions,
    payments: [],
    categories,
    videos,
    video_purchases,
    custom_video_requests,
    custom_video_applications: [],
    custom_video_deliveries: [],
    ad_campaigns,
    campaign_applications,
    campaign_deliveries,
    social_accounts,
    payout_requests,
    audit_logs: [],
    campaign_submissions: [],
    submission_comments: [],
    campaign_participations: [] as CampaignParticipation[],
    campaign_videos: [],
    campaign_comments: [] as CampaignComment[],
    campaign_direct_messages: [],
    vibeporter_requests,
    participation_comments: [],
    // 유튜브 쇼츠 커머스
    product_categories: productCategories,
    products: demoProducts,
    creator_youtube_channels: [],
    creator_shorts_links: [],
    product_orders: demoOrders,
  };
}
