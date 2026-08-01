import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { nanoid } from "nanoid";
import { getCurrentUser } from "@/lib/auth";

// 허용 확장자 화이트리스트
const ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "avi", "jpg", "jpeg", "png", "pdf", "zip"]);
// 파일 크기 제한: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export async function POST(req: NextRequest) {
  // 인증: 로그인 필수
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다" }, { status: 400 });
    }

    // 파일 크기 제한 (100MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "파일 크기는 100MB를 초과할 수 없습니다" }, { status: 400 });
    }

    // 확장자 화이트리스트 검사
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `허용되지 않는 파일 형식입니다. 허용: ${[...ALLOWED_EXTENSIONS].join(", ")}` },
        { status: 400 }
      );
    }

    const filename = `${nanoid()}_${Date.now()}.${ext}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // public/uploads/ 디렉토리가 없으면 생성
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    const filePath = join(uploadDir, filename);
    await writeFile(filePath, buffer);

    return NextResponse.json({ url: `/uploads/${filename}`, filename });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "업로드 실패" }, { status: 500 });
  }
}
