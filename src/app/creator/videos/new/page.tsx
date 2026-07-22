import { requireRole } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { NewVideoForm } from "@/components/forms/new-video-form";

export default function NewVideoPage() {
  requireRole("creator");
  const db = getDb();
  const categories = db.categories
    .filter((c) => c.is_active)
    .map((c) => ({ id: c.id, name: c.name, platform: c.platform }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="영상 등록" description="판매할 영상 정보를 입력하세요." />
      <NewVideoForm categories={categories} />
    </div>
  );
}
