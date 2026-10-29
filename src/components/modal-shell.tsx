"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { openModalFlag } from "@/lib/modal-flag";

/**
 * 공통 모달 틀: 배경 클릭·Esc 로 닫기, 열릴 때 창으로 포커스 이동, 닫히면 원래 위치로 포커스 복귀,
 * body 에 모달 표시(떠 있는 "문의하기" 버튼 숨김). role="dialog" + aria-modal.
 */
export function ModalShell({
  onClose,
  label,
  panelClassName,
  children,
  before,
}: {
  onClose: () => void;
  /** 화면낭독기용 창 이름 */
  label: string;
  panelClassName: string;
  children: ReactNode;
  /** 창 바깥(배경 위)에 그릴 요소 — 예: 토스트 */
  before?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const closeFlag = openModalFlag();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      closeFlag();
      previous?.focus?.();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4" onClick={() => closeRef.current()}>
      {before}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`${panelClassName} focus:outline-none`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
