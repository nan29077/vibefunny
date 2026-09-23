import { NextResponse, type NextRequest } from "next/server";

// ===========================================================================
// 1차 방어선: 회원 전용 영역(/admin, /creator, /advertiser)은 세션 쿠키가 없으면
// 페이지·RSC 요청 모두 로그인으로 보낸다.
// - Edge 런타임에서는 DB(역할) 조회가 불가하므로 여기서는 "로그인 여부"만 확인하고,
//   역할/상태 검증은 각 page.tsx 의 requireRole()/requireAdmin() 이 담당한다.
// - App Router는 RSC 요청 시 layout 을 건너뛸 수 있으므로 layout 인증에만 의존하지 않는다.
// ===========================================================================

const COOKIE_NAME = "vf_session";

export function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? "";
  // 형식: <userId>.<hex-hmac-sha256>
  const valid = /^[^.\s]+\.[0-9a-f]{64}$/i.test(token);
  if (valid) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*", "/creator/:path*", "/advertiser/:path*"],
};
