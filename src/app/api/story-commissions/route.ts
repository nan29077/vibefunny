import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// AI스토리 프로젝트의 data/story_requests.json을 공유 파일로 사용
const DATA_FILE = path.join(
  process.cwd(),
  "..",
  "AI스토리",
  "data",
  "story_requests.json"
);

export async function GET() {
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
