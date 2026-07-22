import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const body = await req.json();
  const {
    creator_id,
    type,
    video_url,
    video_file_data,
    video_file_name,
    video_file_type,
    deploy_link,
    note,
  } = body;
  // type: "video" | "deploy"

  if (!creator_id || !type) {
    return NextResponse.json({ error: "creator_id, type 필요" }, { status: 400 });
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
