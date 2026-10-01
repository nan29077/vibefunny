import { NextResponse } from "next/server";
import { tx } from "@/lib/db";
import { audit } from "@/lib/services";
import { aiShortsAccess } from "@/lib/ai/settings";
import { createProject, createSchema } from "@/lib/ai/projects";
import { AiError } from "@/lib/ai/engine";
import { creatorOrAdmin, errorResponse } from "@/lib/ai/api";

// 새 숏츠 만들기 (스위치 OFF·대상 아님이면 거절)
export async function POST(req: Request) {
  const auth = creatorOrAdmin();
  if ("error" in auth) return auth.error;
  const user = auth.user;
  try {
    const input = createSchema.parse(await req.json().catch(() => ({})));
    const project = tx((db) => {
      const access = aiShortsAccess(db, user);
      if (!access.open) throw new AiError(access.reason, 403, "closed");
      const p = createProject(db, user, input);
      audit(db, { actorId: user.id, action: "ai_shorts_create", targetTable: "shorts_projects", targetId: p.id });
      return p;
    });
    return NextResponse.json({ id: project.id });
  } catch (error) {
    return errorResponse(error);
  }
}
