import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 인증: 로그인 필수, creator 역할 확인
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  if (user.role !== "creator") {
    return NextResponse.json({ error: "크리에이터 권한이 필요합니다" }, { status: 403 });
  }

  const db = getDb();
  const body = await req.json();
  const {
    type,
    video_url,
    video_file_data,
    video_file_name,
    video_file_type,
    deploy_link,
    note,
  } = body;
  // type: "video" | "deploy"
  // creator_id는 세션 user.id 사용 (body의 creator_id 무시)
  const creator_id = user.id;

  if (!type) {
    return NextResponse.json({ error: "type 필요" }, { status: 400 });
  }

  // type(video/deploy)에 맞는 참여 유형으로 정확히 조회 (한 캠페인에 두 유형 참여 가능)
  const wantType = type === "deploy" ? "deploy" : "video_production";
  const candidates = (db.campaign_participations ?? []).filter(
    (p) => p.campaign_id === params.id && p.creator_id === creator_id
  );
  const p =
    candidates.find((p) => (p.participation_type ?? "deploy") === wantType) ??
    candidates[0];
  if (!p) {
    return NextResponse.json({ error: "참여 기록 없음" }, { status: 404 });
  }

  // 소유권 확인: 세션 사용자가 이 참여의 크리에이터인지 검증
  if (p.creator_id !== user.id) {
    return NextResponse.json({ error: "본인의 참여 기록만 제출할 수 있습니다" }, { status: 403 });
  }

  if (type === "video") {
    if (!video_url) {
      return NextResponse.json({ error: "video_url 필요" }, { status: 400 });
    }
    p.status = "video_submitted";
    p.video_url = video_url;
    p.video_note = note ?? undefined;
    if (video_file_data) {
      p.video_file_data = video_file_data;
      p.video_file_name = video_file_name ?? null;
      p.video_file_type = video_file_type ?? null;
    }
  } else if (type === "deploy") {
    // deploy-only 참여(participation_type === "deploy")는 "applied" 상태에서도 제출 가능
    const isDeployOnly = p.participation_type === "deploy";
    const allowedStatuses = isDeployOnly
      ? ["applied", "accepted", "deploy_rejected"]
      : ["video_approved", "deploy_rejected"];
    if (!allowedStatuses.includes(p.status)) {
      return NextResponse.json(
        { error: isDeployOnly ? "배포 링크를 제출할 수 없는 상태입니다" : "영상 승인 후 배포 신청 가능합니다" },
        { status: 400 }
      );
    }
    p.status = "deploy_submitted";
    p.rejection_reason = undefined;
    p.deploy_link = deploy_link ?? undefined;
    p.deploy_note = note ?? undefined;
  } else {
    return NextResponse.json({ error: "type은 video 또는 deploy" }, { status: 400 });
  }

  p.updated_at = new Date().toISOString();
  saveDb(db);

  return NextResponse.json(p);
}
