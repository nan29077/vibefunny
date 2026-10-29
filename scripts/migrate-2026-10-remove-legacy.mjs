// 2026-10 정리 마이그레이션: 종료한 기능의 데이터를 db.json 에서 지운다.
//  - AI스토리(동화 제작 의뢰) 캠페인·설정
//  - 바이브포터 의뢰 캠페인·의뢰 목록·영상 판매 승인 정보
//  - 회원 영상판매(마켓): 판매용 영상·구매 기록·판매 정책 설정
//  - 쇼츠 커머스의 "바이브포터 구매 영상" 출처 정보
// 함께 하는 일: 진행 중 캠페인에 크리에이터 지급 단가 스냅샷이 없으면 현재 단가로 채운다.
//
// 지급·출금 원장(wallet_transactions)은 회계 기록이므로 지우지 않는다.
// (과거 "영상 판매" 적립 내역은 그대로 남고 화면에는 "영상 판매 (종료된 서비스)"로 표시된다)
// 감사 로그는 삭제한 캠페인·영상·바이브포터를 가리키는 줄만 지우고 나머지는 보존한다.
//
// 사용: npm run migrate:remove-legacy           ← 무엇이 지워지는지 미리 보기 (저장 안 함)
//       npm run migrate:remove-legacy -- --apply ← 실제로 정리 (실행 전 db.json 백업 자동 생성)
//       npm run migrate:remove-legacy -- --apply --clean-backups
//            ← 정리 후 data/ 의 백업(*.bak)에서도 같은 데이터를 지우고, 남은 임시 파일(*.tmp)을 삭제
//       node scripts/migrate-2026-10-remove-legacy.mjs --file <경로.json> [--file …]
//            ← 지정한 JSON 백업 파일만 정리 (압축 백업에서 꺼낸 db.json 등)
// 여러 번 실행해도 안전합니다.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, DB_PATH, withDb } from "./lib/env-db.mjs";

const APPLY = process.argv.includes("--apply");
const LEGACY_TEXT = /바이브포터|AI스토리|vibeporter|ai_story|story_creation|동화 제작|맞춤 동화/i;

function isLegacyCampaign(c) {
  return (
    c.campaign_type === "story_creation" ||
    c.source_type === "vibeporter" ||
    c.source_type === "ai_story" ||
    c.advertiser_id === "vibeporter_system" ||
    !!c.story_brief
  );
}

