import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader, Card, LinkButton } from "@/components/ui";
import { Cafe24SettingsForm } from "@/components/commerce/cafe24-settings-form";
import { defaultCafe24Settings } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default function AdminCafe24Page() {
  requireRole("admin");
  const db = getDb();
  const settings = db.settings.cafe24 ?? defaultCafe24Settings();
  const defaultCommission = db.settings.shorts_commerce_default_commission_rate ?? 10;

  return (
    <div className="space-y-6">
      <PageHeader
        title="카페24 연동 설정"
        description="카페24 Open API 인증정보를 입력하면 상품이 실제 카페24에 등록됩니다."
        action={<LinkButton href="/admin/products" variant="outline" size="sm">상품 목록</LinkButton>}
      />
      <Card className="border-blue-200 bg-blue-50">
        <p className="text-sm text-gray-700">
          카페24 개발자센터에서 앱을 만들고 OAuth 인증을 거쳐 Access Token을 발급받아야 합니다.
          (필요 권한 스코프: <code>mall.write_product</code>) 키가 없으면 미리보기로 안전하게 동작합니다.
        </p>
      </Card>
      <Cafe24SettingsForm settings={settings} defaultCommission={defaultCommission} />
    </div>
  );
}
