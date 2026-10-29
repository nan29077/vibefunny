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
      },
      creator: {
        target_role: "creator",
        // 크리에이터 가입비 990,000원 (결제 시 바이브회원). 관리자 정책 설정에서 변경
        signup_fee_enabled: true,
        signup_fee_amount: 990000,
        referral_reward_amount: 5000,
      },
      advertiser: {
        target_role: "advertiser",
        signup_fee_enabled: false,
        signup_fee_amount: 0,
        referral_reward_amount: 5000,
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
        subtitle: "캠페인 배포·영상 제작·쇼츠 커머스·추천 수당까지 한 곳에서",
        cta_label: "추천 코드로 가입하기",
        cta_href: "/signup",
        gradient: "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)",
        is_active: true,
      },
    ],
    site_announcement: null,
    site_howto_blocks: [
      { step: 1, role: "creator" as const, title: "회원가입", description: "크리에이터로 가입하세요." },
      { step: 2, role: "creator" as const, title: "가입비 결제", description: "가입비를 결제하면 바이브회원이 됩니다." },
      { step: 3, role: "creator" as const, title: "수익 창출", description: "캠페인 배포·영상 제작 수익과 추천 수당을 받으세요." },
    ],
    site_revenue_stats: [
      { key: "creators", label: "등록 크리에이터", value: "1,200", suffix: "명" },
      { key: "videos", label: "제작된 영상", value: "8,500", suffix: "개" },
      { key: "avg_income", label: "크리에이터 평균 월 수익", value: "32", suffix: "만원" },
    ],
    support_hours_enabled: true,
    support_hours_start: "10:00",
    support_hours_end: "17:00",
    support_hours_timezone: "Asia/Seoul",
    verification_sender_email: "",
    // 유튜브 쇼츠 커머스
    cafe24: defaultCafe24Settings(),
    shorts_commerce_default_commission_rate: 10,
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
    vibe_member_at: null,
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
    vibe_member_at: now, // 데모 크리에이터는 바이브회원
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
    vibe_member_at: null,
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
    vibe_member_at: null,
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
    vibe_member_at: now, // 데모 크리에이터는 바이브회원
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
    vibe_member_at: now, // 데모 크리에이터는 바이브회원
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
    vibe_member_at: now, // 데모 크리에이터는 바이브회원
    created_at: daysAgo(200),
    updated_at: daysAgo(10),
  };

  const profiles = [admin, creatorTest, advertiserTest, agencyTest, creator2, creator3, suspendedUser];
  // 데모 크리에이터는 바이브회원(가입비 결제 완료)으로 시작 — 결제 전 흐름은 새로 가입해 확인
  for (const p of profiles) if (p.role === "creator") p.vibe_member_at = p.created_at;

  // ── 카테고리 ──────────────────────────────────────────────────────────────
  const ytCat = categories.find((c) => c.platform === "youtube" && c.name === "유머")!;
  const igCat = categories.find((c) => c.platform === "instagram" && c.name === "뷰티")!;
  const tkCat = categories.find((c) => c.platform === "tiktok" && c.name === "유머")!;

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
  };

  const soon = () => new Date(Date.now() + 25 * 86400000).toISOString();

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
    participation_limit: 8,
    brand_name: "페이루프",
    industry: "IT",
    brief_product_name: "페이루프 가계부 앱",
    brief_product_detail: "자동 가계부 + 소비 분석 핀테크 앱. 핵심 기능 3가지를 60초에 담아주세요.",
    brief_tone: "신뢰감 있고 전문적인",
    brief_style: "튜토리얼 / 하우투형",
  };

  const ad_campaigns: AdCampaign[] = [
    campaign1, campaign2, campaign3, campaign4,
    campA, campB, campC, campD,
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
    paid_balance: 200000, // 지급 완료 200,000 (150,000은 출금 신청 중 → 지급가능 잔액에서 차감된 상태)
    created_at: daysAgo(120),
    updated_at: now,
  };

  const wallet2: Wallet = {
    id: genId(),
    user_id: creator2.id,
    pending_balance: 0,
    available_balance: 0, // 80,000 전액 출금 신청(승인됨) → 지급가능 잔액에서 차감된 상태
    paid_balance: 0,
    created_at: daysAgo(80),
    updated_at: now,
  };

  const wallets: Wallet[] = [wallet1, wallet2];

  const walletTx1: WalletTransaction = {
    id: genId(),
    user_id: creatorTest.id,
    type: "campaign_reward",
    amount: 24000,
    status: "available",
    related_table: null,
    related_id: null,
    memo: "뷰티 브랜드 AI 광고 영상 제작 수익",
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
    type: "campaign_reward",
    amount: 400000,
    status: "available",
    related_table: null,
    related_id: null,
    memo: "캠페인 수익 (누적)",
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

  // 실행사 지갑 잔액(500,000P)과 원장 합계가 일치하도록 최근 충전 1건을 추가 (원장 정합성)
  const ptTx7: PointTransaction = {
    id: genId(),
    advertiser_id: advertiserTest.id,
    type: "charge",
    amount: 200000,
    balance_after: 500000,
    payment_id: null,
    campaign_id: null,
    memo: "포인트 충전",
    created_at: daysAgo(1),
  };

  const point_transactions: PointTransaction[] = [ptTx1, ptTx2, ptTx3, ptTx4, ptTx5, ptTx6, ptTx7];

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

  // ── 원장 정합성: 지갑 잔액 = 원장 합계가 되도록 시드 거래를 보완한다 ──────────
  // (scripts/reconcile-ledgers.mjs 기준. 출금 신청 건은 반드시 payout 원장 행이 있어야 관리자 처리 가능)
  walletTx3.related_id = payout1.id;
  wallet_transactions.push(
    {
      id: genId(), user_id: creatorTest.id, type: "campaign_reward", amount: 326000, status: "available",
      related_table: null, related_id: null, memo: "캠페인 수익 (이전 누적분)",
      created_at: daysAgo(90), updated_at: daysAgo(90),
    },
    {
      id: genId(), user_id: creatorTest.id, type: "campaign_reward", amount: 30000, status: "pending",
      related_table: null, related_id: null, memo: "캠페인 보상 (검수 대기)",
      created_at: daysAgo(3), updated_at: daysAgo(3),
    },
    {
      id: genId(), user_id: creatorTest.id, type: "payout", amount: -150000, status: "requested",
      related_table: "payout_requests", related_id: payout2.id, memo: "출금 신청",
      created_at: daysAgo(2), updated_at: daysAgo(2),
    },
    {
      id: genId(), user_id: creator2.id, type: "payout", amount: -80000, status: "requested",
      related_table: "payout_requests", related_id: payout3.id, memo: "출금 신청",
      created_at: daysAgo(5), updated_at: daysAgo(5),
    },
  );

  // ── 유튜브 쇼츠 커머스: 카테고리 + 데모 상품 ──────────────────────────
  const productCategories = seedProductCategories();
  const shortsAdminId = profiles.find((p) => p.role === "admin")?.id ?? "admin";
  const demoProducts = seedDemoProducts(productCategories, shortsAdminId);
  const demoOrders = seedDemoOrders(demoProducts, creatorTest.id, creatorTest.name);

  return {
    profile_character_migration_version: 0,
    membership_migrated_at: new Date().toISOString(),
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
    participation_comments: [],
    // 유튜브 쇼츠 커머스
    product_categories: productCategories,
    products: demoProducts,
    creator_youtube_channels: [],
    creator_shorts_links: [],
    product_orders: demoOrders,
    support_threads: [],
    support_messages: [],
    email_verifications: [],
  };
}

