import { NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { storage } from "@/lib/storage";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

/** 로컬 저장소의 실제 파일 경로 (저장 폴더 밖으로 나가는 경로는 거절) */
function localPath(storageName: string): string | null {
  if (config.storage.type === "s3") return null;
  const base = path.resolve(process.cwd(), "data", "private-uploads");
  const target = path.resolve(base, storageName);
  const rel = path.relative(base, target);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return target;
}

/** 파일의 일부(또는 전체)만 흘려보낸다 — 큰 영상을 통째로 메모리에 읽지 않는다 */
function fileStream(file: string, start: number, end: number): BodyInit {
  const node = createReadStream(file, { start, end });
  return Readable.toWeb(node) as unknown as BodyInit;
}

// AI 숏츠 결과물(이미지·음성·영상) 보기/내려받기 — 본인 또는 관리자만. 영상 탐색(Range) 지원.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const db = getDb();
  const file = (db.private_files ?? []).find((f) => f.id === params.id && f.source === "ai_shorts");
  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
  if (file.owner_id !== user.id && user.role !== "admin") return NextResponse.json({ error: "파일 접근 권한이 없습니다." }, { status: 403 });

  // 로컬 파일이면 크기만 확인하고 필요한 구간만 스트리밍, 아니면(외부 저장소) 내용을 받아서 잘라 보낸다
  const disk = localPath(file.storage_name);
  let size: number;
  let buf: Buffer | null = null;
  try {
    if (disk) {
      const st = await stat(disk);
      if (!st.isFile()) throw new Error("not a file");
      size = st.size;
    } else {
      buf = await storage.get(file.storage_name);
      size = buf.length;
    }
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
  const body = (start: number, end: number): BodyInit =>
    disk ? fileStream(disk, start, end) : (new Uint8Array(buf!.subarray(start, end + 1)) as BodyInit);

  const range = req.headers.get("range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null;
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(size - 1, end);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) {
      return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new NextResponse(body(start, end), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  if (size === 0) return new NextResponse(null, { headers: { ...headers, "Content-Length": "0" } });
  return new NextResponse(body(0, size - 1), { headers: { ...headers, "Content-Length": String(size) } });
}
