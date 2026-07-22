import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, LinkButton } from "@/components/ui";
import { nameOf } from "@/lib/queries";
import { AdvertiserCampaignsUI } from "@/components/campaigns/advertiser-campaigns-ui";
import type { AdvertiserCampaignRow } from "@/components/campaigns/advertiser-campaigns-ui";

export const dynamic = "force-dynamic";

export default function AdvertiserCampaignsPage() {
  const user = requireRole("advertiser");
  const db = getDb();

  const campaigns = db.ad_campaigns
    .filter((c) => c.advertiser_id === user.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const allDMs = db.campaign_direct_messages ?? [];

  const rows: AdvertiserCampaignRow[] = campaigns.map((campaign) => {
    const participations = (db.campaign_participations ?? []).filter(
      (p) => p.campaign_id === campaign.id
    );

    return {
      campaign,
      participations: participations.map((p) => ({
        participation: p,
        creatorName: nameOf(db, p.creator_id),
        directMessages: allDMs.filter((m) => m.participation_id === p.id),
      })),
    };
  });

  return (
    <div>
      <PageHeader
        title="내 캠페인"
        description="진행 예정·진행 중 캠페인을 확인하고 참여자 작업물을 검수하세요."
        action={<LinkButton href="/advertiser/campaigns/new">캠페인 만들기</LinkButton>}
      />
      <AdvertiserCampaignsUI
        rows={rows}
        advertiserId={user.id}
        advertiserName={user.name}
      />
    </div>
  );
}