function cleanup(db, { snapshot = true } = {}) {
  const report = {};
  const count = (key, n) => { if (n) report[key] = (report[key] ?? 0) + n; };

  // 1) 바이브포터·AI스토리 캠페인과 딸린 기록
  const campaigns = db.ad_campaigns ?? [];
  const removedCampaignIds = new Set(campaigns.filter(isLegacyCampaign).map((c) => c.id));
  db.ad_campaigns = campaigns.filter((c) => !removedCampaignIds.has(c.id));
  count("ad_campaigns (바이브포터·AI스토리 캠페인)", removedCampaignIds.size);

  const byCampaign = ["campaign_applications", "campaign_deliveries", "campaign_comments", "campaign_direct_messages", "campaign_videos", "campaign_favorites"];
  for (const key of byCampaign) {
    const before = (db[key] ?? []).length;
    db[key] = (db[key] ?? []).filter((row) => !removedCampaignIds.has(row.campaign_id));
    count(key, before - db[key].length);
  }
  const removedSubmissionIds = new Set((db.campaign_submissions ?? []).filter((s) => removedCampaignIds.has(s.campaign_id)).map((s) => s.id));
  db.campaign_submissions = (db.campaign_submissions ?? []).filter((s) => !removedSubmissionIds.has(s.id));
  count("campaign_submissions", removedSubmissionIds.size);
  const subCommentsBefore = (db.submission_comments ?? []).length;
  db.submission_comments = (db.submission_comments ?? []).filter((c) => !removedSubmissionIds.has(c.submission_id));
  count("submission_comments", subCommentsBefore - db.submission_comments.length);

  const removedParticipationIds = new Set((db.campaign_participations ?? []).filter((p) => removedCampaignIds.has(p.campaign_id)).map((p) => p.id));
  db.campaign_participations = (db.campaign_participations ?? []).filter((p) => !removedParticipationIds.has(p.id));
  count("campaign_participations", removedParticipationIds.size);
  const partCommentsBefore = (db.participation_comments ?? []).length;
  db.participation_comments = (db.participation_comments ?? []).filter((c) => !removedParticipationIds.has(c.participation_id));
  count("participation_comments", partCommentsBefore - db.participation_comments.length);

  // 지급 원장은 지우지 않는다 — 삭제된 캠페인과 연결된 지급이 있으면 알려만 준다
  const linkedRewards = (db.wallet_transactions ?? []).filter(
    (t) => (t.related_table === "campaign_participations" && removedParticipationIds.has(t.related_id)) ||
           (t.related_table === "ad_campaigns" && removedCampaignIds.has(t.related_id))
  );
  if (linkedRewards.length) report["⚠ 보존한 지급 원장(삭제 캠페인 관련)"] = linkedRewards.length;

  // 2) 남은 캠페인의 출처·동화 필드 제거
  for (const c of db.ad_campaigns) {
    if ("source_type" in c) { delete c.source_type; count("캠페인 source_type 필드", 1); }
    if ("story_brief" in c) { delete c.story_brief; count("캠페인 story_brief 필드", 1); }
  }

  // 3) 바이브포터 의뢰 목록, 회원 영상판매(판매용 영상·구매 기록)
  count("vibeporter_requests", (db.vibeporter_requests ?? []).length);
  delete db.vibeporter_requests;
  report.__videoIds = (db.videos ?? []).map((v) => v.id);
  count("videos (판매용 영상)", (db.videos ?? []).length);
  delete db.videos;
  count("video_purchases (영상 구매 기록)", (db.video_purchases ?? []).length);
  delete db.video_purchases;
  // 결제 대기 중이던 영상 구매 결제는 취소 처리 (완료된 결제 기록은 보존)
  for (const p of db.payments ?? []) {
    if (p.payment_type === "video_purchase" && p.status === "pending") {
      p.status = "cancelled";
      p.metadata_json = { ...(p.metadata_json ?? {}), cancel_reason: "video_market_closed" };
      count("대기 중 영상 구매 결제 → 취소", 1);
    }
  }

  // 4) 설정
  for (const key of ["ai_story", "member_video_sale_price_tiers", "member_video_sale_price", "video_sale_platform_fee_rate", "video_auto_approve"]) {
    if (db.settings && key in db.settings) { delete db.settings[key]; count(`settings.${key}`, 1); }
  }

  // 5) 쇼츠 커머스의 바이브포터 영상 출처 정보
  for (const link of db.creator_shorts_links ?? []) {
    for (const key of ["video_source", "source_video_id", "source_video_title"]) {
      if (key in link) { delete link[key]; count(`creator_shorts_links.${key}`, 1); }
    }
  }

  // 6-a) 삭제한 캠페인·판매용 영상·바이브포터를 가리키는 감사 로그 줄
  const removedVideoIds = new Set((report.__videoIds ?? []));
  delete report.__videoIds;
  const auditBefore = (db.audit_logs ?? []).length;
  db.audit_logs = (db.audit_logs ?? []).filter((a) => {
    if (removedCampaignIds.has(a.target_id) || removedVideoIds.has(a.target_id)) return false;
    if (/vibeporter|ai_story|story|video_purchase|approve_video|reject_video|create_video|download_video|update_video_sale/i.test(a.action ?? "")) return false;
    if (a.target_table === "videos" || a.target_table === "video_purchases") return false;
    return true;
  });
  count("audit_logs (삭제 항목 관련 줄)", auditBefore - db.audit_logs.length);

  // 6) 종료 기능을 가리키는 알림
  const notesBefore = (db.notifications ?? []).length;
  db.notifications = (db.notifications ?? []).filter((n) => {
    const text = `${n.title ?? ""} ${n.message ?? ""} ${n.link ?? ""}`;
    if (LEGACY_TEXT.test(text)) return false;
    if (/\/admin\/(vibeporter|ai-story|videos)|\/creator\/(videos|story-commissions)/.test(n.link ?? "")) return false;
    if ([...removedCampaignIds].some((id) => (n.link ?? "").includes(id))) return false;
    return true;
  });
  count("notifications (종료 기능 관련 알림)", notesBefore - db.notifications.length);

  // 7) 진행 중 캠페인에 크리에이터 지급 단가 스냅샷 채우기 (이후 관리자 단가 변경이 영향 주지 않도록)
  //    (백업 파일 정리 때는 원본 그대로 두기 위해 건너뜀)
  if (snapshot) {
    const tiers = db.settings?.video_pricing_tiers ?? [];
    const deployPayouts = {};
    for (const r of db.settings?.distribution_rates ?? []) deployPayouts[r.platform] = r.creator_payout;
    for (const c of db.ad_campaigns) {
      if (c.creator_rate_snapshot || ["completed", "cancelled", "refunded", "rejected"].includes(c.status)) continue;
      const tier = tiers.find((t) => t.key === c.video_duration_tier);
      const videoPayout = tier && typeof tier.amount === "number" ? tier.amount : (db.settings?.extra_creation_creator_payout ?? 0);
      c.creator_rate_snapshot = { video_payout: videoPayout, deploy_payouts: { ...deployPayouts }, captured_at: new Date().toISOString() };
      count("진행 중 캠페인 지급 단가 스냅샷 생성", 1);
    }
  }
  return report;
}