// ===========================================================================
// 운영(production) 첫 실행용 빈 DB
// ---------------------------------------------------------------------------
// 운영 환경에서는 데모 계정·데모 캠페인·데모 상품을 절대 만들지 않는다.
// 최고관리자는 환경변수 ADMIN_EMAIL / ADMIN_PASSWORD 가 있을 때만 1명 생성한다.
// (없으면 `npm run admin:create` 스크립트로 만든다)
// ===========================================================================
export function isStrongAdminPassword(password: string): boolean {
  return (
    password.length >= 10 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password) &&
    !["Admin1234!", "Test1234!"].includes(password)
  );
}

export function createProductionDatabase(env: { adminEmail?: string; adminPassword?: string; adminName?: string } = {}): Database {
  const now = new Date().toISOString();
  const profiles: Profile[] = [];
  const email = (env.adminEmail ?? "").trim().toLowerCase();
  const password = env.adminPassword ?? "";
  if (email && password) {
    if (!isStrongAdminPassword(password)) {
      throw new Error("ADMIN_PASSWORD 는 영문+숫자 포함 10자 이상이어야 하며 예시 비밀번호는 사용할 수 없습니다.");
    }
    profiles.push({
      id: genId(),
      email,
      password_hash: hashPassword(password),
      email_verified_at: now,
      name: env.adminName?.trim() || "최고관리자",
      phone: null,
      role: "admin",
      advertiser_type: null,
      parent_advertiser_id: null,
      referral_code: genReferralCode(),
      referred_by_user_id: null,
      status: "active",
      avatar_url: null,
      vibe_member_at: null,
      created_at: now,
      updated_at: now,
    });
  }
  return {
    profile_character_migration_version: 0,
    membership_migrated_at: new Date().toISOString(),
    profiles,
    settings: defaultSettings(),
    referral_rewards: [],
    referral_relations: [],
    wallets: [],
    wallet_transactions: [],
    point_wallets: [],
    point_transactions: [],
    payments: [],
    categories: seedCategories(),
    custom_video_requests: [],
    custom_video_applications: [],
    custom_video_deliveries: [],
    ad_campaigns: [],
    campaign_applications: [],
    campaign_deliveries: [],
    social_accounts: [],
    payout_requests: [],
    audit_logs: [],
    campaign_submissions: [],
    submission_comments: [],
    campaign_participations: [],
    campaign_videos: [],
    campaign_comments: [],
    campaign_direct_messages: [],
    participation_comments: [],
    product_categories: seedProductCategories(),
    products: [],
    creator_youtube_channels: [],
    creator_shorts_links: [],
    product_orders: [],
    support_threads: [],
    support_messages: [],
    email_verifications: [],
  };
}
