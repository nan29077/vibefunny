import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { nanoid } from "nanoid";
import type { CampaignDirectMessage } from "@/lib/schema";

// GET /api/campaigns/direct-messages?participation_id=...
export async function GET(req: NextRequest) {
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

  return NextResponse.json(messages);
}

// POST /api/campaigns/direct-messages
export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();

  const { campaign_id, participation_id, creator_id, from_role, from_name, content } = body;

  if (!campaign_id || !participation_id || !creator_id || !from_role || !from_name || !content) {
    return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
  }

  const msg: CampaignDirectMessage = {
    id: nanoid(),
    campaign_id,
    participation_id,
    creator_id,
    from_role: from_role as "advertiser" | "admin" | "creator",
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
  const db = getDb();
  const body = await req.json();
  const { participation_id, reader_role } = body;

  if (!participation_id || !reader_role) {
    return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
  }

  if (!db.campaign_direct_messages) db.campaign_direct_messages = [];

  // Mark all messages sent by the other side as read
  db.campaign_direct_messages.forEach((m) => {
    if (m.participation_id === participation_id && m.from_role !== reader_role) {
      m.read = true;
    }
  });

  saveDb(db);
  return NextResponse.json({ ok: true });
}
