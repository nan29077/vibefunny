"use client";

import { useState } from "react";
import { IconClipboard, IconCheck } from "@/components/icons";

export function ReferralLinkSection({
  referralCode,
  siteUrl,
}: {
  referralCode: string;
  siteUrl: string;
}) {
  const base = siteUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const referralLink = `${base}/signup?role=advertiser&ref=${referralCode}`;
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  return (
    <div className="flex gap-4">
      <dt className="w-28 shrink-0 font-medium text-gray-500">추천인 링크</dt>
      <dd className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2 rounded-xl bg-purple-50 px-3 py-2 ring-1 ring-purple-100">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-purple-700 select-all">
            {referralLink}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title="링크 복사"
            className="shrink-0 flex items-center gap-1 rounded-lg bg-purple-100 px-3 py-1.5 text-xs font-bold text-purple-700 transition hover:bg-purple-200 active:scale-95"
          >
            {copied ? (
              <>
                <IconCheck size={13} />
                복사됨
              </>
            ) : (
              <>
                <IconClipboard size={13} />
                복사
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400">
          이 링크로 접속하면 대행사 광고주 가입 시 내 추천인 코드가 자동 적용됩니다. 코드는 수정하거나 삭제할 수 없습니다.
        </p>
      </dd>
    </div>
  );
}
