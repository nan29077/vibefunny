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
  const user = db.profiles.find((p) => p.id === uid) ?? null;
  if (!user || user.status === "suspended" || user.status === "withdrawn") return null;
  return user;
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
  if (user.status === "withdrawn") redirect("/unauthorized");
  return user;
}

/** 관리자 전용 */
export function requireAdmin(): Profile {
  return requireRole("admin");
}

/**
 * API 라우트용 인증: 로그인 + 역할 + 활성 상태(가입비 결제 대기 등 제외)를 확인한다.
 * 실패 시 { error, status } 를 반환하므로 라우트에서 그대로 JSON 응답하면 된다.
 */
export function authorizeApi(
  ...roles: Role[]
): { user: Profile; error?: undefined; status?: undefined } | { user?: undefined; error: string; status: number } {
  const user = getCurrentUser();
  if (!user) return { error: "로그인이 필요합니다.", status: 401 };
  if (roles.length > 0 && !roles.includes(user.role)) return { error: "권한이 없습니다.", status: 403 };
  if (user.status !== "active") return { error: "활성화된 계정만 이용할 수 있습니다.", status: 403 };
  return { user };
}
