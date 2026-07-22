import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(
  process.cwd(),
  "..",
  "AI스토리",
  "data",
  "story_requests.json"
);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
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
      item.creator_id = body.creator_id ?? "vf-creator";
      item.creator_name = body.creator_name ?? "크리에이터";
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
