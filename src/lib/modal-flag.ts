// 화면 위에 모달(확인 창·상세 창)이 열려 있음을 body[data-vf-modal] 로 표시한다.
// 여러 모달이 겹쳐 열릴 수 있으므로 개수를 세어, 마지막 모달이 닫힐 때만 표시를 지운다.
// (globals.css 에서 이 표시가 있으면 떠 있는 "문의하기" 버튼을 숨긴다)
let openCount = 0;

export function openModalFlag(): () => void {
  if (typeof document === "undefined") return () => {};
  openCount += 1;
  document.body.dataset.vfModal = "1";
  let closed = false;
  return () => {
    if (closed) return;
    closed = true;
    openCount = Math.max(0, openCount - 1);
    if (openCount === 0) delete document.body.dataset.vfModal;
  };
}
