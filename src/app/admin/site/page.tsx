import { getDb } from "@/lib/db";
import { PageHeader, Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import {
  updateAnnouncementAction,
  addBannerAction,
  toggleBannerAction,
  deleteBannerAction,
  updateHowtoBlockAction,
  updateRevenueStatsAction,
} from "@/lib/actions/site-actions";
import {
  IconMegaphone, IconGlobe, IconFilm, IconUsers,
  IconBarChart, IconZap, IconCheckCircle,
} from "@/components/icons";

const ROLE_OPTIONS = [
  { value: "all",        label: "전체" },
  { value: "creator",    label: "크리에이터" },
  { value: "advertiser", label: "광고주" },
];

const GRADIENT_OPTIONS = [
  { label: "퍼플→핑크 (기본)", value: "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)" },
  { label: "옐로우→레드",      value: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)" },
  { label: "블루→사이언",      value: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)" },
  { label: "그린→에메랄드",    value: "linear-gradient(135deg, #10b981 0%, #34d399 100%)" },
  { label: "다크",             value: "linear-gradient(135deg, #1f2937 0%, #374151 100%)" },
];

export default function SiteManagementPage() {
  const db = getDb();
  const s = db.settings;
  const banners      = s.site_banners ?? [];
  const howtoBlocks  = s.site_howto_blocks ?? [];
  const revenueStats = s.site_revenue_stats ?? [];

  return (
    <div className="space-y-10">
      <PageHeader title="사이트 관리" description="공지사항, 배너, 이용 방법, 수익 현황 콘텐츠를 관리합니다." />

      {/* ── 공지사항 ── */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-800">
          <IconMegaphone size={16} className="text-brand-purple" />
          공지사항 배너
        </h2>
        <Card>
          <form action={updateAnnouncementAction} className="space-y-3">
            <Field label="공지사항 문구 (비어있으면 숨김)">
              <Textarea
                name="announcement"
                defaultValue={s.site_announcement ?? ""}
                placeholder="예: 🎉 베타 서비스 시작! 지금 가입하면 첫 달 구독료 무료!"
                rows={2}
              />
            </Field>
            <SubmitButton size="sm">저장</SubmitButton>
          </form>
          {s.site_announcement && (
            <div className="mt-4 rounded-xl bg-brand-purple/10 px-4 py-3 text-sm text-brand-purple">
              <strong>현재 표시 중:</strong> {s.site_announcement}
            </div>
          )}
        </Card>
      </section>

      {/* ── 배너 관리 ── */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-800">
          <IconGlobe size={16} className="text-brand-pink" />
          메인 배너 관리
        </h2>

        {/* 기존 배너 목록 */}
        {banners.length > 0 && (
          <div className="mb-4 space-y-3">
            {banners.map((b, idx) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 p-4"
              >
                <div
                  className="h-10 w-10 shrink-0 rounded-xl"
                  style={{ background: b.gradient }}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{b.title}</div>
                  <div className="text-xs text-gray-400 truncate">{b.subtitle}</div>
                  <div className="text-xs text-gray-400">CTA: {b.cta_label} → {b.cta_href}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    b.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {b.is_active ? "활성" : "비활성"}
                  </span>
                  <form action={toggleBannerAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <SubmitButton size="sm" variant="outline">
                      {b.is_active ? "숨기기" : "표시"}
                    </SubmitButton>
                  </form>
                  <form action={deleteBannerAction}>
                    <input type="hidden" name="id" value={b.id} />
                    <SubmitButton size="sm" variant="danger">삭제</SubmitButton>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 배너 추가 */}
        <Card>
          <h3 className="mb-4 text-sm font-bold text-gray-700">+ 배너 추가</h3>
          <form action={addBannerAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="제목" required>
                <Input name="title" placeholder="숏폼 영상으로 부업 시작하기" required />
              </Field>
              <Field label="부제목">
                <Input name="subtitle" placeholder="한 줄 설명" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="CTA 버튼 텍스트">
                <Input name="cta_label" placeholder="지금 시작하기" />
              </Field>
              <Field label="CTA 링크">
                <Input name="cta_href" placeholder="/signup" />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="배경 그라디언트">
                <select
                  name="gradient"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-purple focus:outline-none"
                >
                  {GRADIENT_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="활성화">
                <label className="flex items-center gap-2 pt-2 text-sm">
                  <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 rounded" />
                  즉시 표시
                </label>
              </Field>
            </div>
            <SubmitButton size="sm">배너 추가</SubmitButton>
          </form>
        </Card>
      </section>

      {/* ── 이용 방법 ── */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-800">
          <IconFilm size={16} className="text-blue-500" />
          이용 방법 블록 편집
        </h2>
        <Card>
          <form action={updateHowtoBlockAction} className="space-y-5">
            {howtoBlocks.map((b, i) => (
              <div key={i} className="rounded-xl border border-gray-100 p-4">
                <div className="mb-3 text-xs font-bold text-gray-400 uppercase tracking-wide">블록 {i + 1}</div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="단계(숫자)">
                    <Input
                      type="number"
                      name={`blocks[${i}][step]`}
                      defaultValue={b.step}
                      min={1}
                    />
                  </Field>
                  <Field label="대상">
                    <select
                      name={`blocks[${i}][role]`}
                      defaultValue={b.role}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-brand-purple focus:outline-none"
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="제목" className="sm:col-span-2">
                    <Input name={`blocks[${i}][title]`} defaultValue={b.title} />
                  </Field>
                </div>
                <Field label="설명">
                  <Textarea
                    name={`blocks[${i}][description]`}
                    defaultValue={b.description}
                    rows={2}
                  />
                </Field>
              </div>
            ))}
            <SubmitButton size="sm">이용 방법 저장</SubmitButton>
          </form>
        </Card>
      </section>

      {/* ── 수익 현황 ── */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-800">
          <IconBarChart size={16} className="text-green-600" />
          수익 현황 통계 편집
        </h2>
        <Card>
          <form action={updateRevenueStatsAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {revenueStats.map((st, i) => (
                <div key={st.key} className="rounded-xl border border-gray-100 p-3 space-y-2">
                  <div className="text-xs font-bold text-gray-400">{st.label}</div>
                  <input type="hidden" name={`stats[${i}][key]`} value={st.key} />
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="항목명">
                      <Input name={`stats[${i}][label]`} defaultValue={st.label} className="text-xs" />
                    </Field>
                    <Field label="값">
                      <Input name={`stats[${i}][value]`} defaultValue={st.value} className="text-xs" />
                    </Field>
                    <Field label="단위">
                      <Input name={`stats[${i}][suffix]`} defaultValue={st.suffix} className="text-xs" />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
            <SubmitButton size="sm">수익 통계 저장</SubmitButton>
          </form>
        </Card>
      </section>
    </div>
  );
}
