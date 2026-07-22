import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, LinkButton } from "@/components/ui";
import { MockCheckout } from "@/components/mock-checkout";
import { PAYMENT_TYPE_LABELS } from "@/lib/labels";
import { IconCheckCircle } from "@/components/icons";

function IconXCircle({ size = 24, className, strokeWidth = 2 }: { size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="15" y1="9" x2="9" y2="15"/>
      <line x1="9" y1="9" x2="15" y2="15"/>
    </svg>
  );
}

export default function CheckoutPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { next?: string };
}) {
  const user = getCurrentUser();
  if (!user) redirect("/login");

  const db = getDb();
  const payment = db.payments.find((p) => p.id === params.id);
  const next = searchParams.next || "/";

  if (!payment || payment.user_id !== user.id) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <Card className="text-center text-sm text-gray-500">결제 정보를 찾을 수 없습니다.</Card>
      </main>
    );
  }

  const orderName = PAYMENT_TYPE_LABELS[payment.payment_type] ?? "결제";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-5 py-10">
      <h1 className="text-center text-2xl font-extrabold text-gray-900">{orderName} 결제</h1>

      {payment.status === "pending" && (
        <MockCheckout paymentId={payment.id} amount={payment.amount} orderName={orderName} />
      )}

      {payment.status === "paid" && (
        <Card className="text-center">
          <IconCheckCircle size={48} className="text-green-500 mx-auto" strokeWidth={1.5} />
          <h2 className="mt-3 text-lg font-bold">결제가 완료되었습니다!</h2>
          <div className="mt-5">
            <LinkButton href={next} className="w-full">계속하기</LinkButton>
          </div>
        </Card>
      )}

      {payment.status === "failed" && (
        <Card className="text-center">
          <IconXCircle size={48} className="text-red-500 mx-auto" strokeWidth={1.5} />
          <h2 className="mt-3 text-lg font-bold">결제에 실패했습니다.</h2>
          <p className="mt-1 text-sm text-gray-500">다시 시도해 주세요.</p>
          <div className="mt-5">
            <LinkButton href={`/payment/${payment.id}`} className="w-full">
              다시 시도
            </LinkButton>
          </div>
        </Card>
      )}
    </main>
  );
}
