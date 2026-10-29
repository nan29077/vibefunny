import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { CreatorRequestsUI } from "@/components/requests/creator-requests-ui";
import { VibeOnlyNotice } from "@/components/membership/vibe-only-notice";
import { isVibeMember } from "@/lib/membership";

export const dynamic = "force-dynamic";

export default function CreatorRequestsPage() {
  const user = requireRole("creator");
  const db = getDb();

  // 모집 중인 의뢰 (본인이 낸 의뢰 제외). 이미 신청한 의뢰도 "신청 완료" 상태로 함께 보여 준다.
  const openRequests = db.custom_video_requests.filter(
    (r) =>
      r.status === "open" &&
      r.buyer_id !== user.id &&
      (r.is_public || r.designated_creator_id === user.id)
  );

  const myWork = db.custom_video_requests.filter((r) => r.assigned_creator_id === user.id);
  const myApplied = db.custom_video_applications.filter((a) => a.creator_id === user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="영상의뢰"
        description="공개 의뢰에 참여하고, 내 작업 결과물을 제출하세요."
      />
      {!isVibeMember(db, user) && (
        <VibeOnlyNotice feature="영상 제작 의뢰 참여" signupFee={db.settings.fees.creator.signup_fee_amount} compact />
      )}
      <CreatorRequestsUI
        openRequests={openRequests}
        myWork={myWork}
        myApplied={myApplied}
        userId={user.id}
        canAct={isVibeMember(db, user)}
      />
    </div>
  );
}
