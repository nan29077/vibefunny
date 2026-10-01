import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, tx } from "@/lib/db";
import { audit } from "@/lib/services";
import { funnyBalance } from "@/lib/funny";
import { AiError, buildSpecs, enqueueSpecs, estimateSpecs, kickAiEngine, notifyBudgetReachedOnce } from "@/lib/ai/engine";
import { aiShortsAccess } from "@/lib/ai/settings";
import { getOwnedProject } from "@/lib/ai/projects";
import { creatorOrAdmin, errorResponse } from "@/lib/ai/api";

const schema = z.object({
  action: z.enum(["script", "images", "tts", "videos", "music", "compose"]),
  shotIds: z.array(z.string().max(64)).max(20).optional(),
  extra: z.string().max(300).optional(),
  estimateOnly: z.boolean().optional(),
  idempotencyKey: z.string().min(8).max(80).optional(),
});

// 견적(estimateOnly) 또는 AI 작업 등록 — 퍼니는 서버가 계산한 금액으로만 예약한다
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = creatorOrAdmin();
  if ("error" in auth) return auth.error;
  const user = auth.user;
  try {
    const body = schema.parse(await req.json().catch(() => ({})));
    if (user.role !== "creator") throw new AiError("크리에이터 계정에서만 만들 수 있습니다.", 403);
    if (body.estimateOnly) {
      const db = getDb();
      const project = getOwnedProject(db, user, params.id);
      const access = aiShortsAccess(db, user);
      if (!access.open && body.action !== "compose") throw new AiError(access.reason, 403, "closed");
      const specs = buildSpecs(project, body.action, body.shotIds, body.extra);
      const est = estimateSpecs(db, specs);
      return NextResponse.json({ ...est, wallet: funnyBalance(db, user.id) });
    }
    let budgetHit = false;
    try {
      const jobs = tx((db) => {
        const project = getOwnedProject(db, user, params.id);
        if (project.user_id !== user.id) throw new AiError("본인 숏츠만 만들 수 있습니다.", 403);
        const specs = buildSpecs(project, body.action, body.shotIds, body.extra);
        // 합성은 AI·퍼니를 쓰지 않으므로 스위치가 꺼져도 이미 만든 결과물로 완성본을 만들 수 있게 한다
        const created = enqueueSpecs(db, user, project, specs, { idempotencyKey: body.idempotencyKey ?? null, allowWhenClosed: body.action === "compose" });
        audit(db, { actorId: user.id, action: `ai_shorts_run_${body.action}`, targetTable: "shorts_projects", targetId: project.id, after: { jobs: created.length } });
        return created;
      });
      kickAiEngine();
      return NextResponse.json({ ok: true, jobs: jobs.map((j) => j.id), held: jobs.reduce((a, j) => a + j.hold_paid + j.hold_bonus, 0) });
    } catch (error) {
      if (error instanceof AiError && error.code === "budget") budgetHit = true;
      throw error;
    } finally {
      if (budgetHit) {
        try {
          tx((db) => notifyBudgetReachedOnce(db));
        } catch {
          /* 알림 실패는 무시 */
        }
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}
