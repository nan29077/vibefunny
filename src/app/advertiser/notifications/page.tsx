import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/date";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/notification-actions";

export const dynamic = "force-dynamic";

export default function AdvertiserNotificationsPage() {
  const user = requireRole("advertiser");
  const notifications = (getDb().notifications ?? []).filter((item) => item.recipient_id === user.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  return <div className="space-y-5"><PageHeader title="알림" description="캠페인 참여, 제출, 취소와 메시지를 확인합니다." />
    {notifications.some((item) => !item.read_at) && <form action={markAllNotificationsReadAction}><button className="rounded-lg border px-3 py-2 text-sm font-semibold">모두 읽음</button></form>}
    {notifications.length === 0 ? <EmptyState title="알림이 없습니다" /> : <div className="space-y-3">{notifications.map((item) => <Card key={item.id} className={!item.read_at ? "border-brand-purple" : ""}>
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-bold">{item.title}</h2><p className="mt-1 text-sm text-gray-600">{item.message}</p><p className="mt-2 text-xs text-gray-400">{formatDate(item.created_at)}</p></div>{!item.read_at && <form action={markNotificationReadAction}><input type="hidden" name="id" value={item.id}/><button className="text-xs font-semibold text-brand-purple">읽음</button></form>}</div>
      {item.link && <Link href={item.link} className="mt-3 inline-block text-sm font-semibold text-brand-purple">바로가기</Link>}
    </Card>)}</div>}
  </div>;
}
