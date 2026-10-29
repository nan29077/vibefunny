"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { tx, getDb } from "../db";
import { genId, genReferralCode, hashPassword, verifyPassword } from "../crypto";
import { setSession, clearSession, getSessionUserId } from "../session";
import { audit } from "../services";
import type { AdvertiserType, Payment, Profile, Role } from "../schema";
import type { ActionState } from "@/components/form";
import { roleHome } from "../routes";
import { randomProfileAvatar } from "../profile-avatars";
import { EMAIL_VERIFIED_TTL_MS, EMAIL_VERIFY_COOKIE, normalizeEmail, verifyTokenMatches } from "../email-verification";
import { cookies } from "next/headers";
import { clientIp, formatWait, hitCount, rateLimit, recordHit, resetRateLimit } from "../rate-limit";
import { canBeMentor } from "../membership";
import { notifyUser } from "../services";

// 운영 환경에서 공개된 예시 비밀번호로는 로그인할 수 없다 (데모 계정 악용 방지)
const PUBLIC_DEMO_PASSWORDS = new Set(["Admin1234!", "Test1234!"]);
const LOGIN_FAIL_LIMIT = 5; // 같은 이메일 15분에 5회 실패 시 잠금
const LOGIN_IP_LIMIT = 30; // 같은 IP 15분에 30회 시도
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_SLOWDOWN_AFTER = 10; // 이메일 전체 기준 15분에 10회 실패부터 응답 지연

const now = () => new Date().toISOString();

// --- 회원가입 -----------------------------------------------------------
const signupSchema = z.object({
  email: z.string().email("올바른 이메일을 입력하세요."),
  password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다."),
  password_confirm: z.string().min(1, "비밀번호 확인을 입력하세요."),
  name: z.string().min(1, "이름을 입력하세요."),
  role: z.enum(["creator", "advertiser"]),
  advertiser_type: z.enum(["execution_company", "agency"]).optional(),
  referral_code: z.string().optional(),
  // 대행사 가입 시 추천인 없음 선택 여부
  no_referral_agency: z.boolean().optional(),
}).refine((value) => value.password === value.password_confirm, {
  path: ["password_confirm"],
  message: "비밀번호가 일치하지 않습니다.",
});

