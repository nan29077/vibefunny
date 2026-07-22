import fs from "fs";
import path from "path";
import type { Database, AdCampaign } from "./schema";
import { seedDatabase, seedProductCategories, seedDemoProducts, seedDemoOrders, defaultCafe24Settings, defaultAiStorySettings } from "./seed";
import { syncAllCampaignVideos } from "./distribution";
import { profileAvatarForSeed, randomProfileAvatar } from "./profile-avatars";

const PROFILE_CHARACTER_MIGRATION_VERSION = 2;

/**
 * 누락된 컬렉션/설정을 채운다 (구버전 db.json 마이그레이션). @returns 변경 여부
 */
function ensureCommerceCollections(db: Database): boolean {
  let dirty = false;
  if (!db.product_categories) { db.product_categories = seedProductCategories(); dirty = true; }
  if (!db.products) {
    const adminId = db.profiles?.find((p) => p.role === "admin")?.id ?? "admin";
    db.products = seedDemoProducts(db.product_categories, adminId);
    dirty = true;
  }
  if (!db.creator_youtube_channels) { db.creator_youtube_channels = []; dirty = true; }
  if (!db.creator_shorts_links) { db.creator_shorts_links = []; dirty = true; }
  if (!db.product_orders) {
    const creator = db.profiles?.find((p) => p.role === "creator");
    db.product_orders = creator
      ? seedDemoOrders(db.products ?? [], creator.id, creator.name)
      : [];
    dirty = true;
  }
  if (!db.support_threads) { db.support_threads = []; dirty = true; }
  if (!db.support_messages) { db.support_messages = []; dirty = true; }
  if (db.profile_character_migration_version !== PROFILE_CHARACTER_MIGRATION_VERSION) {
    for (const profile of db.profiles ?? []) {
      profile.avatar_url = randomProfileAvatar();
    }
    db.profile_character_migration_version = PROFILE_CHARACTER_MIGRATION_VERSION;
    dirty = true;
  } else {
    for (const profile of db.profiles ?? []) {
      if (!profile.avatar_url) {
        profile.avatar_url = profileAvatarForSeed(profile.id || profile.email);
        dirty = true;
      }
    }
  }
  if (db.settings) {
    if (!db.settings.cafe24) { db.settings.cafe24 = defaultCafe24Settings(); dirty = true; }
    if (!db.settings.ai_story) { db.settings.ai_story = defaultAiStorySettings(); dirty = true; }
    if (db.settings.shorts_commerce_default_commission_rate === undefined) {
      db.settings.shorts_commerce_default_commission_rate = 10;
      dirty = true;
    }
  }
  return dirty;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");

// 동화(story_creation) 캠페인 목소리 파일 백필 데이터
const STORY_VOICES: Record<string, { label: string; name: string; url: string }> = {
  camp_story_001: { label: "엄마 목소리", name: "지유_엄마목소리.mp3", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3" },
  camp_story_002: { label: "아빠 목소리", name: "도윤_아빠목소리.mp3", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" },
  camp_story_005: { label: "엄마 목소리", name: "유나_엄마목소리.mp3", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3" },
};

// 추가 더미 캠페인(바이브포터 영상제작 / AI스토리 동화제작) — 기존 db.json에 없으면 주입
function extraDummyCampaigns(): AdCampaign[] {
  const ago = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const soon = new Date(Date.now() + 25 * 86400000).toISOString();
  const base = {
    category_id: null, reference_links: null, admin_memo: null, total_cost: 0, point_spent: 0,
    status: "recruiting" as const, created_at: ago(1), updated_at: ago(1), approved_at: ago(1),
    published_at: ago(1), start_date: ago(1), end_date: soon,
  };
  return [
    {
      ...base, id: "camp_demo_vp4", advertiser_id: "vibeporter_system",
      title: "동물병원 브랜드 홍보 숏폼 제작·배포 (바이브포터)",
      description: "바이브포터 제작 의뢰. 반려동물 병원 브랜드 홍보 영상 제작 후 인스타·틱톡 배포.",
      campaign_type: "create_and_distribute", platforms: ["instagram", "tiktok"], video_required: true,
      uploaded_video_url: null, distribution_count: 16, video_production_count: 4, video_duration_tier: "30s",
      target_keywords: "반려동물,동물병원,펫케어", source_type: "vibeporter", participation_limit: 8,
      brand_name: "행복한동물병원",
    } as AdCampaign,
    {
      ...base, id: "camp_story_005", advertiser_id: "vibeporter_system",
      title: "우리 아이 맞춤 동화 제작 - 구름나라 여행",
      description: "AI스토리 맞춤 동화 의뢰. 구름나라를 여행하는 상상력 가득한 그림동화 제작.",
      campaign_type: "story_creation", platforms: [], video_required: false, uploaded_video_url: null,
      distribution_count: 0, video_production_count: 1, video_duration_tier: null,
      target_keywords: "동화,그림책,맞춤동화,구름", source_type: "ai_story", participation_limit: 3,
      story_brief: {
        source: "ai_story", source_request_id: "req-005", child_name: "유나", child_age: 5,
        child_photo_url: "", story_theme: "구름나라 여행",
        story_note: "솜사탕 구름을 타고 하늘나라 친구들을 만나는 상상 가득한 이야기.",
        art_style: "몽환적인 파스텔 수채화", tone: "포근하고 몽글몽글한", page_count: 12,
        target_age_range: "4~7세", key_characters: "주인공 유나, 구름 친구 '몽실', 무지개 새",
        moral_lesson: "상상력은 무엇이든 가능하게 한다", language: "한국어", requester_name: "최은영",
        style_requirements: "전체적으로 부드럽고 따뜻한 색감, 잠자기 전 읽기 좋은 분위기",
        reference_image_urls: [], voice_label: "엄마 목소리", voice_file_name: "유나_엄마목소리.mp3",
        voice_file_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
      },
    } as AdCampaign,
  ];
}

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const seeded = seedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2), "utf-8");
  }
}

