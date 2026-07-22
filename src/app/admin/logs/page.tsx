import { getDb } from "@/lib/db";
import { PageHeader, Table, Th, Td, EmptyState } from "@/components/ui";
import { nameOf } from "@/lib/queries";

export default function AdminLogsPage() {
  const db = getDb();
  const logs = [...db.audit_logs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 200);
  return (
    <div>
      <PageHeader title="감사 로그" description="관리자 및 주요 작업 기록 (최근 200건)" />
      {logs.length === 0 ? (
        <EmptyState title="로그가 없습니다" />
      ) : (
        <Table>
          <thead>
            <tr><Th>일시</Th><Th>행위자</Th><Th>액션</Th><Th>대상</Th></tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <Td className="text-xs text-gray-400">{l.created_at.slice(0, 19).replace("T", " ")}</Td>
                <Td>{l.actor_id ? nameOf(db, l.actor_id) : "시스템"}</Td>
                <Td className="font-mono text-xs">{l.action}</Td>
                <Td className="text-gray-500">{l.target_table ?? "-"}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
