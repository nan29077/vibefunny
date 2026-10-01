"use client";

import { useFormState } from "react-dom";
import { Card, Field, Input, Select } from "@/components/ui";
import { SubmitButton, FormMessage, initialActionState } from "@/components/form";
import { saveCafe24SettingsAction } from "@/lib/actions/commerce-actions";
import type { Cafe24Settings } from "@/lib/schema";

export function Cafe24SettingsForm({
  settings,
  secretHints,
  defaultCommission,
}: {
  /** 비밀값(client_secret·토큰)은 빈 값으로 넘어온다 — 화면 HTML 에 비밀값을 싣지 않기 위함 */
  settings: Cafe24Settings;
  secretHints: { client_secret: string; access_token: string; refresh_token: string };
  defaultCommission: number;
}) {
  const [state, action] = useFormState(saveCafe24SettingsAction, initialActionState);

  return (
    <form action={action} className="space-y-6">
      <Card>
        <h2 className="mb-1 text-base font-bold">카페24 Open API 연동</h2>
        <p className="mb-4 text-sm text-gray-500">
          아래 값을 입력하고 &quot;실제 연동 사용&quot;을 켜면 상품 등록 시 카페24에 자동 등록됩니다.
          입력 전에는 미리보기(mock) 모드로 동작합니다.
        </p>
        <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <input
            type="checkbox" name="enabled" defaultChecked={settings.enabled}
            className="h-4 w-4 rounded border-gray-300"
          />
          실제 연동 사용 (체크 해제 시 미리보기 모드)
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="몰 아이디 (mall_id)" hint="예: myshop → myshop.cafe24.com">
            <Input name="mall_id" defaultValue={settings.mall_id} placeholder="myshop" />
          </Field>
          <Field label="API 버전">
            <Input name="api_version" defaultValue={settings.api_version || "2024-06-01"} />
          </Field>
          <Field label="Client ID">
            <Input name="client_id" defaultValue={settings.client_id} placeholder="앱 Client ID" />
          </Field>
          <Field label="Client Secret" hint={secretHints.client_secret ? `저장됨 ${secretHints.client_secret} · 변경할 때만 입력` : "미입력"}>
            <Input name="client_secret" type="password" autoComplete="off" placeholder={secretHints.client_secret ? "변경할 때만 입력" : "앱 Client Secret"} />
            {secretHints.client_secret && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" name="clear_client_secret" className="h-3.5 w-3.5 rounded border-gray-300" /> 저장된 값 삭제
              </label>
            )}
          </Field>
          <Field label="Access Token" hint={secretHints.access_token ? `저장됨 ${secretHints.access_token} · 변경할 때만 입력` : "미입력"}>
            <Input name="access_token" type="password" autoComplete="off" placeholder={secretHints.access_token ? "변경할 때만 입력" : "OAuth Access Token"} />
            {secretHints.access_token && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" name="clear_access_token" className="h-3.5 w-3.5 rounded border-gray-300" /> 저장된 값 삭제
              </label>
            )}
          </Field>
          <Field label="Refresh Token" hint={secretHints.refresh_token ? `저장됨 ${secretHints.refresh_token} · 변경할 때만 입력` : "미입력"}>
            <Input name="refresh_token" type="password" autoComplete="off" placeholder={secretHints.refresh_token ? "변경할 때만 입력" : "OAuth Refresh Token"} />
            {secretHints.refresh_token && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" name="clear_refresh_token" className="h-3.5 w-3.5 rounded border-gray-300" /> 저장된 값 삭제
              </label>
            )}
          </Field>
          <Field label="쇼핑몰 번호 (shop_no)">
            <Input type="number" name="shop_no" min={1} defaultValue={settings.shop_no || 1} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-1 text-base font-bold">쇼츠 커머스 기본값</h2>
        <Field label="기본 판매 수수료율" hint="상품 등록 시 기본값으로 적용되는 크리에이터 수수료율(%)">
          <Input type="number" name="default_commission_rate" min={0} max={90} defaultValue={defaultCommission} />
        </Field>
      </Card>

      <div className="flex items-center gap-3">
        <SubmitButton size="lg">설정 저장</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
