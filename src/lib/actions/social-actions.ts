"use server";

import { revalidatePath } from "next/cache";
import { tx } from "../db";
import { requireRole } from "../auth";
import { genId } from "../crypto";
import type { SocialPlatform } from "../schema";

const now = () => new Date().toISOString();

export async function addSocialAction(fd: FormData): Promise<void> {
  const user = requireRole("creator");
  const platform = String(fd.get("platform") || "youtube") as SocialPlatform;
  const accountName = String(fd.get("account_name") || "").trim();
  const channelUrl = String(fd.get("channel_url") || "").trim();
  const followerCount = Math.max(0, Math.floor(Number(fd.get("follower_count") || 0)));
  if (!accountName || !channelUrl) return;
  tx((db) => {
    db.social_accounts.push({
      id: genId(),
      creator_id: user.id,
      platform,
      account_name: accountName,
      channel_url: channelUrl,
      follower_count: followerCount,
      verified_status: "unverified",
      created_at: now(),
      updated_at: now(),
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
