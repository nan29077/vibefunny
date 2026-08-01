import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getCurrentUser } from "@/lib/auth";

const DATA_FILE = path.join(
  process.cwd(),
  "..",
  "AI스토리",
  "data",
  "story_requests.json"
);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // 인증: 로그인 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

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
      item.status = "in_progress";
      // creator_id와 creator_name은 세션에서 가져옴
      item.creator_id = user.id;
      item.creator_name = user.name;
    } else if (body.action === "complete") {
      item.status = "completed";
      item.completed_at = now;
    }

    data[idx] = item;
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
    return NextResponse.json(item);
  } catch {
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