function printReport(report) {
  const entries = Object.entries(report);
  if (entries.length === 0) {
    console.log("정리할 항목이 없습니다. (이미 정리됨)");
    return;
  }
  for (const [key, n] of entries) console.log(`  - ${key}: ${n}`);
}

function cleanFile(file) {
  let db;
  try { db = JSON.parse(fs.readFileSync(file, "utf8")); } catch { console.log(`  ⏭ ${path.basename(file)}: JSON 이 아니어서 건너뜀`); return; }
  const report = cleanup(db, { snapshot: false });
  const n = Object.values(report).reduce((sum, v) => sum + (typeof v === "number" ? v : 0), 0);
  if (n === 0) { console.log(`  ✓ ${path.basename(file)}: 정리할 항목 없음`); return; }
  const tmp = `${file}.${process.pid}.cleaning`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, file);
  console.log(`  ✅ ${path.basename(file)}: ${n}개 항목 정리`);
}

const fileArgs = process.argv.flatMap((arg, i, all) => (arg === "--file" && all[i + 1] ? [all[i + 1]] : []));
if (fileArgs.length > 0) {
  console.log("🧹 지정한 파일 정리");
  for (const file of fileArgs) cleanFile(path.resolve(file));
  process.exit(0);
}

if (!fs.existsSync(DB_PATH)) {
  console.error("data/db.json 이 없습니다.");
  process.exit(1);
}

if (!APPLY) {
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  console.log("🔎 미리 보기 (저장하지 않음). 실제 정리: npm run migrate:remove-legacy -- --apply");
  printReport(cleanup(db));
} else {
  const { result, backup } = withDb((db) => cleanup(db));
  console.log("✅ 정리 완료");
  printReport(result);
  if (process.argv.includes("--clean-backups")) {
    console.log("🧹 data/ 백업 파일 정리");
    for (const name of fs.readdirSync(DATA_DIR)) {
      const file = path.join(DATA_DIR, name);
      if (name.endsWith(".bak")) cleanFile(file);
      // 저장 중 남은 임시 파일(1시간 이상 지난 것)은 삭제
      else if (name.endsWith(".tmp") && Date.now() - fs.statSync(file).mtimeMs > 60 * 60 * 1000) {
        fs.unlinkSync(file);
        console.log(`  🗑 ${name}: 남은 임시 파일 삭제`);
      }
    }
  } else {
    console.log(`   백업: ${backup}`);
    console.log("   ※ 백업 파일(*.bak)에는 정리 전 데이터가 남아 있습니다. 백업까지 정리하려면 --clean-backups 를 함께 주세요.");
  }
}
