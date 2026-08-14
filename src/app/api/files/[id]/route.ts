import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const db = getDb();
  const file = (db.private_files ?? []).find((item) => item.id === params.id);
  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  const fileUrl = `/api/files/${file.id}`;
  const relatedDelivery = db.custom_video_deliveries.find((delivery) => {
    if (delivery.video_url !== fileUrl) return false;
    const request = db.custom_video_requests.find((item) => item.id === delivery.request_id);
    return delivery.creator_id === user.id || request?.buyer_id === user.id || request?.assigned_creator_id === user.id;
  });
  const relatedParticipation = (db.campaign_participations ?? []).find((participation) => {
    if (participation.video_url !== fileUrl) return false;
    const campaign = db.ad_campaigns.find((item) => item.id === participation.campaign_id);
    return participation.creator_id === user.id || campaign?.advertiser_id === user.id;
  });
  if (user.role !== "admin" && file.owner_id !== user.id && !relatedDelivery && !relatedParticipation) {
    return NextResponse.json({ error: "파일 접근 권한이 없습니다." }, { status: 403 });
  }
  try {
    const buf = await storage.get(file.storage_name);
    // Buffer → Uint8Array 캐스트: Next.js 14 BodyInit 타입과 호환
    return new NextResponse(new Uint8Array(buf) as BodyInit, {
      headers: {
        "Content-Type": file.mime_type,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "파일을 읽을 수 없습니다." }, { status: 404 });
  }
}
