"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { openModalFlag } from "@/lib/modal-flag";

// 서버 액션 표준 반환 타입
export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
};

export const initialActionState: ActionState = { ok: false };

/** 폼 제출 버튼 - pending 시 로딩 표시. confirmMessage 를 주면 제출 전에 확인 창을 띄운다. */
export function SubmitButton({
  children,
  variant = "primary",
  size = "md",
  className,
  confirmMessage,
  confirmLabel = "확인",
  successMessage,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  confirmMessage?: string;
  confirmLabel?: string;
  /** 제출 처리가 끝나면 화면 하단에 잠시 띄울 안내 (예: "저장되었습니다") */
  successMessage?: string;
}) {
  const { pending } = useFormStatus();
  const wasPending = React.useRef(false);
  const [toast, setToast] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (pending) { wasPending.current = true; return; }
    if (wasPending.current && successMessage) {
      wasPending.current = false;
      setToast(successMessage);
      const t = window.setTimeout(() => setToast(null), 2500);
      return () => window.clearTimeout(t);
    }
    wasPending.current = false;
  }, [pending, successMessage]);
  const ref = React.useRef<HTMLButtonElement>(null);
  const confirmedRef = React.useRef(false);
  const [asking, setAsking] = React.useState(false);

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!confirmMessage) return;
    if (confirmedRef.current) { confirmedRef.current = false; return; }
    e.preventDefault();
    setAsking(true);
  };
  const proceed = () => {
    setAsking(false);
    const btn = ref.current;
    const form = btn?.form;
    if (!btn || !form) return;
    // 버튼의 name/value 가 함께 전송되도록 해당 버튼으로 제출.
    // requestSubmit 은 click 이벤트를 만들지 않으므로 확인 플래그가 필요 없다(다음 클릭 때 다시 확인 창이 뜬다).
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit(btn);
    } else {
      confirmedRef.current = true; // 구형 브라우저: click() 이 onClick 을 한 번 통과하도록
      btn.click();
    }
  };

  return (
    <>
      <Button ref={ref} type="submit" variant={variant} size={size} className={className} disabled={pending} onClick={onClick}>
        {pending ? "처리 중..." : children}
      </Button>
      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-[310] -translate-x-1/2 whitespace-nowrap rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg lg:bottom-8">
          ✓ {toast}
        </div>
      )}
      {asking && confirmMessage && (
        <ConfirmDialog message={confirmMessage} confirmLabel={confirmLabel} danger={variant === "danger"} onCancel={() => setAsking(false)} onConfirm={proceed} />
      )}
    </>
  );
}

/** 확인 대화상자 (브라우저 기본 confirm 대신 사용하는 화면 내 모달) */
export function ConfirmDialog({
  message,
  confirmLabel = "확인",
  cancelLabel = "취소",
  danger,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const cancelRef = React.useRef(onCancel);
  cancelRef.current = onCancel;
  // 열릴 때 1번만: 확인 버튼에 포커스, Esc 로 닫기, 모달 표시(문의하기 버튼 숨김)
  React.useEffect(() => {
    confirmRef.current?.focus();
    const closeFlag = openModalFlag();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") cancelRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      closeFlag();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4" onClick={(e) => { e.stopPropagation(); onCancel(); }}>
      <div role="alertdialog" aria-modal="true" aria-label="확인" className="w-full max-w-sm rounded-2xl bg-white p-5 text-left shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p className="whitespace-pre-line text-sm leading-6 text-gray-800">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="md" onClick={onCancel}>{cancelLabel}</Button>
          <Button ref={confirmRef} type="button" variant={danger ? "danger" : "primary"} size="md" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
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
