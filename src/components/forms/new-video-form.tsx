"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { createVideoAction } from "@/lib/actions/video-actions";
import { Card, Field, Input, Textarea, Select } from "@/components/ui";
import { SubmitButton, FormMessage, FieldError, initialActionState } from "@/components/form";
import { PLATFORM_LABELS, type Platform } from "@/lib/schema";

interface Cat {
  id: string;
  name: string;
  platform: Platform;
}

export function NewVideoForm({ categories }: { categories: Cat[] }) {
  const [state, formAction] = useFormState(createVideoAction, initialActionState);
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
        <Field label="설명">
          <Textarea name="description" placeholder="영상 소개, 사용처 등" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="플랫폼" required>
            <Select name="platform" value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
              {platforms.map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </Select>
          </Field>
          <Field label="카테고리">
            <Select name="category_id" defaultValue="">
              <option value="">선택 안함</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="영상 길이(초)" required>
            <Input type="number" name="duration_seconds" min={1} required />
            <FieldError state={state} name="duration_seconds" />
          </Field>
          <Field label="판매 가격(원)" required>
            <Input type="number" name="price" min={0} required />
            <FieldError state={state} name="price" />
          </Field>
        </div>
        <Field label="태그" hint="쉼표로 구분 (예: 유머, 강아지)">
          <Input name="tags" />
        </Field>
        <Field label="원본 영상 URL" required hint="실제 서비스에서는 비공개 스토리지에 업로드되고 결제 후 signed URL로만 제공됩니다.">
          <Input name="original_video_url" placeholder="https://storage/.../original.mp4" required />
          <FieldError state={state} name="original_video_url" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="미리보기(워터마크) URL">
            <Input name="preview_video_url" placeholder="https://.../preview.mp4" />
          </Field>
          <Field label="썸네일 URL">
            <Input name="thumbnail_url" placeholder="https://.../thumb.jpg" />
          </Field>
        </div>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" name="copyright_confirmed" className="mt-0.5" />
          <span>본 영상의 저작권을 보유하고 있으며 판매 권한이 있음을 확인합니다. (필수)</span>
        </label>
        <FieldError state={state} name="copyright_confirmed" />
        <FormMessage state={state} />
        <SubmitButton>등록하기</SubmitButton>
      </form>
    </Card>
  );
}
