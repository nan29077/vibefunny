export const SUPPORT_FAQS = [
  { question: "수익은 어떻게 발생하나요?", keywords: ["수익", "돈", "얼마"], answer: "바이브퍼니 수익은 숏폼 제작, 캠페인 참여, 콘텐츠 배포와 추천 활동을 통해 발생합니다. 자세한 항목별 금액은 마이페이지의 수익 현황에서 확인할 수 있어요." },
  { question: "정산과 출금은 언제 가능한가요?", keywords: ["정산", "출금", "입금"], answer: "확정된 수익은 포인트·출금 메뉴에서 확인할 수 있습니다. 출금 신청 후 관리자 검토가 완료되면 등록된 지급 정보로 처리됩니다." },
  { question: "영상은 어디에서 등록하나요?", keywords: ["영상", "업로드", "등록"], answer: "크리에이터 마이페이지의 ‘영상판매’ 메뉴에서 영상을 등록할 수 있습니다. 캠페인용 결과물은 해당 캠페인 상세 화면에서 제출해 주세요." },
  { question: "캠페인 참여 방법이 궁금해요", keywords: ["캠페인", "참여", "신청"], answer: "마이페이지의 ‘캠페인’에서 모집 중인 캠페인을 선택하고 참여 신청을 진행하세요. 승인 여부와 제출 일정도 같은 화면에서 확인할 수 있습니다." },
  { question: "추천 수당은 어떻게 받나요?", keywords: ["추천", "추천인", "수당"], answer: "내 추천 현황의 전용 링크나 추천 코드를 공유하세요. 추천받은 회원이 조건을 충족하면 설정된 추천 수당이 적립됩니다." },
  { question: "로그인이나 계정 문제가 있어요", keywords: ["로그인", "비밀번호", "계정", "가입"], answer: "이메일과 비밀번호를 다시 확인해 주세요. 계속 문제가 발생하면 증상과 사용 중인 이메일을 남겨 주시면 관리자가 확인해 드립니다." },
] as const;

export function getSupportBotReply(content: string): string {
  const normalized = content.replace(/\s+/g, "").toLowerCase();
  const matched = SUPPORT_FAQS.find((faq) => faq.keywords.some((keyword) => normalized.includes(keyword)));
  if (matched) return matched.answer;
  return "문의가 정상적으로 접수되었습니다. 담당 관리자가 확인 후 이 대화창으로 답변드릴게요. 운영 시간에는 순서대로 빠르게 안내해 드립니다.";
}
