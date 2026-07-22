"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { requestPayoutAction } from "@/lib/actions/payout-actions";
import { Field, Input } from "@/components/ui";
import { SubmitButton, FormMessage, FieldError, initialActionState } from "@/components/form";
import { formatKRW } from "@/lib/money";

export function PayoutForm({ available }: { available: number }) {
  const [state, formAction] = useFormState(requestPayoutAction, initialActionState);
  const [showRrn, setShowRrn] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-gray-500">
        출금 가능 금액: <span className="font-bold text-brand-purple">{formatKRW(available)}</span>
      </p>
      <Field label="출금액(원)" required>
        <Input type="number" name="amount" min={1} max={available} required />
        <FieldError state={state} name="amount" />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="은행" required>
          <Input name="bank_name" placeholder="국민은행" required />
        </Field>
        <Field label="계좌번호" required>
          <Input name="bank_account_number" placeholder="000-00-000000" required />
        </Field>
        <Field label="예금주" required>
          <Input name="account_holder" required />
        </Field>
      </div>

      {/* 주민등록번호 섹션 */}
      <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-400 text-xs font-bold text-white">!</div>
          <div>
            <div className="text-sm font-bold text-orange-800">원천징수(3.3%) 안내</div>
            <div className="mt-1 text-xs leading-relaxed text-orange-700">
              수익금에는 소득세 3% + 지방소득세 0.3% = <strong>원천징수 3.3%</strong>가 적용됩니다.
              원활한 세무 처리를 위해 주민등록번호를 수집합니다.
              <br />
              <span className="mt-1 block font-semibold text-orange-800">
                수집된 주민등록번호는 원천징수 신고 완료 즉시 폐기되며, 그 외 목적으로 일절 사용되지 않습니다.
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={showRrn}
              onChange={(e) => setShowRrn(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            주민등록번호를 입력하겠습니다 (선택)
          </label>
        </div>

        {showRrn && (
          <div className="mt-3">
            <Field label="주민등록번호">
              <Input
                name="resident_id_number"
                placeholder="000000-0000000"
                maxLength={14}
                className="tracking-widest"
              />
            </Field>
            <p className="mt-1.5 text-xs text-orange-600">
              형식: 생년월일 6자리 - 뒤 7자리 (예: 901231-1234567)
            </p>
          </div>
        )}
      </div>

      <FormMessage state={state} />
      <SubmitButton>출금 신청</SubmitButton>
    </form>
  );
}
