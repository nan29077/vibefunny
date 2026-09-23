"use client";

import { useFormState } from "react-dom";
import { Card, Field, Input } from "@/components/ui";
import { SubmitButton, FormMessage, initialActionState } from "@/components/form";
import { updateNicknameAction, changePasswordAction, updateCreatorEligibilityAction } from "@/lib/actions/settings-actions";

export function CreatorSettingsForms({
  name,
  email,
  nickname,
  roleLabel,
  referralCode,
  phone,
  joinedAt,
  creatorGender,
  creatorAgeGroup,
}: {
  name: string;
  email: string;
  nickname: string;
  roleLabel: string;
  referralCode: string;
  phone: string | null;
  joinedAt: string;
  creatorGender: string;
  creatorAgeGroup: string;
}) {
  const [nickState, nickAction] = useFormState(updateNicknameAction, initialActionState);
  const [pwState, pwAction] = useFormState(changePasswordAction, initialActionState);
  const [eligibilityState, eligibilityAction] = useFormState(updateCreatorEligibilityAction, initialActionState);

  const displayPreview = (nickname.trim() || name);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="text-lg font-bold text-gray-900">캠페인 참여 자격</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">광고주의 성별·연령 조건을 판정할 때 사용합니다. 팔로워 수는 인증된 채널 정보를 기준으로 합니다.</p>
        <form action={eligibilityAction} className="grid gap-3 sm:grid-cols-2">
          <Field label="성별" required>
            <select aria-label="성별" name="creator_gender" defaultValue={creatorGender} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required>
              <option value="" disabled>선택</option><option value="female">여성</option><option value="male">남성</option><option value="other">기타</option>
            </select>
          </Field>
          <Field label="연령대" required>
            <select aria-label="연령대" name="creator_age_group" defaultValue={creatorAgeGroup} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" required>
              <option value="" disabled>선택</option><option value="teens">10대</option><option value="20s">20대</option><option value="30s">30대</option><option value="40plus">40대 이상</option>
            </select>
          </Field>
          <div className="flex items-center gap-3 sm:col-span-2"><SubmitButton>참여 자격 저장</SubmitButton><FormMessage state={eligibilityState} /></div>
        </form>
      </Card>
      {/* 닉네임 설정 */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900">닉네임</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">
          닉네임은 이름이 표기되는 모든 화면(예: <span className="font-semibold">{displayPreview}({roleLabel})</span>)에 표시됩니다.
          실제 이름은 이 설정 화면에서만 확인할 수 있습니다.
        </p>
        <form action={nickAction} className="space-y-3">
          <Field label="닉네임" hint="비워두면 실제 이름으로 표시됩니다. (최대 20자)">
            <Input name="nickname" defaultValue={nickname} maxLength={20} placeholder="예: 영상장인" />
          </Field>
          <div className="flex items-center gap-3">
            <SubmitButton>닉네임 저장</SubmitButton>
            <FormMessage state={nickState} />
          </div>
        </form>
      </Card>

      {/* 비밀번호 변경 */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900">비밀번호 변경</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">보안을 위해 주기적으로 비밀번호를 변경하세요.</p>
        <form action={pwAction} className="space-y-3 max-w-md">
          <Field label="현재 비밀번호" required>
            <Input type="password" name="current_password" autoComplete="current-password" />
          </Field>
          <Field label="새 비밀번호" required hint="8자 이상">
            <Input type="password" name="new_password" autoComplete="new-password" />
          </Field>
          <Field label="새 비밀번호 확인" required>
            <Input type="password" name="confirm_password" autoComplete="new-password" />
          </Field>
          <div className="flex items-center gap-3">
            <SubmitButton>비밀번호 변경</SubmitButton>
            <FormMessage state={pwState} />
          </div>
        </form>
      </Card>

      {/* 계정 정보 (실제 이름은 여기서만 확인) */}
      <Card>
        <h2 className="text-lg font-bold text-gray-900">계정 정보</h2>
        <p className="mt-1 mb-4 text-sm text-gray-500">실제 이름은 본인만 이 화면에서 확인할 수 있습니다.</p>
        <dl className="space-y-3 text-sm">
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">실제 이름</dt>
            <dd className="text-gray-900">{name}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">표시 이름</dt>
            <dd className="text-gray-900">{displayPreview} <span className="text-gray-400">({roleLabel})</span></dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">이메일</dt>
            <dd className="text-gray-900">{email}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">전화번호</dt>
            <dd className="text-gray-900">{phone ?? "미등록"}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">추천 코드</dt>
            <dd className="font-mono font-bold text-brand-purple">{referralCode}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">가입일</dt>
            <dd className="text-gray-400">{joinedAt}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
