"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import type { CampaignDirectMessage } from "@/lib/schema";

interface Props {
  participationId: string;
  campaignId: string;
  creatorId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: "advertiser" | "admin" | "creator";
  initialMessages: CampaignDirectMessage[];
}

function formatTime(isoString: string) {
  const d = new Date(isoString);
  return d.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DirectMessageThread({
  participationId,
  campaignId,
  creatorId,
  currentUserName,
  currentUserRole,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<CampaignDirectMessage[]>(initialMessages);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await fetch("/api/campaigns/direct-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          participation_id: participationId,
          creator_id: creatorId,
          from_role: currentUserRole,
          from_name: currentUserName,
          content: trimmed,
        }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        setText("");
      } else {
        showToast("메시지 전송에 실패했습니다.");
      }
    });
  }

  const unreadCount = messages.filter(
    (m) => !m.read && m.from_role !== currentUserRole
  ).length;

  return (
    <div className="flex flex-col">
      {toast && (
        <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      {unreadCount > 0 && (
        <div className="mb-2 flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 border border-amber-200">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
            {unreadCount}
          </span>
          읽지 않은 메시지가 있습니다
        </div>
      )}

      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto px-1 py-2 rounded-xl bg-gray-50 border border-gray-100">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-8">아직 메시지가 없습니다. 첫 메시지를 보내보세요!</p>
        ) : (
          messages.map((m) => {
            const isMine = m.from_role === currentUserRole;
            return (
              <div
                key={m.id}
                className={["flex", isMine ? "justify-end" : "justify-start"].join(" ")}
              >
                <div className={["max-w-[75%]", isMine ? "items-end" : "items-start", "flex flex-col"].join(" ")}>
                  {!isMine && (
                    <span className="text-[10px] text-gray-500 mb-0.5 ml-1">{m.from_name}</span>
                  )}
                  <div
                    className={[
                      "rounded-2xl px-4 py-2 text-sm leading-relaxed",
                      isMine
                        ? "bg-amber-500 text-white rounded-tr-sm"
                        : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm",
                    ].join(" ")}
                  >
                    {m.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                    {formatTime(m.created_at)}
                    {isMine && (
                      <span className="ml-1">{m.read ? "읽음" : "전송됨"}</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="mt-2 flex gap-2">
        <input
          type="text"
          placeholder="메시지를 입력하세요..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          onClick={handleSend}
          disabled={isPending || !text.trim()}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 shrink-0"
        >
          전송
        </button>
      </div>
    </div>
  );
}
