// 캠페인 참여 재신청 규칙 (서버·클라이언트 공용 — db 접근 없음)
import type { CampaignParticipation } from "./schema";

/** 이 참여 기록 때문에 같은 유형으로 다시 신청할 수 없는지 (본인 취소만 재신청 허용) */
export function blocksReapply(p: Pick<CampaignParticipation, "status" | "cancelled_by">): boolean {
  if (p.status !== "cancelled") return true;
  return !!p.cancelled_by && p.cancelled_by !== "creator";
}

/** 선발 취소(광고주·관리자 결정)로 끝난 참여인지 — 캠페인 종료(system)는 제외 */
export function cancelledByReviewer(p: Pick<CampaignParticipation, "status" | "cancelled_by">): boolean {
  return p.status === "cancelled" && (p.cancelled_by === "reviewer" || p.cancelled_by === "admin");
}
