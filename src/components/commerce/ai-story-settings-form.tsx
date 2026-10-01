"use client";

import { useFormState } from "react-dom";
import { Card, Field, Input } from "@/components/ui";
import { SubmitButton, FormMessage, initialActionState } from "@/components/form";
import { saveAiStorySettingsAction } from "@/lib/actions/commerce-actions";
import type { AiStorySettings } from "@/lib/schema";

export function AiStorySettingsForm({
  settings,
  secretHints,
}: {
  /** api_key·webhook_secret 은 빈 값으로 넘어온다 — 화면 HTML 에 비밀값을 싣지 않기 위함 */
  settings: AiStorySettings;
  secretHints: { api_key: string; webhook_secret: string };
}) {
  const [state, action] = useFormState(saveAiStorySettingsAction, initialActionState);
  return (
    <form action={action} className="space-y-6">
      <Card>
        <h2 className="mb-1 text-base font-bold">AI스토리 연동 설정</h2>
        <p className="mb-4 text-sm text-gray-500">
          AI스토리 앱에서 들어오는 동화 제작 의뢰를 연동하기 위한 설정입니다. 키 입력 전에는 연동 준비(미리보기) 상태로 동작합니다.
        </p>
        <label className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-800">
          <input type="checkbox" name="enabled" defaultChecked={settings.enabled} className="h-4 w-4 rounded border-gray-300" />
          실제 연동 사용 (체크 해제 시 연동 준비 상태)
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="API Base URL" className="sm:col-span-2">
            <Input name="api_base" defaultValue={settings.api_base} placeholder="https://api.ai-story.example.com" />
          </Field>
          <Field label="API Key" hint={secretHints.api_key ? `저장됨 ${secretHints.api_key} · 변경할 때만 입력` : "미입력"}>
            <Input name="api_key" type="password" autoComplete="off" placeholder={secretHints.api_key ? "변경할 때만 입력" : "AI스토리 API Key"} />
            {secretHints.api_key && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" name="clear_api_key" className="h-3.5 w-3.5 rounded border-gray-300" /> 저장된 값 삭제
              </label>
            )}
          </Field>
          <Field label="Webhook 시크릿" hint={secretHints.webhook_secret ? `저장됨 ${secretHints.webhook_secret} · 동화 의뢰 수신 서명 검증용` : "동화 의뢰 수신 서명 검증용"}>
            <Input name="webhook_secret" type="password" autoComplete="off" placeholder={secretHints.webhook_secret ? "변경할 때만 입력" : "Webhook Secret"} />
            {secretHints.webhook_secret && (
              <label className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <input type="checkbox" name="clear_webhook_secret" className="h-3.5 w-3.5 rounded border-gray-300" /> 저장된 값 삭제
              </label>
            )}
          </Field>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="auto_import" defaultChecked={settings.auto_import} className="h-4 w-4 rounded border-gray-300" />
          동화 제작 의뢰 자동 수신 (수신 시 동화 제작 캠페인 자동 생성)
        </label>
      </Card>
      <div className="flex items-center gap-3">
        <SubmitButton size="lg">설정 저장</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
