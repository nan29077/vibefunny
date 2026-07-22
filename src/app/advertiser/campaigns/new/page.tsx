import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { NewCampaignForm } from "@/components/forms/new-campaign-form";

export const dynamic = "force-dynamic";

export default function NewCampaignPage() {
  const user = requireRole("advertiser");
  const db = getDb();
  const pw = db.point_wallets.find((p) => p.advertiser_id === user.id);
  const rates = db.settings.distribution_rates.map((r) => ({
    platform: r.platform,
    advertiser_charge: r.advertiser_charge,
  }));
  const categories = db.categories
    .filter((c) => c.is_active)
    .map((c) => ({ id: c.id, name: c.name, platform: c.platform }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="캠페인 신청" description="숏폼 제작·배포 캠페인을 설정하세요." />
      <NewCampaignForm
        rates={rates}
        extraCreationFee={db.settings.extra_creation_advertiser_charge}
        categories={categories}
        balance={pw?.point_balance ?? 0}
        videoPricingTiers={(db.settings.video_pricing_tiers ?? []).map((t) => ({
          key: t.key,
          label: t.label,
          advertiser_charge: t.advertiser_charge ?? 0,
          amount: t.amount,
          max_seconds: t.max_seconds,
        }))}
      />
    </div>
  );
}
