import { redirect } from "next/navigation";

// "동화 제작 의뢰"는 별도 메뉴에서 제거되고 캠페인 메뉴(참여 가능한 캠페인)로 통합되었습니다.
// 기존 경로로 접근 시 캠페인 페이지로 이동시킵니다.
export default function StoryCommissionsRedirect() {
  redirect("/creator/campaigns");
}