/** 현재 DB 스냅샷을 디스크에서 읽어온다. */
export function getDb(): Database {
  ensureFile();
  try {
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const db = JSON.parse(raw) as Database;
    if (!db.campaign_participations) db.campaign_participations = [];
    if (!db.campaign_videos) db.campaign_videos = [];
    if (!db.campaign_comments) db.campaign_comments = [];
    if (!db.campaign_direct_messages) db.campaign_direct_messages = [];
    if (!db.vibeporter_requests) db.vibeporter_requests = [];
    if (!db.campaign_submissions) db.campaign_submissions = [];
    if (!db.submission_comments) db.submission_comments = [];
    if (!db.participation_comments) db.participation_comments = [];
    if (!db.audit_logs) db.audit_logs = [];
    const __commerceDirty = ensureCommerceCollections(db);
    if (!db.settings.member_video_sale_price_tiers || db.settings.member_video_sale_price_tiers.length === 0) {
      db.settings.member_video_sale_price_tiers = [
        { key: "30s",  label: "30초 이하", max_seconds: 30,   price: 3000,  creator_payout: 1500 },
        { key: "60s",  label: "60초 이하", max_seconds: 60,   price: 5000,  creator_payout: 2500 },
        { key: "90s",  label: "90초 이하", max_seconds: 90,   price: 7000,  creator_payout: 3500 },
        { key: "long", label: "90초 초과", max_seconds: null, price: 10000, creator_payout: 5000 },
      ];
    }
    if ((db.settings as unknown as Record<string, unknown>).member_video_sale_price !== undefined) {
      delete (db.settings as unknown as Record<string, unknown>).member_video_sale_price;
    }
    // ── 마이그레이션: 회원 영상판매 가격 구간에 크리에이터 제작단가 백필 ──
    for (const t of db.settings.member_video_sale_price_tiers) {
      if ((t as { creator_payout?: number }).creator_payout === undefined) {
        (t as { creator_payout: number }).creator_payout = Math.round((t.price ?? 0) / 2);
      }
    }
    // ── 마이그레이션: 영상 제작 단가 구간에 광고주 청구단가 백필 ──
    const VP_CHARGE_DEFAULT: Record<string, number> = { "15s": 10000, "30s": 15000, "60s": 25000, "90s": 35000, custom: 0 };
    for (const t of db.settings.video_pricing_tiers ?? []) {
      if ((t as { advertiser_charge?: number }).advertiser_charge === undefined) {
        (t as { advertiser_charge: number }).advertiser_charge = VP_CHARGE_DEFAULT[t.key] ?? Math.max(0, (t.amount ?? 0) * 3);
      }
    }
    // ── 마이그레이션: 숏폼 배포 단가에 Facebook 추가 ──
    if (db.settings.distribution_rates && !db.settings.distribution_rates.some((r) => r.platform === "facebook")) {
      db.settings.distribution_rates.push({
        platform: "facebook",
        label: "Facebook Reels",
        creator_payout: 10000,
        advertiser_charge: 15000,
      });
    }
    // ── 마이그레이션: 동화 캠페인 출처(AI스토리)/목소리 백필 + 신규 더미 캠페인 주입 ──
    let __campDirty = false;
    if (Array.isArray(db.ad_campaigns)) {
      for (const c of db.ad_campaigns) {
        if (c.campaign_type === "story_creation") {
          if (c.source_type !== "ai_story") { c.source_type = "ai_story"; __campDirty = true; }
          const v = STORY_VOICES[c.id];
          if (v && c.story_brief && !c.story_brief.voice_file_url) {
            c.story_brief.voice_label = v.label;
            c.story_brief.voice_file_name = v.name;
            c.story_brief.voice_file_url = v.url;
            __campDirty = true;
          }
        }
      }
      const ids = new Set(db.ad_campaigns.map((c) => c.id));
      for (const extra of extraDummyCampaigns()) {
        if (!ids.has(extra.id)) { db.ad_campaigns.push(extra); __campDirty = true; }
      }
    }
    // 배포용 영상 풀(campaign_videos) 백필 (제작 승인분 / 레거시 단일 영상)
    let __videosDirty = false;
    try { __videosDirty = syncAllCampaignVideos(db); } catch { /* ignore */ }
    // 변경분을 디스크에 영속화 → tx()(참여 신청 등)에서도 동일 데이터 인식
    if (__campDirty || __commerceDirty || __videosDirty) {
      try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8"); } catch { /* ignore */ }
    }
    return db;
  } catch {
    const seeded = seedDatabase();
    fs.writeFileSync(DB_PATH, JSON.stringify(seeded, null, 2), "utf-8");
    return seeded;
  }
}

/** DB 스냅샷을 디스크에 저장한다. */
export function saveDb(db: Database): void {
  ensureFile();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export function tx<T>(mutator: (db: Database) => T): T {
  ensureFile();
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  const db = JSON.parse(raw) as Database;
  ensureCommerceCollections(db); // 구버전 db.json 안전 가드
  if (!db.campaign_videos) db.campaign_videos = []; // 배포 영상 풀 가드
  const result = mutator(db);
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf-8");
  return result;
}
