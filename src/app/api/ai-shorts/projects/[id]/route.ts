import { NextResponse } from "next/server";
import { getDb, tx } from "@/lib/db";
import { audit } from "@/lib/services";
import { funnyBalance } from "@/lib/funny";
import { aiShortsAccess } from "@/lib/ai/settings";
import { AiError, capabilityStatus, flushCleanup } from "@/lib/ai/engine";
import { deleteProject, getOwnedProject, patchSchema, projectView, updateProject } from "@/lib/ai/projects";
import { creatorOrAdmin, errorResponse } from "@/lib/ai/api";

export const dynamic = "force-dynamic";

// 편집 화면 상태 (2~3초 간격 조회)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = creatorOrAdmin();
  if ("error" in auth) return auth.error;
  try {
    const db = getDb();
    const project = getOwnedProject(db, auth.user, params.id);
    return NextResponse.json({
      ...projectView(db, project),
      wallet: funnyBalance(db, project.user_id),
      access: aiShortsAccess(db, auth.user),
      capabilities: capabilityStatus(db),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// 대본·컷·설정 수정 (스위치 OFF 면 읽기 전용)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = creatorOrAdmin();
  if ("error" in auth) return auth.error;
  try {
    const patch = patchSchema.parse(await req.json().catch(() => ({})));
    tx((db) => {
      const project = getOwnedProject(db, auth.user, params.id);
      if (project.user_id !== auth.user.id) throw new AiError("본인 숏츠만 수정할 수 있습니다.", 403);
      const access = aiShortsAccess(db, auth.user);
      if (!access.open) throw new AiError(`${access.reason} 지금은 보기·다운로드만 할 수 있습니다.`, 403, "closed");
      updateProject(db, project, patch);
    });
    await flushCleanup();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

// 숏츠 삭제 (결과 파일까지 정리)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = creatorOrAdmin();
  if ("error" in auth) return auth.error;
  try {
    tx((db) => {
      const project = getOwnedProject(db, auth.user, params.id);
      if (project.user_id !== auth.user.id && auth.user.role !== "admin") throw new AiError("본인 숏츠만 삭제할 수 있습니다.", 403);
      deleteProject(db, project);
      audit(db, { actorId: auth.user.id, action: "ai_shorts_delete", targetTable: "shorts_projects", targetId: project.id });
    });
    await flushCleanup();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
