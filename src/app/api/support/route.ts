import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getCurrentUser } from "@/lib/auth";
import { getDb, tx } from "@/lib/db";
import { getSupportBotReply } from "@/lib/support";
import { getSupportAvailability } from "@/lib/support-hours";
import type { SupportMessage, SupportThread } from "@/lib/schema";

const now = () => new Date().toISOString();

function unauthorized() {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const availability = getSupportAvailability(db.settings);
  if (new URL(req.url).searchParams.get("availability") === "1") {
    return NextResponse.json({ availability });
  }

  const user = getCurrentUser();
  if (!user) return unauthorized();
  if (user.role === "admin") {
    const selectedId = new URL(req.url).searchParams.get("thread_id");
    const threads = [...db.support_threads]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .map((thread) => {
        const member = db.profiles.find((profile) => profile.id === thread.user_id);
        const messages = db.support_messages.filter((message) => message.thread_id === thread.id);
        return {
          ...thread,
          member: member ? { id: member.id, name: member.nickname || member.name, email: member.email, role: member.role, avatar_url: member.avatar_url } : null,
          last_message: messages.at(-1)?.content ?? "",
          message_count: messages.length,
        };
      });
    const threadId = selectedId ?? threads[0]?.id ?? null;
    const messages = threadId
      ? db.support_messages.filter((message) => message.thread_id === threadId)
      : [];
    return NextResponse.json({ threads, selected_thread_id: threadId, messages, availability });
  }

  const thread = db.support_threads.find((item) => item.user_id === user.id) ?? null;
  const messages = thread
    ? db.support_messages.filter((message) => message.thread_id === thread.id)
    : [];
  return NextResponse.json({ thread, messages, availability });
}

export async function POST(req: NextRequest) {
  const user = getCurrentUser();
  if (!user) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const content = String(body.content ?? "").trim().slice(0, 1000);
  if (!content) return NextResponse.json({ error: "문의 내용을 입력해 주세요." }, { status: 400 });

  if (user.role === "admin") {
    const threadId = String(body.thread_id ?? "");
    const result = tx((db) => {
      const thread = db.support_threads.find((item) => item.id === threadId);
      if (!thread) return null;
      const message: SupportMessage = {
        id: nanoid(), thread_id: thread.id, sender: "admin", sender_id: user.id, content, created_at: now(),
      };
      db.support_messages.push(message);
      thread.status = "open";
      thread.updated_at = message.created_at;
      return message;
    });
    if (!result) return NextResponse.json({ error: "문의 대화를 찾을 수 없습니다." }, { status: 404 });
    return NextResponse.json(result);
  }

  const availability = getSupportAvailability(getDb().settings);
  if (!availability.isOpen) {
    return NextResponse.json(
      { error: availability.closedMessage, code: "SUPPORT_CLOSED", availability },
      { status: 403 },
    );
  }

  const result = tx((db) => {
    let thread = db.support_threads.find((item) => item.user_id === user.id);
    if (!thread) {
      thread = { id: nanoid(), user_id: user.id, status: "waiting", created_at: now(), updated_at: now() } satisfies SupportThread;
      db.support_threads.push(thread);
    }
    const message: SupportMessage = {
      id: nanoid(), thread_id: thread.id, sender: "user", sender_id: user.id, content, created_at: now(),
    };
    const botMessage: SupportMessage = {
      id: nanoid(), thread_id: thread.id, sender: "bot", sender_id: null, content: getSupportBotReply(content), created_at: now(),
    };
    db.support_messages.push(message, botMessage);
    thread.status = "waiting";
    thread.updated_at = botMessage.created_at;
    return { thread, messages: [message, botMessage] };
  });
  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const user = getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const threadId = String(body.thread_id ?? "");
  const status = String(body.status ?? "");
  if (!(["open", "waiting", "resolved"] as const).includes(status as "open" | "waiting" | "resolved")) {
    return NextResponse.json({ error: "올바르지 않은 상태입니다." }, { status: 400 });
  }
  const updated = tx((db) => {
    const thread = db.support_threads.find((item) => item.id === threadId);
    if (!thread) return null;
    thread.status = status as SupportThread["status"];
    thread.updated_at = now();
    return thread;
  });
  if (!updated) return NextResponse.json({ error: "문의 대화를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(updated);
}
