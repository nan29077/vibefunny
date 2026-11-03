import { SubmitButton } from "@/components/form";
import { updateSiteImageAction } from "@/lib/actions/site-actions";
import { getSiteImage, getSiteImageOptions, type SiteImageSelections, type SiteImageSlot } from "@/lib/site-images";

export function SiteImageManager({ slots, selections }: {
  slots: readonly SiteImageSlot[];
  selections?: SiteImageSelections;
}) {
  return (
    <div className="space-y-3">
      {slots.map((slot, index) => {
        const current = getSiteImage(slot, selections);
        const isMargin = slot.id.endsWith("-margin");
        return (
          <details key={slot.id} open={index === 0} className="rounded-2xl border border-gray-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-bold text-gray-800">
              {slot.label} <span className="ml-2 font-normal text-gray-500">현재 적용 · {current.label}</span>
            </summary>
            <form action={updateSiteImageAction} className="mt-4 space-y-4">
              <input type="hidden" name="slot" value={slot.id} />
              <fieldset key={current.id} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <legend className="sr-only">{slot.label} 이미지 선택</legend>
                {getSiteImageOptions(slot).map((option) => (
                  <label key={option.id} className="relative block cursor-pointer">
                    <input type="radio" name="image_id" value={option.id} defaultChecked={option.id === current.id} required className="peer sr-only" />
                    <span className="block h-full overflow-hidden rounded-xl border-2 border-gray-200 bg-gray-50 peer-checked:border-brand-purple peer-checked:bg-purple-50 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-purple peer-focus-visible:ring-offset-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={option.src} alt="" width={isMargin ? 360 : 320} height={isMargin ? 120 : 180} loading="lazy" className={isMargin ? "aspect-[3/1] w-full object-cover" : "aspect-video w-full object-cover"} />
                      <span className="block px-2 py-2 text-xs font-semibold text-gray-800">{option.label}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <SubmitButton size="sm" successMessage="이미지를 적용했습니다">선택 이미지 적용</SubmitButton>
            </form>
          </details>
        );
      })}
    </div>
  );
}
