import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/date";
import { getDb } from "@/lib/db";
import { Card, Badge } from "@/components/ui";
import { IconPenLine, IconUsers, IconClock, IconCheckCircle, IconInfo } from "@/components/icons";
import { defaultAiStorySettings } from "@/lib/seed";
import { AiStorySettingsForm } from "@/components/commerce/ai-story-settings-form";

export const dynamic = "force-dynamic";

export default function AdminAiStoryPage() {
  requireRole("admin");
  const db = getDb();
  const settings = db.settings.ai_story ?? defaultAiStorySettings();
  const stories = db.ad_campaigns.filter((c) => c.campaign_type === "story_creation");
  const inProgress = stories.filter((c) => ["recruiting", "in_progress", "submitted", "published"].includes(c.status)).length;
  const completed = stories.filter((c) => c.status === "completed").length;
  const configured = Boolean(settings.enabled && settings.api_base && settings.api_key);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
          <IconPenLine size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">AI스토리 연동 관리</h1>
          <p className="text-sm text-gray-500">AI스토리에서 들어오는 동화 제작 의뢰를 연동·관리합니다.</p>
        </div>
      </div>

      {/* 연동 상태 */}
      <Card className={configured ? "border-green-200 bg-green-50" : "border-brand-yellow/40 bg-brand-yellow/5"}>
        <p className="flex items-center gap-2 text-sm text-gray-700">
          {configured
            ? <IconCheckCircle size={16} className="text-green-600" />
            : <IconInfo size={16} className="text-amber-600" />}
          연동 상태: <b>{configured ? "실제 연동 활성화" : "연동 준비 중 (미리보기)"}</b>
          {!configured && " — API 키를 입력하기 전까지는 준비 상태로 동작합니다."}
        </p>
      </Card>

      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "동화 의뢰", value: stories.length, cls: "text-purple-600" },
          { label: "진행 중", value: inProgress, cls: "text-blue-600" },
          { label: "완료", value: completed, cls: "text-green-600" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{item.label}</p>
            <p className={`mt-1 text-2xl font-bold ${item.cls}`}>{item.value}건</p>
          </div>
        ))}
      </div>

      {/* 연동 설정 */}
      <AiStorySettingsForm settings={settings} />

      {/* 동화 제작 의뢰 목록 */}
      <div>
        <h2 className="mb-3 text-base font-bold text-gray-900">동화 제작 의뢰 (AI스토리 출처)</h2>
        {stories.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-sm text-gray-400">
            연동된 동화 제작 의뢰가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {stories.map((c) => {
              const b = c.story_brief;
              return (
                <div key={c.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-bold text-gray-900">{c.title}</h3>
                        <Badge tone="purple">AI스토리</Badge>
                        <Badge tone="blue">{c.status}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-500">{c.description}</p>
                    </div>
                  </div>
                  {b && (
                    <div className="mt-3 grid gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500 sm:grid-cols-2">
                      <span className="flex items-center gap-1"><IconUsers size={11} /> 주인공: {b.child_name} ({b.child_age}세)</span>
                      <span className="flex items-center gap-1"><IconPenLine size={11} /> 테마: {b.story_theme}</span>
                      <span>그림체: {b.art_style}</span>
                      <span>분량: {b.page_count}p · 대상 {b.target_age_range}</span>
                      <span className="flex items-center gap-1"><IconClock size={11} /> {formatDate(c.created_at)}</span>
                      {b.requester_name && <span>의뢰자: {b.requester_name}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
