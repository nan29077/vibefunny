import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { genId } from "@/lib/crypto";
import { tx } from "@/lib/db";
import { audit } from "@/lib/services";
import { storage } from "@/lib/storage";

const ALLOWED: Record<string, Set<string>> = {
  mp4: new Set(["video/mp4"]), mov: new Set(["video/quicktime"]),
  jpg: new Set(["image/jpeg"]), jpeg: new Set(["image/jpeg"]), png: new Set(["image/png"]),
  pdf: new Set(["application/pdf"]),
};
const MAX_FILE_SIZE = 25 * 1024 * 1024;

function matchesMagic(buffer: Buffer, ext: string): boolean {
  if (ext === "jpg" || ext === "jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (ext === "png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === "pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (ext === "mp4" || ext === "mov") return buffer.subarray(4, 8).toString("ascii") === "ftyp";
  return false;
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  if (user.role !== "creator") return NextResponse.json({ error: "크리에이터만 업로드할 수 있습니다." }, { status: 403 });
  try {
    const file = (await req.formData()).get("file") as File | null;
    if (!file || file.size <= 0) return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "파일은 25MB 이하여야 합니다." }, { status: 413 });
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED[ext]?.has(file.type)) return NextResponse.json({ error: "확장자와 MIME 형식이 일치하는 영상·이미지·PDF만 업로드할 수 있습니다." }, { status: 400 });

    const id = genId();
    const storageName = `${id}.${ext}`;
    const content = Buffer.from(await file.arrayBuffer());
    if (!matchesMagic(content, ext)) return NextResponse.json({ error: "파일 내용과 확장자가 일치하지 않습니다." }, { status: 400 });
    await storage.save(storageName, content, file.type);
    tx((db) => {
      if (!db.private_files) db.private_files = [];
      db.private_files.push({ id, owner_id: user.id, storage_name: storageName, original_name: file.name.slice(0, 255), mime_type: file.type, size: file.size, created_at: new Date().toISOString() });
      audit(db, { actorId: user.id, action: "upload_private_file", targetTable: "private_files", targetId: id });
    });
    return NextResponse.json({ url: `/api/files/${id}`, filename: file.name });
  } catch (error) {
    console.error("Private upload error", error);
    return NextResponse.json({ error: "업로드에 실패했습니다." }, { status: 500 });
  }
}
