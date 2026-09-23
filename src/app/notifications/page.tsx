import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/date";
import { roleHome } from "@/lib/routes";
import { IconBell } from "@/components/icons";
import { markAllNotificationsReadAction, openNotificationAction } from "@/lib/actions/notification-actions";

export const dynamic = "force-dynamic";

export default function NotificationsPage() {
  const user = requireUser();
  const items = (getDb().notifications ?? [])
    .filter((item) => item.recipient_id === user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const unreadCount = items.filter((item) => !item.read_at).length;
  const backHref = user.status === "pending" ? "/payment/activate" : roleHome(user.role);

  return (
    <main className="min-h-screen bg-[#fffaf0] px-4 py-10 text-[#29251d] sm:px-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link href="/" className="text-sm font-black tracking-tight">VIBE<span className="text-[#d39300]">FUNNY</span></Link>
          <Link href={backHref} className="text-sm font-semibold text-[#765b23] hover:underline">마이페이지로 →</Link>
        </div>
        <div className="rounded-3xl border border-[#eadfcb] bg-white p-5 shadow-[0_16px_50px_rgba(90,67,22,.09)] sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#f1e8d9] pb-5">
            <div>
              <div className="flex items-center gap-2"><IconBell size={22} /><h1 className="text-2xl font-black">알림</h1></div>
              <p className="mt-2 text-sm text-[#776d60]">{unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : "읽지 않은 알림이 없습니다."}</p>
            </div>
            {unreadCount > 0 && <form action={markAllNotificationsReadAction}><button type="submit" className="rounded-full border border-[#d9bd78] px-4 py-2 text-sm font-bold text-[#765719] hover:bg-[#fff7df]">모두 읽음</button></form>}
          </div>
          {items.length === 0 ? (
            <div className="py-16 text-center text-sm text-[#8a8175]">아직 도착한 알림이 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <form key={item.id} action={openNotificationAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className={`w-full rounded-2xl border p-4 text-left transition hover:border-[#d7b655] hover:bg-[#fff9e9] ${item.read_at ? "border-[#eee8dc] bg-white" : "border-[#eac867] bg-[#fffbef]"}`}>
                    <span className="flex items-start justify-between gap-3"><strong className="text-sm">{item.title}</strong>{!item.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#df9f00]" aria-label="읽지 않음" />}</span>
                    <span className="mt-1.5 block text-sm leading-relaxed text-[#70675b]">{item.message}</span>
                    <time dateTime={item.created_at} className="mt-2 block text-xs text-[#9a9186]">{formatDate(item.created_at)}</time>
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
