import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { authorizeApi } from "@/lib/auth";
import { tx } from "@/lib/db";
import { notifyUser } from "@/lib/services";
import { isOwnPrivateFileOrExternal, notifyAdmins } from "@/lib/campaign-workflow";
import { vibeOnlyError } from "@/lib/membership";

function isHttpUrl(value: string): boolean {
  if (/^\/api\/files\/[0-9a-f-]{36}$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // 로그인 + 활성 계정(가입비 미결제 pending·정지 계정 제외)만 허용
  const auth = authorizeApi();
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;
  if (user.role !== "creator") return NextResponse.json({ error: "크리에이터 권한이 필요합니다." }, { status: 403 });

  const input = (await req.json().catch(() => ({}))) as { video_url?: string; message?: string };
  const videoUrl = input.video_url?.trim() ?? "";
  if (!isHttpUrl(videoUrl)) return NextResponse.json({ error: "유효한 http(s) 영상 URL이 필요합니다." }, { status: 400 });

  const result = tx<{ status: number; body: unknown }>((db) => {
    const vibeBlock = vibeOnlyError(db, user);
    if (vibeBlock) return { status: 403, body: { error: vibeBlock } };
    const request = db.custom_video_requests.find((item) => item.id === params.id);
    if (!request) return { status: 404, body: { error: "제작 의뢰를 찾을 수 없습니다." } };
    if (!request.assigned_creator_id || request.assigned_creator_id !== user.id) {
      return { status: 403, body: { error: "본인에게 배정된 제작 의뢰만 제출할 수 있습니다." } };
    }
    if (!["in_progress", "revision_requested"].includes(request.status)) {
      return { status: 409, body: { error: "진행 중이거나 수정 요청된 의뢰만 제출할 수 있습니다." } };
    }
    // 남의 비공개 파일을 결과물로 지정해 열람 권한을 얻는 것을 막는다
    if (!isOwnPrivateFileOrExternal(db, videoUrl, user.id)) {
      return { status: 403, body: { error: "본인이 업로드한 파일만 제출할 수 있습니다." } };
    }

    request.submitted_video_url = videoUrl;
    request.status = "submitted";
    request.updated_at = new Date().toISOString();
    db.custom_video_deliveries.push({
      id: nanoid(), request_id: request.id, creator_id: user.id, video_url: videoUrl,
      message: input.message?.trim().slice(0, 3000) || null, status: "submitted",
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    // 검수는 관리자 화면(/admin/requests)에서 하므로 관리자에게 알린다 (의뢰자에게도 안내)
    notifyAdmins(db, { title: "제작 의뢰 결과물이 제출되었습니다", message: request.title, link: "/admin/requests" });
    if (db.profiles.some((p) => p.id === request.buyer_id && p.role !== "admin")) {
      notifyUser(db, { recipientId: request.buyer_id, title: "제작 의뢰 작업물이 제출되었습니다", message: `${request.title} · 관리자 검수 후 결과를 알려드립니다.`, link: "/creator/requests" });
    }
    return { status: 200, body: { ok: true } };
  });
  return NextResponse.json(result.body, { status: result.status });
}
