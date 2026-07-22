"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import {
  loginAction,
  testLoginAdmin,
  testLoginCreator,
  testLoginAdvertiser,
  testLoginAgency,
} from "@/lib/actions/auth-actions";
import { Card, Field, Input } from "@/components/ui";
import { SubmitButton, FormMessage, FieldError, initialActionState } from "@/components/form";
import {
  IconShield,
  IconFilm,
  IconMegaphone,
  IconBuilding,
} from "@/components/icons";

const testAccounts = [
  {
    label: "최고관리자",
    email: "admin@vibefunny.com",
    action: testLoginAdmin,
    Icon: IconShield,
    bg: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    iconBg: "bg-purple-100 text-purple-600",
    textColor: "text-purple-900",
    subColor: "text-purple-500",
  },
  {
    label: "크리에이터",
    email: "creator_test@vibefunny.com",
    action: testLoginCreator,
    Icon: IconFilm,
    bg: "bg-pink-50 border-pink-200 hover:bg-pink-100",
    iconBg: "bg-pink-100 text-pink-600",
    textColor: "text-pink-900",
    subColor: "text-pink-500",
  },
  {
    label: "광고주 (실행사)",
    email: "advertiser_test@vibefunny.com",
    action: testLoginAdvertiser,
    Icon: IconMegaphone,
    bg: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100",
    iconBg: "bg-yellow-100 text-yellow-600",
    textColor: "text-yellow-900",
    subColor: "text-yellow-600",
  },
  {
    label: "광고주 (대행사)",
    email: "agency_test@vibefunny.com",
    action: testLoginAgency,
    Icon: IconBuilding,
    bg: "bg-green-50 border-green-200 hover:bg-green-100",
    iconBg: "bg-green-100 text-green-600",
    textColor: "text-green-900",
    subColor: "text-green-500",
  },
];

// ── 소셜 로그인 버튼 ─────────────────────────────────────────────────────────
function SocialButtons() {
  const handleSocial = () => {
    alert("준비 중입니다.");
  };
  return (
    <div>
      <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-widest text-gray-400">
        소셜 계정으로 로그인
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
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400">또는 이메일로 로그인</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>
    </div>
  );
}

export default function LoginPage() {
  const [state, formAction] = useFormState(loginAction, initialActionState);

  return (
    <main className="vf-auth-page mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-6 block text-center text-2xl font-black tracking-tight">
        <span className="text-gray-900">VIBE</span><span style={{ color: "#f59e0b" }}>FUNNY</span>
      </Link>

      {/* 테스트 계정 빠른 로그인 */}
      <div className="mb-4">
        <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
          테스트 계정 빠른 로그인
        </p>
        <div className="grid grid-cols-2 gap-2">
          {testAccounts.map((acc) => (
            <form key={acc.email} action={acc.action}>
              <button
                type="submit"
                className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition ${acc.bg}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${acc.iconBg}`}>
                  <acc.Icon size={14} />
                </span>
                <span>
                  <span className={`block font-bold ${acc.textColor}`}>{acc.label}</span>
                  <span className={`block truncate ${acc.subColor}`}>{acc.email}</span>
                </span>
              </button>
            </form>
          ))}
        </div>
      </div>

      <Card>
        <SocialButtons />

        <form action={formAction} className="space-y-4">
          <Field label="이메일">
            <Input name="email" type="email" placeholder="you@example.com" autoComplete="email" />
            <FieldError state={state} name="email" />
          </Field>
          <Field label="비밀번호">
            <Input name="password" type="password" placeholder="••••••••" autoComplete="current-password" />
            <FieldError state={state} name="password" />
          </Field>
          <FormMessage state={state} />
          <SubmitButton className="w-full">로그인</SubmitButton>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="font-semibold text-brand-purple hover:underline">
            회원가입
          </Link>
        </p>
      </Card>
    </main>
  );
}
