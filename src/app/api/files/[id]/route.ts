import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { storage } from "@/lib/storage";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  // 로그인 + 활성 계정(가입비 미결제 pending·정지 계정 제외)만 허용
  const auth = authorizeApi();
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;
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
  // 배포 영상 풀: 이 파일(제작 영상)을 배정받은 배포 크리에이터, 또는 해당 캠페인 광고주
  const relatedPoolVideo = (db.campaign_videos ?? []).find((video) => {
    if (video.video_url !== fileUrl && video.file_data !== fileUrl) return false;
    if (video.assigned_creator_id === user.id && video.status !== "unassigned") return true;
    const campaign = db.ad_campaigns.find((item) => item.id === video.campaign_id);
    return campaign?.advertiser_id === user.id;
  });
  // 캠페인 첨부 파일: 캠페인 광고주, 선발(참여 확정)된 크리에이터
  const relatedAttachment = db.ad_campaigns.find((campaign) => {
    if (campaign.attachment_file_data !== fileUrl) return false;
    if (campaign.advertiser_id === user.id) return true;
    return (db.campaign_participations ?? []).some(
      (p) => p.campaign_id === campaign.id && p.creator_id === user.id && !["applied", "application_rejected", "cancelled"].includes(p.status)
    );
  });
  // 결과물 제출 첨부: 제출한 크리에이터, 해당 캠페인 광고주
  const relatedSubmission = (db.campaign_submissions ?? []).find((submission) => {
    if (submission.file_data !== fileUrl) return false;
    if (submission.creator_id === user.id) return true;
    return db.ad_campaigns.find((c) => c.id === submission.campaign_id)?.advertiser_id === user.id;
  });
  if (user.role !== "admin" && file.owner_id !== user.id && !relatedDelivery && !relatedParticipation && !relatedPoolVideo && !relatedAttachment && !relatedSubmission) {
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
