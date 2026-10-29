// 스크립트 공용: .env 읽기 + db.json 잠금/원자적 저장 (앱의 json-provider 와 같은 규칙)
import fs from "node:fs";
import path from "node:path";
import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";

export function loadEnvFiles(root = process.cwd()) {
  for (const name of [".env.local", ".env"]) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || process.env[m[1]] !== undefined) continue;
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

export const DATA_DIR = path.join(process.cwd(), "data");
export const DB_PATH = path.join(DATA_DIR, "db.json");
const LOCK_PATH = path.join(DATA_DIR, "db.lock");

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** db.lock 획득 (앱·다른 스크립트와 동시에 쓰지 않도록). 반환값을 releaseLock 에 넘긴다. */
export function acquireLock() {
  const started = Date.now();
  for (;;) {
    try {
      return fs.openSync(LOCK_PATH, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - fs.statSync(LOCK_PATH).mtimeMs > 30_000) fs.unlinkSync(LOCK_PATH);
      } catch {}
      if (Date.now() - started > 10_000) throw new Error("db.lock 대기 시간 초과");
      sleep(50);
    }
  }
}
export function releaseLock(handle) {
  try { fs.closeSync(handle); } catch {}
  try { fs.unlinkSync(LOCK_PATH); } catch {}
}

/** 앱과 같은 db.lock 을 잡고 db.json 을 읽어 수정 후 원자적으로 저장한다. */
export function withDb(mutator) {
  if (!fs.existsSync(DB_PATH)) throw new Error("data/db.json 이 없습니다. 앱을 한 번 실행해 DB를 만든 뒤 다시 시도하세요.");
  const started = Date.now();
  let handle = null;
  while (handle === null) {
    try {
      handle = fs.openSync(LOCK_PATH, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - fs.statSync(LOCK_PATH).mtimeMs > 30_000) fs.unlinkSync(LOCK_PATH);
      } catch {}
      if (Date.now() - started > 10_000) throw new Error("db.lock 대기 시간 초과");
      sleep(50);
    }
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    const result = mutator(db);
    const backup = path.join(DATA_DIR, `db.json.pre-script-${new Date().toISOString().replace(/[:.]/g, "-")}.bak`);
    fs.copyFileSync(DB_PATH, backup);
    const tmp = path.join(DATA_DIR, `db.${process.pid}.${Date.now()}.tmp`);
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, DB_PATH);
    return { result, backup };
  } finally {
    try { fs.closeSync(handle); } catch {}
    try { fs.unlinkSync(LOCK_PATH); } catch {}
  }
}

// src/lib/crypto.ts 와 동일한 키 유도·형식 (약한 키 판정도 src/lib/secrets.ts 와 동일)
const PREFIX = "enc:v1:";
const PLACEHOLDER = /change-?me|example|placeholder|dev-secret|your-|^secret$|^password$/i;
function isWeakSecret(value) {
  const v = String(value ?? "").trim();
  return v.length < 32 || PLACEHOLDER.test(v);
}
function sensitiveKey() {
  const secret = process.env.DATA_ENCRYPTION_KEY;
  if (!secret || isWeakSecret(secret)) {
    if (process.env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY 환경변수는 예시 값이 아닌 32자 이상 무작위 값이어야 합니다.");
    return createHash("sha256").update(process.env.SESSION_SECRET || "vibefunny-local-sensitive-data-key").digest();
  }
  return createHash("sha256").update(secret).digest();
}
export function encryptSensitive(value) {
  if (!value || String(value).startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sensitiveKey(), iv);
  const enc = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
