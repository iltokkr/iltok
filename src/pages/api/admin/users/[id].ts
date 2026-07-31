// GET /api/admin/users/[id] — 회원 상세 (AdminUserDetail)
//
// 수동 경고를 보내기 위한 화면이 쓴다. 경고 이력 + 숨김되지 않은 공고 목록 + 다음 제재 예고.

import type { NextApiRequest, NextApiResponse } from 'next';
import type { AdminApiError, AdminUserDetail, SpamKind } from '@/types/admin';
import { requireAdmin, methodAllowed, toKoreanErrorMessage } from '@/lib/adminAuth';
import {
  AdminJdSource,
  AdminUserSource,
  SELECT_JD_FIELDS,
  SELECT_USER_FIELDS,
  computeNextSanction,
  displayNameOf,
  isActivePost,
  regionTextOf,
  salaryTextOf,
  worktimeTextOf,
} from '@/lib/adminSpam';
import { groupSimilarPosts, stripHtml } from '@/lib/spamText';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface WarningRow {
  id: number;
  level: number;
  kind: SpamKind;
  region_1depth: string | null;
  region_2depth: string | null;
  jd_count: number | null;
  hidden_jd_titles: string[] | null;
  suspended_until: string | null;
  is_permanent: boolean | null;
  reason_text: string | null;
  admin_note: string | null;
  created_at: string;
  acknowledged_at: string | null;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminUserDetail | AdminApiError>
) {
  if (!methodAllowed(req, res, 'GET')) return;

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  const rawId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  const userId = (rawId ?? '').trim();
  if (!UUID_PATTERN.test(userId)) {
    return res.status(400).json({ error: '회원 번호가 올바르지 않습니다.' });
  }

  try {
    const [userResult, warningResult, jdResult] = await Promise.all([
      supabase.from('users').select(SELECT_USER_FIELDS).eq('id', userId).maybeSingle(),
      supabase
        .from('user_warnings')
        .select(
          'id, level, kind, region_1depth, region_2depth, jd_count, hidden_jd_titles, ' +
            'suspended_until, is_permanent, reason_text, admin_note, created_at, acknowledged_at'
        )
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      supabase.from('jd').select(SELECT_JD_FIELDS).eq('uploader_id', userId),
    ]);

    if (userResult.error) throw userResult.error;
    if (warningResult.error) throw warningResult.error;
    if (jdResult.error) throw jdResult.error;

    const user = userResult.data as unknown as AdminUserSource | null;
    if (!user) {
      return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });
    }

    const warnings = ((warningResult.data ?? []) as unknown as WarningRow[]).map((w) => ({
      id: w.id,
      level: w.level,
      kind: w.kind,
      region: regionTextOf(w.region_1depth, w.region_2depth) || null,
      jdCount: w.jd_count,
      hiddenJdTitles: w.hidden_jd_titles,
      suspendedUntil: w.suspended_until,
      isPermanent: w.is_permanent === true,
      reasonText: w.reason_text,
      adminNote: w.admin_note,
      createdAt: w.created_at,
      acknowledgedAt: w.acknowledged_at,
    }));

    const activeJd = ((jdResult.data ?? []) as unknown as AdminJdSource[])
      .filter(isActivePost)
      .sort((a, b) => {
        const ta = a.updated_time ? new Date(a.updated_time).getTime() : 0;
        const tb = b.updated_time ? new Date(b.updated_time).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return b.id - a.id;
      });

    // 같은 지역 + 내용이 비슷한 공고끼리 묶어둔다.
    // 제목만으로는 중복인지 알 수 없으므로 화면이 이 묶음을 먼저 짚어준다.
    const groups = groupSimilarPosts(
      activeJd.map((jd) => ({
        id: jd.id,
        region: regionTextOf(jd['1depth_region'], jd['2depth_region']),
        contents: jd.contents ?? '',
      }))
    );

    const posts = activeJd.map((jd) => ({
      id: jd.id,
      title: jd.title ?? '',
      region: regionTextOf(jd['1depth_region'], jd['2depth_region']),
      updatedTime: jd.updated_time,
      salaryText: salaryTextOf(jd.salary_type, jd.salary_detail),
      worktimeText: worktimeTextOf(jd),
      contactPhone: jd.contact_phone,
      locationDetail: jd.work_location_detail,
      contents: stripHtml(jd.contents ?? ''),
      similarGroup: groups.get(jd.id) ?? null,
    }));

    const sanction = computeNextSanction(user.warning_count, user.is_permanently_blocked);

    return res.status(200).json({
      id: user.id,
      displayName: displayNameOf(user),
      userType: user.user_type,
      phone: user.number,
      email: user.email,
      warningCount: user.warning_count ?? 0,
      suspendedUntil: user.suspended_until,
      isPermanentlyBlocked: user.is_permanently_blocked === true,
      activePostCount: posts.length,
      warnings,
      posts,
      nextLevel: sanction.nextLevel,
      nextAction: sanction.nextAction,
      nextSuspendedUntil: sanction.nextSuspendedUntil,
    });
  } catch (err) {
    console.error('admin/users/[id] error:', err);
    return res.status(500).json({ error: toKoreanErrorMessage(err) });
  }
}
