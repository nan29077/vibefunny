import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { roleHome } from "@/lib/routes";
import { ROLE_LABELS } from "@/lib/schema";
import { Card, LinkButton } from "@/components/ui";
import { MockCheckout } from "@/components/mock-checkout";

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

  // 이미 활성 회원이면 대시보드로
  if (user.status === "active") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <Card className="text-center">
          <IconPartyPopper size={48} className="text-amber-500 mx-auto" strokeWidth={1.5} />
          <h1 className="mt-3 text-xl font-bold">가입이 완료되었습니다!</h1>
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

  const db = getDb();
  const payment = db.payments.find(
    (p) =>
      p.user_id === user.id &&
      p.payment_type === "signup_fee" &&
      p.status === "pending"
  );

  if (!payment) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <Card className="text-center">
          <h1 className="text-xl font-bold text-gray-800">결제 정보 없음</h1>
          <p className="mt-1 text-sm text-gray-500">가입비 결제 내역을 찾을 수 없습니다.</p>
          <div className="mt-5">
            <LinkButton href="/" className="w-full">홈으로</LinkButton>
          </div>
        </Card>
      </main>
    );
  }

  const roleName = ROLE_LABELS[user.role] ?? user.role;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <h1 className="text-center text-2xl font-extrabold text-gray-900">
        시스템 및 프로그램 구입비 결제 안내
      </h1>
      <p className="mt-2 text-center text-sm leading-6 text-gray-500">
        서비스 이용을 시작하려면 최고관리자가 정책 설정에서 지정한 가입비를 결제해 주세요.
        결제가 완료되면 크리에이터 대시보드가 바로 활성화됩니다.
      </p>
      <div className="mt-6">
        <MockCheckout
          paymentId={payment.id}
          amount={payment.amount}
          orderName={`${roleName} 시스템 및 프로그램 구입비`}
        />
      </div>
    </main>
  );
}
