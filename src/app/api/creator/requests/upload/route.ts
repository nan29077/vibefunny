import { NextRequest } from "next/server";
import { handlePrivateUpload } from "@/lib/uploads";

// 제작 의뢰 결과물 업로드 (크리에이터 전용)
export async function POST(req: NextRequest) {
  return handlePrivateUpload(req, ["creator"]);
}
