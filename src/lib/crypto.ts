import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual, randomUUID } from "crypto";

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

const SENSITIVE_PREFIX = "enc:v1:";

function sensitiveKey(): Buffer {
  const secret = process.env.DATA_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATA_ENCRYPTION_KEY 환경변수는 32자 이상이어야 합니다.");
    }
    return createHash("sha256").update(process.env.SESSION_SECRET || "vibefunny-local-sensitive-data-key").digest();
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSensitive(value: string): string {
  if (!value || value.startsWith(SENSITIVE_PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sensitiveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${SENSITIVE_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSensitive(value?: string | null): string {
  if (!value || !value.startsWith(SENSITIVE_PREFIX)) return value ?? "";
  const [ivText, tagText, dataText] = value.slice(SENSITIVE_PREFIX.length).split(".");
  if (!ivText || !tagText || !dataText) return "";
  const decipher = createDecipheriv("aes-256-gcm", sensitiveKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
}

export function maskBankAccount(value?: string | null): string {
  const plain = decryptSensitive(value).replace(/\s/g, "");
  if (plain.length <= 4) return "****";
  return `${plain.slice(0, 3)}${"*".repeat(Math.max(4, plain.length - 7))}${plain.slice(-4)}`;
}
