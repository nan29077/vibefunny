// ===========================================================================
// JSON 파일 기반 DB 프로바이더 (MVP 로컬 모드)
// ---------------------------------------------------------------------------
// 데이터는 /data/db.json 에 저장된다.
// DATABASE_TYPE=postgres 전환 시 이 파일은 사용되지 않는다.
// ===========================================================================

import fs from "fs";
import path from "path";
import type { Database } from "../schema";
import { seedDatabase, createProductionDatabase, seedProductCategories, seedDemoProducts, seedDemoOrders, defaultCafe24Settings } from "../seed";
import { syncAllCampaignVideos } from "../distribution";
import { profileAvatarForSeed, randomProfileAvatar } from "../profile-avatars";

const PROFILE_CHARACTER_MIGRATION_VERSION = 2;

/** 운영 모드: 데모 시드·더미 데이터 주입을 하지 않는다. */
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * 누락된 컬렉션/설정을 채운다 (구버전 db.json 마이그레이션). @returns 변경 여부
 */
function ensureCommerceCollections(db: Database): boolean {
  let dirty = false;
  if (!db.product_categories) { db.product_categories = seedProductCategories(); dirty = true; }
  if (!db.products) {
    const adminId = db.profiles?.find((p) => p.role === "admin")?.id ?? "admin";
    db.products = IS_PRODUCTION ? [] : seedDemoProducts(db.product_categories, adminId);
    dirty = true;
  }
  if (!db.creator_youtube_channels) { db.creator_youtube_channels = []; dirty = true; }
  if (!db.creator_shorts_links) { db.creator_shorts_links = []; dirty = true; }
  if (!db.product_orders) {
    const creator = db.profiles?.find((p) => p.role === "creator");
    db.product_orders = creator && !IS_PRODUCTION
      ? seedDemoOrders(db.products ?? [], creator.id, creator.name)
      : [];
    dirty = true;
  }
  if (!db.support_threads) { db.support_threads = []; dirty = true; }
  if (!db.support_messages) { db.support_messages = []; dirty = true; }
  if (!db.email_verifications) { db.email_verifications = []; dirty = true; }
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
    if (db.settings.support_hours_enabled === undefined) { db.settings.support_hours_enabled = true; dirty = true; }
    if (!db.settings.support_hours_start) { db.settings.support_hours_start = "10:00"; dirty = true; }
    if (!db.settings.support_hours_end) { db.settings.support_hours_end = "17:00"; dirty = true; }
    if (!db.settings.support_hours_timezone) { db.settings.support_hours_timezone = "Asia/Seoul"; dirty = true; }
    if (db.settings.verification_sender_email === undefined) { db.settings.verification_sender_email = ""; dirty = true; }
    if (!db.settings.cafe24) { db.settings.cafe24 = defaultCafe24Settings(); dirty = true; }
    if (db.settings.shorts_commerce_default_commission_rate === undefined) {
      db.settings.shorts_commerce_default_commission_rate = 10;
      dirty = true;
    }
  }
  return dirty;
}

/** AI 숏츠·퍼니 컬렉션 (구버전 db.json 호환) */
function ensureAiCollections(db: Database): void {
  if (!db.ai_providers) db.ai_providers = [];
  if (!db.ai_models) db.ai_models = [];
  if (!db.ai_jobs) db.ai_jobs = [];
  if (!db.shorts_projects) db.shorts_projects = [];
  if (!db.funny_wallets) db.funny_wallets = [];
  if (!db.funny_transactions) db.funny_transactions = [];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const DB_LOCK_PATH = path.join(DATA_DIR, "db.lock");
const DB_BACKUP_PATH = path.join(DATA_DIR, "db.json.bak");
const LOCK_TIMEOUT_MS = 5_000;
const STALE_LOCK_MS = 30_000;

function wait(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withDbLock<T>(work: () => T): T {
  ensureFile();
  const startedAt = Date.now();
  let handle: number | null = null;
  while (handle === null) {
    try {
      handle = fs.openSync(DB_LOCK_PATH, "wx");
      fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString() }));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - fs.statSync(DB_LOCK_PATH).mtimeMs > STALE_LOCK_MS) {
          fs.unlinkSync(DB_LOCK_PATH);
          continue;
        }
      } catch { /* another process released it */ }
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        throw new Error("데이터 저장 잠금 대기 시간이 초과되었습니다. 잠시 후 다시 시도하세요.");
      }
      wait(25);
    }
  }
  try {
    return work();
  } finally {
    try { fs.closeSync(handle); } catch { /* already closed */ }
    try { fs.unlinkSync(DB_LOCK_PATH); } catch { /* already released */ }
  }
}

