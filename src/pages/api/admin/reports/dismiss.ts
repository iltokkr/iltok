// POST /api/admin/reports/dismiss — 후보 무시 (DismissReportRequest → { ok: true })
//
// dismiss_report() 는 status/reviewed_by/reviewed_at 만 기록한다. 부수 효과는 없다.

import type { NextApiRequest, NextApiResponse } from 'next';
import type { AdminApiError, DismissReportRequest } from '@/types/admin';
import { requireAdmin, methodAllowed, toKoreanErrorMessage } from '@/lib/adminAuth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true } | AdminApiError>
) {
  if (!methodAllowed(req, res, 'POST')) return;

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { supabase, adminId } = ctx;

  const body = (req.body ?? {}) as Partial<DismissReportRequest>;
  const reportId = Number(body.reportId);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(400).json({ error: '후보 번호가 올바르지 않습니다.' });
  }

  const { error } = await supabase.rpc('dismiss_report', {
    p_report_id: reportId,
    p_admin_id: adminId,
  });

  if (error) {
    console.error('admin/reports/dismiss error:', error);
    const isConflict = /REPORT_ALREADY_REVIEWED|REPORT_NOT_FOUND/.test(error.message ?? '');
    return res.status(isConflict ? 400 : 500).json({ error: toKoreanErrorMessage(error) });
  }

  return res.status(200).json({ ok: true });
}
