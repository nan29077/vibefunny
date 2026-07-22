"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

// 서버 액션 표준 반환 타입
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false };

/** 폼 제출 버튼 - pending 시 로딩 표시 */
export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending}>
      {pending ? "처리 중..." : children}
    </Button>
  );
}

/** 액션 결과 메시지 (성공/실패) */
export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <div
      className={
        state.ok
          ? "rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700"
          : "rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700"
      }
    >
      {state.message}
    </div>
  );
}

/** 필드별 에러 표시 */
export function FieldError({
  state,
  name,
}: {
  state: ActionState;
  name: string;
}) {
  const err = state.fieldErrors?.[name];
  if (!err) return null;
  return <p className="mt-1 text-xs text-red-500">{err}</p>;
}
