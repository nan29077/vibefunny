"use server";

import { revalidatePath } from "next/cache";
import { tx } from "../db";
import { requireRole } from "../auth";
import { genId } from "../crypto";
import { ALL_SOCIAL_PLATFORMS, SOCIAL_PLATFORM_LABELS, type SocialPlatform } from "../schema";
import { isHttpUrl } from "../url";
import { notifyAdmins } from "../campaign-workflow";

const now = () => new Date().toISOString();

export async function addSocialAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const platformRaw = String(fd.get("platform") || "youtube") as SocialPlatform;
  if (!ALL_SOCIAL_PLATFORMS.includes(platformRaw)) return;
  const platform = platformRaw;
  const accountName = String(fd.get("account_name") || "").trim();
  const channelUrl = String(fd.get("channel_url") || "").trim();
  const followerCount = Math.max(0, Math.floor(Number(fd.get("follower_count") || 0)));
  if (!accountName || !channelUrl) return;
  // javascript: 등 위험 스킴 차단 — http(s) 채널 주소만 허용
  if (!isHttpUrl(channelUrl)) return;
  tx((db) => {
    db.social_accounts.push({
      id: genId(),
      creator_id: user.id,
      platform,
      account_name: accountName,
      channel_url: channelUrl,
      follower_count: followerCount,
      // 등록 즉시 관리자 인증 대기 상태 → 관리자가 채널 확인 후 인증해야 캠페인 참여 가능
      verified_status: "pending",
      created_at: now(),
      updated_at: now(),
    });
    notifyAdmins(db, {
      title: "SNS 채널 인증 요청",
      message: `${user.nickname || user.name} · ${SOCIAL_PLATFORM_LABELS[platform]} ${accountName}`,
      link: "/admin/members#channels",
    });
  });
  revalidatePath("/creator/social");
  revalidatePath("/creator/community");
}

export async function deleteSocialAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const id = String(fd.get("id") || "");
  tx((db) => {
    db.social_accounts = db.social_accounts.filter(
      (s) => !(s.id === id && s.creator_id === user.id)
    );
  });
  revalidatePath("/creator/social");
  revalidatePath("/creator/community");
}

// 기존 미인증 계정의 인증 요청 (unverified → pending)
export async function requestSocialVerificationAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const id = String(fd.get("id") || "");
  tx((db) => {
    const account = db.social_accounts.find((s) => s.id === id && s.creator_id === user.id);
    if (!account || account.verified_status !== "unverified") return;
    account.verified_status = "pending";
    account.updated_at = now();
    notifyAdmins(db, {
      title: "SNS 채널 인증 요청",
      message: `${user.nickname || user.name} · ${SOCIAL_PLATFORM_LABELS[account.platform]} ${account.account_name}`,
      link: "/admin/members#channels",
    });
  });
  revalidatePath("/creator/social");
}
