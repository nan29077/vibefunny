import { requireRole } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";

export default function SettingsNotificationsPage() {
  requireRole("advertiser");

  return (
    <div className="space-y-6">
      <PageHeader title="알림 설정" description="알림 수신 방법을 설정하세요." />

      <Card>
        <p className="text-sm text-gray-500">
          알림 설정 기능은 준비 중입니다.
        </p>
      </Card>
    </div>
  );
}
