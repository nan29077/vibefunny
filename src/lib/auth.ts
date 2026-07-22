import { redirect } from "next/navigation";
import { getDb } from "./db";
import { getSessionUserId } from "./session";
import type { Profile, Role } from "./schema";

// ===========================================================================
// 인증/권한 헬퍼 (서버 전용)
// ===========================================================================

/** 현재 로그인 사용자 (없으면 null) */
export function getCurrentUser(): Profile | null {
  const uid = getSessionUserId();
  if (!uid) return null;
  const db = getDb();
  return db.profiles.find((p) => p.id === uid) ?? null;
}

/** 로그인 필수. 미로그인 시 /login 으로 리다이렉트 */
export function requireUser(): Profile {
  const user = getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** 특정 역할 필수. 권한 없으면 /unauthorized */
export function requireRole(...roles: Role[]): Profile {
  const user = requireUser();
  if (!roles.includes(user.role)) redirect("/unauthorized");
  // 활성 상태가 아니면(가입비 결제 대기 등) 결제 안내 페이지로
  if (user.status === "pending") redirect("/payment/activate");
  if (user.status === "suspended") redirect("/unauthorized");
  return user;
}

/** 관리자 전용 */
export function requireAdmin(): Profile {
  return requireRole("admin");
}
