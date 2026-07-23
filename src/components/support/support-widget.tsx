"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { IconMessageSquare, IconSend, IconX } from "@/components/icons";
import { getSupportBotReply, SUPPORT_FAQS } from "@/lib/support";
import type { SupportAvailability } from "@/lib/support-hours";

type Message = {
  id: string;
  sender: "user" | "admin" | "bot";
  content: string;
  created_at: string;
};

const greeting: Message = {
  id: "welcome",
  sender: "bot",
  content: "안녕하세요! 바이브퍼니 문의 도우미예요. 자주 묻는 질문을 선택하거나 궁금한 내용을 남겨 주세요.",
  created_at: new Date(0).toISOString(),
};

export function SupportWidget({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [availability, setAvailability] = useState<SupportAvailability | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const supportOpen = availability?.isOpen === true;

  const loadAvailability = async () => {
    const response = await fetch("/api/support?availability=1", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setAvailability(data.availability ?? null);
  };

  const loadMessages = async () => {
    if (!isAuthenticated) return;
    const response = await fetch("/api/support", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setAvailability(data.availability ?? null);
    setMessages(data.messages?.length ? [greeting, ...data.messages] : [greeting]);
  };

  useEffect(() => {
    if (!open) return;
    void loadAvailability();
    const timer = window.setInterval(() => void loadAvailability(), 60_000);
    return () => window.clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 5000);
    return () => window.clearInterval(timer);
  }, [open, isAuthenticated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = async (content: string) => {
    const value = content.trim();
    if (!value || sending || !supportOpen) return;
    setInput("");
    if (!isAuthenticated) {
      const createdAt = new Date().toISOString();
      setMessages((current) => [
        ...current,
        { id: `guest-${Date.now()}`, sender: "user", content: value, created_at: createdAt },
        { id: `guest-bot-${Date.now()}`, sender: "bot", content: getSupportBotReply(value), created_at: createdAt },
      ]);
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: value }),
      });
      if (response.ok) {
        await loadMessages();
      } else {
        const data = await response.json().catch(() => ({}));
        if (data.availability) setAvailability(data.availability);
        if (data.error) {
          setMessages((current) => [...current, {
            id: `support-error-${Date.now()}`,
            sender: "bot",
            content: String(data.error),
            created_at: new Date().toISOString(),
          }]);
        }
      }
    } finally {
      setSending(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  return (
    <div className={`vf-support ${open ? "is-open" : ""}`}>
      {open && (
        <section className="vf-support-panel" aria-label="회원 문의 채팅">
          <div className="vf-support-head">
            <div>
              <strong>바이브퍼니 문의</strong>
              <span><i /> 상담 챗봇 · 관리자 연결</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="문의창 닫기"><IconX size={20} /></button>
          </div>
          <div className="vf-support-quick" aria-label="자주 묻는 질문">
            {SUPPORT_FAQS.slice(0, 4).map((faq) => (
              <button key={faq.question} type="button" disabled={!supportOpen} onClick={() => void send(faq.question)}>{faq.question}</button>
            ))}
          </div>
          <div className={`vf-support-hours ${supportOpen ? "is-open" : "is-closed"}`}>
            {availability ? (
              supportOpen
                ? `문의 가능 · ${availability.label}`
                : availability.closedMessage
            ) : "문의 가능 시간을 확인하고 있습니다."
            }
          </div>
          <div ref={scrollRef} className="vf-support-messages">
            {messages.map((message) => (
              <div key={message.id} className={`vf-support-message is-${message.sender}`}>
                {message.sender !== "user" && <span className="vf-support-speaker">{message.sender === "admin" ? "관리자" : "BEE BOT"}</span>}
                <p>{message.content}</p>
              </div>
            ))}
            {!isAuthenticated && (
              <p className="vf-support-login-note">관리자 답변을 받으려면 <Link href="/login">로그인</Link>해 주세요.</p>
            )}
          </div>
          <form onSubmit={submit} className="vf-support-form">
            <input value={input} onChange={(event) => setInput(event.target.value)} maxLength={1000} disabled={!supportOpen} placeholder={supportOpen ? "문의 내용을 입력해 주세요" : "문의 가능 시간에 이용해 주세요"} aria-label="문의 내용" />
            <button type="submit" disabled={sending || !input.trim() || !supportOpen} aria-label="문의 보내기"><IconSend size={19} /></button>
          </form>
        </section>
      )}
      <button type="button" className="vf-support-launcher" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="문의하기">
        {open ? <IconX size={23} /> : <IconMessageSquare size={23} />}
        <span>문의하기</span>
      </button>
    </div>
  );
}
