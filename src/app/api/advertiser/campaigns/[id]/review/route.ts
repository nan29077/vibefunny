import { NextRequest, NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth";
import { tx } from "@/lib/db";
import { reviewParticipation } from "@/lib/campaign-workflow";

// 광고주 캠페인 상세 화면의 작업물 검수 (creator_id + type 기준)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = authorizeApi("admin", "advertiser");
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;

  const input = (await req.json().catch(() => ({}))) as {
    creator_id?: string; type?: "video" | "deploy"; action?: "approve" | "reject"; reason?: string;
  };
  if (!input.creator_id || !["video", "deploy"].includes(input.type ?? "") || !["approve", "reject"].includes(input.action ?? "")) {
    return NextResponse.json({ error: "creator_id, type, action 값이 올바르지 않습니다." }, { status: 400 });
  }
  const action = input.action as "approve" | "reject";

  const result = tx((db) => {
    const campaign = db.ad_campaigns.find((item) => item.id === params.id);
    if (!campaign) return { ok: false as const, status: 404, error: "캠페인을 찾을 수 없습니다." };
    if (user.role === "advertiser" && campaign.advertiser_id !== user.id) {
      return { ok: false as const, status: 403, error: "본인 캠페인만 승인할 수 있습니다." };
    }
    const participationType = input.type === "video" ? "video_production" : "deploy";
    const participation = (db.campaign_participations ?? []).find(
      (item) => item.campaign_id === campaign.id && item.creator_id === input.creator_id && (item.participation_type ?? "deploy") === participationType
    );
    if (!participation) return { ok: false as const, status: 404, error: "해당 유형의 참여 기록을 찾을 수 없습니다." };
    const expected = input.type === "video" ? ["video_submitted", "video_approved"] : ["deploy_submitted"];
    if (!expected.includes(participation.status)) {
      return { ok: false as const, status: 409, error: "검토할 제출물이 없는 상태입니다." };
    }
    return reviewParticipation(db, user, participation, action, input.reason);
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body, { status: 200 });
}
