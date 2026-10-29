// 관리자 "사이트 관리"에서 설정한 배너·이용 방법 블록을 실제 화면에 표시하는 컴포넌트 (서버 컴포넌트)
import Link from "next/link";
import type { SiteBanner, SiteHowtoBlock } from "@/lib/schema";
import { isHttpUrl, isInternalPath } from "@/lib/url";

const DEFAULT_GRADIENT = "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)";
// 관리자 화면에서 고르는 값은 "linear-gradient(...)" 형태. 그 외(과거 tailwind 클래스 문자열 등)는 기본값으로 대체
const SAFE_GRADIENT = /^linear-gradient\([#%,.\s\w()-]+\)$/;

function bannerHref(href: string): string | null {
  const v = (href ?? "").trim();
  if (!v) return null;
  if (v === "/register") return "/signup"; // 과거 기본 배너의 존재하지 않는 경로 보정
  if (isInternalPath(v) || isHttpUrl(v)) return v;
  return null;
}

export function SiteBanners({ banners }: { banners: SiteBanner[] | undefined }) {
  const active = (banners ?? []).filter((b) => b.is_active && b.title?.trim());
  if (active.length === 0) return null;
  return (
    <section aria-label="안내 배너" className="mx-auto w-full max-w-6xl space-y-3 px-4 py-6 md:px-8">
      {active.map((b) => {
        const href = bannerHref(b.cta_href);
        const external = href ? isHttpUrl(href) : false;
        const background = SAFE_GRADIENT.test(b.gradient ?? "") ? b.gradient : DEFAULT_GRADIENT;
        return (
          <div key={b.id} className="flex flex-col gap-3 rounded-2xl px-6 py-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between" style={{ background }}>
            <div className="min-w-0">
              <p className="text-lg font-black leading-snug">{b.title}</p>
              {b.subtitle && <p className="mt-1 text-sm text-white/85">{b.subtitle}</p>}
            </div>
            {href && b.cta_label && (
              external ? (
                <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-gray-900">
                  {b.cta_label}
                </a>
              ) : (
                <Link href={href} className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-gray-900">
                  {b.cta_label}
                </Link>
              )
            )}
          </div>
        );
      })}
    </section>
  );
}

export function SiteHowto({ blocks, role }: { blocks: SiteHowtoBlock[] | undefined; role: "creator" | "advertiser" }) {
  const list = (blocks ?? [])
    .filter((b) => (b.role === role || b.role === "all") && b.title?.trim())
    .sort((a, b) => (a.step ?? 0) - (b.step ?? 0));
  if (list.length === 0) return null;
  return (
    <section aria-label="이용 방법" className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-base font-bold text-gray-900">이용 방법</h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((b, i) => (
          <li key={`${b.step}-${i}`} className="flex gap-3 rounded-xl bg-gray-50 p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-black">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">{b.title}</p>
              {b.description && <p className="mt-0.5 text-xs leading-5 text-gray-500">{b.description}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
