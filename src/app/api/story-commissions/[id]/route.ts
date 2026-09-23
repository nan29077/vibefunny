import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getCurrentUser } from "@/lib/auth";

// AI스토리 프로젝트의 data/story_requests.json 을 공유 파일로 사용.
// 배포 환경에서는 AI_STORY_REQUESTS_FILE 환경변수로 경로를 지정한다 (미지정 시 로컬 개발용 기본 경로).
const DATA_FILE = process.env.AI_STORY_REQUESTS_FILE
  ? path.resolve(process.env.AI_STORY_REQUESTS_FILE)
  : path.join(process.cwd(), "..", "AI스토리", "data", "story_requests.json");

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // 인증: 로그인 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }
  if (user.role !== "creator" && user.role !== "admin") return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });

  const { id } = params;
  const body = await req.json();
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const data = JSON.parse(raw);
    const idx = data.findIndex((r: { id: string }) => r.id === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });

    const item = data[idx];
    const now = Date.now();

    if (body.action === "join") {
      if (user.role !== "creator") return NextResponse.json({ error: "크리에이터만 참여할 수 있습니다." }, { status: 403 });
      if (item.status !== "approved" || item.creator_id) return NextResponse.json({ error: "이미 배정되었거나 참여할 수 없는 의뢰입니다." }, { status: 409 });
      item.status = "in_progress";
      // creator_id와 creator_name은 세션에서 가져옴
      item.creator_id = user.id;
      item.creator_name = user.name;
    } else if (body.action === "complete") {
      if (user.role !== "creator" || item.creator_id !== user.id || item.status !== "in_progress") return NextResponse.json({ error: "본인에게 배정된 진행 중 의뢰만 완료할 수 있습니다." }, { status: 403 });
      item.status = "completed";
      item.completed_at = now;
    } else {
      return NextResponse.json({ error: "지원하지 않는 action입니다." }, { status: 400 });
    }

    data[idx] = item;
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    return NextResponse.json(item);
  } catch (err) {
    // 공유 파일(AI스토리 연동)이 없으면 500 대신 연동 미설정 안내
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "AI스토리 연동 데이터가 설정되지 않았습니다." }, { status: 503 });
    }
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
