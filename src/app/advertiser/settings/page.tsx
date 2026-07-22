import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/date";
import { getDb } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";

export default function SettingsProfilePage() {
  const user = requireRole("advertiser");
  const db = getDb();

  return (
    <div className="space-y-6">
      <PageHeader title="내 계정 정보" description="프로필 및 계정 정보를 확인하세요." />

      <Card>
        <dl className="space-y-3 text-sm">
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">이름</dt>
            <dd className="text-gray-900">{user.name}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">이메일</dt>
            <dd className="text-gray-900">{user.email}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">전화번호</dt>
            <dd className="text-gray-900">{user.phone ?? "미등록"}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">계정 유형</dt>
            <dd className="text-gray-900">
              {user.advertiser_type === "execution_company" ? "실행사" : "대행사"}
            </dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">추천 코드</dt>
            <dd className="font-mono font-bold text-brand-purple">{user.referral_code}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">상태</dt>
            <dd className="text-gray-900">{user.status}</dd>
          </div>
          <div className="flex gap-4">
            <dt className="w-28 shrink-0 font-medium text-gray-500">가입일</dt>
            <dd className="text-gray-400">{formatDate(user.created_at)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
