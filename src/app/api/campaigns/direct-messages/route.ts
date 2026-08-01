import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { nanoid } from "nanoid";
import type { CampaignDirectMessage } from "@/lib/schema";

// GET /api/campaigns/direct-messages?participation_id=...
export async function GET(req: NextRequest) {
  // 인증: 로그인 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const participationId = searchParams.get("participation_id");
  const campaignId = searchParams.get("campaign_id");
  const creatorId = searchParams.get("creator_id");

  const db = getDb();
  let messages = db.campaign_direct_messages ?? [];

  if (participationId) {
    messages = messages.filter((m) => m.participation_id === participationId);
  } else if (campaignId && creatorId) {
    messages = messages.filter(
      (m) => m.campaign_id === campaignId && m.creator_id === creatorId
    );
  }

  // 크리에이터는 본인 메시지만 조회
  if (user.role === "creator") {
    messages = messages.filter((m) => m.creator_id === user.id);
  }

  return NextResponse.json(messages);
}

// POST /api/campaigns/direct-messages
export async function POST(req: NextRequest) {
  // 인증: 로그인 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const db = getDb();
  const body = await req.json();

  const { campaign_id, participation_id, creator_id, content } = body;

  if (!campaign_id || !participation_id || !creator_id || !content) {
    return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
  }

  // from_role, from_name은 세션에서 가져옴 (body 값 무시)
  const from_role = user.role as "advertiser" | "admin" | "creator";
  const from_name = user.name;

  const msg: CampaignDirectMessage = {
    id: nanoid(),
    campaign_id,
    participation_id,
    creator_id,
    from_role,
    from_name,
    content,
    created_at: new Date().toISOString(),
    read: false,
  };

  if (!db.campaign_direct_messages) db.campaign_direct_messages = [];
  db.campaign_direct_messages.push(msg);

  // Mark messages from opposite role as read
  db.campaign_direct_messages.forEach((m) => {
    if (m.participation_id === participation_id && m.from_role !== from_role) {
      m.read = true;
    }
  });

  saveDb(db);

  return NextResponse.json(msg);
}

// PATCH /api/campaigns/direct-messages - mark as read
export async function PATCH(req: NextRequest) {
  // 인증: 로그인 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const db = getDb();
  const body = await req.json();
  const { participation_id } = body;

  if (!participation_id) {
    return NextResponse.json({ error: "participation_id 필수" }, { status: 400 });
  }

  if (!db.campaign_direct_messages) db.campaign_direct_messages = [];

  // 세션 role 기준으로 상대방 메시지를 읽음 처리
  const reader_role = user.role;
  db.campaign_direct_messages.forEach((m) => {
    if (m.participation_id === participation_id && m.from_role !== reader_role) {
      m.read = true;
    }
  });

  saveDb(db);
  return NextResponse.json({ ok: true });
}
