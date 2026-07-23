"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { tx, getDb } from "../db";
import { genId, genReferralCode, hashPassword, verifyPassword } from "../crypto";
import { setSession, clearSession } from "../session";
import { audit } from "../services";
import type { AdvertiserType, Payment, Profile, Role } from "../schema";
import type { ActionState } from "@/components/form";
import { roleHome } from "../routes";
import { randomProfileAvatar } from "../profile-avatars";
import { normalizeEmail } from "../email-verification";

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
    referral_code: (formData.get("referral_code") as string)?.trim() || undefined,
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

  let redirectTo: string | null = null;
  const result = tx<ActionState>((db) => {
    if (db.profiles.some((p) => normalizeEmail(p.email) === data.email)) {
      return { ok: false, message: "이미 가입된 이메일입니다." };
    }

    const emailVerification = [...db.email_verifications]
      .filter((item) => item.email === data.email && item.verified_at && !item.consumed_at)
      .sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at))[0];
    if (!emailVerification || Date.parse(emailVerification.expires_at) < Date.now()) {
      return {
        ok: false,
        message: "이메일 인증을 완료한 후 가입해 주세요.",
        fieldErrors: { email: "이메일 인증이 필요합니다." } as Record<string, string>,
      };
    }

    if (role === "creator" && db.settings.referral_system_enabled && !data.referral_code) {
      return {
        ok: false,
        message: "현재 추천인 제도가 운영 중이므로 추천인 코드를 입력해야 합니다.",
        fieldErrors: { referral_code: "추천인 코드는 필수입니다." } as Record<string, string>,
      };
    }

    // 추천인 확인 (추천인 제도가 비활성화 상태면 코드 무시)
    let referredBy: Profile | null = null;
    if (data.referral_code && db.settings.referral_system_enabled) {
      referredBy =
        db.profiles.find((p) => p.referral_code === data.referral_code) ?? null;
      if (!referredBy) {
        return {
          ok: false,
          message: "유효하지 않은 추천인 코드입니다.",
          fieldErrors: { referral_code: "존재하지 않는 코드" } as Record<string, string>,
        };
      }
    }

    // 대행사는 실행사 코드로만 가입 가능
    if (role === "advertiser" && advertiserType === "agency") {
      if (!data.referral_code) {
        return {
          ok: false,
          message: "대행사는 실행사의 추천인 코드로만 가입할 수 있습니다.",
          fieldErrors: { referral_code: "실행사 추천 코드 필수" } as Record<string, string>,
        };
      }
      if (!referredBy || referredBy.role !== "advertiser" || referredBy.advertiser_type !== "execution_company") {
        return {
          ok: false,
          message: "유효한 실행사 코드가 아닙니다. 실행사로부터 추천 코드를 받아 입력하세요.",
          fieldErrors: { referral_code: "실행사 코드만 사용 가능" } as Record<string, string>,
        };
      }
    }

    // 대행사가 실행사 코드로 가입한 경우 상위 실행사 연결
    let parentAdvertiserId: string | null = null;
    if (
      role === "advertiser" &&
      advertiserType === "agency" &&
      referredBy &&
      referredBy.role === "advertiser" &&
      referredBy.advertiser_type === "execution_company"
    ) {
      parentAdvertiserId = referredBy.id;
    }

    // 가입비 설정 확인
    const fee = db.settings.fees[role];
    const needsSignupFee = fee.signup_fee_enabled && fee.signup_fee_amount > 0;

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
      // 가입비 없음 -> 즉시 active / 있음 -> 결제 대기 pending
      status: needsSignupFee ? "pending" : "active",
      avatar_url: randomProfileAvatar(),
      subscription_active_until: null,
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
      if (parentAdvertiserId) {
        db.referral_relations.push({
          id: genId(),
          referrer_id: parentAdvertiserId,
          referee_id: user.id,
          referral_type: "advertiser_hierarchy",
          created_at: now(),
        });
      }
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

    setSession(user.id);
    redirectTo = needsSignupFee ? "/payment/activate" : roleHome(role);
    return { ok: true };
  });

  if (result.ok && redirectTo) redirect(redirectTo);
  return result;
}

// --- 로그인 -------------------------------------------------------------
export async function loginAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  if (!email || !password) {
    return { ok: false, message: "이메일과 비밀번호를 입력하세요." };
  }

  const db = getDb();
  const user = db.profiles.find((p) => p.email === email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  if (user.status === "withdrawn") {
    return { ok: false, message: "탈퇴한 계정입니다." };
  }

  setSession(user.id);
  if (user.status === "pending") redirect("/payment/activate");
  redirect(roleHome(user.role));
}

// --- 로그아웃 -----------------------------------------------------------
export async function logoutAction(): Promise<void> {
  clearSession();
  redirect("/login");
}

// --- 역할별 테스트 로그인 (FormData 없는 개별 액션) ----------------------
async function loginAs(email: string): Promise<void> {
  const db = getDb();
  const user = db.profiles.find((p) => p.email === email);
  if (!user) return;
  setSession(user.id);
  redirect(roleHome(user.role));
}

export async function testLoginAdmin(): Promise<void> {
  await loginAs("admin@vibefunny.com");
}

export async function testLoginCreator(): Promise<void> {
  await loginAs("creator_test@vibefunny.com");
}

export async function testLoginAdvertiser(): Promise<void> {
  await loginAs("advertiser_test@vibefunny.com");
}

export async function testLoginAgency(): Promise<void> {
  await loginAs("agency_test@vibefunny.com");
}
