import { Card, LinkButton } from "@/components/ui";
import { formatKRW } from "@/lib/money";
import { GENERAL_MEMBER_LABEL, VIBE_MEMBER_LABEL } from "@/lib/membership";

/** 일반회원(가입비 결제 전)에게 보여 주는 바이브회원 전용 안내 */
export function VibeOnlyNotice({ feature, signupFee, compact = false }: { feature: string; signupFee: number; compact?: boolean }) {
  return (
    <Card className={`border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 ${compact ? "" : "py-8 text-center"}`}>
      <div className={compact ? "flex flex-wrap items-center justify-between gap-3" : "space-y-3"}>
        <div>
          <div className="font-bold text-amber-900">{feature} 기능은 {VIBE_MEMBER_LABEL} 전용입니다</div>
          <div className="mt-1 text-sm text-amber-800">
            지금은 {GENERAL_MEMBER_LABEL}입니다. 가입비({formatKRW(signupFee)})를 결제하면 바로 {VIBE_MEMBER_LABEL}으로 전환되어 이용할 수 있습니다.
          </div>
        </div>
        <LinkButton href="/payment/activate" size={compact ? "sm" : undefined}>가입비 결제하고 {VIBE_MEMBER_LABEL} 되기</LinkButton>
      </div>
    </Card>
  );
}
