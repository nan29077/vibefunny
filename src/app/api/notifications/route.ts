import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const notifications = (getDb().notifications ?? [])
    .filter((item) => item.recipient_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return NextResponse.json({
    unreadCount: notifications.filter((item) => !item.read_at).length,
    items: notifications.slice(0, 6).map(({ id, title, message, link, read_at, created_at }) => ({
      id, title, message, link, read_at, created_at,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
