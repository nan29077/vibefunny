import { PageHeader } from "@/components/ui";
import { AdminInquiries } from "@/components/support/admin-inquiries";

export const dynamic = "force-dynamic";

export default function AdminInquiriesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="회원 문의" description="회원별 문의 내역을 확인하고 실시간으로 답변합니다." />
      <AdminInquiries />
    </div>
  );
}
