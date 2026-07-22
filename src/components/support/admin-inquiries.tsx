"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { IconMessageSquare, IconSend } from "@/components/icons";

type Thread = {
  id: string;
  status: "open" | "waiting" | "resolved";
  updated_at: string;
  last_message: string;
  message_count: number;
  member: { id: string; name: string; email: string; role: string; avatar_url: string | null } | null;
};

type Message = {
  id: string;
  sender: "user" | "admin" | "bot";
  content: string;
  created_at: string;
};

const statusLabel = { open: "답변 중", waiting: "답변 대기", resolved: "답변 완료" } as const;

export function AdminInquiries() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async (threadId?: string | null) => {
    const query = threadId ? `?thread_id=${encodeURIComponent(threadId)}` : "";
    const response = await fetch(`/api/support${query}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setThreads(data.threads ?? []);
    setSelectedId(data.selected_thread_id ?? null);
    setMessages(data.messages ?? []);
  };

  useEffect(() => {
    void load(selectedId);
    const timer = window.setInterval(() => void load(selectedId), 5000);
    return () => window.clearInterval(timer);
  }, [selectedId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const selectThread = (threadId: string) => {
    setSelectedId(threadId);
    void load(threadId);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedId || !input.trim() || sending) return;
    setSending(true);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: selectedId, content: input.trim() }),
      });
      if (response.ok) {
        setInput("");
        await load(selectedId);
      }
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: Thread["status"]) => {
    if (!selectedId) return;
    await fetch("/api/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: selectedId, status }),
    });
    await load(selectedId);
  };

  const selected = threads.find((thread) => thread.id === selectedId) ?? null;

  if (threads.length === 0) {
    return <div className="grid min-h-[420px] place-items-center rounded-2xl border border-amber-200 bg-white text-center"><div><IconMessageSquare size={34} className="mx-auto text-amber-500" /><p className="mt-3 font-bold text-gray-800">접수된 회원 문의가 없습니다</p><p className="mt-1 text-sm text-gray-400">새 문의가 등록되면 이곳에 표시됩니다.</p></div></div>;
  }

  return (
    <div className="grid min-h-[650px] overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm lg:grid-cols-[310px_1fr]">
      <aside className="border-b border-amber-100 bg-amber-50/40 lg:border-b-0 lg:border-r">
        <div className="border-b border-amber-100 p-4"><strong className="text-gray-900">회원별 문의</strong><p className="mt-1 text-xs text-gray-500">총 {threads.length}개의 대화</p></div>
        <div className="max-h-[580px] overflow-y-auto">
          {threads.map((thread) => (
            <button key={thread.id} type="button" onClick={() => selectThread(thread.id)} className={`flex w-full gap-3 border-b border-amber-100/70 p-4 text-left transition ${selectedId === thread.id ? "bg-[#fff0ad]" : "hover:bg-white"}`}>
              {thread.member?.avatar_url ? <img src={thread.member.avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full border border-amber-200 object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-200">🐝</span>}
              <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><b className="truncate text-sm text-gray-900">{thread.member?.name ?? "탈퇴 회원"}</b><em className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] not-italic font-bold ${thread.status === "waiting" ? "bg-red-100 text-red-600" : thread.status === "resolved" ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}>{statusLabel[thread.status]}</em></span><span className="mt-1 block truncate text-xs text-gray-500">{thread.last_message}</span><span className="mt-1 block text-[10px] text-gray-400">{thread.member?.email}</span></span>
            </button>
          ))}
        </div>
      </aside>
      <section className="flex min-h-[560px] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 px-5 py-4">
          <div><strong className="text-gray-900">{selected?.member?.name ?? "회원 문의"}</strong><p className="text-xs text-gray-400">{selected?.member?.email}</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => void updateStatus("open")} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-bold text-amber-800">답변 중</button><button type="button" onClick={() => void updateStatus("resolved")} className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-bold text-white">답변 완료</button></div>
        </header>
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-[#fffdf6] p-5">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === "admin" ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.sender === "admin" ? "rounded-br-md bg-[#ffc928] text-gray-950" : message.sender === "bot" ? "rounded-bl-md border border-amber-200 bg-amber-50 text-gray-700" : "rounded-bl-md bg-white text-gray-700 shadow-sm"}`}><span className="mb-1 block text-[10px] font-black text-amber-700">{message.sender === "admin" ? "관리자" : message.sender === "bot" ? "BEE BOT" : selected?.member?.name}</span>{message.content}</div></div>
          ))}
        </div>
        <form onSubmit={submit} className="flex gap-2 border-t border-amber-100 p-4"><input value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000} placeholder="회원에게 답변을 입력하세요" className="min-w-0 flex-1 rounded-xl border border-amber-200 px-4 py-3 text-sm outline-none focus:border-amber-400" /><button type="submit" disabled={sending || !input.trim()} className="grid h-11 w-11 place-items-center rounded-xl bg-[#ffc928] text-gray-950 disabled:opacity-40" aria-label="답변 보내기"><IconSend size={19} /></button></form>
      </section>
    </div>
  );
}
