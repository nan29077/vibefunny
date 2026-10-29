// ===========================================================================
// URL 안전성 유틸 (서버/클라이언트 공용, 순수 함수)
// - 사용자 입력 URL은 http(s) 만 저장 허용 (javascript:, data:text/html 등 차단)
// - 렌더링 시에도 safeHref() 로 한 번 더 방어 (기존 저장 데이터 대비)
// ===========================================================================

/** 절대 URL 이며 http/https 스킴인지 */
export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/** 사이트 내부 상대경로("/..." 이면서 "//" 프로토콜 상대 URL 아님) */
export function isInternalPath(value: string | null | undefined): boolean {
  if (!value) return false;
  // 브라우저는 주소의 탭·줄바꿈을 지우고 역슬래시를 슬래시로 바꾸므로("/\t/evil.com" → "//evil.com")
  // 제어문자·공백·역슬래시가 들어 있으면 내부 경로로 인정하지 않는다
  if (/[\x00-\x20\x7f\\]/.test(value)) return false;
  return value.startsWith("/") && !value.startsWith("//");
}

const SAFE_DATA_URL = /^data:(image\/(png|jpe?g|gif|webp|bmp|avif|heic|heif)|video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|application\/pdf)[;,]/i;

/** 링크(href)/미디어(src)로 렌더해도 안전한 값인지 */
export function isSafeHref(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  if (v.startsWith("#")) return true;
  if (isInternalPath(v)) return true;
  if (SAFE_DATA_URL.test(v)) return true;
  return isHttpUrl(v);
}

/** 안전하지 않은 URL 은 "#" 으로 치환 */
export function safeHref(value: string | null | undefined): string {
  return value && isSafeHref(value) ? value.trim() : "#";
}

/** 사용자 입력 URL 정규화: 빈 값은 null, http(s) 가 아니면 false(검증 실패) */
export function normalizeUserUrl(value: string | null | undefined): string | null | false {
  const v = (value ?? "").trim();
  if (!v) return null;
  return isHttpUrl(v) ? v : false;
}
