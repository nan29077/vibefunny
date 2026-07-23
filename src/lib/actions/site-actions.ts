"use server";

import { revalidatePath } from "next/cache";
import { tx } from "../db";
import { requireAdmin } from "../auth";
import type { SiteBanner, SiteHowtoBlock, SiteRevenueStat } from "../schema";

const now = () => new Date().toISOString();
let _id = 0;
const uid = () => `banner-${Date.now()}-${++_id}`;

const normalizeTime = (value: FormDataEntryValue | null, fallback: string) => {
  const time = String(value ?? "");
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : fallback;
};

export async function updateVerificationEmailAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  const email = String(fd.get("verification_sender_email") ?? "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  tx((db) => {
    db.settings.verification_sender_email = email;
    db.settings.updated_at = now();
    db.settings.updated_by = admin.id;
  });
  revalidatePath("/admin/site");
}

export async function updateSupportHoursAction(fd: FormData): Promise<void> {
  const admin = requireAdmin();
  tx((db) => {
    db.settings.support_hours_enabled = fd.get("support_hours_enabled") === "on";
    db.settings.support_hours_start = normalizeTime(fd.get("support_hours_start"), "10:00");
    db.settings.support_hours_end = normalizeTime(fd.get("support_hours_end"), "17:00");
    db.settings.support_hours_timezone = "Asia/Seoul";
    db.settings.updated_at = now();
    db.settings.updated_by = admin.id;
  });
  revalidatePath("/");
  revalidatePath("/admin/inquiries");
}

// === 공지사항 업데이트 ====================================================
export async function updateAnnouncementAction(fd: FormData): Promise<void> {
  requireAdmin();
  const text = String(fd.get("announcement") ?? "").trim();
  tx((db) => {
    db.settings.site_announcement = text || null;
    db.settings.updated_at = now();
  });
  revalidatePath("/admin/site");
}

// === 배너 추가 =============================================================
export async function addBannerAction(fd: FormData): Promise<void> {
  requireAdmin();
  const banner: SiteBanner = {
    id: uid(),
    title:     String(fd.get("title") ?? ""),
    subtitle:  String(fd.get("subtitle") ?? ""),
    cta_label: String(fd.get("cta_label") ?? ""),
    cta_href:  String(fd.get("cta_href") ?? ""),
    gradient:  String(fd.get("gradient") ?? "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)"),
    is_active: fd.get("is_active") === "on",
  };
  if (!banner.title) return;
  tx((db) => {
    db.settings.site_banners = [...(db.settings.site_banners ?? []), banner];
    db.settings.updated_at = now();
  });
  revalidatePath("/admin/site");
}

// === 배너 활성/비활성 토글 =================================================
export async function toggleBannerAction(fd: FormData): Promise<void> {
  requireAdmin();
  const id = String(fd.get("id") ?? "");
  tx((db) => {
    const b = db.settings.site_banners?.find((x) => x.id === id);
    if (b) b.is_active = !b.is_active;
    db.settings.updated_at = now();
  });
  revalidatePath("/admin/site");
}

// === 배너 삭제 =============================================================
export async function deleteBannerAction(fd: FormData): Promise<void> {
  requireAdmin();
  const id = String(fd.get("id") ?? "");
  tx((db) => {
    db.settings.site_banners = (db.settings.site_banners ?? []).filter((b) => b.id !== id);
    db.settings.updated_at = now();
  });
  revalidatePath("/admin/site");
}

// === 이용 방법 블록 업데이트 ===============================================
export async function updateHowtoBlockAction(fd: FormData): Promise<void> {
  requireAdmin();
  const blocks: SiteHowtoBlock[] = [];
  let i = 0;
  while (fd.get(`blocks[${i}][title]`) !== null) {
    blocks.push({
      step:        Number(fd.get(`blocks[${i}][step]`) ?? i + 1),
      role:        String(fd.get(`blocks[${i}][role]`) ?? "all") as SiteHowtoBlock["role"],
      title:       String(fd.get(`blocks[${i}][title]`) ?? ""),
      description: String(fd.get(`blocks[${i}][description]`) ?? ""),
    });
    i++;
  }
  tx((db) => {
    db.settings.site_howto_blocks = blocks;
    db.settings.updated_at = now();
  });
  revalidatePath("/admin/site");
}

// === 수익 현황 통계 업데이트 ===============================================
export async function updateRevenueStatsAction(fd: FormData): Promise<void> {
  requireAdmin();
  const stats: SiteRevenueStat[] = [];
  let i = 0;
  while (fd.get(`stats[${i}][key]`) !== null) {
    stats.push({
      key:    String(fd.get(`stats[${i}][key]`) ?? ""),
      label:  String(fd.get(`stats[${i}][label]`) ?? ""),
      value:  String(fd.get(`stats[${i}][value]`) ?? ""),
      suffix: String(fd.get(`stats[${i}][suffix]`) ?? ""),
    });
    i++;
  }
  tx((db) => {
    db.settings.site_revenue_stats = stats.filter((s) => s.key && s.label);
    db.settings.updated_at = now();
  });
  revalidatePath("/admin/site");
}
