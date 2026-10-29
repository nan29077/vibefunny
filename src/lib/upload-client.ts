// 브라우저에서 비공개 파일을 업로드한다 (/api/uploads → /api/files/<id> 주소 반환)
export const CLIENT_MAX_UPLOAD_MB = 25;

export async function uploadPrivateFile(file: File): Promise<{ url: string } | { error: string }> {
  if (file.size > CLIENT_MAX_UPLOAD_MB * 1024 * 1024) {
    return { error: `파일은 ${CLIENT_MAX_UPLOAD_MB}MB 이하여야 합니다. 큰 영상은 URL로 입력하세요.` };
  }
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/uploads", { method: "POST", body });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !data.url) return { error: data.error ?? "업로드에 실패했습니다." };
    return { url: data.url };
  } catch {
    return { error: "업로드에 실패했습니다. 네트워크를 확인하세요." };
  }
}
