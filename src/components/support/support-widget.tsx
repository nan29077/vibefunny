"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { IconMessageSquare, IconSend, IconX } from "@/components/icons";
import { getFaqAnswer, getSupportBotReply, FAQ_CATEGORIES } from "@/lib/support";
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
  content: "안녕하세요! 바이브퍼니 문의 도우미예요. 아래 자주 묻는 질문을 선택하거나 궁금한 내용을 직접 입력해 주세요.",
  created_at: new Date(0).toISOString(),
};

// ─── 2단계 FAQ 탐색기 ─────────────────────────────────────────────────────────

type FaqStep = "categories" | "subcategories" | "questions";

function FaqNavigator({
  onSelect,
  disabled,
}: {
  onSelect: (question: string, answer: string) => void;
  disabled: boolean;
}) {
  const [step, setStep] = useState<FaqStep>("categories");
  const [catIdx, setCatIdx] = useState<number | null>(null);
  const [subIdx, setSubIdx] = useState<number | null>(null);

  const selectedCat = catIdx !== null ? FAQ_CATEGORIES[catIdx] : null;
  const selectedSub =
    selectedCat && subIdx !== null ? selectedCat.subcategories[subIdx] : null;

  const handleCategory = (idx: number) => {
    setCatIdx(idx);
    setSubIdx(null);
    setStep("subcategories");
  };

  const handleSubcategory = (idx: number) => {
    setSubIdx(idx);
    setStep("questions");
  };

  const handleQuestion = (question: string) => {
    const answer = getFaqAnswer(question) ?? getSupportBotReply(question);
    onSelect(question, answer);
  };

  const goBack = () => {
    if (step === "questions") {
      setStep("subcategories");
      setSubIdx(null);
    } else if (step === "subcategories") {
      setStep("categories");
      setCatIdx(null);
    }
  };

  return (
    <div className="vf-support-faq">
      {/* 브레드크럼 헤더 */}
      <div className="vf-support-faq-header">
        {step !== "categories" && (
          <button type="button" onClick={goBack} className="vf-support-faq-back" aria-label="뒤로">
            ‹
          </button>
        )}
        <span className="vf-support-faq-title">
          {step === "categories" && "자주 묻는 질문"}
          {step === "subcategories" && selectedCat?.category}
          {step === "questions" && selectedSub?.name}
        </span>
      </div>

      {/* 항목 목록 */}
      <div className="vf-support-faq-list">
        {step === "categories" &&
          FAQ_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.category}
              type="button"
              onClick={() => handleCategory(idx)}
              className="vf-support-faq-item is-category"
            >
              {cat.category}
              <span className="vf-support-faq-arrow">›</span>
            </button>
          ))}

        {step === "subcategories" &&
          selectedCat?.subcategories.map((sub, idx) => (
            <button
              key={sub.name}
              type="button"
              onClick={() => handleSubcategory(idx)}
              className="vf-support-faq-item is-sub"
            >
              {sub.name}
              <span className="vf-support-faq-arrow">›</span>
            </button>
          ))}

        {step === "questions" &&
          selectedSub?.faqs.map((faq) => (
            <button
              key={faq.question}
              type="button"
              disabled={disabled}
              onClick={() => handleQuestion(faq.question)}
              className="vf-support-faq-item is-question"
            >
              {faq.question}
            </button>
          ))}
      </div>
    </div>
  );
}

// ─── 메인 위젯 ────────────────────────────────────────────────────────────────

export function SupportWidget({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([greeting]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [availability, setAvailability] = useState<SupportAvailability | null>(null);
  const [showFaq, setShowFaq] = useState(true);
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

  const addBotMessage = (content: string) => {
    setMessages((current) => [
      ...current,
      {
        id: `bot-${Date.now()}`,
        sender: "bot",
        content,
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const addUserMessage = (content: string) => {
    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        content,
        created_at: new Date().toISOString(),
      },
    ]);
  };

  const send = async (content: string) => {
    const value = content.trim();
    if (!value || sending || !supportOpen) return;
    setInput("");
    setShowFaq(false);

    if (!isAuthenticated) {
      addUserMessage(value);
      setTimeout(() => addBotMessage(getSupportBotReply(value)), 300);
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
          addBotMessage(String(data.error));
        }
      }
    } finally {
      setSending(false);
    }
  };

  // FAQ 선택 시 질문+답변을 바로 채팅에 표시
  const handleFaqSelect = (question: string, answer: string) => {
    setShowFaq(false);
    addUserMessage(question);
    setTimeout(() => addBotMessage(answer), 300);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  return (
    <div className={`vf-support ${open ? "is-open" : ""}`}>
      {open && (
        <section className="vf-support-panel" aria-label="회원 문의 채팅">
          {/* 헤더 */}
          <div className="vf-support-head">
            <div>
              <strong>바이브퍼니 문의</strong>
              <span><i /> 상담 챗봇 · 관리자 연결</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="문의창 닫기">
              <IconX size={20} />
            </button>
          </div>

          {/* 운영 시간 배너 */}
          <div className={`vf-support-hours ${supportOpen ? "is-open" : "is-closed"}`}>
            {availability
              ? supportOpen
                ? `문의 가능 · ${availability.label}`
                : availability.closedMessage
              : "문의 가능 시간을 확인하고 있습니다."}
          </div>

          {/* 메시지 영역 */}
          <div ref={scrollRef} className="vf-support-messages">
            {messages.map((message) => (
              <div key={message.id} className={`vf-support-message is-${message.sender}`}>
                {message.sender !== "user" && (
                  <span className="vf-support-speaker">
                    {message.sender === "admin" ? "관리자" : "BEE BOT"}
                  </span>
                )}
                <p>{message.content}</p>
              </div>
            ))}
            {!isAuthenticated && (
              <p className="vf-support-login-note">
                관리자 답변을 받으려면 <Link href="/login">로그인</Link>해 주세요.
              </p>
            )}
          </div>

          {/* FAQ 탐색기 (토글 가능) */}
          {showFaq ? (
            <FaqNavigator onSelect={handleFaqSelect} disabled={!supportOpen} />
          ) : (
            <button
              type="button"
              className="vf-support-faq-toggle"
              onClick={() => setShowFaq(true)}
            >
              자주 묻는 질문 보기
            </button>
          )}

          {/* 입력 폼 */}
          <form onSubmit={submit} className="vf-support-form">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              maxLength={1000}
              disabled={!supportOpen}
              placeholder={
                supportOpen ? "문의 내용을 입력해 주세요" : "문의 가능 시간에 이용해 주세요"
              }
              aria-label="문의 내용"
            />
            <button
              type="submit"
              disabled={sending || !input.trim() || !supportOpen}
              aria-label="문의 보내기"
            >
              <IconSend size={19} />
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        className="vf-support-launcher"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="문의하기"
      >
        {open ? <IconX size={23} /> : <IconMessageSquare size={23} />}
        <span>문의하기</span>
      </button>
    </div>
  );
}
