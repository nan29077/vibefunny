// 서버 시작 시 띄우는 백그라운드 작업 (Node 런타임 전용 — src/instrumentation.ts 에서만 불러온다)
// - AI 숏츠 작업 엔진 (AI_ENGINE=off 로 끌 수 있음 — 별도 서버에서만 처리하고 싶을 때)
// - 마감일이 지난 캠페인 자동 정산 (시작 10초 후 + 30분마다, CAMPAIGN_SWEEP=off 로 끌 수 있음)
// - AI 합성 임시 폴더 정리 (시작 시 1회)
import { startAiEngine } from "./ai/engine";
import { cleanupStaleAiTemp } from "./ai/compose";
import { getDb, tx } from "./db";
import { expiredActiveCampaignIds, sweepExpiredCampaigns } from "./campaign-workflow";

const SWEEP_INTERVAL_MS = 30 * 60 * 1000;

export async function startBackground(): Promise<void> {
  startAiEngine();

  // 개발 서버 핫 리로드로 여러 번 불려도 타이머는 1개만 유지
  const g = globalThis as typeof globalThis & { __vfBackgroundStarted?: boolean };
  if (g.__vfBackgroundStarted) return;
  g.__vfBackgroundStarted = true;

  try {
    await cleanupStaleAiTemp();
  } catch (err) {
    console.error("[startup] AI 임시 폴더 정리 실패", err);
  }

  if (process.env.CAMPAIGN_SWEEP === "off") return;
  // 캠페인 1건씩 별도 트랜잭션으로 처리: 한 건이 실패해도 나머지 정산은 저장된다
  const runSweep = () => {
    let ids: string[] = [];
    try {
      ids = expiredActiveCampaignIds(getDb());
    } catch (err) {
      console.error("[campaign-sweep] 목록 조회 실패", err);
      return;
    }
    let settled = 0;
    for (const id of ids) {
      try {
        settled += tx((db) => sweepExpiredCampaigns(db, Date.now(), id));
      } catch (err) {
        console.error(`[campaign-sweep] 캠페인 ${id} 정산 실패`, err);
      }
    }
    if (settled > 0) console.log(`[campaign-sweep] 마감 캠페인 ${settled}건 자동 정산`);
  };
  const first = setTimeout(runSweep, 10_000);
  (first as { unref?: () => void }).unref?.();
  const timer = setInterval(runSweep, SWEEP_INTERVAL_MS);
  (timer as { unref?: () => void }).unref?.();
}
