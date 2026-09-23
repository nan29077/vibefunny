import { requireRole } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { NotificationPrefsForm } from "@/components/settings/notification-prefs-form";

export const dynamic = "force-dynamic";

export default function SettingsNotificationsPage() {
  const user = requireRole("advertiser");

  return (
    <div className="space-y-6">
      <PageHeader title="알림 설정" description="받고 싶은 알림 종류를 선택하세요. (사이트 내 알림 기준)" />
      <Card>
        <NotificationPrefsForm prefs={user.notification_prefs ?? {}} />
      </Card>
    </div>
  );
}
