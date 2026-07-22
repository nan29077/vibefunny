"use client";

import { useState } from "react";
import { IconLink, IconCheckCircle, IconUsers, IconDollarSign } from "@/components/icons";

interface ReferralCardProps {
  referralCode: string;
  referredCount: number;
  referralEarnings: number;
}

export function ReferralCard({ referralCode, referredCount, referralEarnings }: ReferralCardProps) {
  const [copied, setCopied] = useState(false);

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${referralCode}`
      : `/signup?ref=${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = referralUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50 to-pink-50 p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100">
          <IconUsers size={16} className="text-purple-600" />
        </div>
        <span className="font-bold text-gray-900">추천인 제도</span>
      </div>

      {/* Stats */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
          <div className="text-2xl font-extrabold text-purple-600">{referredCount}</div>
          <div className="mt-0.5 text-xs text-gray-500">추천 가입</div>
        </div>
        <div className="rounded-xl bg-white p-3 text-center shadow-sm">
          <div className="flex items-center justify-center gap-1 text-2xl font-extrabold text-green-600">
            <IconDollarSign size={18} />
            {referralEarnings.toLocaleString()}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">추천 수당 (원)</div>
        </div>
      </div>

      {/* Code display */}
      <div className="mb-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">내 추천 코드</div>
        <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 shadow-sm">
          <span className="flex-1 font-mono text-lg font-bold tracking-widest text-purple-700">
            {referralCode}
          </span>
        </div>
      </div>

      {/* URL + copy */}
      <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">추천 링크</div>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center overflow-hidden rounded-xl bg-white px-3 py-2.5 shadow-sm">
          <IconLink size={14} className="mr-2 shrink-0 text-gray-400" />
          <span className="truncate text-sm text-gray-600">{referralUrl}</span>
        </div>
        <button
          onClick={handleCopy}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            copied
              ? "bg-green-500 text-white"
              : "bg-purple-600 text-white hover:bg-purple-700"
          }`}
        >
          {copied ? (
            <>
              <IconCheckCircle size={15} />
              복사됨
            </>
          ) : (
            <>
              <IconLink size={15} />
              복사
            </>
          )}
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        이 링크로 가입한 크리에이터는 당신의 추천 후배로 등록됩니다.
      </p>
    </div>
  );
}
