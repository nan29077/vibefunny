import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/date";
import { PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/schema";
import { CreatorSettingsForms } from "@/components/creator-settings-forms";
import { getDb } from "@/lib/db";
import { canBeMentor, memberGradeLabel } from "@/lib/membership";

export const dynamic = "force-dynamic";

export default function CreatorSettingsPage() {
  const user = requireRole("creator");
  const db = getDb();
  // 바이브회원이 아니면 추천 코드를 공유해도 가입에 쓸 수 없으므로 코드 대신 안내를 보여 준다
  const referralCode = canBeMentor(db, user) ? user.referral_code : null;
  return (
    <div className="space-y-6">
      <PageHeader title="설정" description="닉네임, 비밀번호 등 계정 설정을 관리합니다." />
      <CreatorSettingsForms
        name={user.name}
        email={user.email}
        nickname={user.nickname ?? ""}
        roleLabel={`${ROLE_LABELS.creator} · ${memberGradeLabel(db, user) ?? ""}`}
        referralCode={referralCode}
        phone={user.phone}
        joinedAt={formatDate(user.created_at)}
        creatorGender={user.creator_gender ?? ""}
        creatorAgeGroup={user.creator_age_group ?? ""}
      />
    </div>
  );
}
