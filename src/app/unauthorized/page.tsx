import { LinkButton } from "@/components/ui";
import { IconShield } from "@/components/icons";

export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 text-center">
      <IconShield size={56} className="text-gray-400 mx-auto" strokeWidth={1.25} />
      <h1 className="mt-4 text-2xl font-extrabold text-gray-900">접근 권한이 없습니다</h1>
      <p className="mt-2 text-sm text-gray-500">
        요청하신 페이지에 접근할 수 있는 권한이 없습니다.
      </p>
      <div className="mt-6 flex gap-2">
        <LinkButton href="/" variant="outline">
          홈으로
        </LinkButton>
        <LinkButton href="/login">로그인</LinkButton>
      </div>
    </main>
  );
}
