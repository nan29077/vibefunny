import type { Role } from "./schema";

// 역할별 홈 경로 (서버/클라이언트 공용 순수 함수)
export function roleHome(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "creator":
      return "/creator";
    case "advertiser":
      return "/advertiser";
  }
}
