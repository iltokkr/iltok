// POST /api/admin/reports/warn — 후보를 승인해 경고를 발송한다 (WarnReportRequest → WarnResult)
//
// 회차 증가 · 제재 적용 · 공고 숨김 · 이력 생성 · 겹치는 후보 정리는 전부
// issue_warning() 안에서 한 트랜잭션으로 처리된다. 여기서는 호출만 한다.

import type { NextApiRequest, NextApiResponse } from 'next';
import type { AdminApiError, WarnReportRequest, WarnResult } from '@/types/admin';
import { requireAdmin, methodAllowed, toKoreanErrorMessage } from '@/lib/adminAuth';
import { IssuedWarningRow, toWarnResult } from '@/lib/adminSpam';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WarnResult | AdminApiError>
) {
  if (!methodAllowed(req, res, 'POST')) return;

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { supabase, adminId } = ctx;

  const body = (req.body ?? {}) as Partial<WarnReportRequest>;
  const reportId = Number(body.reportId);
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return res.status(400).json({ error: '후보 번호가 올바르지 않습니다.' });
  }

  const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim() : '';

  const { data, error } = await supabase.rpc('issue_warning', {
    p_report_id: reportId,
    p_admin_id: adminId,
    p_admin_note: adminNote || null,
  });

  if (error) {
    console.error('admin/reports/warn error:', error);
    // 이미 처리된 후보 등 운영자가 바로 이해할 수 있는 상황은 400 으로 내린다
    const isConflict = /REPORT_ALREADY_REVIEWED|REPORT_NOT_FOUND|USER_NOT_FOUND/.test(
      error.message ?? ''
    );
    return res.status(isConflict ? 400 : 500).json({ error: toKoreanErrorMessage(error) });
  }

  const row = (Array.isArray(data) ? data[0] : data) as IssuedWarningRow | null;
  if (!row) {
    return res.status(500).json({ error: '경고 발송 결과를 확인하지 못했습니다.' });
  }

  return res.status(200).json(toWarnResult(row));
}
