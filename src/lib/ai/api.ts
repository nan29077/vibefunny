import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { authorizeApi } from "../auth";
import { FunnyError } from "../funny";
import { AiError } from "./engine";

// AI 숏츠 API 공용: 인증 + 오류 응답 정리

export function creatorOrAdmin() {
  const auth = authorizeApi("creator", "admin");
  if (!auth.user) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) } as const;
  return { user: auth.user } as const;
}

export function errorResponse(error: unknown) {
  if (error instanceof AiError || error instanceof FunnyError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || "입력값을 확인해 주세요." }, { status: 400 });
  }
  console.error("[ai-shorts api]", error);
  return NextResponse.json({ error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
}
