// ===========================================================================
// 비공개 파일 업로드 공통 처리
// - 캠페인 첨부·배포 영상(광고주), 결과물 제출·제작 의뢰 납품(크리에이터)에서 함께 사용
// - 파일은 storage(로컬/S3)에 저장하고 DB에는 /api/files/<id> 주소만 남긴다 (Base64 DB 저장 금지)
// - 본문을 끝까지 메모리에 올리기 전에 크기를 확인한다 (Content-Length 누락·위조 대비)
// ===========================================================================
import { NextRequest, NextResponse } from "next/server";
import { authorizeApi } from "./auth";
import { genId } from "./crypto";
import { getDb, tx } from "./db";
import { rateLimit } from "./rate-limit";
import { audit } from "./services";
import { storage } from "./storage";
import type { Database, Role } from "./schema";
import { vibeOnlyError } from "./membership";

const ALLOWED: Record<string, Set<string>> = {
  mp4: new Set(["video/mp4"]), mov: new Set(["video/quicktime"]),
  jpg: new Set(["image/jpeg"]), jpeg: new Set(["image/jpeg"]), png: new Set(["image/png"]),
  webp: new Set(["image/webp"]),
  pdf: new Set(["application/pdf"]),
};
export const MAX_UPLOAD_SIZE = 25 * 1024 * 1024;
/** multipart 헤더 등 본문 여유분 */
const BODY_OVERHEAD = 1024 * 1024;
const USER_UPLOAD_QUOTA = 2 * 1024 * 1024 * 1024; // 회원당 직접 업로드 총량 2GB
const USER_UPLOADS_PER_HOUR = 30;

/** 업로드된 비공개 파일 주소 형식 */
export const PRIVATE_FILE_URL = /^\/api\/files\/([A-Za-z0-9_-]{6,64})$/;

function matchesMagic(buffer: Buffer, ext: string): boolean {
  if (ext === "jpg" || ext === "jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (ext === "png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === "webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (ext === "pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (ext === "mp4" || ext === "mov") return buffer.subarray(4, 8).toString("ascii") === "ftyp";
  return false;
}

/** 요청 본문을 읽으면서 상한을 넘으면 즉시 중단한다 (chunked 전송으로 크기 검사를 우회하는 것 방지) */
async function readBodyLimited(req: NextRequest, limit: number): Promise<Buffer | null> {
  if (!req.body) return Buffer.alloc(0);
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      try { await reader.cancel(); } catch { /* ignore */ }
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** 비공개 파일 업로드 API 처리 — 허용 역할만, 활성 계정만 */
export async function handlePrivateUpload(req: NextRequest, roles: Role[]): Promise<NextResponse> {
  const auth = authorizeApi(...roles);
  if (!auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;
  // 크리에이터의 작업물 업로드는 바이브회원만 (일반회원은 제출할 작업이 없음)
  const vibeBlock = vibeOnlyError(getDb(), user);
  if (vibeBlock) return NextResponse.json({ error: vibeBlock }, { status: 403 });
  const tooLarge = () => NextResponse.json({ error: "파일은 25MB 이하여야 합니다." }, { status: 413 });
  // 선언된 크기로 먼저 거르고, 실제 본문도 읽으면서 상한을 확인한다
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_UPLOAD_SIZE + BODY_OVERHEAD) return tooLarge();
  if (rateLimit(`upload:${user.id}`, USER_UPLOADS_PER_HOUR, 60 * 60 * 1000) > 0) {
    return NextResponse.json({ error: "업로드가 너무 잦습니다. 잠시 후 다시 시도하세요." }, { status: 429 });
  }
  const used = (getDb().private_files ?? [])
    .filter((item) => item.owner_id === user.id && item.source !== "ai_shorts")
    .reduce((sum, item) => sum + (item.size || 0), 0);
  if (used >= USER_UPLOAD_QUOTA) {
    return NextResponse.json({ error: "업로드 가능한 저장 용량(2GB)을 모두 사용했습니다. 관리자에게 문의하세요." }, { status: 413 });
  }
  try {
    const raw = await readBodyLimited(req, MAX_UPLOAD_SIZE + BODY_OVERHEAD);
    if (!raw) return tooLarge();
    const form = await new Request("http://local/upload", {
      method: "POST",
      headers: { "content-type": req.headers.get("content-type") ?? "" },
      body: new Uint8Array(raw),
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ error: "파일이 필요합니다." }, { status: 400 });
    if (file.size > MAX_UPLOAD_SIZE) return tooLarge();
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED[ext]?.has(file.type)) {
      return NextResponse.json({ error: "mp4·mov 영상, jpg·png·webp 이미지, PDF만 업로드할 수 있습니다." }, { status: 400 });
    }
    const id = genId();
    const storageName = `${id}.${ext}`;
    const content = Buffer.from(await file.arrayBuffer());
    if (!matchesMagic(content, ext)) return NextResponse.json({ error: "파일 내용과 확장자가 일치하지 않습니다." }, { status: 400 });
    await storage.save(storageName, content, file.type);
    tx((db) => {
      if (!db.private_files) db.private_files = [];
      db.private_files.push({ id, owner_id: user.id, storage_name: storageName, original_name: file.name.slice(0, 255), mime_type: file.type, size: file.size, source: "upload", created_at: new Date().toISOString() });
      audit(db, { actorId: user.id, action: "upload_private_file", targetTable: "private_files", targetId: id });
    });
    return NextResponse.json({ url: `/api/files/${id}`, filename: file.name, type: file.type });
  } catch (error) {
    console.error("Private upload error", error);
    return NextResponse.json({ error: "업로드에 실패했습니다." }, { status: 500 });
  }
}

/**
 * 폼으로 받은 첨부 값 검사: 비어 있거나, 본인이 업로드한 /api/files/<id> 주소만 허용.
 * (Base64 data: URL 이나 남의 파일 주소는 거부)
 * @returns 저장할 값(null=첨부 없음) 또는 false(거부)
 */
export function ownedPrivateFileUrl(db: Database, ownerId: string, value: string | null | undefined): string | null | false {
  const v = (value ?? "").trim();
  if (!v) return null;
  const m = PRIVATE_FILE_URL.exec(v);
  if (!m) return false;
  const file = (db.private_files ?? []).find((f) => f.id === m[1]);
  if (!file || file.owner_id !== ownerId) return false;
  return v;
}
