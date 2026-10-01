import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { Card, PageHeader, EmptyState, Badge, LinkButton } from "@/components/ui";
import { formatFunny, funnyBalance } from "@/lib/funny";
import { aiShortsAccess } from "@/lib/ai/settings";
import { capabilityStatus, ttsVoices } from "@/lib/ai/engine";
import { SHORTS_TEMPLATES, TONES } from "@/lib/ai/prompts";
import { NewShortsForm } from "@/components/ai-shorts/new-shorts-form";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "gray" | "yellow" | "blue" | "green" | "red" | "purple" }> = {
  draft: { label: "대본 전", tone: "gray" },
  scripted: { label: "제작 중", tone: "blue" },
  composing: { label: "합성 중", tone: "yellow" },
  composed: { label: "완성", tone: "green" },
  failed: { label: "실패", tone: "red" },
};

export default function CreatorAiShortsPage() {
  const user = requireRole("creator");
  const db = getDb();
  const access = aiShortsAccess(db, user);
  const bal = funnyBalance(db, user.id);
  const projects = (db.shorts_projects ?? []).filter((p) => p.user_id === user.id).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const caps = capabilityStatus(db);
  const voices = ttsVoices(db);

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 숏츠 만들기"
        description="주제만 입력하면 AI가 대본·컷 이미지·내레이션·영상 클립을 만들고, 자막을 넣어 세로 숏츠로 합성합니다."
        action={
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-purple-50 px-3 py-1.5 text-sm font-bold text-brand-purple">{formatFunny(bal.available)}</span>
            <LinkButton href="/creator/funny" variant="outline" size="sm">퍼니 충전</LinkButton>
          </div>
        }
      />

      {!access.open ? (
        <Card className="border-yellow-200 bg-yellow-50">
          <p className="text-sm font-semibold text-yellow-900">{access.reason}</p>
          <p className="mt-1 text-xs text-yellow-800">이전에 만든 숏츠는 아래에서 계속 보고 내려받을 수 있습니다. 퍼니 잔액은 그대로 보관됩니다.</p>
        </Card>
      ) : !caps.text.ready ? (
        <Card className="border-yellow-200 bg-yellow-50 text-sm text-yellow-900">AI 준비가 아직 끝나지 않았습니다. 잠시 후 다시 확인해 주세요.</Card>
      ) : (
        <NewShortsForm templates={SHORTS_TEMPLATES.map(({ id, label, desc }) => ({ id, label, desc }))} tones={TONES} voices={voices} />
      )}

      <Card>
        <h2 className="mb-3 text-base font-bold">내 숏츠 ({projects.length})</h2>
        {projects.length === 0 ? (
          <EmptyState title="아직 만든 숏츠가 없습니다" description="위에서 주제를 입력하고 첫 숏츠를 만들어 보세요." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const st = STATUS[p.status] ?? STATUS.draft;
              const done = p.shots.filter((s) => s.image_file_id).length;
              return (
                <Link key={p.id} href={`/creator/ai-shorts/${p.id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-brand-purple/50 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="line-clamp-2 font-bold text-gray-900">{p.title || p.topic}</h3>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-1 text-xs text-gray-500">{SHORTS_TEMPLATES.find((t) => t.id === p.template)?.label} · {p.target_seconds}초 · 컷 {p.shots.length}개 (이미지 {done})</p>
                  <p className="mt-2 text-[11px] text-gray-400">수정 {formatDateTime(p.updated_at)}</p>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
