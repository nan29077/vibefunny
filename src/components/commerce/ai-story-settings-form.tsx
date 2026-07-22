"use client";

import { useFormState } from "react-dom";
import { Card, Field, Input } from "@/components/ui";
import { SubmitButton, FormMessage, initialActionState } from "@/components/form";
import { saveAiStorySettingsAction } from "@/lib/actions/commerce-actions";
import type { AiStorySettings } from "@/lib/schema";

export function AiStorySettingsForm({ settings }: { settings: AiStorySettings }) {
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
          <Field label="API Key">
            <Input name="api_key" type="password" defaultValue={settings.api_key} placeholder="AI스토리 API Key" />
          </Field>
          <Field label="Webhook 시크릿" hint="동화 의뢰 수신 서명 검증용">
            <Input name="webhook_secret" type="password" defaultValue={settings.webhook_secret} placeholder="Webhook Secret" />
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
