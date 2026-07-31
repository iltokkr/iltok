// POST /api/admin/warnings — 운영자 수동 경고 (ManualWarningRequest → WarnResult)
//
// 자동 감지에 걸리지 않은 도배를 운영자가 직접 처리하는 경로다.
// spam_reports 에 kind='manual' 행을 하나 만든 뒤 issue_warning() 을 그대로 호출한다.
// 이렇게 하면 회차 계산·제재·이력 생성이 자동 후보와 완전히 같은 코드를 탄다.
//
// issue_warning() 의 manual 분기는 jd_ids 를 전부 숨긴다 (운영자가 직접 고른 것이므로).

import type { NextApiRequest, NextApiResponse } from 'next';
import type { AdminApiError, ManualWarningRequest, WarnResult } from '@/types/admin';
import { randomUUID } from 'crypto';
import { requireAdmin, methodAllowed, toKoreanErrorMessage } from '@/lib/adminAuth';
import { AdminJdSource, IssuedWarningRow, toWarnResult } from '@/lib/adminSpam';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_JD_IDS = 200;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<WarnResult | AdminApiError>
) {
  if (!methodAllowed(req, res, 'POST')) return;

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { supabase, adminId } = ctx;

  const body = (req.body ?? {}) as Partial<ManualWarningRequest>;

  const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
  if (!UUID_PATTERN.test(userId)) {
    return res.status(400).json({ error: '회원 번호가 올바르지 않습니다.' });
  }

  if (!Array.isArray(body.jdIds) || body.jdIds.length === 0) {
    return res.status(400).json({ error: '숨길 공고를 한 건 이상 선택해주세요.' });
  }
  if (body.jdIds.length > MAX_JD_IDS) {
    return res.status(400).json({ error: `공고는 한 번에 ${MAX_JD_IDS}건까지 지정할 수 있습니다.` });
  }

  const jdIds = Array.from(new Set(body.jdIds.map((v) => Number(v))));
  if (jdIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    return res.status(400).json({ error: '공고 번호가 올바르지 않습니다.' });
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const adminNote = typeof body.adminNote === 'string' ? body.adminNote.trim() : '';

  let reportId: number | null = null;

  try {
    // (1) 지정한 공고가 정말 그 회원 것인지 확인한다
    const { data: jdData, error: jdError } = await supabase
      .from('jd')
      .select('id, uploader_id, 1depth_region, 2depth_region')
      .in('id', jdIds);

    if (jdError) throw jdError;

    const jdRows = (jdData ?? []) as unknown as Pick<
      AdminJdSource,
      'id' | 'uploader_id' | '1depth_region' | '2depth_region'
    >[];

    if (jdRows.length !== jdIds.length) {
      return res.status(400).json({ error: '존재하지 않는 공고가 포함되어 있습니다.' });
    }
    if (jdRows.some((row) => row.uploader_id !== userId)) {
      return res.status(400).json({ error: '해당 회원의 공고가 아닌 것이 포함되어 있습니다.' });
    }

    // 지역은 첫 공고 기준 (spam_reports.region_* 은 NOT NULL 이라 빈 문자열로 채운다)
    const byId = new Map(jdRows.map((row) => [row.id, row]));
    const firstJd = byId.get(jdIds[0]);

    // (2) 수동 후보 생성 — cluster_key 는 pending 유일 인덱스와 충돌하지 않게 UUID 로
    const { data: reportData, error: reportError } = await supabase
      .from('spam_reports')
      .insert({
        uploader_id: userId,
        kind: 'manual',
        region_1depth: firstJd?.['1depth_region'] ?? '',
        region_2depth: firstJd?.['2depth_region'] ?? '',
        jd_ids: jdIds,
        jd_count: jdIds.length,
        content_similarity: 0,
        same_contact: false,
        same_salary: false,
        same_worktime: false,
        same_location_detail: false,
        confidence: 'high',
        cluster_key: `manual:${randomUUID()}`,
        status: 'pending',
        reason_text: reason || null,
      })
      .select('id')
      .single();

    if (reportError) throw reportError;
    reportId = (reportData as { id: number }).id;

    // (3) 자동 후보와 같은 경로로 발송
    const { data, error } = await supabase.rpc('issue_warning', {
      p_report_id: reportId,
      p_admin_id: adminId,
      p_admin_note: adminNote || null,
    });

    if (error) {
      // 발송에 실패하면 방금 만든 후보를 지운다 — 검토 대기 목록에 유령 행을 남기지 않는다
      await supabase.from('spam_reports').delete().eq('id', reportId).eq('status', 'pending');
      console.error('admin/warnings issue_warning error:', error);
      const isConflict = /USER_NOT_FOUND|REPORT_NOT_FOUND/.test(error.message ?? '');
      return res.status(isConflict ? 400 : 500).json({ error: toKoreanErrorMessage(error) });
    }

    const row = (Array.isArray(data) ? data[0] : data) as IssuedWarningRow | null;
    if (!row) {
      return res.status(500).json({ error: '경고 발송 결과를 확인하지 못했습니다.' });
    }

    return res.status(200).json(toWarnResult(row));
  } catch (err) {
    if (reportId !== null) {
      await supabase.from('spam_reports').delete().eq('id', reportId).eq('status', 'pending');
    }
    console.error('admin/warnings error:', err);
    return res.status(500).json({ error: toKoreanErrorMessage(err) });
  }
}
