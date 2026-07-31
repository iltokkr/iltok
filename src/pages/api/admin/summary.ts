// GET /api/admin/summary — 관리자 화면 상단 요약 (AdminSummary)
//
// 이번 달 기준은 KST 다. 서버(Vercel)는 UTC 로 돌기 때문에 직접 계산한다.

import type { NextApiRequest, NextApiResponse } from 'next';
import type { AdminSummary, AdminApiError } from '@/types/admin';
import { requireAdmin, methodAllowed, toKoreanErrorMessage } from '@/lib/adminAuth';

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 이번 달 1일 00:00 의 UTC ISO 문자열 */
const kstMonthStartISO = (): string => {
  const kstNow = new Date(Date.now() + KST_OFFSET_MS);
  const startKst = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1, 0, 0, 0, 0);
  return new Date(startKst - KST_OFFSET_MS).toISOString();
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminSummary | AdminApiError>
) {
  if (!methodAllowed(req, res, 'GET')) return;

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  try {
    const nowISO = new Date().toISOString();

    const [pending, warnings, suspended, blocked] = await Promise.all([
      supabase
        .from('spam_reports')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('user_warnings')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', kstMonthStartISO()),
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gt('suspended_until', nowISO)
        .eq('is_permanently_blocked', false),
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('is_permanently_blocked', true),
    ]);

    const firstError =
      pending.error || warnings.error || suspended.error || blocked.error;
    if (firstError) throw firstError;

    return res.status(200).json({
      pendingReports: pending.count ?? 0,
      warningsThisMonth: warnings.count ?? 0,
      suspendedUsers: suspended.count ?? 0,
      permanentlyBlockedUsers: blocked.count ?? 0,
    });
  } catch (err) {
    console.error('admin/summary error:', err);
    return res.status(500).json({ error: toKoreanErrorMessage(err) });
  }
}
