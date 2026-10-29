import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, PageHeader, Table, Th, Td, Badge, EmptyState } from "@/components/ui";
import { AdminCancelJobForm } from "@/components/ai-shorts/admin-forms";
import { formatFunny } from "@/lib/funny";
import { formatDateTime } from "@/lib/date";
import { displayName } from "@/lib/schema";

export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { script: "대본", shot_image: "컷 이미지", shot_tts: "내레이션", shot_video: "영상 클립", music: "배경음악", compose: "합성" };
const STATUS: Record<string, { label: string; tone: "gray" | "yellow" | "blue" | "green" | "red" }> = {
  queued: { label: "대기", tone: "yellow" },
  running: { label: "진행", tone: "blue" },
  succeeded: { label: "완료", tone: "green" },
  failed: { label: "실패", tone: "red" },
  cancelled: { label: "취소", tone: "gray" },
};

export default function AdminAiJobsPage({ searchParams }: { searchParams: { status?: string } }) {
  requireAdmin();
  const db = getDb();
  const filter = searchParams.status ?? "";
  const jobs = (db.ai_jobs ?? [])
    .filter((j) => !filter || (filter === "active" ? j.status === "queued" || j.status === "running" : j.status === filter))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 300);
  const model = (id: string | null) => (db.ai_models ?? []).find((m) => m.id === id)?.label ?? "-";
  const user = (id: string) => {
    const p = db.profiles.find((x) => x.id === id);
    return p ? `${displayName(p)} (${p.email})` : id;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="AI 작업 모니터" description="모든 크리에이터의 AI 작업과 퍼니 정산 상태. 진행 중 작업을 강제로 취소하면 예약 퍼니가 전액 반환됩니다." />
      <div className="flex flex-wrap gap-2 text-sm">
        {[["", "전체"], ["active", "진행 중"], ["failed", "실패"], ["succeeded", "완료"], ["cancelled", "취소"]].map(([v, l]) => (
          <Link key={v} href={v ? `/admin/ai-shorts/jobs?status=${v}` : "/admin/ai-shorts/jobs"} className={`rounded-full px-3 py-1 ${filter === v ? "bg-brand-purple text-white" : "bg-gray-100 text-gray-700"}`}>{l}</Link>
        ))}
      </div>
      <Card>
        {jobs.length === 0 ? (
          <EmptyState title="작업이 없습니다" />
        ) : (
          <Table>
            <thead>
              <tr><Th>일시</Th><Th>크리에이터</Th><Th>작업</Th><Th>모델</Th><Th>상태</Th><Th>퍼니(예약/사용)</Th><Th>원가(지출)</Th><Th>오류(관리자용 원문)</Th><Th></Th></tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <Td className="text-xs text-gray-500">{formatDateTime(j.created_at)}</Td>
                  <Td className="max-w-[200px] truncate text-xs">{user(j.user_id)}</Td>
                  <Td>{KIND[j.kind] ?? j.kind}</Td>
                  <Td className="max-w-[160px] truncate text-xs">{model(j.model_ref)}</Td>
                  <Td><Badge tone={STATUS[j.status]?.tone ?? "gray"}>{STATUS[j.status]?.label ?? j.status}</Badge>{j.attempts > 1 && <span className="ml-1 text-[11px] text-gray-400">시도 {j.attempts}</span>}</Td>
                  <Td className="text-xs">{formatFunny(j.hold_paid + j.hold_bonus)} / {formatFunny(j.charged_funny)}</Td>
                  <Td className="text-xs">{j.cost_won.toLocaleString()}원{j.vendor_cost_won !== undefined && j.vendor_cost_won !== j.cost_won ? <span className="block text-[11px] text-gray-400">지출 {Math.round(j.vendor_cost_won).toLocaleString()}원</span> : null}</Td>
                  <Td className="max-w-[260px] whitespace-normal break-words text-[11px] text-red-600">{j.status === "failed" ? j.error_detail : ""}</Td>
                  <Td>
                    {(j.status === "queued" || j.status === "running") && (
                      <AdminCancelJobForm jobId={j.id} />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
