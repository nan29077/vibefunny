import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { roleHome } from "@/lib/routes";
import { ROLE_LABELS } from "@/lib/schema";
import { Card, LinkButton } from "@/components/ui";
import { MockCheckout } from "@/components/mock-checkout";
import { paymentProviderReady } from "@/lib/payment/provider";
import { SubmitButton } from "@/components/form";
import { retrySignupPaymentAction } from "@/lib/actions/payment-actions";
import { isVibeMember, GENERAL_MEMBER_LABEL, VIBE_MEMBER_LABEL } from "@/lib/membership";
import { formatKRW } from "@/lib/money";

function IconPartyPopper({ size = 24, className, strokeWidth = 2 }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5.8 11.3 2 22l10.7-3.79"/>
      <path d="M4 3h.01"/>
      <path d="M22 8h.01"/>
      <path d="M15 2h.01"/>
      <path d="M22 20h.01"/>
      <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/>
      <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17"/>
      <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7"/>
      <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/>
    </svg>
  );
}

export default function ActivatePage() {
  const user = getCurrentUser();
  if (!user) redirect("/login");

  const db0 = getDb();
  const isCreator = user.role === "creator";
  // 결제가 끝난 회원: 크리에이터는 바이브회원, 그 밖의 역할은 활성(active)
  const done = isCreator ? isVibeMember(db0, user) : user.status === "active";
  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <Card className="text-center">
          <IconPartyPopper size={48} className="text-amber-500 mx-auto" strokeWidth={1.5} />
          <h1 className="mt-3 text-xl font-bold">{isCreator ? `${VIBE_MEMBER_LABEL}이 되었습니다!` : "가입이 완료되었습니다!"}</h1>
          <p className="mt-1 text-sm text-gray-500">이제 모든 기능을 이용할 수 있어요.</p>
          <div className="mt-5">
            <LinkButton href={roleHome(user.role)} className="w-full">
              대시보드로 이동
            </LinkButton>
          </div>
        </Card>
      </main>
    );
  }

  const db = db0;
  // 가입비를 이미 냈는데 바이브회원이 아닌 경우(관리자 조정 등) — 다시 결제시키지 않고 문의로 안내
  const alreadyPaid = db.payments.some((p) => p.user_id === user.id && p.payment_type === "signup_fee" && p.status === "paid");
  if (alreadyPaid) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <Card className="text-center">
          <h1 className="text-xl font-bold text-gray-800">가입비 결제 기록이 있습니다</h1>
          <p className="mt-2 text-sm text-gray-500">
            이미 가입비를 결제한 기록이 있어 다시 결제하지 않습니다. 회원 등급 확인이 필요하시면 고객센터(문의하기)로 연락해 주세요.
          </p>
          <div className="mt-5">
            <LinkButton href={roleHome(user.role)} className="w-full">대시보드로 이동</LinkButton>
          </div>
        </Card>
      </main>
    );
  }
  const currentFee = db.settings.fees[user.role]?.signup_fee_amount ?? 0;
  const payment = db.payments.find(
    (p) =>
      p.user_id === user.id &&
      p.payment_type === "signup_fee" &&
      p.status === "pending" &&
      p.amount === currentFee
  );
  // 크리에이터 일반회원은 결제를 미루고 먼저 둘러볼 수 있다
  const laterLink = isCreator ? (
    <div className="mt-3">
      <LinkButton href="/creator" variant="outline" className="w-full">나중에 결제하고 {GENERAL_MEMBER_LABEL}으로 둘러보기</LinkButton>
    </div>
  ) : null;

  if (!payment) {
    // 결제 실패·취소 등으로 대기 중인 가입비 결제가 없는 경우 → 다시 결제할 수 있게 안내
    const lastFailed = [...db.payments]
      .filter((p) => p.user_id === user.id && p.payment_type === "signup_fee")
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <Card className="text-center">
          <h1 className="text-xl font-bold text-gray-800">{isCreator ? `가입비를 결제하고 ${VIBE_MEMBER_LABEL}이 되세요` : "가입비 결제를 다시 진행해 주세요"}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {lastFailed && lastFailed.status === "failed"
              ? "이전 결제가 완료되지 않았습니다. 아래 버튼을 눌러 다시 결제할 수 있습니다."
              : `가입비 ${formatKRW(currentFee)}을 결제하면 캠페인·쇼츠 커머스·AI 숏츠 등 수익 기능을 이용할 수 있습니다.`}
          </p>
          <form action={retrySignupPaymentAction} className="mt-5">
            <SubmitButton className="w-full">{lastFailed ? "가입비 결제 다시 하기" : "가입비 결제 시작하기"}</SubmitButton>
          </form>
          {laterLink ?? (
            <div className="mt-3">
              <LinkButton href="/" variant="outline" className="w-full">홈으로</LinkButton>
            </div>
          )}
        </Card>
      </main>
    );
  }

  const roleName = ROLE_LABELS[user.role] ?? user.role;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <h1 className="text-center text-2xl font-extrabold text-gray-900">
        가입비 결제 안내
      </h1>
      <p className="mt-2 text-center text-sm leading-6 text-gray-500">
        {isCreator
          ? `지금은 ${GENERAL_MEMBER_LABEL}입니다. 가입비를 결제하면 바로 ${VIBE_MEMBER_LABEL}으로 전환되어 캠페인 참여, 영상 제작 의뢰, 쇼츠 커머스, AI 숏츠, 출금, SNS 맞구독을 이용할 수 있고, 내 추천 코드로 멘티를 받을 수 있습니다.`
          : "서비스 이용을 시작하려면 최고관리자가 정책 설정에서 지정한 가입비를 결제해 주세요."}
      </p>
      <div className="mt-6">
        <MockCheckout
          paymentId={payment.id}
          amount={payment.amount}
          orderName={`${roleName} 가입비`}
          ready={paymentProviderReady()}
        />
      </div>
      {laterLink}
    </main>
  );
}
