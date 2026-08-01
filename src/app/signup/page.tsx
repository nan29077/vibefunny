"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { signupAction } from "@/lib/actions/auth-actions";
import { FieldError, FormMessage, SubmitButton, initialActionState } from "@/components/form";
import { Card, Field, Input, Select } from "@/components/ui";
import { IconMegaphone, IconVideo } from "@/components/icons";

type Role = "creator" | "advertiser";
type AdvertiserType = "execution_company" | "agency" | "";

const ROLE_CARDS = [
  { value: "creator" as const, Icon: IconVideo, title: "숏폼 크리에이터", desc: "영상 제작과 배포로 수익을 시작해요." },
  { value: "advertiser" as const, Icon: IconMegaphone, title: "광고주", desc: "숏폼으로 브랜드를 알리세요." },
];

function SignupForm() {
  const searchParams = useSearchParams();
  const lockedReferralCode = (searchParams.get("ref") || "").trim();
  const urlRole = searchParams.get("role") as Role | null;
  // 추천인 링크 모드: ?ref=CODE가 있을 때
  const referralLinkMode = Boolean(lockedReferralCode);
  // 대행사 추천인 링크: ?ref=CODE&role=advertiser
  const isAgencyReferralLink = referralLinkMode && urlRole === "advertiser";

  const [state, formAction] = useFormState(signupAction, initialActionState);
  // 역할: 대행사 추천인 링크이면 advertiser 고정, ?role=advertiser이면 advertiser로 시작
  const [role, setRole] = useState<Role>(
    isAgencyReferralLink || urlRole === "advertiser" ? "advertiser" : "creator"
  );
  // 광고주 유형: 대행사 추천인 링크이면 agency 고정
  const [advertiserType, setAdvertiserType] = useState<AdvertiserType>(
    isAgencyReferralLink ? "agency" : ""
  );
  // 대행사가 추천인 없음을 선택했는지
  const [noReferral, setNoReferral] = useState(false);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [referralRequired, setReferralRequired] = useState(false);

  useEffect(() => {
    fetch("/api/auth/signup-config")
      .then((response) => response.json())
      .then((config) => setReferralRequired(Boolean(config.referralRequired)))
      .catch(() => setReferralRequired(false));
  }, []);

  async function requestCode() {
    if (!email) return setEmailMessage("이메일을 먼저 입력하세요.");
    setEmailBusy(true);
    setEmailVerified(false);
    try {
      const response = await fetch("/api/auth/email-verification/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      setEmailMessage(result.message || result.error || "인증번호를 전송했습니다.");
    } catch {
      setEmailMessage("인증번호 발송 중 오류가 발생했습니다.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function verifyCode() {
    setEmailBusy(true);
    try {
      const response = await fetch("/api/auth/email-verification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const result = await response.json();
      setEmailVerified(Boolean(result.ok));
      setEmailMessage(result.ok ? "이메일 인증이 완료되었습니다." : result.error);
    } catch {
      setEmailMessage("인증 확인 중 오류가 발생했습니다.");
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <main className="vf-auth-page mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <Link href="/" className="vf-auth-brand mb-6 justify-center text-center text-2xl font-black tracking-tight" aria-label="바이브퍼니 메인으로">
        <Image src="/images/vibefunny-video-bee-logo.png" alt="" width={52} height={52} priority className="vf-auth-brand-image" />
        <span>VIBE</span><b>FUNNY</b>
      </Link>
      <Card>
        <h1 className="text-xl font-bold text-gray-900">회원가입</h1>
        <p className="mt-1 text-sm text-gray-500">회원 유형을 선택하고 이메일 인증을 완료해 주세요.</p>

        <form action={formAction} className="mt-6 space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-600">회원 유형</p>
            <div className="grid grid-cols-2 gap-3">
              {ROLE_CARDS.map(({ value, Icon, title, desc }) => {
                const selected = role === value;
                // 대행사 추천인 링크: 크리에이터 선택 비활성 / 일반 크리에이터 추천인 링크: 광고주 선택 비활성
                const disabled = isAgencyReferralLink ? value === "creator" : (referralLinkMode && value === "advertiser");
                return (
                  <button key={value} type="button" disabled={disabled} onClick={() => { setRole(value); setAdvertiserType(""); setNoReferral(false); }}
                    className={`rounded-xl border-2 p-4 text-left transition ${selected ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white"} ${disabled ? "cursor-not-allowed opacity-40" : "hover:border-amber-300"}`}>
                    <span className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg ${selected ? "bg-amber-400 text-gray-900" : "bg-gray-100 text-gray-500"}`}><Icon size={18} /></span>
                    <span className="block text-sm font-bold text-gray-900">{title}</span>
                    <span className="mt-1 block text-xs text-gray-500">{desc}</span>
                  </button>
                );
              })}
            </div>
            <input type="hidden" name="role" value={role} />
          </div>

          <Field label="이름">
            <Input name="name" placeholder="이름" autoComplete="name" />
            <FieldError state={state} name="name" />
          </Field>

          <Field label="이메일">
            <div className="flex gap-2">
              <Input name="email" type="email" value={email} disabled={emailVerified} onChange={(event) => { setEmail(event.target.value); setEmailVerified(false); }} placeholder="you@example.com" autoComplete="email" />
              {emailVerified && <input type="hidden" name="email" value={email} />}
              <button type="button" onClick={requestCode} disabled={emailBusy || emailVerified} className="shrink-0 rounded-xl bg-gray-900 px-4 text-sm font-bold text-white disabled:opacity-50">인증하기</button>
            </div>
            <FieldError state={state} name="email" />
          </Field>

          <Field label="인증번호">
            <div className="flex gap-2">
              <Input value={code} disabled={emailVerified} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="6자리 인증번호" />
              <button type="button" onClick={verifyCode} disabled={emailBusy || emailVerified || code.length !== 6} className="shrink-0 rounded-xl border border-amber-400 bg-amber-50 px-4 text-sm font-bold text-amber-800 disabled:opacity-50">확인</button>
            </div>
            {emailMessage && <p className={`mt-2 text-xs ${emailVerified ? "text-green-600" : "text-gray-500"}`}>{emailMessage}</p>}
          </Field>

          <Field label="비밀번호">
            <Input name="password" type="password" placeholder="8자 이상" autoComplete="new-password" />
            <FieldError state={state} name="password" />
          </Field>
          <Field label="비밀번호 확인">
            <Input name="password_confirm" type="password" placeholder="비밀번호를 다시 입력하세요" autoComplete="new-password" />
            <FieldError state={state} name="password_confirm" />
          </Field>

          {role === "advertiser" && (
            <Field label="광고주 유형">
              {isAgencyReferralLink ? (
                // 대행사 추천인 링크로 진입 → 대행사 고정
                <>
                  <input type="hidden" name="advertiser_type" value="agency" />
                  <div className="rounded-xl border border-gray-200 bg-gray-100 px-4 py-2.5 text-sm text-gray-700 font-semibold">대행사</div>
                  <p className="mt-1 text-xs text-amber-700">추천인 링크를 통해 대행사로 가입이 진행됩니다.</p>
                </>
              ) : (
                <Select name="advertiser_type" value={advertiserType} onChange={(e) => { setAdvertiserType(e.target.value as AdvertiserType); setNoReferral(false); }}>
                  <option value="" disabled>선택하세요</option>
                  <option value="execution_company">실행사</option>
                  <option value="agency">대행사</option>
                </Select>
              )}
              <FieldError state={state} name="advertiser_type" />
            </Field>
          )}

          {/* 크리에이터 추천인 코드 */}
          {role === "creator" && (referralRequired || referralLinkMode) && (
            <Field label={`추천인 코드${referralRequired ? " (필수)" : ""}`}>
              <Input name="referral_code" defaultValue={lockedReferralCode} readOnly={referralLinkMode} required={referralRequired} className={referralLinkMode ? "bg-gray-100" : undefined} placeholder="추천인 코드를 입력하세요" />
              {referralLinkMode && <p className="mt-1 text-xs text-amber-700">공유받은 추천인 코드가 자동 적용되어 수정할 수 없습니다.</p>}
              <FieldError state={state} name="referral_code" />
            </Field>
          )}

          {/* 대행사 추천인 코드 */}
          {role === "advertiser" && advertiserType === "agency" && (
            <Field label="실행사 추천인 코드">
              {isAgencyReferralLink ? (
                // 추천인 링크로 진입 → 코드 고정, 수정 불가
                <>
                  <Input name="referral_code" defaultValue={lockedReferralCode} readOnly className="bg-gray-100" />
                  <p className="mt-1 text-xs text-amber-700">실행사의 추천인 코드가 자동 적용되어 수정할 수 없습니다.</p>
                </>
              ) : (
                // 직접 가입 → 코드 입력 또는 추천인 없음 선택
                <>
                  {!noReferral && (
                    <Input
                      name="referral_code"
                      placeholder="실행사 추천인 코드를 입력하세요"
                      disabled={noReferral}
                    />
                  )}
                  {noReferral && <input type="hidden" name="no_referral_agency" value="true" />}
                  <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-gray-600 select-none">
                    <input
                      type="checkbox"
                      checked={noReferral}
                      onChange={(e) => setNoReferral(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 accent-amber-500"
                    />
                    추천인 없음 (추천인 코드 없이 가입)
                  </label>
                  {!noReferral && <p className="mt-1 text-xs text-gray-400">실행사로부터 추천인 코드를 받으셨다면 위에 입력하세요.</p>}
                </>
              )}
              <FieldError state={state} name="referral_code" />
            </Field>
          )}

          <FormMessage state={state} />
          <SubmitButton className="w-full">회원가입 완료</SubmitButton>
          {!emailVerified && <p className="text-center text-xs text-red-500">이메일 인증을 완료해야 회원가입할 수 있습니다.</p>}
        </form>
        <p className="mt-5 text-center text-sm text-gray-500">이미 계정이 있으신가요? <Link href="/login" className="font-semibold text-amber-700 hover:underline">로그인</Link></p>
      </Card>
    </main>
  );
}

export default function SignupPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-gray-400">불러오는 중...</div>}><SignupForm /></Suspense>;
}
