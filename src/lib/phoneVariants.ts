/**
 * users.number 는 저장 형식이 섞여 있다.
 *   '821012345678'  (+ 없음, 초기 가입자 대부분 — 약 2,450명)
 *   '+821012345678' (현재 클라이언트가 만드는 형식)
 *   '01012345678'   (일부)
 * 클라이언트는 항상 '+82…' 로 보내므로 .eq('number', phone) 으로 찾으면
 * 앞의 두 형식 회원을 "가입 안 된 번호"로 판정한다. 같은 번호의 모든 표기를 돌려준다.
 */
export function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  let local = digits; // 1012345678 형태(국가번호·앞자리 0 제외)
  if (local.startsWith('82')) local = local.slice(2);
  if (local.startsWith('0')) local = local.slice(1);
  if (!local) return [phone];
  return Array.from(new Set([`+82${local}`, `82${local}`, `0${local}`, phone]));
}
