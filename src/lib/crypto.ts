import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from "crypto";

// ===========================================================================
// 비밀번호 해싱 (로컬 모드 전용). scrypt 사용.
// Supabase 전환 시 Supabase Auth가 대체하므로 password_hash는 사용 안 함.
// ===========================================================================

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, salt, hash] = stored.split(":");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function genId(): string {
  return randomUUID();
}

/** 사람이 입력 가능한 추천 코드 (8자, 혼동 문자 제외) */
export function genReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}
