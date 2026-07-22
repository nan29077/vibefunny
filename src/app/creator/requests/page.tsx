import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { CreatorRequestsUI } from "@/components/requests/creator-requests-ui";

export const dynamic = "force-dynamic";

export default function CreatorRequestsPage() {
  const user = requireRole("creator");
  const db = getDb();

  const openRequests = db.custom_video_requests.filter(
    (r) =>
      r.status === "open" &&
      (r.is_public || r.designated_creator_id === user.id) &&
      !db.custom_video_applications.some((a) => a.request_id === r.id && a.creator_id === user.id)
  );

  const myWork = db.custom_video_requests.filter((r) => r.assigned_creator_id === user.id);
  const myApplied = db.custom_video_applications.filter((a) => a.creator_id === user.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="영상의뢰"
        description="공개 의뢰에 참여하고, 내 작업 결과물을 제출하세요."
      />
      <CreatorRequestsUI
        openRequests={openRequests}
        myWork={myWork}
        myApplied={myApplied}
        userId={user.id}
      />
    </div>
  );
}
