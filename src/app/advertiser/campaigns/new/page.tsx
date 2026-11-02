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

  // 모집 종료일: 오늘(한국 시간) 이후만 가능, 기본값은 30일 뒤
  const kstToday = new Date(Date.now() + 9 * 3600 * 1000);
  const minEndDate = kstToday.toISOString().slice(0, 10);
  const defaultEndDate = new Date(kstToday.getTime() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="캠페인 신청" description="숏폼 제작·배포 캠페인을 설정하세요." />
      <NewCampaignForm
        rates={rates}
        extraCreationFee={db.settings.extra_creation_advertiser_charge}
        categories={categories}
        balance={pw?.point_balance ?? 0}
        defaultEndDate={defaultEndDate}
        minEndDate={minEndDate}
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
