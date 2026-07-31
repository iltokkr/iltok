// 관리자 화면 공용 표시 함수 — 날짜·라벨·제재 예고 문구
//
// 관리자 페이지와 회원 상세 패널이 같은 문구를 써야 해서 한 곳에 둔다.

import type { NextAction } from '@/types/admin';

/** ISO → "2026년 8월 7일 15:20" (KST) */
export const formatKST = (iso: string): string =>
  new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

/** ISO → "2026년 8월 7일" */
export const formatDateShort = (iso: string): string =>
  new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

/** ISO → "8월 7일" */
export const formatMonthDay = (iso: string): string =>
  new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
  });

export const kindLabel = (kind: string): string => {
  if (kind === 'bump_abuse') return '끌어올리기 남용';
  if (kind === 'manual') return '운영자 조치';
  return '중복 게재';
};

export const confidenceLabel = (c: string): string => {
  if (c === 'high') return '확신 높음';
  if (c === 'medium') return '확신 보통';
  return '확신 낮음';
};

/** "2회차 · 8월 7일까지 7일 제한" 처럼 경고를 눌렀을 때 벌어질 일을 미리 알려준다 */
export const formatSanctionPreview = (
  nextLevel: number,
  nextAction: NextAction,
  nextSuspendedUntil: string | null
): string => {
  if (nextAction === 'permanent') return `${nextLevel}회차 · 영구 제한`;
  if (nextAction === 'suspend_7d' && nextSuspendedUntil) {
    return `${nextLevel}회차 · ${formatMonthDay(nextSuspendedUntil)}까지 7일 제한`;
  }
  return `${nextLevel}회차 · 경고만 부여`;
};
