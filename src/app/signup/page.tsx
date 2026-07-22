"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useFormState } from "react-dom";
import { signupAction } from "@/lib/actions/auth-actions";
import { Card, Field, Input, Select } from "@/components/ui";
import {
  SubmitButton,
  FormMessage,
  FieldError,
  initialActionState,
} from "@/components/form";
import { IconVideo, IconMegaphone } from "@/components/icons";

// ── 소셜 로그인 버튼 ─────────────────────────────────────────────────────────
function SocialButtons() {
  const handleSocial = () => {
    alert("준비 중입니다.");
  };
  return (
    <div>
      <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-widest text-gray-400">
        소셜 계정으로 가입
      </p>
      <div className="grid grid-cols-3 gap-2">
        {/* 카카오 */}
        <button
          type="button"
          onClick={handleSocial}
          className="flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition hover:opacity-80"
          style={{ background: "#FEE500", borderColor: "#FEE500", color: "#191919" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 3C6.477 3 2 6.477 2 10.667c0 2.711 1.68 5.09 4.2 6.472l-1.062 4.002c-.094.355.38.629.666.393L10.87 18.9c.371.05.75.077 1.13.077 5.523 0 10-3.477 10-7.41C22 6.477 17.523 3 12 3z" />
          </svg>
          카카오
        </button>

        {/* 네이버 */}
        <button
          type="button"
          onClick={handleSocial}
          className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold text-white transition hover:opacity-80"
          style={{ background: "#03C75A" }}
        >
          <span className="text-sm font-black leading-none">N</span>
          네이버
        </button>

        {/* 구글 */}
        <button
          type="button"
          onClick={handleSocial}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-bold text-gray-700 transition hover:bg-gray-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          구글
        </button>
      </div>

      {/* 구분선 */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">또는 이메일로 가입</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
    </div>
  );
}

// ── 역할 카드 데이터 ─────────────────────────────────────────────────────────
const ROLE_CARDS = [
  {
    value: "creator" as const,
    Icon: IconVideo,
    title: "숏폼 크리에이터",
    label: "VIBEFUNNY 회원",
    desc: "영상 제작·배포로 수익을 만들어보세요",
  },
  {
    value: "advertiser" as const,
    Icon: IconMegaphone,
    title: "광고주·브랜드",
    label: "광고주 회원",
    desc: "숏폼으로 브랜드를 알리세요",
  },
];

// ── 회원가입 폼 ──────────────────────────────────────────────────────────────
function SignupForm() {
  const [state, formAction] = useFormState(signupAction, initialActionState);
  const [role, setRole] = useState<"creator" | "advertiser">("creator");
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref") ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-6 block text-center text-2xl font-black tracking-tight">
        <span className="text-gray-900">VIBE</span><span style={{ color: "#f59e0b" }}>FUNNY</span>
      </Link>
      <Card>
        <h1 className="text-xl font-bold text-gray-900">회원가입</h1>
        <p className="mt-1 text-sm text-gray-500">유형을 선택하고 가입하세요.</p>

        <SocialButtons />

        <form action={formAction} className="space-y-5">
          {/* 역할 선택 카드 */}
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-600">회원 유형 선택</p>
            <div className="grid grid-cols-2 gap-3">
              {ROLE_CARDS.map(({ value, Icon, title, label, desc }) => {
                const selected = role === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setRole(value)}
                    className={`flex flex-col items-start rounded-xl border-2 p-4 text-left transition ${
                      selected
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <span
                      className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${
                        selected ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="block text-sm font-bold text-gray-900">{title}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-blue-500">{label}</span>
                    <span className="mt-1 block text-xs text-gray-500">{desc}</span>
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="role" value={role} />
          </div>

          {/* 이름 */}
          <Field label="이름">
            <Input name="name" placeholder="홍길동" autoComplete="name" />
            <FieldError state={state} name="name" />
          </Field>

          {/* 이메일 */}
          <Field label="이메일">
            <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" />
            <FieldError state={state} name="email" />
          </Field>

          {/* 비밀번호 */}
          <Field label="비밀번호">
            <Input name="password" type="password" placeholder="8자 이상" autoComplete="new-password" />
            <FieldError state={state} name="password" />
          </Field>

          {/* 광고주 유형 (조건부) */}
          {role === "advertiser" && (
            <Field label="광고주 유형">
              <Select name="advertiser_type" defaultValue="">
                <option value="" disabled>선택하세요</option>
                <option value="execution_company">실행사</option>
                <option value="agency">대행사</option>
              </Select>
              <FieldError state={state} name="advertiser_type" />
            </Field>
          )}

          {/* 추천인 코드 (URL 파라미터에서 자동) */}
          {refCode && <input type="hidden" name="referral_code" value={refCode} />}

          <FormMessage state={state} />
          <SubmitButton className="w-full">가입하기</SubmitButton>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="font-semibold text-brand-purple hover:underline">
            로그인
          </Link>
        </p>
      </Card>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-gray-400">로딩...</div>}>
      <SignupForm />
    </Suspense>
  );
}
