import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

// AI 숏츠 결과물(이미지·음성·영상) 보기/내려받기 — 본인 또는 관리자만. 영상 탐색(Range) 지원.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const db = getDb();
  const file = (db.private_files ?? []).find((f) => f.id === params.id && f.source === "ai_shorts");
  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  if (file.owner_id !== user.id && user.role !== "admin") return NextResponse.json({ error: "파일 접근 권한이 없습니다." }, { status: 403 });
  let buf: Buffer;
  try {
    buf = await storage.get(file.storage_name);
  } catch {
    return NextResponse.json({ error: "파일을 읽을 수 없습니다." }, { status: 404 });
  }
  const url = new URL(req.url);
  const disposition = url.searchParams.get("download") === "1"
    ? `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`
    : "inline";
  const headers: Record<string, string> = {
    "Content-Type": file.mime_type,
    "Content-Disposition": disposition,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  const range = req.headers.get("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m && (m[1] || m[2])) {
    const size = buf.length;
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    const chunk = buf.subarray(start, end + 1);
    return new NextResponse(new Uint8Array(chunk) as BodyInit, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(chunk.length) },
    });
  }
  return new NextResponse(new Uint8Array(buf) as BodyInit, { headers: { ...headers, "Content-Length": String(buf.length) } });
}
