"use server";

import { revalidatePath } from "next/cache";
import { tx } from "../db";
import { requireUser } from "../auth";
import { hashPassword, verifyPassword } from "../crypto";
import { audit } from "../services";
import type { ActionState } from "@/components/form";

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
    p.updated_at = now();
    audit(db, { actorId: user.id, action: "change_password", targetTable: "profiles", targetId: user.id });
    outcome = { ok: true, message: "비밀번호가 변경되었습니다." };
  });
  revalidatePath("/creator/settings");
  return outcome;
}
