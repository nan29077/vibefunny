// 최고관리자 계정 생성 / 비밀번호 재설정 (운영 배포용)
// 사용:
//   npm run admin:create -- --email admin@회사.com --password '영문숫자10자이상' [--name 최고관리자]
//   npm run admin:create -- --suspend-demo        # 데모 시드 계정(@vibefunny.com 테스트 계정) 일괄 정지
import { randomUUID, randomBytes } from "node:crypto";
import { loadEnvFiles, withDb, hashPassword } from "./lib/env-db.mjs";

loadEnvFiles();
const args = process.argv.slice(2);
const arg = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const email = (arg("email") || process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const password = arg("password") || process.env.ADMIN_PASSWORD || "";
const name = arg("name") || process.env.ADMIN_NAME || "최고관리자";
const suspendDemo = args.includes("--suspend-demo");
const DEMO_EMAILS = [
  "admin@vibefunny.com", "creator_test@vibefunny.com", "advertiser_test@vibefunny.com",
  "agency_test@vibefunny.com", "creator2@vibefunny.com", "creator3@vibefunny.com", "suspended@vibefunny.com",
];
const strong = (pw) => pw.length >= 10 && /[A-Za-z]/.test(pw) && /\d/.test(pw) && !["Admin1234!", "Test1234!"].includes(pw);

if (!email && !suspendDemo) {
  console.error("사용법: npm run admin:create -- --email <이메일> --password <비밀번호> [--name <이름>] [--suspend-demo]");
  process.exit(1);
}
if (email && !strong(password)) {
  console.error("비밀번호는 영문+숫자 포함 10자 이상이어야 하며 예시 비밀번호(Admin1234! 등)는 사용할 수 없습니다.");
  process.exit(1);
}
const code = () => {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(8), (b) => a[b % a.length]).join("");
};

const { result, backup } = withDb((db) => {
  const out = [];
  const now = new Date().toISOString();
  if (email) {
    const existing = db.profiles.find((p) => String(p.email).toLowerCase() === email);
    if (existing) {
      existing.password_hash = hashPassword(password);
      existing.role = "admin";
      existing.status = "active";
      existing.session_version = (existing.session_version || 0) + 1;
      existing.updated_at = now;
      out.push(`기존 계정을 최고관리자로 설정하고 비밀번호를 재설정했습니다: ${email}`);
    } else {
      db.profiles.push({
        id: randomUUID(), email, password_hash: hashPassword(password), email_verified_at: now, name,
        phone: null, role: "admin", advertiser_type: null, parent_advertiser_id: null, referral_code: code(),
        referred_by_user_id: null, status: "active", avatar_url: null, vibe_member_at: null,
        session_version: 0, created_at: now, updated_at: now,
      });
      out.push(`최고관리자 계정을 만들었습니다: ${email}`);
    }
  }
  if (suspendDemo) {
    let n = 0;
    for (const p of db.profiles) {
      if (DEMO_EMAILS.includes(String(p.email).toLowerCase()) && String(p.email).toLowerCase() !== email && p.status !== "suspended") {
        p.status = "suspended";
        p.session_version = (p.session_version || 0) + 1;
        p.updated_at = now;
        n++;
      }
    }
    out.push(`데모 시드 계정 ${n}개를 정지했습니다.`);
  }
  return out;
});
for (const line of result) console.log("✅ " + line);
console.log("   백업: " + backup);
