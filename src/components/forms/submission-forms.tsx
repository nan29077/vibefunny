"use client";

import { useFormState } from "react-dom";
import { createSubmissionAction, addCommentAction, rejectSubmissionAction } from "@/lib/actions/submission-actions";
import { Field, Input, Textarea } from "@/components/ui";
import { SubmitButton, FormMessage, FieldError, initialActionState } from "@/components/form";
import { FileUpload } from "./file-upload";

// === 크리에이터: 제출 폼 =============================================
export function SubmissionForm({ campaignId }: { campaignId: string }) {
  const [state, formAction] = useFormState(createSubmissionAction, initialActionState);
  return (
    <form action={formAction} className="space-y-3 rounded-xl bg-gray-50 p-4">
      <div className="text-sm font-semibold text-gray-700">제출하기</div>
      <input type="hidden" name="campaign_id" value={campaignId} />
      <Field label="설명" required>
        <Textarea
          name="description"
          placeholder="완성된 영상에 대한 설명, 배포 결과 등을 입력하세요."
          className="min-h-[70px]"
          required
        />
        <FieldError state={state} name="description" />
      </Field>
      <Field label="파일 첨부 (이미지 / 동영상)">
        <FileUpload
          name="file"
          accept="image/*,video/*"
          label="파일 업로드"
          hint="완성된 영상이나 배포 증빙 이미지를 첨부하세요."
        />
      </Field>
      <FormMessage state={state} />
      <SubmitButton size="sm">제출하기</SubmitButton>
    </form>
  );
}

// === 광고주: 반려 폼 (사유 입력) ======================================
export function RejectSubmissionForm({ submissionId }: { submissionId: string }) {
  const [state, formAction] = useFormState(rejectSubmissionAction, initialActionState);
  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-xl border border-red-100 bg-red-50 p-3">
      <div className="text-xs font-semibold text-red-700">반려 사유 입력</div>
      <input type="hidden" name="submission_id" value={submissionId} />
      <div>
        <Input
          name="reject_reason"
          placeholder="반려 사유를 입력하세요 (필수)"
          className="text-sm"
          required
        />
        <FieldError state={state} name="reject_reason" />
      </div>
      <FormMessage state={state} />
      <SubmitButton size="sm" variant="danger">반려 처리</SubmitButton>
    </form>
  );
}

// === 공통: 댓글 폼 ====================================================
export function CommentForm({ submissionId }: { submissionId: string }) {
  const [state, formAction] = useFormState(addCommentAction, initialActionState);
  return (
    <form action={formAction} className="flex gap-2 mt-2">
      <input type="hidden" name="submission_id" value={submissionId} />
      <Input
        name="content"
        placeholder="댓글을 입력하세요..."
        className="flex-1 text-sm"
        required
      />
      <SubmitButton size="sm" variant="outline">등록</SubmitButton>
      {state.message && !state.ok && (
        <span className="text-xs text-red-500 self-center">{state.message}</span>
      )}
    </form>
  );
}
