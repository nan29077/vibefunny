"use client";

import { useState, useTransition } from "react";
import type { CampaignComment } from "@/lib/schema";
import { formatShortDateTime } from "@/lib/date";

interface Props {
  campaignId: string;
  initialComments: CampaignComment[];
  authorId: string;
  authorName: string;
}

export function AdminCampaignComments({ campaignId, initialComments, authorId, authorName }: Props) {
  const [open, setOpen] = useState(false);
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
          author_role: "admin",
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
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900"
      >
        <span>캠페인 채팅</span>
        {comments.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {comments.length}
          </span>
        )}
        <span className="text-gray-400 text-xs">{open ? "접기" : "펼치기"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {comments.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl bg-gray-50 p-3">
              {comments.map((cm) => (
                <div key={cm.id} className="flex gap-2">
                  <div className={["h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-xs font-bold", roleColor[cm.author_role] ?? "bg-gray-200"].join(" ")}>
                    {cm.author_name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-semibold text-gray-800">{cm.author_name}</span>
                      <span className={["inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold", roleColor[cm.author_role] ?? ""].join(" ")}>
                        {roleLabel[cm.author_role] ?? cm.author_role}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {formatShortDateTime(cm.created_at)}
                      </span>
                    </div>
                    <div className="rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-800">
                      {cm.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400">
              아직 댓글이 없습니다.
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="관리자 댓글 입력..."
              className="flex-1 rounded-xl border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-purple/30"
            />
            <button
              onClick={handleSend}
              disabled={isPending || !text.trim()}
              className="rounded-xl bg-gradient-to-r from-brand-purple to-brand-pink px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              전송
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
