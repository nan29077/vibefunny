import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, Badge, EmptyState, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { formatKRW } from "@/lib/money";
import { categoryName } from "@/lib/queries";
import { PLATFORM_LABELS, type MemberVideoSalePriceTier } from "@/lib/schema";
import { statusLabel, statusTone } from "@/lib/labels";
import { IconFilm, IconCheckCircle, IconLink } from "@/components/icons";
import { toggleVibeporterAction } from "@/lib/actions/video-actions";

function getTierPrice(seconds: number, tiers: MemberVideoSalePriceTier[]): number {
  const sorted = [...tiers].sort((a, b) => (a.max_seconds ?? 999999) - (b.max_seconds ?? 999999));
  for (const t of sorted) {
    if (t.max_seconds === null || seconds <= t.max_seconds) return t.price;
  }
  return sorted[sorted.length - 1]?.price ?? 2000;
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

const toneCls: Record<string, string> = {
  gray:   "bg-gray-100 text-gray-600",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  blue:   "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
};

export default function CreatorVideosPage() {
  const user = requireRole("creator");
  const db = getDb();
  const tiers = db.settings.member_video_sale_price_tiers ?? [];
  const videos = db.videos
    .filter((v) => v.creator_id === user.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  return (
    <div className="space-y-6">
      <PageHeader
        title="영상판매"
        description="등록한 판매용 영상 목록 · 영상을 등록하면 바이브포터를 통해 판매 등록됩니다."
        action={<LinkButton href="/creator/videos/new">영상 등록</LinkButton>}
      />
      {videos.length === 0 ? (
        <EmptyState
          title="등록한 영상이 없습니다"
          description="첫 영상을 등록하고 판매를 시작하세요."
          action={<LinkButton href="/creator/videos/new">영상 등록하기</LinkButton>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {videos.map((v) => {
            const catName = categoryName(db, v.category_id);
            const tone = statusTone(v.status);
            const isApproved = v.vibeporter_approved === true;
            const isPending = v.vibeporter_enabled && !v.vibeporter_approved;
            const canApply = v.status === "available" && !v.vibeporter_enabled;

            return (
              <Card key={v.id} className="flex flex-col gap-3">
                {/* 썸네일 */}
                <div className="aspect-video w-full overflow-hidden rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt={v.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <IconFilm size={28} />
                      <span className="text-xs">미리보기 없음</span>
                    </div>
                  )}
                </div>

                {/* 기본 정보 */}
                <div>
                  <h3 className="font-bold text-gray-900 leading-tight truncate">{v.title}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {PLATFORM_LABELS[v.platform]}{catName ? ` · ${catName}` : ""} · {formatDuration(v.duration_seconds)}
                  </p>
                </div>

                {/* 가격 / 상태 */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-brand-purple">{formatKRW(v.price)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${toneCls[tone] ?? toneCls.gray}`}>
                    {statusLabel(v.status)}
                  </span>
                </div>

                {/* 저작권 */}
                <div className="flex items-center gap-1 text-xs">
                  <IconCheckCircle size={12} className={v.copyright_confirmed ? "text-green-500" : "text-red-400"} />
                  <span className={v.copyright_confirmed ? "text-green-700" : "text-red-500"}>
                    저작권 {v.copyright_confirmed ? "확인됨" : "미확인"}
                  </span>
                </div>

                {/* 바이브포터 영역 */}
                <div className="border-t border-gray-100 pt-3">
                  {isApproved && (
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                        <IconLink size={11} />
                        바이브포터 판매중
                      </span>
                      <span className="text-xs text-gray-500">판매가 {formatKRW(getTierPrice(v.duration_seconds, tiers))}</span>
                    </div>
                  )}

                  {isPending && (
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800">
                        <IconLink size={11} />
                        바이브포터 승인 대기
                      </span>
                      <form action={toggleVibeporterAction}>
                        <input type="hidden" name="video_id" value={v.id} />
                        <input type="hidden" name="enable" value="0" />
                        <SubmitButton variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-700">
                          신청 취소
                        </SubmitButton>
                      </form>
                    </div>
                  )}

                  {canApply && (
                    <form action={toggleVibeporterAction}>
                      <input type="hidden" name="video_id" value={v.id} />
                      <input type="hidden" name="enable" value="1" />
                      <SubmitButton variant="secondary" size="sm" className="w-full text-xs">
                        <IconLink size={12} />
                        바이브포터 판매 신청
                      </SubmitButton>
                    </form>
                  )}

                  {!canApply && !isApproved && !isPending && v.status !== "available" && (
                    <p className="text-xs text-gray-400">판매 승인 후 바이브포터 신청 가능</p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