export async function signupAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    email: normalizeEmail(String(formData.get("email") || "")),
    password: formData.get("password"),
    password_confirm: formData.get("password_confirm"),
    name: formData.get("name"),
    role: formData.get("role"),
    advertiser_type: formData.get("advertiser_type") || undefined,
    // 추천인 코드는 대소문자 구분 없이 받는다 (코드는 대문자로 발급)
    referral_code: (formData.get("referral_code") as string)?.trim().toUpperCase() || undefined,
    no_referral_agency: formData.get("no_referral_agency") === "true",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { ok: false, message: "입력값을 확인하세요.", fieldErrors };
  }

  const data = parsed.data;
  const role = data.role as Role;
  const advertiserType = (data.advertiser_type as AdvertiserType | undefined) ?? null;

  if (role === "advertiser" && !advertiserType) {
    return { ok: false, message: "광고주 유형(실행사/대행사)을 선택하세요." };
  }

  // 가입 시도 제한: 같은 IP 1시간 60회 (설명회 등 같은 와이파이에서 여러 명이 가입하는 경우 고려)
  const signupWait = rateLimit(`signup-ip:${clientIp()}`, 60, 60 * 60 * 1000);
  if (signupWait > 0) return { ok: false, message: `가입 시도가 너무 많습니다. ${formatWait(signupWait)} 후 다시 시도하세요.` };
  const verifyCookie = cookies().get(EMAIL_VERIFY_COOKIE)?.value;

  let redirectTo: string | null = null;
  let newSession: { id: string; version: number } | null = null;
  const result = tx<ActionState>((db) => {
    if (db.profiles.some((p) => normalizeEmail(p.email) === data.email)) {
      return { ok: false, message: "이미 가입된 이메일입니다." };
    }

    const emailVerification = [...db.email_verifications]
      .filter((item) => item.email === data.email && item.verified_at && !item.consumed_at && verifyTokenMatches(verifyCookie, item))
      .sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at))[0];
    // 인증 완료 후 30분 안에 같은 브라우저에서 가입해야 한다
    if (!emailVerification || Date.parse(emailVerification.verified_at as string) + EMAIL_VERIFIED_TTL_MS < Date.now()) {
      return {
        ok: false,
        message: "이메일 인증을 완료한 후 가입해 주세요.",
        fieldErrors: { email: "이메일 인증이 필요합니다." } as Record<string, string>,
      };
    }

    // 크리에이터는 항상 추천인(멘토) 코드가 있어야 가입할 수 있다
    if (role === "creator" && !data.referral_code) {
      return {
        ok: false,
        message: "추천인 코드를 입력해야 가입할 수 있습니다.",
        fieldErrors: { referral_code: "추천인 코드는 필수입니다." } as Record<string, string>,
      };
    }

    let referredBy: Profile | null = null;
    if (role === "creator") {
      // 멘토는 가입비를 결제한 바이브회원 크리에이터만 될 수 있다
      const mentor = db.profiles.find((p) => p.referral_code === data.referral_code) ?? null;
      if (!mentor || (mentor.role !== "creator" && mentor.role !== "admin") || mentor.status !== "active") {
        return {
          ok: false,
          message: "유효하지 않은 추천인 코드입니다.",
          fieldErrors: { referral_code: "존재하지 않는 코드" } as Record<string, string>,
        };
      }
      if (!canBeMentor(db, mentor)) {
        return {
          ok: false,
          message: "바이브회원(가입비 결제 완료)의 추천인 코드만 사용할 수 있습니다.",
          fieldErrors: { referral_code: "아직 바이브회원이 아닌 회원의 코드입니다" } as Record<string, string>,
        };
      }
      referredBy = mentor;
    } else if (data.referral_code && db.settings.referral_system_enabled) {
      // 광고주(실행사): 추천인 제도가 켜져 있을 때만 추천인 코드 확인 (대행사는 아래 실행사 코드 확인)
      referredBy = db.profiles.find((p) => p.referral_code === data.referral_code) ?? null;
      if (!referredBy && !(advertiserType === "agency")) {
        return {
          ok: false,
          message: "유효하지 않은 추천인 코드입니다.",
          fieldErrors: { referral_code: "존재하지 않는 코드" } as Record<string, string>,
        };
      }
    }

    // 대행사의 실행사 코드는 추천인 제도 ON/OFF 와 무관하게 확인한다
    // (이전: 추천인 제도가 꺼져 있으면 실행사 코드가 무시되어 대행사 가입이 항상 실패함)
    const executionCompany =
      role === "advertiser" && advertiserType === "agency" && data.referral_code
        ? db.profiles.find(
            (p) => p.referral_code === data.referral_code && p.role === "advertiser" && p.advertiser_type === "execution_company" && p.status === "active"
          ) ?? null
        : null;

    // 대행사는 실행사 코드로만 가입 가능 (추천인 없음 선택 시 예외 허용)
    if (role === "advertiser" && advertiserType === "agency") {
      const hasNoReferral = Boolean(data.no_referral_agency);
      if (!data.referral_code && !hasNoReferral) {
        return {
          ok: false,
          message: "실행사 추천인 코드를 입력하거나 '추천인 없음'을 선택하세요.",
          fieldErrors: { referral_code: "추천인 코드 입력 또는 추천인 없음 선택 필요" } as Record<string, string>,
        };
      }
      if (data.referral_code && !executionCompany) {
        return {
          ok: false,
          message: "유효한 실행사 코드가 아닙니다. 실행사로부터 추천 코드를 받아 입력하세요.",
          fieldErrors: { referral_code: "실행사 코드만 사용 가능" } as Record<string, string>,
        };
      }
    }

    // 대행사가 실행사 코드로 가입한 경우 상위 실행사 연결
    let parentAdvertiserId: string | null = null;
    if (executionCompany) {
      parentAdvertiserId = executionCompany.id;
    }

    // 가입비 설정 확인
    const fee = db.settings.fees[role];
    const needsSignupFee = fee.signup_fee_enabled && fee.signup_fee_amount > 0;
    // 크리에이터: 가입비가 있어도 계정은 바로 활성(일반회원)이고, 결제하면 바이브회원이 된다.
    // 그 밖의 역할은 기존처럼 결제 전까지 결제 대기(pending).
    const isCreator = role === "creator";

    const user: Profile = {
      id: genId(),
      email: data.email,
      password_hash: hashPassword(data.password),
      email_verified_at: emailVerification.verified_at,
      name: data.name,
      phone: null,
      role,
      advertiser_type: advertiserType,
      parent_advertiser_id: parentAdvertiserId,
      referral_code: genReferralCode(),
      referred_by_user_id: referredBy?.id ?? null,
      // 크리에이터는 항상 active(결제 전 = 일반회원). 그 밖의 역할: 가입비 없음 -> active / 있음 -> pending
      status: isCreator || !needsSignupFee ? "active" : "pending",
      avatar_url: randomProfileAvatar(),
      // 가입비 제도가 꺼져 있을 때 가입한 크리에이터는 바로 바이브회원
      vibe_member_at: isCreator && !needsSignupFee ? now() : null,
      created_at: now(),
      updated_at: now(),
    };
    db.profiles.push(user);

    // 추천 관계 저장 (수당은 가입비 결제가 완료된 뒤 한 번만 생성)
    if (referredBy) {
      db.referral_relations.push({
        id: genId(),
        referrer_id: referredBy.id,
        referee_id: user.id,
        referral_type: "signup",
        created_at: now(),
      });
      // 멘토에게 새 멘티 가입 알림 (결제 전/후는 '내 멘티 현황'에서 확인)
      if (isCreator && referredBy.role === "creator") {
        notifyUser(db, {
          recipientId: referredBy.id,
          title: "새 멘티가 가입했습니다",
          message: `${data.name}님이 내 추천 코드로 가입했습니다. ${needsSignupFee ? "아직 가입비 결제 전(일반회원)입니다." : "바이브회원으로 가입했습니다."}`,
          link: "/creator/referrals",
        });
      }
    }
    // 대행사-실행사 계층 관계 (추천인 제도와 별개로 항상 저장)
    if (parentAdvertiserId) {
      db.referral_relations.push({
        id: genId(),
        referrer_id: parentAdvertiserId,
        referee_id: user.id,
        referral_type: "advertiser_hierarchy",
        created_at: now(),
      });
    }

    emailVerification.consumed_at = now();

    // 가입비 결제 대기 시 payment 레코드 생성
    if (needsSignupFee) {
      const payment: Payment = {
        id: genId(),
        user_id: user.id,
        payment_type: "signup_fee",
        amount: fee.signup_fee_amount,
        status: "pending",
        provider: process.env.PAYMENT_PROVIDER || "mock",
        provider_payment_id: null,
        metadata_json: {},
        created_at: now(),
        paid_at: null,
      };
      db.payments.push(payment);
    }

    audit(db, {
      actorId: user.id,
      action: "signup",
      targetTable: "profiles",
      targetId: user.id,
      after: { role, advertiserType },
    });

    newSession = { id: user.id, version: user.session_version ?? 0 };
    redirectTo = needsSignupFee ? "/payment/activate" : roleHome(role);
    return { ok: true };
  });

  // 세션 쿠키는 DB 저장(tx)이 끝난 뒤에 발급한다
  const session = newSession as { id: string; version: number } | null;
  if (result.ok && session) setSession(session.id, session.version);
  if (result.ok) cookies().delete(EMAIL_VERIFY_COOKIE);
  if (result.ok && redirectTo) redirect(redirectTo);
  return result;
}

