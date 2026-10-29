import { NextRequest, NextResponse } from "next/server";
import { tx } from "@/lib/db";
import { authorizeApi } from "@/lib/auth";
import { joinParticipation, type ParticipationType } from "@/lib/campaign-workflow";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 인증: 로그인 + creator 역할 + 활성 계정
  const auth = authorizeApi("creator");
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;

  let body: { participation_type?: ParticipationType; platform?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const participationType = body.participation_type ?? "deploy";
  if (participationType !== "deploy" && participationType !== "video_production") {
    return NextResponse.json({ error: "참여 유형이 올바르지 않습니다." }, { status: 400 });
  }

  // tx() 내부에서 검증 + 영상 배정까지 원자적으로 처리 (동시 신청 시 중복 배정 방지)
  const result = tx((db) => joinParticipation(db, user, params.id, participationType, typeof body.platform === "string" ? body.platform : null));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body, { status: 200 });
}
