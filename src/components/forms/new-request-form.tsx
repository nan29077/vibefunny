"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createRequestAction } from "@/lib/actions/request-actions";
import { Card, Field, Input, Textarea, Select } from "@/components/ui";
import { SubmitButton, FormMessage, FieldError, initialActionState } from "@/components/form";
import { PLATFORM_LABELS, type Platform } from "@/lib/schema";

interface Cat { id: string; name: string; platform: Platform; }
interface Creator { id: string; name: string; }

export function NewRequestForm({
  categories,
  creators,
}: {
  categories: Cat[];
  creators: Creator[];
}) {
  const [state, formAction] = useFormState(createRequestAction, initialActionState);
  const [platform, setPlatform] = useState<Platform>("youtube");
  const platforms: Platform[] = ["youtube", "instagram", "tiktok"];
  const cats = categories.filter((c) => c.platform === platform);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <Field label="제목" required>
          <Input name="title" required />
          <FieldError state={state} name="title" />
        </Field>
        <Field label="상세 요구사항" required>
          <Textarea name="requirements" placeholder="영상 컨셉, 분위기, 필수 포함 내용 등" required />
          <FieldError state={state} name="requirements" />
        </Field>
        <Field label="참고 링크">
          <Input name="reference_links" placeholder="https://..." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="플랫폼 용도" required>
            <Select name="platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
              {platforms.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
            </Select>
          </Field>
          <Field label="카테고리">
            <Select name="category_id" defaultValue="">
              <option value="">선택 안함</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="원하는 영상 길이(초)" required>
            <Input type="number" name="duration_seconds" min={1} defaultValue={30} required />
          </Field>
          <Field label="예산(원)" required>
            <Input type="number" name="budget" min={1} required />
            <FieldError state={state} name="budget" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="희망 납기일">
            <Input type="date" name="due_date" />
          </Field>
          <Field label="특정 VIBEFUNNY 회원 지정" hint="미지정 시 공개 의뢰됩니다.">
            <Select name="designated_creator_id" defaultValue="">
              <option value="">공개 의뢰</option>
              {creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <FormMessage state={state} />
        <p className="text-xs text-gray-400">제출 후 예산 결제(Mock)가 진행되며, 결제 완료 시 의뢰가 공개됩니다.</p>
        <SubmitButton>의뢰 등록 후 결제</SubmitButton>
      </form>
    </Card>
  );
}
