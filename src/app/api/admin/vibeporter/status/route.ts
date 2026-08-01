import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  // 인증: admin 역할 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
  }

  const db = getDb();

  // 크리에이터 이름 조회 헬퍼
  const nameOf = (id: string | null | undefined) =>
    db.profiles.find((p) => p.id === id)?.name ?? "-";

  // 바이브포터 노출 신청 중 (enabled=true, approved=false/undefined)
  const pendingVideos = db.videos
    .filter((v) => v.vibeporter_enabled && !v.vibeporter_approved)
    .map((v) => ({
      id: v.id,
      title: v.title,
      creator_name: nameOf(v.creator_id),
      platform: v.platform,
      price: v.price,
      vibeporter_price: v.vibeporter_price,
      vibeporter_enabled: v.vibeporter_enabled,
      vibeporter_approved: v.vibeporter_approved ?? false,
      vibeporter_approved_at: v.vibeporter_approved_at,
      thumbnail_url: v.thumbnail_url,
      created_at: v.created_at,
    }));

  // 바이브포터 승인 완료 영상
  const approvedVideos = db.videos
    .filter((v) => v.vibeporter_enabled && v.vibeporter_approved)
    .map((v) => ({
      id: v.id,
      title: v.title,
      creator_name: nameOf(v.creator_id),
      platform: v.platform,
      price: v.price,
      vibeporter_price: v.vibeporter_price,
      vibeporter_enabled: v.vibeporter_enabled,
      vibeporter_approved: v.vibeporter_approved ?? false,
      vibeporter_approved_at: v.vibeporter_approved_at,
      thumbnail_url: v.thumbnail_url,
      created_at: v.created_at,
    }));

  // 바이브포터 의뢰 목록
  const requests = (db.vibeporter_requests ?? []).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json({ pendingVideos, approvedVideos, requests });
}