function atomicWriteDb(db: Database): void {
  const tempPath = path.join(DATA_DIR, `db.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), "utf-8");
    const tempHandle = fs.openSync(tempPath, "r");
    try {
      try { fs.fsyncSync(tempHandle); }
      catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EPERM" && code !== "EINVAL" && code !== "ENOTSUP") throw error;
      }
    } finally { fs.closeSync(tempHandle); }
    if (fs.existsSync(DB_PATH)) fs.copyFileSync(DB_PATH, DB_BACKUP_PATH);
    fs.renameSync(tempPath, DB_PATH);
  } catch (error) {
    // 저장 실패 시 임시 파일을 남기지 않는다 (data 폴더에 .tmp 가 쌓이던 문제)
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch { /* ignore */ }
    throw error;
  }
}

function ensureFile(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    // 운영: 데모 계정(공개된 비밀번호) 없이 빈 DB + 환경변수로 지정한 최고관리자 1명만 만든다.
    // 개발: 기존처럼 데모 시드 데이터로 채운다.
    const initial = IS_PRODUCTION
      ? createProductionDatabase({
          adminEmail: process.env.ADMIN_EMAIL,
          adminPassword: process.env.ADMIN_PASSWORD,
          adminName: process.env.ADMIN_NAME,
        })
      : seedDatabase();
    if (IS_PRODUCTION && initial.profiles.length === 0) {
      console.warn("[db] 운영 DB를 새로 만들었지만 ADMIN_EMAIL/ADMIN_PASSWORD 가 없어 관리자 계정이 없습니다. `npm run admin:create` 로 관리자를 만드세요.");
    }
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), { encoding: "utf-8", flag: "wx" });
    } catch (error) {
      // 다른 프로세스가 먼저 만든 경우는 정상
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
}

/**
 * 구버전 db.json 보정(컬렉션 기본값, 설정 백필, 영상 풀 동기화).
 * getDb()와 tx() 모두에서 적용해 "화면에 보이는 데이터 = 저장 시 사용하는 데이터"가 되게 한다.
 * (tx() 에서 적용된 보정은 저장 시 함께 디스크에 영속화된다)
 */
/**
 * 1회성: 구독료 제거 + 크리에이터 회원 등급(일반/바이브) 도입
 * - 결제 대기(pending) 크리에이터 → 활성 일반회원(가입비 결제 전)
 * - 이미 활성(또는 정지)인 크리에이터 → 바이브회원 (가입비 결제일, 없으면 가입일 기준)
 * - 구독료 설정·구독 만료일 필드 삭제
 */
function migrateMembership(db: Database): void {
  if (db.membership_migrated_at) return;
  for (const p of db.profiles ?? []) {
    const legacy = p as unknown as Record<string, unknown>;
    if ("subscription_active_until" in legacy) delete legacy.subscription_active_until;
    if (p.role !== "creator" || p.vibe_member_at !== undefined && p.vibe_member_at !== null) continue;
    // 가입비 결제 완료 기록이 있으면 상태와 관계없이 바이브회원 (결제 후 pending 으로 남은 계정 포함)
    const paid = (db.payments ?? [])
      .filter((x) => x.user_id === p.id && x.payment_type === "signup_fee" && x.status === "paid")
      .sort((a, b) => (a.paid_at ?? a.created_at).localeCompare(b.paid_at ?? b.created_at))[0];
    const wasPending = p.status === "pending";
    if (wasPending) p.status = "active";
    if (paid) {
      p.vibe_member_at = paid.paid_at ?? paid.created_at;
    } else if (!wasPending && p.status === "active") {
      // 결제 기록 없이 이미 활동 중이던 계정(가입비 제도 이전 가입·관리자 활성화)은 기존 권한 유지
      p.vibe_member_at = p.created_at;
    } else {
      // 결제 전 대기 계정·정지·탈퇴 계정은 일반회원
      p.vibe_member_at = null;
    }
  }
  for (const fee of Object.values(db.settings?.fees ?? {})) {
    const legacy = fee as unknown as Record<string, unknown>;
    delete legacy.subscription_enabled;
    delete legacy.subscription_amount;
  }
  db.membership_migrated_at = new Date().toISOString();
}

/** 예전 기본 배너·이용방법 문구(무료 가입·영상 판매·없는 /register 링크)를 현재 문구로 교체 — 관리자가 고친 문구는 건드리지 않는다 */
function migrateSiteCopy(db: Database): void {
  const st = db.settings as unknown as Record<string, unknown> | undefined;
  if (!st) return;
  const banners = (st.site_banners ?? []) as Array<Record<string, unknown>>;
  for (const b of banners) {
    if (b.subtitle === "숏폼 영상 제작부터 배포, 판매까지 한 곳에서") b.subtitle = "캠페인 배포·영상 제작·쇼츠 커머스·추천 수당까지 한 곳에서";
    if (b.cta_label === "무료로 시작하기") b.cta_label = "추천 코드로 가입하기";
    if (b.cta_href === "/register") b.cta_href = "/signup";
  }
  const blocks = (st.site_howto_blocks ?? []) as Array<Record<string, unknown>>;
  for (const h of blocks) {
    if (h.title === "영상 업로드" && h.description === "숏폼 영상을 업로드하세요.") {
      h.title = "가입비 결제";
      h.description = "가입비를 결제하면 바이브회원이 됩니다.";
    }
    if (h.description === "배포 수익과 판매 수익을 받으세요.") h.description = "캠페인 배포·영상 제작 수익과 추천 수당을 받으세요.";
  }
}

/** 이번 변경 전의 선발 취소 기록에 취소 주체를 채운다 (기본 사유 문구로 판별) — 선발 취소 후 재신청 방지 */
function migrateCancelledBy(db: Database): void {
  const reviewerReasons = new Set(["광고주가 선발을 취소했습니다.", "관리자가 선발을 취소했습니다."]);
  for (const p of db.campaign_participations ?? []) {
    if (p.status !== "cancelled" || p.cancelled_by) continue;
    if (p.rejection_reason && reviewerReasons.has(p.rejection_reason)) p.cancelled_by = "reviewer";
  }
}

function applyMigrations(db: Database): void {
  migrateMembership(db);
  migrateSiteCopy(db);
  migrateCancelledBy(db);
  if (!db.campaign_participations) db.campaign_participations = [];
  if (!db.campaign_favorites) db.campaign_favorites = [];
  if (!db.campaign_videos) db.campaign_videos = [];
  if (!db.campaign_comments) db.campaign_comments = [];
  if (!db.campaign_direct_messages) db.campaign_direct_messages = [];
  if (!db.campaign_submissions) db.campaign_submissions = [];
  if (!db.submission_comments) db.submission_comments = [];
  if (!db.participation_comments) db.participation_comments = [];
  if (!db.notifications) db.notifications = [];
  if (!db.private_files) db.private_files = [];
  if (!db.audit_logs) db.audit_logs = [];
  ensureAiCollections(db);
  const __commerceDirty = ensureCommerceCollections(db);
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
  // 배포용 영상 풀(campaign_videos) 백필 (제작 승인분 / 레거시 단일 영상)
  let __videosDirty = false;
  try { __videosDirty = syncAllCampaignVideos(db); } catch { /* ignore */ }
  void __commerceDirty;
  void __videosDirty;
}

/**
 * db.json 을 읽는다. 파일이 깨져 있으면(저장 중 중단 등) 직전 백업(db.json.bak)으로 대체하고 경고를 남긴다.
 * 백업으로 대체된 경우 다음 저장(tx) 때 db.json 이 백업 내용 기준으로 복구된다.
 */
function readDbFile(): Database {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as Database;
  } catch (error) {
    if (fs.existsSync(DB_BACKUP_PATH)) {
      try {
        const backup = JSON.parse(fs.readFileSync(DB_BACKUP_PATH, "utf-8")) as Database;
        console.error("[db] db.json 을 읽을 수 없어 db.json.bak 으로 대체합니다.", error);
        return backup;
      } catch { /* preserve the original error below */ }
    }
    throw new Error("데이터 파일을 읽을 수 없습니다. db.json과 db.json.bak를 확인하세요.", { cause: error });
  }
}

/** 현재 DB 스냅샷을 디스크에서 읽어온다. */
export function getDb(): Database {
  ensureFile();
  const db = readDbFile();
  applyMigrations(db);
  return db;
}

/** 마이그레이션 없이 파일만 읽는다 (백그라운드 작업 엔진의 잦은 상태 확인용) */
export function peekDb(): Database {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf-8")) as Database;
  } catch {
    return getDb();
  }
}

/** DB 스냅샷을 디스크에 저장한다. */
export function saveDb(db: Database): void {
  withDbLock(() => atomicWriteDb(db));
}

export function tx<T>(mutator: (db: Database) => T): T {
  return withDbLock(() => {
    const db = readDbFile();
    applyMigrations(db); // getDb()와 같은 보정을 적용하고 저장 시 영속화
    const result = mutator(db);
    atomicWriteDb(db);
    return result;
  });
}
