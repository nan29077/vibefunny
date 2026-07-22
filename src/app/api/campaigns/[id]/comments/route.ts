import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { nanoid } from "nanoid";

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const comments = (db.campaign_comments ?? []).filter(
    (c) => c.campaign_id === params.id
  );
  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
  const body = await req.json();

  if (!body.author_id || !body.author_name || !body.author_role || !body.content) {
    return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
  }

  const comment = {
    id: nanoid(),
    campaign_id: params.id,
    author_id: body.author_id,
    author_name: body.author_name,
    author_role: body.author_role as "admin" | "creator" | "advertiser",
    content: body.content,
    created_at: new Date().toISOString(),
  };

  if (!db.campaign_comments) db.campaign_comments = [];
  db.campaign_comments.push(comment);
  saveDb(db);

  return NextResponse.json(comment);
}
