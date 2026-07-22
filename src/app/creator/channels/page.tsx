import { redirect } from "next/navigation";

// "운영 YouTube 채널" 메뉴는 "내 SNS 계정" 페이지로 통합되었습니다.
// 기존 링크/북마크 호환을 위해 SNS 계정 페이지로 리다이렉트합니다.
export default function CreatorChannelsRedirect() {
  redirect("/creator/social");
}
