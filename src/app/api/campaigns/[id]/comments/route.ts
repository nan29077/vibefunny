import { NextRequest, NextResponse } from "next/server";
import { getDb, saveDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
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
  // 인증: 로그인 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const db = getDb();
  const body = await req.json();

  if (!body.content) {
    return NextResponse.json({ error: "content 필수" }, { status: 400 });
  }

  // author_id, author_name, author_role을 body 대신 세션에서 가져옴
  const comment = {
    id: nanoid(),
    campaign_id: params.id,
    author_id: user.id,
    author_name: user.name,
    author_role: user.role as "admin" | "creator" | "advertiser",
    content: body.content,
    created_at: new Date().toISOString(),
  };

  if (!db.campaign_comments) db.campaign_comments = [];
  db.campaign_comments.push(comment);
  saveDb(db);

  return NextResponse.json(comment);
}
