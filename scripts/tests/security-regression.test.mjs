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
  const upload = read("src/lib/uploads.ts");
  const storage = read("src/lib/storage.ts");
  assert.match(upload, /storage/);
  assert.match(storage, /"data", "private-uploads"/);
  assert.doesNotMatch(upload, /"public", "uploads"/);
  assert.doesNotMatch(storage, /"public", "uploads"/);
  assert.ok(fs.existsSync(path.join(root, "src/app/api/files/[id]/route.ts")));
});

test("uploads stop reading the body past the size limit and forms only accept own uploaded files", () => {
  const upload = read("src/lib/uploads.ts");
  assert.match(upload, /readBodyLimited\(req, MAX_UPLOAD_SIZE \+ BODY_OVERHEAD\)/);
  assert.match(read("src/app/api/creator/requests/upload/route.ts"), /handlePrivateUpload\(req, \["creator"\]\)/);
  assert.match(read("src/lib/actions/campaign-actions.ts"), /ownedPrivateFileUrl\(/);
  assert.match(read("src/lib/actions/submission-actions.ts"), /ownedPrivateFileUrl\(/);
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
  for (const file of ["src/lib/uploads.ts", "src/app/api/files/[id]/route.ts", "src/app/api/campaigns/direct-messages/route.ts"]) {
    assert.match(read(file), /authorizeApi\(/, file);
  }
});

test("integration secrets are encrypted and never sent back to the browser", () => {
  assert.match(read("src/lib/actions/commerce-actions.ts"), /keepOrReplaceSecret\(fd, "access_token"/);
  assert.match(read("src/app/admin/products/cafe24/page.tsx"), /access_token: ""/);
});

test("saving fee policy keeps roles that are not on the form", () => {
  assert.match(read("src/lib/actions/admin-actions.ts"), /if \(!fd\.has\(`\$\{role\}_referral_amount`\)\) continue;/);
});

test("AI shorts: closed switch blocks new jobs and funny charging, AI keys are encrypted", () => {
  // 스위치 OFF: 신규 유료 작업 차단 (합성은 본인·활성 크리에이터만 예외)
  assert.match(read("src/lib/ai/engine.ts"), /if \(!access\.open && !\(opts\.allowWhenClosed && user\.role === "creator" && user\.status === "active" && project\.user_id === user\.id\)\)/);
  // 충전: 스위치 + 대상자 + 필수 모델 준비까지 확인 (결제 확정 직전에도 재확인)
  assert.match(read("src/lib/actions/funny-actions.ts"), /funnyChargeAllowed\(db, user\)/);
  assert.match(read("src/lib/actions/payment-actions.ts"), /funny_charge" && !funnyChargeAllowed/);
  assert.match(read("src/lib/payment/effects.ts"), /funnyChargeAllowed/);
  assert.match(read("src/lib/actions/ai-admin-actions.ts"), /api_key_enc: kind === "mock" \? "" : encryptSensitive\(key\)/);
});

test("signup fee failure can be retried instead of locking the account", () => {
  assert.match(read("src/lib/actions/payment-actions.ts"), /export async function retrySignupPaymentAction/);
  assert.match(read("src/app/payment/activate/page.tsx"), /retrySignupPaymentAction/);
});

test("expired campaigns are swept and auto-settled in the background", () => {
  assert.match(read("src/lib/campaign-workflow.ts"), /export function sweepExpiredCampaigns/);
  assert.match(read("src/lib/background.ts"), /sweepExpiredCampaigns/);
  assert.match(read("src/instrumentation.ts"), /startBackground/);
  assert.match(read("src/lib/background.ts"), /CAMPAIGN_SWEEP === "off"/);
});

test("point ledger never goes negative and commission clawback is clamped", () => {
  assert.match(read("src/lib/services.ts"), /params\.amount < 0 && pw\.point_balance \+ params\.amount < 0/);
  assert.match(read("src/lib/campaign-workflow.ts"), /Math\.min\(want, Math\.max\(0, balance\)\)/);
});

test("deploy participations are assigned a platform and paid at that platform's rate", () => {
  const wf = read("src/lib/campaign-workflow.ts");
  assert.match(wf, /deployablePlatforms\(db, user\.id, campaign\)/);
  assert.match(wf, /creatorDeployPayout\(db, p\.platform && platformTargets\(campaign\) && campaign\.platforms\.includes\(p\.platform\)/);
  assert.match(read("src/lib/campaign-eligibility.ts"), /export function platformCapacity/);
});

test("custom video requests can be cancelled with refund and partial refund on approval", () => {
  const src = read("src/lib/actions/request-actions.ts");
  assert.match(src, /export async function cancelRequestAction/);
  assert.match(src, /partial_refund_amount/);
  assert.match(read("src/components/requests/request-detail-modal.tsx"), /applyRequestAction/);
});

test("creator campaign list hides admin memo and unconfirmed attachments", () => {
  const src = read("src/app/creator/campaigns/page.tsx");
  assert.match(src, /admin_memo: null/);
  assert.match(src, /attachment_file_data: confirmed \? c\.attachment_file_data : null/);
});

test("shorts-commerce hides supplier price and only links sellable products / own channels", () => {
  assert.match(read("src/app/creator/shorts-commerce/page.tsx"), /supply_price: 0/);
  const src = read("src/lib/actions/commerce-actions.ts");
  assert.match(src, /isSellable\(p\)/);
  assert.match(src, /c\.creator_id === user\.id/);
});

test("removed integrations (AI story / vibeporter / video market) leave no traces", () => {
  const files = ["src/lib/schema.ts", "src/lib/nav.ts", "src/lib/seed.ts", "src/lib/db/json-provider.ts", "src/lib/labels.ts", "src/components/campaigns/creator-campaigns-ui.tsx", "src/components/commerce/shorts-commerce-panel.tsx", ".env.example"];
  for (const file of files) {
    assert.doesNotMatch(read(file), /vibeporter|바이브포터|ai_story|AI스토리|story_creation|story_brief|video_purchase|member_video_sale/i, file);
  }
});

test("site banners and how-to blocks are rendered and links are restricted", () => {
  assert.match(read("src/app/page.tsx"), /<SiteBanners banners=\{db\.settings\.site_banners\}/);
  assert.match(read("src/components/site/site-content.tsx"), /isInternalPath\(v\) \|\| isHttpUrl\(v\)/);
  assert.match(read("src/lib/actions/site-actions.ts"), /!isInternalPath\(banner\.cta_href\) && !isHttpUrl\(banner\.cta_href\)/);
});

test("Supabase profiles self-update cannot change privileged columns", () => {
  const sql = read("supabase/migrations/0004_profiles_self_update_hardening.sql");
  assert.match(sql, /with check \(auth_user_id = auth\.uid\(\)\)/);
  assert.match(sql, /new\.role is distinct from old\.role/);
});

test("Korean 404 / error pages exist and CSP header is set", () => {
  assert.ok(fs.existsSync(path.join(root, "src/app/not-found.tsx")));
  assert.ok(fs.existsSync(path.join(root, "src/app/error.tsx")));
  assert.match(read("next.config.mjs"), /Content-Security-Policy/);
});

test("subscription fee feature is fully removed", () => {
  for (const file of ["src/lib/schema.ts", "src/lib/campaign-workflow.ts", "src/lib/payment/effects.ts", "src/app/creator/page.tsx", "src/app/admin/settings/page.tsx", "src/lib/actions/admin-actions.ts"]) {
    assert.doesNotMatch(read(file), /subscription_(enabled|amount|active_until)|startSubscriptionAction/, file);
  }
  assert.ok(!fs.existsSync(path.join(root, "src/lib/actions/subscription-actions.ts")));
});

test("creator signup requires a vibe-member (or company) referral code and starts as a general member", () => {
  const src = read("src/lib/actions/auth-actions.ts");
  assert.match(src, /role === "creator" && !data\.referral_code/);
  assert.match(src, /canBeMentor\(db, mentor\)/);
  assert.match(src, /status: isCreator \|\| !needsSignupFee \? "active" : "pending"/);
  assert.match(read("src/lib/payment/effects.ts"), /if \(user\.role === "creator"\) user\.vibe_member_at = now\(\);/);
});

test("paid-only creator features check vibe membership on the server", () => {
  assert.match(read("src/lib/campaign-workflow.ts"), /vibeOnlyError\(db, user\)/);
  for (const file of ["src/lib/actions/request-actions.ts", "src/lib/actions/commerce-actions.ts", "src/lib/actions/payout-actions.ts", "src/lib/actions/submission-actions.ts", "src/lib/uploads.ts", "src/app/api/creator/requests/[id]/submit/route.ts"]) {
    assert.match(read(file), /vibeOnlyError\(/, file);
  }
  assert.match(read("src/lib/ai/settings.ts"), /if \(!isVibeMember\(db, user\)\) return \{ open: false, reason: VIBE_ONLY_MESSAGE \}/);
  assert.match(read("src/app/creator/community/page.tsx"), /isVibeMember\(db, me\)/);
});

test("mentors can see whether each mentee has paid", () => {
  const src = read("src/app/creator/referrals/page.tsx");
  assert.match(src, /"결제 완료" : "가입비 면제"\} · \{VIBE_MEMBER_LABEL\}/);
  assert.match(src, /결제 전 · \{GENERAL_MEMBER_LABEL\}/);
});

// --- 2026-10 AI 숏츠 엔진 수정 회귀 테스트 ---------------------------------------

test("AI shorts: non-members cannot compose or estimate even when the switch-off compose exception applies", () => {
  const engine = read("src/lib/ai/engine.ts");
  // 회원 검사가 스위치 OFF 합성 예외보다 먼저
  const member = engine.indexOf('if (vibeOnlyError(db, user)) throw new AiError(VIBE_ONLY_MESSAGE, 403, "not_member")');
  const closed = engine.indexOf("if (!access.open && !(opts.allowWhenClosed");
  assert.ok(member > 0 && closed > member, "membership check must precede allowWhenClosed exception");
  const route = read("src/app/api/ai-shorts/projects/[id]/run/route.ts");
  const est = route.indexOf("if (body.estimateOnly)");
  const routeMember = route.indexOf('if (vibeOnlyError(db, user)) throw new AiError(VIBE_ONLY_MESSAGE, 403, "not_member")');
  assert.ok(est > 0 && routeMember > est && routeMember < route.indexOf('body.action !== "compose"'), "estimateOnly must check membership first");
});

test("AI engine: heartbeat keeps leases alive and startup no longer expires other workers' leases", () => {
  const engine = read("src/lib/ai/engine.ts");
  assert.doesNotMatch(engine, /startup lease reset/);
  assert.match(engine, /setInterval\(heartbeat, HEARTBEAT_MS\)/);
  assert.match(engine, /j\.worker_id !== s\.workerId\) continue;[\s\S]*j\.heartbeat_at = /);
  assert.match(engine, /now - Date\.parse\(j\.heartbeat_at\) > HEARTBEAT_STALE_MS/);
  assert.match(read("src/lib/schema.ts"), /heartbeat_at\?: string \| null;/);
});

test("AI engine: provider breaker defers queued jobs and notifies admins only on entering cooldown", () => {
  const engine = read("src/lib/ai/engine.ts");
  assert.match(engine, /if \(!j\.vendor_ref && providerCooldownUntil\(db, j\.model_ref\) !== null\) \{\s*deferForCooldown\(j\.id\);/);
  assert.match(engine, /if \(deferUntil\(db, j\)\) return null;/);
  assert.match(engine, /if \(!cooling && \(p\.fail_streak >= BREAKER_FAILURES \|\| err\.status === 401\)\)/);
});

test("AI http: initial request URL and Gemini poll/result URLs are SSRF-checked", () => {
  const http = read("src/lib/ai/http.ts");
  assert.match(http, /if \(!\(await safeCallUrl\(current\)\)\) throw new VendorError/);
  const providers = read("src/lib/ai/providers.ts");
  assert.match(providers, /GOOGLE_DOMAINS = \["googleapis\.com", "google\.com", "googleusercontent\.com"\]/);
  assert.match(providers, /!hostIn\(pollUrl, GOOGLE_DOMAINS\)/);
  assert.match(providers, /!hostIn\(uri, GOOGLE_DOMAINS\) \|\| !\(await safeUrl\(uri\)\)/);
});

test("AI budget: per-attempt cost flag prevents double counting; admin test cost is recorded; admin cancel reports errors", () => {
  const engine = read("src/lib/ai/engine.ts");
  assert.match(engine, /cost_recorded_attempt === j\.attempts;/);
  assert.match(engine, /cost_recorded_attempt !== j\.attempts\) addVendorCost\(j, j\.cost_won, j\.attempts\)/);
  const admin = read("src/lib/actions/ai-admin-actions.ts");
  assert.match(admin, /recordAdminTestCost\(db, \{/);
  assert.match(admin, /export async function adminCancelJobAction\(_prev: ActionState, fd: FormData\): Promise<ActionState>/);
  assert.match(read("src/app/admin/ai-shorts/jobs/page.tsx"), /<AdminCancelJobForm jobId=\{j\.id\} \/>/);
});

test("AI engine: TTS checks ffmpeg before calling the vendor and tolerates probe failure", () => {
  const engine = read("src/lib/ai/engine.ts");
  const check = engine.indexOf('if (job.kind === "shot_tts" && !(await ffmpegAvailable()))');
  const run = engine.indexOf("outcome = await adapter.run(");
  assert.ok(check > 0 && run > check, "ffmpeg check must precede vendor call");
  assert.match(engine, /audioSeconds = estimateAudioSeconds\(/);
});

// --- 2026-10-29 야간 점검 수정 회귀 테스트 -----------------------------------------

test("campaign form keeps step-2 uploads mounted so pool videos and attachments are submitted", () => {
  const src = read("src/components/forms/new-campaign-form.tsx");
  assert.match(src, /step === 2 \? "space-y-5" : "hidden"/);
  assert.doesNotMatch(src, /\{step === 2 && \(/);
});

test("reviewer-cancelled participations cannot re-apply", () => {
  const wf = read("src/lib/campaign-workflow.ts");
  assert.match(wf, /cancelledByReviewer\(existing\)/);
  assert.match(wf, /participation\.cancelled_by = "reviewer"/);
  const route = read("src/app/api/creator/participations/[id]/cancel/route.ts");
  assert.match(route, /cancelled_by = "creator"/);
});

test("payments: production mock shows notice, stale signup fee cancelled, concurrent confirm locked", () => {
  const actions = read("src/lib/actions/payment-actions.ts");
  assert.match(actions, /if \(!paymentProviderReady\(\)\) return;/);
  assert.match(actions, /cancel_reason: "fee_changed"/);
  assert.match(actions, /confirm_lock !== lockToken/);
  assert.match(actions, /status === "paid"\)\) return;/); // 이미 낸 가입비 재결제 방지
  assert.match(read("src/components/mock-checkout.tsx"), /온라인 결제를 준비 중입니다/);
});

test("signup requires the verification cookie of the browser that verified the email", () => {
  const verify = read("src/app/api/auth/email-verification/verify/route.ts");
  assert.match(verify, /EMAIL_VERIFY_COOKIE/);
  assert.match(verify, /httpOnly: true/);
  const signup = read("src/lib/actions/auth-actions.ts");
  assert.match(signup, /verifyTokenMatches\(verifyCookie, item\)/);
  assert.match(signup, /signup-ip:/);
  assert.match(signup, /EMAIL_VERIFIED_TTL_MS/);
});

test("general members cannot post campaign comments or register requests", () => {
  assert.match(read("src/app/api/campaigns/[id]/comments/route.ts"), /vibeOnlyError/);
  assert.match(read("src/lib/actions/request-actions.ts"), /export async function createRequestAction[\s\S]{0,200}vibeOnlyError/);
});

test("comments and DMs store nicknames instead of real names", () => {
  for (const f of ["src/app/api/campaigns/[id]/comments/route.ts", "src/app/api/campaigns/participation-comments/route.ts", "src/app/api/campaigns/direct-messages/route.ts"]) {
    assert.doesNotMatch(read(f), /_name: user\.name/);
  }
});

test("creator campaign list does not ship advertiser spend to the browser", () => {
  const src = read("src/app/creator/campaigns/page.tsx");
  assert.match(src, /point_spent: 0/);
  assert.match(src, /creator_rate_snapshot: undefined/);
});

test("creator signup fee default is 990,000 won", () => {
  assert.match(read("src/lib/seed.ts"), /signup_fee_amount: 990000/);
});

test("legacy reviewer cancellations are backfilled and pending creators without payment stay general members", () => {
  const src = read("src/lib/db/json-provider.ts");
  assert.match(src, /function migrateCancelledBy/);
  assert.match(src, /!wasPending && p\.status === "active"/);
  assert.match(read("src/components/forms/new-campaign-form.tsx"), /<form action=\{formAction\} noValidate/);
});
