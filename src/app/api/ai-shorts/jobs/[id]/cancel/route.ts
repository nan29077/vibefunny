import { NextResponse } from "next/server";
import { tx } from "@/lib/db";
import { cancelJob } from "@/lib/ai/engine";
import { creatorOrAdmin, errorResponse } from "@/lib/ai/api";

// 대기 중인 작업 취소 (예약 퍼니 전액 반환). 이미 AI 가 만들고 있는 작업은 관리자만 취소 가능.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = creatorOrAdmin();
  if ("error" in auth) return auth.error;
  try {
    tx((db) => cancelJob(db, params.id, auth.user));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
