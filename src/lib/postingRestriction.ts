// 공고 등록 제한(도배 경고·정지) 안내 문구 변환
//
// DB 트리거 enforce_posting_suspension() 이 던지는 예외 메시지를
// 사용자에게 보여줄 한국어 문구로 바꾼다.
//   POSTING_BLOCKED_PERMANENT
//   POSTING_SUSPENDED_UNTIL:2026-08-07 15:20
//
// 관련 없는 오류면 null 을 돌려주므로, 호출부에서 기존 오류 처리로 넘기면 된다.

export const getPostingRestrictionMessage = (error: unknown): string | null => {
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: string }).message ?? '')
      : typeof error === 'string'
      ? error
      : '';

  if (!message) return null;

  if (message.includes('POSTING_BLOCKED_PERMANENT')) {
    return '공고 등록이 영구히 제한된 계정입니다. 고객센터로 문의해주세요.';
  }

  const suspended = message.match(/POSTING_SUSPENDED_UNTIL:\s*([0-9-]{10} [0-9:]{5})/);
  if (suspended) {
    return `공고 등록이 제한된 상태입니다. ${suspended[1]} 이후에 다시 이용하실 수 있습니다.`;
  }

  return null;
};
