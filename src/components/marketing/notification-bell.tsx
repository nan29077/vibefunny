"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconBell } from "@/components/icons";
import { formatDate } from "@/lib/date";
import { markAllNotificationsReadAction, openNotificationAction } from "@/lib/actions/notification-actions";

export type NotificationPreview = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

type NotificationResponse = {
  unreadCount: number;
  items: NotificationPreview[];
};

export function NotificationBell({
  authenticated,
  initialUnreadCount,
  initialItems,
}: {
  authenticated: boolean;
  initialUnreadCount: number;
  initialItems: NotificationPreview[];
}) {
  const [open, setOpen] = useState(false);
  const [sessionActive, setSessionActive] = useState(authenticated);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [items, setItems] = useState(initialItems);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    if (!authenticated) return;
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (response.status === 401) {
        setSessionActive(false);
        setUnreadCount(0);
        setItems([]);
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as NotificationResponse;
      setSessionActive(true);
      setUnreadCount(data.unreadCount);
      setItems(data.items);
    } catch {
      // The server-rendered list remains available during a temporary connection failure.
    }
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [authenticated, refresh]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return (
    <div className="vf-notification" ref={rootRef}>
      <button
        type="button"
        className="vf-notification-trigger"
        aria-label={unreadCount > 0 ? `알림 ${unreadCount}개 미확인` : "알림"}
        aria-expanded={open}
        aria-controls="vf-notification-panel"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void refresh();
        }}
      >
        <IconBell size={19} />
        {sessionActive && unreadCount > 0 && (
          <span className="vf-notification-count" aria-hidden>{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>
      {open && (
        <div id="vf-notification-panel" className="vf-notification-panel" role="dialog" aria-label="알림 목록">
          <div className="vf-notification-heading">
            <div>
              <strong>알림</strong>
              {sessionActive && <span>{unreadCount > 0 ? `새 알림 ${unreadCount}개` : "새 알림 없음"}</span>}
            </div>
            {sessionActive && unreadCount > 0 && (
              <form action={markAllNotificationsReadAction} onSubmit={() => {
                setUnreadCount(0);
                setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
              }}>
                <button type="submit">모두 읽음</button>
              </form>
            )}
          </div>
          {!sessionActive ? (
            <div className="vf-notification-empty">
              <p>로그인하면 내 알림을 확인할 수 있어요.</p>
              <Link href="/login" onClick={() => setOpen(false)}>로그인하기</Link>
            </div>
          ) : items.length === 0 ? (
            <div className="vf-notification-empty"><p>아직 도착한 알림이 없습니다.</p></div>
          ) : (
            <div className="vf-notification-list">
              {items.map((item) => (
                <form key={item.id} action={openNotificationAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" className={`vf-notification-item ${item.read_at ? "" : "is-unread"}`}>
                    <span className="vf-notification-item-title">{item.title}</span>
                    <span className="vf-notification-item-message">{item.message}</span>
                    <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                  </button>
                </form>
              ))}
            </div>
          )}
          {sessionActive && <Link href="/notifications" className="vf-notification-all" onClick={() => setOpen(false)}>전체 알림 보기 →</Link>}
        </div>
      )}
    </div>
  );
}
