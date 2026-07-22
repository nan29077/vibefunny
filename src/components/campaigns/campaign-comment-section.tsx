"use client";

import { useState, useTransition } from "react";
import type { CampaignComment } from "@/lib/schema";
import { formatShortDateTime } from "@/lib/date";

interface Props {
  campaignId: string;
  initialComments: CampaignComment[];
  authorId: string;
  authorName: string;
  authorRole: "admin" | "creator" | "advertiser";
}

export function CampaignCommentSection({
  campaignId,
  initialComments,
  authorId,
  authorName,
  authorRole,
}: Props) {
  const [comments, setComments] = useState<CampaignComment[]>(initialComments);
  const [text, setText] = useState("");
  const [isPending, startTransition] = useTransition();

  const roleLabel: Record<string, string> = {
    admin: "관리자",
    creator: "크리에이터",
    advertiser: "광고주",
  };

  const roleColor: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    creator: "bg-blue-100 text-blue-700",
    advertiser: "bg-amber-100 text-amber-700",
  };

  function handleSend() {
    if (!text.trim()) return;
    startTransition(async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_id: authorId,
          author_name: authorName,
          author_role: authorRole,
          content: text,
        }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [...prev, newComment]);
        setText("");
      }
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">
          캠페인 채팅 ({comments.length})
        </h4>
      </div>

      {/* Comment list */}
      {comments.length > 0 ? (
        <div className="space-y-2 max-h-60 overflow-y-auto rounded-xl bg-gray-50 p-3">
          {comments.map((cm) => {
            const isMe = cm.author_id === authorId;
            return (
              <div
                key={cm.id}
                className={[
                  "flex gap-2",
                  isMe ? "flex-row-reverse" : "flex-row",
                ].join(" ")}
              >
                <div
                  className={[
                    "h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold",
                    roleColor[cm.author_role] ?? "bg-gray-200 text-gray-600",
                  ].join(" ")}
                >
                  {cm.author_name.charAt(0)}
                </div>
                <div className={["flex-1", isMe ? "items-end" : "items-start", "flex flex-col gap-0.5"].join(" ")}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-gray-800">{cm.author_name}</span>
                    <span
                      className={[
                        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        roleColor[cm.author_role] ?? "",
                      ].join(" ")}
                    >
                      {roleLabel[cm.author_role] ?? cm.author_role}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {formatShortDateTime(cm.created_at)}
                    </span>
                  </div>
                  <div
                    className={[
                      "rounded-xl px-3 py-2 text-sm",
                      isMe
                        ? "bg-amber-500 text-white"
                        : "bg-white border border-gray-200 text-gray-800",
                    ].join(" ")}
                  >
                    {cm.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
          아직 댓글이 없습니다. 첫 댓글을 남겨보세요!
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="댓글을 입력하세요..."
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          onClick={handleSend}
          disabled={isPending || !text.trim()}
          className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          전송
        </button>
      </div>
    </div>
  );
}
