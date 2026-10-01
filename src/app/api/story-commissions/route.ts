import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { authorizeApi } from "@/lib/auth";

// AI스토리 프로젝트의 data/story_requests.json 을 공유 파일로 사용.
// 배포 환경에서는 AI_STORY_REQUESTS_FILE 환경변수로 경로를 지정한다 (미지정 시 로컬 개발용 기본 경로).
const DATA_FILE = process.env.AI_STORY_REQUESTS_FILE
  ? path.resolve(process.env.AI_STORY_REQUESTS_FILE)
  : path.join(process.cwd(), "..", "AI스토리", "data", "story_requests.json");

export async function GET() {
  const auth = authorizeApi();
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;
  if (user.role !== "creator" && user.role !== "admin") return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  try {
    const raw = await fs.readFile(DATA_FILE, "utf-8");
    const all = JSON.parse(raw);
    // 크리에이터에게는 승인된 의뢰만 노출
    const visible = all.filter((r: { status: string }) =>
      ["approved", "in_progress", "completed"].includes(r.status)
    );
    return NextResponse.json(visible);
  } catch {
    return NextResponse.json([]);
  }
}
