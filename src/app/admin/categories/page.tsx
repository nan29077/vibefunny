import { getDb } from "@/lib/db";
import { Card, PageHeader, Field, Input, Select, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { PLATFORM_LABELS, type Platform } from "@/lib/schema";
import { addCategoryAction, toggleCategoryAction } from "@/lib/actions/admin-actions";

export default function AdminCategoriesPage() {
  const db = getDb();
  const platforms: Platform[] = ["youtube", "instagram", "tiktok"];

  return (
    <div className="space-y-6">
      <PageHeader title="카테고리 관리" description="플랫폼별 카테고리를 추가/비활성화합니다." />

      <Card>
        <h2 className="text-base font-bold">카테고리 추가</h2>
        <form action={addCategoryAction} className="mt-3 flex flex-wrap items-end gap-3">
          <Field label="플랫폼">
            <Select name="platform" defaultValue="youtube">
              {platforms.map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </Select>
          </Field>
          <Field label="카테고리명">
            <Input name="name" placeholder="예: 브이로그" required />
          </Field>
          <SubmitButton>추가</SubmitButton>
        </form>
      </Card>

      {platforms.map((p) => {
        const cats = db.categories.filter((c) => c.platform === p).sort((a, b) => a.sort_order - b.sort_order);
        return (
          <Card key={p}>
            <h2 className="mb-3 text-base font-bold">{PLATFORM_LABELS[p]}</h2>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <form key={c.id} action={toggleCategoryAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="transition hover:opacity-80">
                    <Badge tone={c.is_active ? "purple" : "gray"}>
                      {c.name} {c.is_active ? "" : "(비활성)"}
                    </Badge>
                  </button>
                </form>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-400">카테고리를 클릭하면 활성/비활성이 전환됩니다.</p>
          </Card>
        );
      })}
    </div>
  );
}
