import { getDb } from "@/lib/db";
import { formatDate } from "@/lib/date";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { PLATFORM_LABELS } from "@/lib/schema";
import { formatKRW } from "@/lib/money";
import { nameOf, categoryName } from "@/lib/queries";
import { statusLabel, statusTone } from "@/lib/labels";
import { approveVideoAction } from "@/lib/actions/admin-actions";
import { IconFilm, IconUsers, IconTag, IconClock, IconCheckCircle } from "@/components/icons";

const toneClass: Record<string, string> = {
  gray:   "bg-gray-100 text-gray-600",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

export default function AdminVideosPage() {
  const db = getDb();
  const pending = db.videos.filter((v) => v.status === "pending_review");
  const others  = db.videos.filter((v) => v.status !== "pending_review")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-8">
      <PageHeader title="영상 판매 승인 관리" description="등록된 판매용 영상을 검토하고 승인·반려합니다." />

      {/* 승인 대기 – 카드형 */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-800">
          <IconFilm size={16} className="text-brand-purple" />
          승인 대기
          <span className="ml-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-700">
            {pending.length}건
          </span>
        </h2>

        {pending.length === 0 ? (
          <Card><EmptyState title="승인 대기 영상이 없습니다" /></Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((v) => {
              const creatorName = nameOf(db, v.creator_id);
              const catName     = categoryName(db, v.category_id);
              return (
                <Card key={v.id} className="flex flex-col">
                  {/* 썸네일 / 플레이스홀더 */}
                  <div className="mb-4 aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt={v.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <IconFilm size={32} />
                        <span className="text-xs">미리보기 없음</span>
                      </div>
                    )}
                  </div>

                  {/* 영상 정보 */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="font-bold text-gray-900 leading-tight">{v.title}</h3>
                      {v.description && (
                        <p className="mt-1 text-xs text-gray-500 line-clamp-2">{v.description}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <IconUsers size={12} className="shrink-0 text-gray-400" />
                        <span className="truncate">{creatorName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <IconTag size={12} className="shrink-0 text-gray-400" />
                        <span className="truncate">{PLATFORM_LABELS[v.platform]} {catName ? `· ${catName}` : ""}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <IconClock size={12} className="shrink-0 text-gray-400" />
                        <span>{formatDuration(v.duration_seconds)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-brand-purple">{formatKRW(v.price)}</span>
                      </div>
                    </div>

                    {/* 태그 */}
                    {v.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {v.tags.slice(0, 5).map((t) => (
                          <span key={t} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                            #{t}
                          </span>
                        ))}
                        {v.tags.length > 5 && (
                          <span className="text-xs text-gray-400">+{v.tags.length - 5}개</span>
                        )}
                      </div>
                    )}

                    {/* 저작권 */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <IconCheckCircle size={13} className={v.copyright_confirmed ? "text-green-500" : "text-red-400"} />
                      <span className={v.copyright_confirmed ? "text-green-700" : "text-red-500"}>
                        저작권 {v.copyright_confirmed ? "확인됨" : "미확인"}
                      </span>
                    </div>

                    {/* 원본 URL */}
                    {v.original_video_url && (
                      <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
                        <span className="font-medium text-gray-700">원본 URL: </span>
                        <a
                          href={v.original_video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-brand-purple underline"
                        >
                          {v.original_video_url.length > 50
                            ? v.original_video_url.slice(0, 50) + "…"
                            : v.original_video_url}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* 승인/반려 버튼 */}
                  <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
                    <form action={approveVideoAction} className="flex-1">
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="approve" value="1" />
                      <SubmitButton className="w-full" size="sm">✓ 승인</SubmitButton>
                    </form>
                    <form action={approveVideoAction} className="flex-1">
                      <input type="hidden" name="id" value={v.id} />
                      <input type="hidden" name="approve" value="0" />
                      <SubmitButton variant="danger" className="w-full" size="sm">✕ 반려</SubmitButton>
                    </form>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 전체 영상 리스트 */}
      <div>
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-800">
          <IconFilm size={16} className="text-gray-500" />
          전체 영상 ({others.length}건)
        </h2>
        {others.length === 0 ? (
          <Card><EmptyState title="영상이 없습니다" /></Card>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-bold text-gray-500">
                  <tr>
                    <th className="px-4 py-3">제목</th>
                    <th className="px-4 py-3">크리에이터</th>
                    <th className="px-4 py-3">플랫폼</th>
                    <th className="px-4 py-3">가격</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">구매자</th>
                    <th className="px-4 py-3">등록일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {others.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">{v.title}</td>
                      <td className="px-4 py-3 text-gray-600">{nameOf(db, v.creator_id)}</td>
                      <td className="px-4 py-3 text-gray-500">{PLATFORM_LABELS[v.platform]}</td>
                      <td className="px-4 py-3 font-semibold text-brand-purple">{formatKRW(v.price)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass[statusTone(v.status)]}`}>
                          {statusLabel(v.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{nameOf(db, v.sold_to_user_id) || "-"}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(v.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
