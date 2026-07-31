// GET /api/admin/users — 회원 검색 ({ users: AdminUserRow[] })
//
// ?q= 로 이름 / 회사명 / 전화번호 / 아이디 / 이메일 부분검색.
// q 가 없으면 경고 이력이 있는 회원(warning_count > 0)만 돌려준다.

import type { NextApiRequest, NextApiResponse } from 'next';
import type { AdminApiError, AdminUserRow } from '@/types/admin';
import { requireAdmin, methodAllowed, toKoreanErrorMessage } from '@/lib/adminAuth';
import {
  AdminJdSource,
  AdminUserSource,
  SELECT_USER_FIELDS,
  displayNameOf,
  isActivePost,
} from '@/lib/adminSpam';

const MAX_USERS = 50;
/** 검색어 없이 목록을 만들 때 훑는 최근 공고 수 상한 */
const RECENT_JD_SCAN_LIMIT = 5000;

/** PostgREST 의 or() 문법을 깨뜨리는 문자를 걷어낸다 */
const sanitizeTerm = (raw: string): string =>
  raw.replace(/[,()*%\\"']/g, ' ').replace(/\s+/g, ' ').trim();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ users: AdminUserRow[] } | AdminApiError>
) {
  if (!methodAllowed(req, res, 'GET')) return;

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  const rawQ = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const term = sanitizeTerm(rawQ ?? '');

  try {
    let query = supabase.from('users').select(SELECT_USER_FIELDS);

    if (term) {
      const patterns = [
        `name.ilike.%${term}%`,
        `company_name.ilike.%${term}%`,
        `number.ilike.%${term}%`,
        `user_id.ilike.%${term}%`,
        `email.ilike.%${term}%`,
      ];
      // 전화번호는 하이픈 유무가 제각각이라 숫자만 남긴 형태로도 한 번 더 본다
      const digits = term.replace(/\D/g, '');
      if (digits.length >= 4 && digits !== term) {
        patterns.push(`number.ilike.%${digits}%`);
      }
      query = query.or(patterns.join(','));
    } else {
      // 검색어가 없으면 "지금 살펴볼 만한 회원"을 보여준다.
      // 자동 감지가 붙기 전에는 이 목록이 도배를 찾는 유일한 출발점이라,
      // 빈 화면을 주면 관리자 페이지가 막다른 길이 된다.
      //   - 최근 90일 안에 공개 공고를 2건 이상 올린 회원 (많은 순)
      //   - 경고 이력이 있는 회원은 공고 수와 무관하게 항상 포함
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      const { data: recentJd, error: recentErr } = await supabase
        .from('jd')
        .select('id, uploader_id, is_hidden, board_type')
        .gte('updated_time', since)
        .limit(RECENT_JD_SCAN_LIMIT);
      if (recentErr) throw recentErr;

      const counts = new Map<string, number>();
      for (const row of (recentJd ?? []) as unknown as Pick<
        AdminJdSource,
        'id' | 'uploader_id' | 'is_hidden' | 'board_type'
      >[]) {
        if (!row.uploader_id || !isActivePost(row)) continue;
        counts.set(row.uploader_id, (counts.get(row.uploader_id) ?? 0) + 1);
      }

      const topIds = Array.from(counts.entries())
        .filter(([, n]) => n >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_USERS)
        .map(([id]) => id);

      const { data: warnedRows } = await supabase
        .from('users')
        .select('id')
        .gt('warning_count', 0)
        .limit(MAX_USERS);

      const ids = Array.from(
        new Set([...(warnedRows ?? []).map((w) => w.id as string), ...topIds])
      ).slice(0, MAX_USERS);

      if (ids.length === 0) {
        return res.status(200).json({ users: [] });
      }
      query = query.in('id', ids);
    }

    const { data, error } = await query
      .order('warning_count', { ascending: false })
      .limit(MAX_USERS);

    if (error) throw error;

    const users = (data ?? []) as unknown as AdminUserSource[];
    if (users.length === 0) {
      return res.status(200).json({ users: [] });
    }

    // 활성 공고 수 — is_hidden / board_type 이 NULL 인 행이 정상이라 JS 에서 센다
    // (.neq() 는 NULL 행을 제외해버린다)
    const { data: jdRows, error: jdError } = await supabase
      .from('jd')
      .select('id, uploader_id, is_hidden, board_type')
      .in(
        'uploader_id',
        users.map((u) => u.id)
      );

    if (jdError) throw jdError;

    const activeCount = new Map<string, number>();
    for (const row of (jdRows ?? []) as unknown as Pick<
      AdminJdSource,
      'id' | 'uploader_id' | 'is_hidden' | 'board_type'
    >[]) {
      if (!row.uploader_id || !isActivePost(row)) continue;
      activeCount.set(row.uploader_id, (activeCount.get(row.uploader_id) ?? 0) + 1);
    }

    const payload: AdminUserRow[] = users.map((u) => ({
      id: u.id,
      displayName: displayNameOf(u),
      userType: u.user_type,
      phone: u.number,
      email: u.email,
      warningCount: u.warning_count ?? 0,
      suspendedUntil: u.suspended_until,
      isPermanentlyBlocked: u.is_permanently_blocked === true,
      activePostCount: activeCount.get(u.id) ?? 0,
    }));

    // 경고 이력이 있는 회원을 먼저, 그다음 공고가 많은 순.
    // 도배 의심이 높은 쪽이 위로 오게 한다.
    payload.sort(
      (a, b) => b.warningCount - a.warningCount || b.activePostCount - a.activePostCount
    );

    return res.status(200).json({ users: payload });
  } catch (err) {
    console.error('admin/users error:', err);
    return res.status(500).json({ error: toKoreanErrorMessage(err) });
  }
}
