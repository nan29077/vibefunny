import { getDb } from "@/lib/db";
import { PageHeader, Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { AdminInquiries } from "@/components/support/admin-inquiries";
import { updateSupportHoursAction } from "@/lib/actions/site-actions";
import { supportHoursConfig } from "@/lib/support-hours";

export const dynamic = "force-dynamic";

export default function AdminInquiriesPage() {
  const settings = getDb().settings;
  const hours = supportHoursConfig(settings);

  return (
    <div className="space-y-6">
      <PageHeader title="회원 문의" description="회원별 문의 내역을 확인하고 문의 가능한 운영 시간을 관리합니다." />
      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">문의 가능 시간 설정</h2>
            <p className="mt-1 text-sm text-gray-500">설정 시간 밖에는 회원이 새 문의를 보낼 수 없습니다. 시간 기준은 대한민국 표준시입니다.</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${hours.enabled ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}`}>
            {hours.enabled ? `현재 ${hours.start}~${hours.end}` : "현재 24시간 문의 가능"}
          </span>
        </div>
        <form action={updateSupportHoursAction} className="mt-5 space-y-4">
          <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <input type="checkbox" name="support_hours_enabled" defaultChecked={hours.enabled} className="mt-0.5 h-4 w-4 rounded" />
            <span><b className="block text-sm text-gray-900">문의 가능 시간 제한 사용</b><span className="mt-1 block text-xs text-gray-500">체크를 해제하면 회원 문의를 24시간 받을 수 있습니다.</span></span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="문의 시작 시간">
              <Input type="time" name="support_hours_start" defaultValue={hours.start} required />
            </Field>
            <Field label="문의 종료 시간">
              <Input type="time" name="support_hours_end" defaultValue={hours.end} required />
            </Field>
          </div>
          <SubmitButton>문의 시간 저장</SubmitButton>
        </form>
      </Card>
      <AdminInquiries />
    </div>
  );
}
