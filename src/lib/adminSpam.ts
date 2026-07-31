// 관리자 API 공통 — 응답 조립에 쓰는 계산들
//
// src/types/admin.ts 의 계약을 채우기 위한 서버 전용 헬퍼다.
// 여러 라우트(reports / users / users/[id])가 같은 값을 만들어야 해서 한 곳에 모았다.

import type { NextAction, WarnResult } from '@/types/admin';

/** users 에서 읽어오는 최소 필드 */
export interface AdminUserSource {
  id: string;
  name: string | null;
  company_name: string | null;
  user_id: string | null;
  email: string | null;
  number: string | null;
  user_type: string | null;
  warning_count: number | null;
  suspended_until: string | null;
  is_permanently_blocked: boolean | null;
}

/** jd 에서 읽어오는 최소 필드 */
export interface AdminJdSource {
  id: number;
  title: string | null;
  contents: string | null;
  updated_time: string | null;
  uploader_id: string | null;
  board_type: string | null;
  is_hidden: boolean | null;
  salary_type: string | null;
  salary_detail: string | null;
  work_start_time: string | null;
  work_end_time: string | null;
  is_two_shift: boolean | null;
  work_start_time2: string | null;
  work_end_time2: string | null;
  contact_phone: string | null;
  work_location_detail: string | null;
  '1depth_region': string | null;
  '2depth_region': string | null;
}

export const SELECT_JD_FIELDS =
  'id, title, contents, updated_time, uploader_id, board_type, is_hidden, ' +
  'salary_type, salary_detail, work_start_time, work_end_time, is_two_shift, ' +
  'work_start_time2, work_end_time2, contact_phone, work_location_detail, ' +
  '1depth_region, 2depth_region';

export const SELECT_USER_FIELDS =
  'id, name, company_name, user_id, email, number, user_type, ' +
  'warning_count, suspended_until, is_permanently_blocked';

/** 화면에 보여줄 이름. 기업은 회사명, 개인은 이름, 없으면 아이디/이메일 */
export const displayNameOf = (u: Pick<AdminUserSource,
  'company_name' | 'name' | 'user_id' | 'email'>): string =>
  (u.company_name || u.name || u.user_id || u.email || '(이름 없음)').trim() || '(이름 없음)';

/** "경기 수원시" */
export const regionTextOf = (depth1: string | null, depth2: string | null): string =>
  [depth1, depth2].filter(Boolean).join(' ').trim();

/** "시급 11,000" — 값이 없으면 null */
export const salaryTextOf = (
  salaryType: string | null,
  salaryDetail: string | null
): string | null => {
  const type = (salaryType || '').trim();
  const detail = (salaryDetail || '').trim();
  if (!type && !detail) return null;
  if (!detail) return type || null;

  const numeric = Number(detail.replace(/,/g, ''));
  const formatted =
    detail !== '' && !Number.isNaN(numeric) ? numeric.toLocaleString('ko-KR') : detail;
  return type ? `${type} ${formatted}` : formatted;
};

/** "08:00~17:00" — 2교대면 두 구간을 함께 */
export const worktimeTextOf = (jd: Pick<AdminJdSource,
  'work_start_time' | 'work_end_time' | 'is_two_shift' | 'work_start_time2' | 'work_end_time2'
>): string | null => {
  const start = (jd.work_start_time || '').trim();
  const end = (jd.work_end_time || '').trim();
  if (!start || !end) return null;

  const first = `${start}~${end}`;
  const start2 = (jd.work_start_time2 || '').trim();
  const end2 = (jd.work_end_time2 || '').trim();
  if (jd.is_two_shift === true && start2 && end2) {
    return `${first} / ${start2}~${end2} (2교대)`;
  }
  return first;
};

/** 숨겨지지 않은 채용/구직 공고인지 (자유게시판 글은 공고가 아니다) */
export const isActivePost = (jd: Pick<AdminJdSource, 'is_hidden' | 'board_type'>): boolean =>
  jd.is_hidden !== true && (jd.board_type ?? '0') !== '4';

export interface NextSanction {
  nextLevel: number;
  nextAction: NextAction;
  nextSuspendedUntil: string | null;
}

/**
 * 경고를 지금 발송하면 어떤 제재가 되는지. issue_warning() 의 회차 계산과 같은 규칙이다.
 *   1회차 → 경고만 / 2회차 → 7일 제한 / 3회차 이상 → 영구 제한
 * 이미 영구 제한된 회원은 회차와 무관하게 permanent.
 */
export const computeNextSanction = (
  warningCount: number | null,
  isPermanentlyBlocked: boolean | null
): NextSanction => {
  const nextLevel = (warningCount ?? 0) + 1;

  if (isPermanentlyBlocked === true || nextLevel >= 3) {
    return { nextLevel, nextAction: 'permanent', nextSuspendedUntil: null };
  }
  if (nextLevel === 2) {
    return {
      nextLevel,
      nextAction: 'suspend_7d',
      nextSuspendedUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return { nextLevel, nextAction: 'warn_only', nextSuspendedUntil: null };
};

/** issue_warning() 이 돌려주는 user_warnings 행 (RETURNS user_warnings) */
export interface IssuedWarningRow {
  id: number;
  level: number;
  suspended_until: string | null;
  is_permanent: boolean | null;
  hidden_jd_ids: number[] | null;
}

export const toWarnResult = (row: IssuedWarningRow): WarnResult => ({
  warningId: row.id,
  level: row.level,
  suspendedUntil: row.suspended_until,
  isPermanent: row.is_permanent === true,
  hiddenJdCount: row.hidden_jd_ids?.length ?? 0,
});
