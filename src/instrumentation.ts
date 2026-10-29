// 서버 시작 시 백그라운드 작업을 띄운다 (AI 숏츠 엔진 · 마감 캠페인 자동 정산 · 임시 폴더 정리).
// 실제 내용은 src/lib/background.ts. Node 런타임에서만 불러오도록 NEXT_RUNTIME 조건 블록 안에서 import 한다
// (엣지 번들에 fs/os 같은 Node 모듈이 섞이지 않게). 빌드 중에는 실행하지 않는다.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    // 운영 모드에서 예시·약한 비밀키로는 서버를 띄우지 않는다
    const { assertProductionSecrets } = await import("./lib/secrets");
    assertProductionSecrets();
    const { startBackground } = await import("./lib/background");
    await startBackground();
  }
}
