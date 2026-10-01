// 서버 시작 시 AI 숏츠 작업 엔진(백그라운드 처리)을 띄운다.
// - Node 런타임에서만(엣지 번들에서는 제외되도록 NEXT_RUNTIME 조건 안에서 import), 빌드 중에는 띄우지 않는다.
// - AI_ENGINE=off 로 끌 수 있다(별도 서버에서만 처리하고 싶을 때).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { startAiEngine } = await import("./lib/ai/engine");
    startAiEngine();
  }
}
