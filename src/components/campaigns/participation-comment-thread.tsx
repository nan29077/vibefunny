"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import type { ParticipationComment } from "@/lib/schema";

interface Props {
  participationId: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: "advertiser" | "creator" | "admin";
  initialComments?: ParticipationComment[];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roleBubbleStyle(role: ParticipationComment["author_role"], isMine: boolean) {
  if (isMine) {
    return role === "advertiser"
      ? "bg-indigo-600 text-white rounded-tr-sm"
      : "bg-amber-500 text-white rounded-tr-sm";
  }
  return role === "advertiser"
    ? "bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-tl-sm"
    : "bg-white text-gray-800 border border-gray-200 rounded-tl-sm shadow-sm";
}

function roleLabel(role: ParticipationComment["author_role"]) {
  if (role === "advertiser") return "광고주";
  if (role === "creator") return "크리에이터";
  return "관리자";
}

export function ParticipationCommentThread({
  participationId,
  currentUserId,
  currentUserName,
  currentUserRole,
  initialComments = [],
}: Props) {
  const [comments, setComments] = useState<ParticipationComment[]>(initialComments);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(initialComments.length > 0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (loaded) return;
    fetch(`/api/campaigns/participation-comments?participation_id=${participationId}`)
      .then((r) => r.json())
      .then((data: ParticipationComment[]) => {
        if (Array.isArray(data)) setComments(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [participationId, loaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await fetch("/api/campaigns/participation-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participation_id: participationId, content: trimmed }),
      });
      if (res.ok) {
        const newComment = await res.json() as ParticipationComment;
        setComments((prev) => [...prev, newComment]);
        setText("");
      } else {
        showToast("댓글 전송에 실패했습니다.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      {toast && (
        <div className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto rounded-xl bg-gray-50 border border-gray-100 p-3">
        {comments.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-4">
            댓글을 남겨 광고주와 소통해보세요.
          </p>
        ) : (
          comments.map((c) => {
            const isMine = c.author_id === currentUserId;
            return (
              <div
                key={c.id}
                className={["flex", isMine ? "justify-end" : "justify-start"].join(" ")}
              >
                <div className={["flex flex-col max-w-[75%]", isMine ? "items-end" : "items-start"].join(" ")}>
                  {!isMine && (
                    <span className="text-[10px] text-gray-500 mb-0.5 ml-1">
                      {roleLabel(c.author_role)} · {c.author_name}
                    </span>
                  )}
                  <div
                    className={[
                      "rounded-2xl px-4 py-2 text-sm leading-relaxed",
                      roleBubbleStyle(c.author_role, isMine),
                    ].join(" ")}
                  >
                    {c.content}
                  </div>
                  <span className="text-[10px] text-gray-400 mt-0.5 px-1">
                    {formatTime(c.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="답글을 입력하세요... (Enter: 전송)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={isPending}
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
