// POST /api/admin/reports/hide — 경고 없이 공고만 숨김 (DismissReportRequest → { ok, hiddenCount })
//
// 한 회원이 여러 묶음으로 잡혔을 때 묶음마다 경고를 주면 하루 만에 영구 제한이 된다.
// 경고는 한 번만 주고 나머지 묶음은 이걸로 공고만 내린다.
// 경고 횟수·정지 상태는 그대로이고 당사자에게 팝업도 뜨지 않는다.

import type { NextApiRequest, NextApiResponse } from 'next';
import type { AdminApiError, DismissReportRequest } from '@/types/admin';
import { requireAdmin, methodAllowed, toKoreanErrorMessage } from '@/lib/adminAuth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ ok: true; hiddenCount: number } | AdminApiError>
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

  const { data, error } = await supabase.rpc('hide_report_posts', {
    p_report_id: reportId,
    p_admin_id: adminId,
  });

  if (error) {
    console.error('admin/reports/hide error:', error);
    const isConflict = /REPORT_ALREADY_REVIEWED|REPORT_NOT_FOUND/.test(error.message ?? '');
    return res.status(isConflict ? 400 : 500).json({ error: toKoreanErrorMessage(error) });
  }

  return res.status(200).json({ ok: true, hiddenCount: Number(data ?? 0) });
}
