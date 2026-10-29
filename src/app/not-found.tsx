import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/routes";

export const metadata = { title: "페이지를 찾을 수 없습니다" };

export default function NotFound() {
  const user = getCurrentUser();
  const home = user ? (user.status === "pending" ? "/payment/activate" : roleHome(user.role)) : "/login";
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#fffdf7] px-5 text-center">
      <p className="text-6xl font-black text-amber-400">404</p>
      <h1 className="mt-3 text-xl font-bold text-gray-900">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
        주소가 바뀌었거나 삭제된 페이지입니다. 입력한 주소를 다시 확인해 주세요.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/" className="inline-flex h-11 items-center rounded-full bg-amber-400 px-6 text-sm font-bold text-black hover:bg-amber-300">
          홈으로
        </Link>
        <Link href={home} className="inline-flex h-11 items-center rounded-full border border-gray-300 bg-white px-6 text-sm font-bold text-gray-800 hover:bg-gray-50">
          {user ? "내 대시보드" : "로그인"}
        </Link>
      </div>
    </main>
  );
}
