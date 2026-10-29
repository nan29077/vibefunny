"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center">
      <p className="text-5xl font-black text-amber-400">!</p>
      <h1 className="mt-3 text-xl font-bold text-gray-900">일시적인 오류가 발생했습니다</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
        잠시 후 다시 시도해 주세요. 문제가 계속되면 고객센터로 알려 주세요.
        {error.digest && <span className="mt-1 block text-xs text-gray-400">오류 코드: {error.digest}</span>}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => reset()} className="inline-flex h-11 items-center rounded-full bg-amber-400 px-6 text-sm font-bold text-black hover:bg-amber-300">
          다시 시도
        </button>
        <Link href="/" className="inline-flex h-11 items-center rounded-full border border-gray-300 bg-white px-6 text-sm font-bold text-gray-800 hover:bg-gray-50">
          홈으로
        </Link>
      </div>
    </main>
  );
}
