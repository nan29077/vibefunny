"use server";

import { revalidatePath } from "next/cache";
import { tx } from "../db";
import { requireUser } from "../auth";
import { hashPassword, verifyPassword } from "../crypto";
import { setSession } from "../session";
import { audit } from "../services";
import type { ActionState } from "@/components/form";
import type { NotificationCategory } from "../schema";

const now = () => new Date().toISOString();

// --- 닉네임 변경 --------------------------------------------------------
export async function updateNicknameAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = requireUser();
  const nickname = String(fd.get("nickname") || "").trim();
  if (nickname.length > 20) {
    return { ok: false, message: "닉네임은 20자 이하로 입력하세요." };
  }
  tx((db) => {
    const p = db.profiles.find((x) => x.id === user.id);
    if (p) {
      p.nickname = nickname || null;
      p.updated_at = now();
    }
  });
  revalidatePath("/creator", "layout");
  revalidatePath("/creator/settings");
  return {
    ok: true,
    message: nickname ? "닉네임이 저장되었습니다." : "닉네임이 해제되어 실제 이름으로 표시됩니다.",
  };
}

export async function updateCreatorEligibilityAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = requireUser();
  if (user.role !== "creator") return { ok: false, message: "크리에이터만 설정할 수 있습니다." };
  const gender = String(fd.get("creator_gender") || "");
  const ageGroup = String(fd.get("creator_age_group") || "");
  if (!["female", "male", "other"].includes(gender) || !["teens", "20s", "30s", "40plus"].includes(ageGroup)) {
    return { ok: false, message: "성별과 연령대 정보를 선택하세요." };
  }
  tx((db) => {
    const profile = db.profiles.find((item) => item.id === user.id);
    if (!profile) return;
    profile.creator_gender = gender as "female" | "male" | "other";
    profile.creator_age_group = ageGroup as "teens" | "20s" | "30s" | "40plus";
    profile.updated_at = now();
    audit(db, { actorId: user.id, action: "update_creator_eligibility", targetTable: "profiles", targetId: user.id });
  });
  revalidatePath("/creator/settings");
  return { ok: true, message: "참여 자격 정보가 저장되었습니다." };
}

// --- 비밀번호 변경 ------------------------------------------------------
export async function changePasswordAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = requireUser();
  const current = String(fd.get("current_password") || "");
  const next = String(fd.get("new_password") || "");
  const confirm = String(fd.get("confirm_password") || "");

  if (!current) return { ok: false, message: "현재 비밀번호를 입력하세요." };
  if (next.length < 8) return { ok: false, message: "새 비밀번호는 8자 이상이어야 합니다." };
  if (next !== confirm) return { ok: false, message: "새 비밀번호 확인이 일치하지 않습니다." };

  let outcome: ActionState = { ok: false };
  let newVersion: number | null = null;
  tx((db) => {
    const p = db.profiles.find((x) => x.id === user.id);
    if (!p) {
      outcome = { ok: false, message: "사용자를 찾을 수 없습니다." };
      return;
    }
    if (!verifyPassword(current, p.password_hash)) {
      outcome = { ok: false, message: "현재 비밀번호가 올바르지 않습니다." };
      return;
    }
    p.password_hash = hashPassword(next);
    // 다른 기기(탈취된 쿠키 포함)의 세션은 모두 끊고, 지금 기기만 새 토큰으로 유지한다.
    p.session_version = (p.session_version ?? 0) + 1;
    p.updated_at = now();
    newVersion = p.session_version;
    audit(db, { actorId: user.id, action: "change_password", targetTable: "profiles", targetId: user.id });
    outcome = { ok: true, message: "비밀번호가 변경되었습니다. 다른 기기에서는 다시 로그인해야 합니다." };
  });
  if (newVersion !== null) setSession(user.id, newVersion);
  revalidatePath("/creator/settings");
  return outcome;
}

// --- 알림 수신 설정 (광고주) ----------------------------------------------
export async function updateNotificationPrefsAction(
  _prev: ActionState,
  fd: FormData
): Promise<ActionState> {
  const user = requireUser();
  const categories: NotificationCategory[] = ["participation", "submission", "campaign_status", "message"];
  tx((db) => {
    const p = db.profiles.find((x) => x.id === user.id);
    if (!p) return;
    const prefs: Partial<Record<NotificationCategory, boolean>> = {};
    for (const c of categories) prefs[c] = fd.get(`pref_${c}`) === "on";
    p.notification_prefs = prefs;
    p.updated_at = now();
    audit(db, { actorId: user.id, action: "update_notification_prefs", targetTable: "profiles", targetId: user.id, after: prefs });
  });
  revalidatePath("/advertiser/settings/notifications");
  return { ok: true, message: "알림 설정이 저장되었습니다." };
}
