// ===========================================================================
// 결제 프로바이더 추상화 (요구사항 13)
// ---------------------------------------------------------------------------
// MVP는 MockPaymentProvider. 운영 전환 시 TossPaymentProvider 등을 추가하고
// getPaymentProvider() 팩토리만 교체하면 된다. 비즈니스 로직은 프로바이더에
// 의존하지 않고 payments 레코드 상태(paid/failed)에만 반응한다.
// ===========================================================================

export interface PaymentInit {
  paymentId: string; // 내부 payments.id
  amount: number;
  orderName: string;
}

export interface PaymentResult {
  providerPaymentId: string;
  success: boolean;
  raw?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly name: string;
  /** 결제 준비 (PG 결제창 URL 등 반환 가능). Mock은 즉시 ready. */
  prepare(init: PaymentInit): Promise<{ redirectUrl?: string }>;
  /** 결제 승인 시도 → 성공/실패 결과 */
  confirm(init: PaymentInit, options?: { forceFail?: boolean }): Promise<PaymentResult>;
}

// --- Mock 구현 ----------------------------------------------------------
class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  async prepare(): Promise<{ redirectUrl?: string }> {
    return {};
  }

  async confirm(
    init: PaymentInit,
    options?: { forceFail?: boolean }
  ): Promise<PaymentResult> {
    // 프로덕션 환경에서 Mock 결제 차단 — 실제 PG 연동 필요
    if (process.env.NODE_ENV === "production") {
      console.error("[MockPaymentProvider] 프로덕션 환경에서 Mock 결제는 허용되지 않습니다. 실제 PG를 연동하세요.");
      return { providerPaymentId: `mock_blocked_${init.paymentId}`, success: false };
    }
    if (options?.forceFail) {
      return { providerPaymentId: `mock_fail_${init.paymentId}`, success: false };
    }
    return {
      providerPaymentId: `mock_${init.paymentId}`,
      success: true,
      raw: { mock: true, confirmedAt: new Date().toISOString() },
    };
  }
}

// --- Toss 자리 (TODO) ---------------------------------------------------
// class TossPaymentProvider implements PaymentProvider { ... }

/**
 * 실제로 결제를 받을 수 있는 상태인지.
 * 운영(production)에서 Mock 프로바이더는 모든 결제를 실패시키므로 결제창 대신 "결제 준비 중" 안내를 보여야 한다.
 */
export function paymentProviderReady(): boolean {
  const provider = process.env.PAYMENT_PROVIDER || "mock";
  // 아직 구현된 실제 PG가 없으므로(getPaymentProvider 는 모르는 값이면 Mock 반환) Mock 외 값도 운영에서는 준비 안 됨
  const implemented = new Set<string>([]);
  if (provider !== "mock" && implemented.has(provider)) return true;
  return process.env.NODE_ENV !== "production";
}

export function getPaymentProvider(): PaymentProvider {
  const provider = process.env.PAYMENT_PROVIDER || "mock";
  switch (provider) {
    case "mock":
    default:
      return new MockPaymentProvider();
    // case "toss": return new TossPaymentProvider();  // TODO
  }
}