// --- 로그인 -------------------------------------------------------------
export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  // 이메일 소문자 정규화 (가입 시 normalizeEmail 적용과 통일)
  const email = normalizeEmail(String(formData.get("email") || ""));
  const password = String(formData.get("password") || "");
  if (!email || !password) {
    return { ok: false, message: "이메일과 비밀번호를 입력하세요." };
  }

  // 횟수 제한: IP 단위 시도 횟수 + 이메일 단위 실패 횟수
  const ip = clientIp();
  const ipWait = rateLimit(`login-ip:${ip}`, LOGIN_IP_LIMIT, LOGIN_WINDOW_MS);
  if (ipWait > 0) {
    return { ok: false, message: `로그인 시도가 너무 많습니다. ${formatWait(ipWait)} 후 다시 시도하세요.` };
  }
  // 같은 IP+이메일 5회 실패 시 잠금.
  // 이메일 전체(여러 IP 합산)는 "잠금" 대신 점진적 지연을 건다:
  //  - 하드 잠금은 남이 IP 를 바꿔가며 일부러 틀려 관리자 계정을 계속 잠그는 공격(DoS)에 악용되므로
  //  - 10회 실패 이후 시도마다 응답을 0.5초~5초 늦춰 대입 속도만 크게 떨어뜨린다(본인은 계속 로그인 가능)
  const failKey = `login-fail:${email}:${ip}`;
  const failAllKey = `login-fail-all:${email}`;
  const lockWait = rateLimit(failKey, LOGIN_FAIL_LIMIT, LOGIN_WINDOW_MS, false);
  if (lockWait > 0) {
    return { ok: false, message: `비밀번호를 여러 번 틀려 잠시 로그인이 제한되었습니다. ${formatWait(lockWait)} 후 다시 시도하세요.` };
  }
  const accountFails = hitCount(failAllKey, LOGIN_WINDOW_MS);
  if (accountFails >= LOGIN_SLOWDOWN_AFTER) {
    const delayMs = Math.min(5000, 500 * 2 ** Math.min(4, accountFails - LOGIN_SLOWDOWN_AFTER));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const db = getDb();
  const user = db.profiles.find((p) => p.email === email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    recordHit(failKey, LOGIN_WINDOW_MS);
    recordHit(failAllKey, LOGIN_WINDOW_MS);
    return { ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  if (process.env.NODE_ENV === "production" && PUBLIC_DEMO_PASSWORDS.has(password)) {
    return { ok: false, message: "공개된 예시 비밀번호는 사용할 수 없습니다. 관리자에게 비밀번호 재설정을 요청하세요." };
  }
  resetRateLimit(failKey);
  if (user.status === "withdrawn") {
    return { ok: false, message: "탈퇴한 계정입니다." };
  }
  if (user.status === "suspended") {
    return { ok: false, message: "정지된 계정입니다. 관리자에게 문의하세요." };
  }

  setSession(user.id, user.session_version ?? 0);
  if (user.status === "pending") redirect("/payment/activate");
  redirect(roleHome(user.role));
}

// --- 로그아웃 -----------------------------------------------------------
export async function logoutAction(): Promise<void> {
  // 세션 버전을 올려 이 계정으로 발급된 기존 세션 토큰(탈취된 쿠키 포함)을 모두 무효화한다.
  const userId = getSessionUserId();
  if (userId) {
    try {
      tx((db) => {
        const user = db.profiles.find((p) => p.id === userId);
        if (user) user.session_version = (user.session_version ?? 0) + 1;
      });
    } catch {
      /* 로그아웃 자체는 계속 진행 */
    }
  }
  clearSession();
  redirect("/login");
}

// --- 역할별 테스트 로그인 (FormData 없는 개별 액션) ----------------------
async function loginAs(email: string): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const db = getDb();
  const user = db.profiles.find((p) => p.email === email);
  if (!user) return;
  setSession(user.id, user.session_version ?? 0);
  redirect(roleHome(user.role));
}

export async function testLoginAdmin(): Promise<void> {
  // 프로덕션 환경에서는 테스트 로그인 비활성화
  if (process.env.NODE_ENV === "production") return;
  await loginAs("admin@vibefunny.com");
}

export async function testLoginCreator(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  await loginAs("creator_test@vibefunny.com");
}

export async function testLoginAdvertiser(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  await loginAs("advertiser_test@vibefunny.com");
}

export async function testLoginAgency(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  await loginAs("agency_test@vibefunny.com");
}
