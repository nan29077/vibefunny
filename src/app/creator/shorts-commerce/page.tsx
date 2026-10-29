import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, StatCard, LinkButton } from "@/components/ui";
import { isSellable, creatorCommission } from "@/lib/commerce";
import { formatKRW } from "@/lib/money";
import { ShortsCommercePanel } from "@/components/commerce/shorts-commerce-panel";
import type { Product } from "@/lib/schema";
import { VibeOnlyNotice } from "@/components/membership/vibe-only-notice";
import { isVibeMember } from "@/lib/membership";

export const dynamic = "force-dynamic";

export default function CreatorShortsCommercePage() {
  const user = requireRole("creator");
  const db = getDb();

  // 크리에이터 브라우저로는 화면에 필요한 값만 보낸다 (공급가·카페24 연동 정보·등록자 비노출)
  const products: Product[] = db.products.filter(isSellable).map((p) => ({
    ...p,
    supply_price: 0,
    cafe24_product_no: null,
    cafe24_sync_status: "not_synced",
    cafe24_synced_at: null,
    cafe24_sync_error: null,
    cafe24_mode: null,
    created_by: "",
  }));
  const categories = db.product_categories;
  const channels = db.creator_youtube_channels.filter((c) => c.creator_id === user.id);
  const links = db.creator_shorts_links.filter((s) => s.creator_id === user.id);

  const linkedCount = links.filter((l) => l.linked_product_ids.length > 0).length;
  const productMap = new Map(products.map((p) => [p.id, p]));
  const potential = links.reduce(
    (sum, l) => sum + l.linked_product_ids.reduce((s, id) => {
      const p = productMap.get(id);
      return p ? s + creatorCommission(p) : s;
    }, 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="유튜브 쇼츠 커머스"
        description="본인 쇼츠에 상품을 연동해 판매 수익을 올리세요. 관리자가 등록한 상품 중에서 선택할 수 있습니다."
        action={<LinkButton href="/creator/social" variant="outline" size="sm">운영 채널 관리</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="등록한 쇼츠" value={`${links.length}개`} accent="purple" />
        <StatCard label="상품 연동된 쇼츠" value={`${linkedCount}개`} accent="pink" />
        <StatCard label="연동 상품 판매 시 예상 수익" value={formatKRW(potential)} accent="yellow" />
      </div>

      <Card className="border-brand-purple/20 bg-gradient-to-br from-brand-purple/5 to-brand-pink/5">
        <h2 className="text-base font-bold text-gray-900">어떻게 수익이 나나요?</h2>
        <ol className="mt-2 space-y-1.5 text-sm text-gray-600">
          <li>1. 운영용 유튜브 채널을 등록하고 숏폼(쇼츠) 영상을 직접 제작해 업로드합니다.</li>
          <li>2. 업로드한 쇼츠 링크를 입력하면 영상 내용과 어울리는 상품을 추천해 드립니다.</li>
          <li>3. 추천 상품을 선택해 쇼츠에 연동합니다. (상품은 카페24와 연동되어 판매됩니다)</li>
          <li>4. 시청자가 연동 상품을 구매하면 <b>판매가 × 수수료율</b> 만큼 수익이 적립됩니다.</li>
        </ol>
      </Card>

      {isVibeMember(db, user) ? (
        <ShortsCommercePanel
          products={products}
          categories={categories}
          channels={channels}
          links={links}
        />
      ) : (
        <VibeOnlyNotice feature="쇼츠 커머스" signupFee={db.settings.fees.creator.signup_fee_amount} />
      )}
    </div>
  );
}
