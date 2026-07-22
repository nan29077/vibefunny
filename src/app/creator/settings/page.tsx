import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/date";
import { PageHeader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/schema";
import { CreatorSettingsForms } from "@/components/creator-settings-forms";

export const dynamic = "force-dynamic";

export default function CreatorSettingsPage() {
  const user = requireRole("creator");
  return (
    <div className="space-y-6">
      <PageHeader title="설정" description="닉네임, 비밀번호 등 계정 설정을 관리합니다." />
      <CreatorSettingsForms
        name={user.name}
        email={user.email}
        nickname={user.nickname ?? ""}
        roleLabel={ROLE_LABELS.creator}
        referralCode={user.referral_code}
        phone={user.phone}
        joinedAt={formatDate(user.created_at)}
      />
    </div>
  );
}
