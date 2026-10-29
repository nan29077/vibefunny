import { NextRequest } from "next/server";
import { handlePrivateUpload } from "@/lib/uploads";

// 캠페인 첨부·배포 영상(광고주), 결과물 제출(크리에이터) 공용 비공개 파일 업로드
export async function POST(req: NextRequest) {
  return handlePrivateUpload(req, ["creator", "advertiser", "admin"]);
}
