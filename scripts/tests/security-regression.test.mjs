import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

test("production test-login actions are disabled", () => {
  const source = read("src/lib/actions/auth-actions.ts");
  assert.match(source, /async function loginAs[\s\S]*NODE_ENV === "production"/);
});

test("participation review uses idempotent wallet rewards via the shared workflow", () => {
  assert.match(read("src/lib/campaign-workflow.ts"), /addWalletTxOnce/);
  for (const file of [
    "src/app/api/participations/[id]/review/route.ts",
    "src/app/api/advertiser/campaigns/[id]/review/route.ts",
    "src/lib/actions/campaign-actions.ts",
  ]) {
    assert.match(read(file), /reviewParticipation\(/);
  }
});

test("creator submission never falls back to another participation type", () => {
  const source = read("src/app/api/creator/campaigns/[id]/submit/route.ts");
  assert.doesNotMatch(source, /candidates\[0\]/);
  assert.match(source, /participation_type/);
});

test("submitted private files must belong to the submitting creator", () => {
  const source = read("src/lib/campaign-workflow.ts");
  assert.match(source, /file\.owner_id !== user\.id/);
});

test("download validates participation ownership and campaign", () => {
  const source = read("src/app/api/creator/campaigns/[id]/download/route.ts");
  assert.match(source, /participation\.creator_id !== user\.id/);
  assert.match(source, /participation\.campaign_id !== params\.id/);
});

test("private uploads are outside public and downloaded through authorization", () => {
  // 업로드는 스토리지 추상화(storage.ts)를 통해 data/private-uploads 에 저장된다
  const upload = read("src/app/api/creator/requests/upload/route.ts");
  const storage = read("src/lib/storage.ts");
  assert.match(upload, /storage/);
  assert.match(storage, /"data", "private-uploads"/);
  assert.doesNotMatch(upload, /"public", "uploads"/);
  assert.doesNotMatch(storage, /"public", "uploads"/);
  assert.ok(fs.existsSync(path.join(root, "src/app/api/files/[id]/route.ts")));
});

test("assigned distribution creators can download their pool video", () => {
  const source = read("src/app/api/files/[id]/route.ts");
  assert.match(source, /assigned_creator_id === user\.id/);
});

test("every admin page enforces admin role itself (not only in layout)", () => {
  const walk = (dir) => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name === "page.tsx" ? [path.join(dir, entry.name)] : []);
  for (const file of walk("src/app/admin")) {
    const source = read(file);
    if (/^"use client"/.test(source.trimStart())) continue; // 클라이언트 페이지는 권한 검사된 API로만 데이터 조회
    assert.match(source, /require(Admin|Role)\(/, `${file} must call requireAdmin()/requireRole()`);
  }
  const middleware = read("src/middleware.ts");
  assert.match(middleware, /\/admin\/:path\*/);
});

test("session secret is resolved lazily so builds do not require it", () => {
  const source = read("src/lib/session.ts");
  assert.doesNotMatch(source, /^const SECRET = resolveSecret\(\);/m);
});

test("user supplied links are rendered through safeHref", () => {
  for (const file of [
    "src/app/creator/community/page.tsx",
    "src/app/creator/social/page.tsx",
    "src/components/campaigns/creator-campaigns-ui.tsx",
    "src/app/admin/campaigns/page.tsx",
  ]) {
    assert.match(read(file), /safeHref\(/, file);
  }
  assert.match(read("src/lib/actions/social-actions.ts"), /isHttpUrl\(channelUrl\)/);
});

test("ledger snapshot is reconciled and contains no duplicate rewards", () => {
  const result = spawnSync(process.execPath, ["scripts/reconcile-ledgers.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.summary, { wallet_mismatches: 0, point_mismatches: 0, duplicate_reward_groups: 0, payout_link_issues: 0, funny_mismatches: 0, funny_charge_issues: 0 });
});

// --- 2026-10 보안 수정 회귀 테스트 ---------------------------------------------

test("production first run never creates demo accounts", () => {
  const source = read("src/lib/db/json-provider.ts");
  assert.match(source, /IS_PRODUCTION\s*\?\s*createProductionDatabase/);
  assert.match(read("src/lib/seed.ts"), /export function createProductionDatabase/);
  assert.doesNotMatch(read("README.md"), /Admin1234!/);
});

test("custom request delivery cannot attach someone else's private file", () => {
  assert.match(read("src/app/api/creator/requests/[id]/submit/route.ts"), /isOwnPrivateFileOrExternal\(db, videoUrl, user\.id\)/);
  assert.match(read("src/lib/actions/request-actions.ts"), /isOwnPrivateFileOrExternal\(db, videoUrl, user\.id\)/);
});

test("session tokens carry a version and server-side expiry", () => {
  const session = read("src/lib/session.ts");
  assert.match(session, /SESSION_MAX_AGE_SECONDS \* 1000/);
  assert.match(read("src/lib/auth.ts"), /session_version \?\? 0\) !== claims\.version/);
  assert.match(read("src/lib/actions/auth-actions.ts"), /session_version = \(user\.session_version \?\? 0\) \+ 1/);
});

test("login and verification email are rate limited", () => {
  assert.match(read("src/lib/actions/auth-actions.ts"), /rateLimit\(`login-ip:/);
  assert.match(read("src/app/api/auth/email-verification/send/route.ts"), /rateLimit\(`email-send-ip10m:/);
});

test("pending accounts cannot use upload / file APIs", () => {
  for (const file of ["src/app/api/creator/requests/upload/route.ts", "src/app/api/files/[id]/route.ts", "src/app/api/campaigns/direct-messages/route.ts"]) {
    assert.match(read(file), /authorizeApi\(/, file);
  }
});

test("integration secrets are encrypted and never sent back to the browser", () => {
  assert.match(read("src/lib/actions/commerce-actions.ts"), /keepOrReplaceSecret\(fd, "access_token"/);
  assert.match(read("src/app/admin/products/cafe24/page.tsx"), /access_token: ""/);
  assert.doesNotMatch(read("src/components/commerce/ai-story-settings-form.tsx"), /defaultValue=\{settings\.api_key\}/);
});

test("saving fee policy keeps roles that are not on the form", () => {
  assert.match(read("src/lib/actions/admin-actions.ts"), /if \(!fd\.has\(`\$\{role\}_referral_amount`\)\) continue;/);
});

test("AI shorts: closed switch blocks new jobs and funny charging, AI keys are encrypted", () => {
  assert.match(read("src/lib/ai/engine.ts"), /if \(!access\.open && !opts\.allowWhenClosed\) throw/);
  assert.match(read("src/lib/actions/funny-actions.ts"), /aiShortsAccess\(db, user\)/);
  assert.match(read("src/lib/actions/payment-actions.ts"), /funny_charge" && !aiShortsAccess/);
  assert.match(read("src/lib/actions/ai-admin-actions.ts"), /api_key_enc: kind === "mock" \? "" : encryptSensitive\(key\)/);
});
