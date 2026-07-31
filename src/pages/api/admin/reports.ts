// GET /api/admin/reports — 검토 대기 후보 목록 (AdminSpamReport[])
//
// ?status=pending|warned|dismissed (기본 pending)
// 정렬: 확신도 high → medium → low, 같은 확신도 안에서는 최신순.
//   확신도는 TEXT 컬럼이라 DB 정렬로는 원하는 순서가 나오지 않는다. 가져온 뒤 JS 에서 정렬한다.
//
// spam_reports 는 RLS 정책이 없어 service role 로만 읽을 수 있다.

import type { NextApiRequest, NextApiResponse } from 'next';
import type {
  AdminApiError,
  AdminReportPost,
  AdminSpamReport,
  SpamConfidence,
  SpamKind,
  SpamReportStatus,
} from '@/types/admin';
import { requireAdmin, methodAllowed, toKoreanErrorMessage } from '@/lib/adminAuth';
import {
  AdminJdSource,
  AdminUserSource,
  SELECT_JD_FIELDS,
  SELECT_USER_FIELDS,
  computeNextSanction,
  displayNameOf,
  regionTextOf,
  salaryTextOf,
  worktimeTextOf,
} from '@/lib/adminSpam';
import { markSharedSentences } from '@/lib/spamText';

const MAX_REPORTS = 100;

const CONFIDENCE_RANK: Record<SpamConfidence, number> = { high: 0, medium: 1, low: 2 };

interface SpamReportRow {
  id: number;
  uploader_id: string;
  kind: SpamKind;
  region_1depth: string | null;
  region_2depth: string | null;
  jd_ids: number[] | null;
  jd_count: number | null;
  content_similarity: number | string | null;
  same_contact: boolean | null;
  same_salary: boolean | null;
  same_worktime: boolean | null;
  same_location_detail: boolean | null;
  confidence: SpamConfidence;
  bump_date: string | null;
  status: SpamReportStatus;
  created_at: string;
}

const isValidStatus = (v: unknown): v is SpamReportStatus =>
  v === 'pending' || v === 'warned' || v === 'dismissed';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ reports: AdminSpamReport[] } | AdminApiError>
) {
  if (!methodAllowed(req, res, 'GET')) return;

  const ctx = await requireAdmin(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  const statusParam = Array.isArray(req.query.status) ? req.query.status[0] : req.query.status;
  const status: SpamReportStatus = isValidStatus(statusParam) ? statusParam : 'pending';

  try {
    const { data: reportRows, error: reportError } = await supabase
      .from('spam_reports')
      .select(
        'id, uploader_id, kind, region_1depth, region_2depth, jd_ids, jd_count, ' +
          'content_similarity, same_contact, same_salary, same_worktime, ' +
          'same_location_detail, confidence, bump_date, status, created_at'
      )
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(MAX_REPORTS);

    if (reportError) throw reportError;

    const reports = (reportRows ?? []) as unknown as SpamReportRow[];
    if (reports.length === 0) {
      return res.status(200).json({ reports: [] });
    }

    // 확신도 우선, 같은 확신도 안에서는 최신순
    reports.sort((a, b) => {
      const rank = (CONFIDENCE_RANK[a.confidence] ?? 9) - (CONFIDENCE_RANK[b.confidence] ?? 9);
      if (rank !== 0) return rank;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    // 필요한 공고와 회원을 한 번씩만 가져온다
    const jdIds = Array.from(new Set(reports.flatMap((r) => r.jd_ids ?? [])));
    const uploaderIds = Array.from(new Set(reports.map((r) => r.uploader_id)));

    // 최근 24시간 안에 경고를 받은 회원 — 묶음마다 경고를 눌러 하루 만에
    // 영구 제한이 되는 것을 화면에서 미리 막기 위해 함께 가져온다.
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [jdResult, userResult, warnResult] = await Promise.all([
      jdIds.length > 0
        ? supabase.from('jd').select(SELECT_JD_FIELDS).in('id', jdIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('users').select(SELECT_USER_FIELDS).in('id', uploaderIds),
      supabase
        .from('user_warnings')
        .select('user_id, created_at')
        .in('user_id', uploaderIds)
        .gte('created_at', since24h),
    ]);

    if (jdResult.error) throw jdResult.error;
    if (userResult.error) throw userResult.error;
    if (warnResult.error) throw warnResult.error;

    const recentWarnAt = new Map<string, string>();
    for (const w of (warnResult.data ?? []) as { user_id: string; created_at: string }[]) {
      const prev = recentWarnAt.get(w.user_id);
      if (!prev || w.created_at > prev) recentWarnAt.set(w.user_id, w.created_at);
    }

    // 같은 회원이 검토 대기에 몇 묶음이나 걸려 있는지
    const pendingByUploader = new Map<string, number>();
    for (const r of reports) {
      pendingByUploader.set(r.uploader_id, (pendingByUploader.get(r.uploader_id) ?? 0) + 1);
    }

    const jdById = new Map<number, AdminJdSource>();
    for (const row of (jdResult.data ?? []) as unknown as AdminJdSource[]) {
      jdById.set(row.id, row);
    }

    const userById = new Map<string, AdminUserSource>();
    for (const row of (userResult.data ?? []) as unknown as AdminUserSource[]) {
      userById.set(row.id, row);
    }

    const payload: AdminSpamReport[] = reports.map((report) => {
      // 최신 공고부터 — issue_warning 이 남기는 1건(가장 최근)이 맨 앞에 온다
      const posts = (report.jd_ids ?? [])
        .map((id) => jdById.get(id))
        .filter((jd): jd is AdminJdSource => !!jd)
        .sort((a, b) => {
          const ta = a.updated_time ? new Date(a.updated_time).getTime() : 0;
          const tb = b.updated_time ? new Date(b.updated_time).getTime() : 0;
          if (tb !== ta) return tb - ta;
          return b.id - a.id;
        });

      // keepDigits: 운영자는 급여·인원 같은 숫자 차이를 눈으로 찾아야 한다.
      // 숫자를 지우고 비교하면 "일당 150,000원"과 "일당 130,000원"이 같은 문장으로 칠해져
      // 정작 봐야 할 차이가 가려진다. 자동 감지 쪽은 목적이 반대라 기본 정규화를 쓴다.
      const sentencesPerPost = markSharedSentences(
        posts.map((p) => p.contents ?? ''),
        { keepDigits: true }
      );

      const reportPosts: AdminReportPost[] = posts.map((jd, idx) => ({
        id: jd.id,
        title: jd.title ?? '',
        updatedTime: jd.updated_time,
        salaryText: salaryTextOf(jd.salary_type, jd.salary_detail),
        worktimeText: worktimeTextOf(jd),
        contactPhone: jd.contact_phone,
        locationDetail: jd.work_location_detail,
        sentences: sentencesPerPost[idx] ?? [],
      }));

      const times = posts
        .map((p) => p.updated_time)
        .filter((t): t is string => !!t)
        .sort();

      const uploader = userById.get(report.uploader_id);
      const warningCount = uploader?.warning_count ?? 0;
      const sanction = computeNextSanction(
        warningCount,
        uploader?.is_permanently_blocked ?? false
      );

      return {
        id: report.id,
        kind: report.kind,
        status: report.status,
        createdAt: report.created_at,

        uploaderId: report.uploader_id,
        uploaderName: uploader ? displayNameOf(uploader) : '(탈퇴한 회원)',
        uploaderPhone: uploader?.number ?? null,

        region: regionTextOf(report.region_1depth, report.region_2depth),
        jdCount: report.jd_count ?? (report.jd_ids?.length ?? 0),
        contentSimilarity: Number(report.content_similarity ?? 0),
        confidence: report.confidence,

        sameContact: report.same_contact === true,
        sameSalary: report.same_salary === true,
        sameWorktime: report.same_worktime === true,
        sameLocationDetail: report.same_location_detail === true,

        bumpDate: report.bump_date,

        firstPostedAt: times[0] ?? null,
        lastPostedAt: times.length > 0 ? times[times.length - 1] : null,

        currentWarningCount: warningCount,
        recentlyWarnedAt: recentWarnAt.get(report.uploader_id) ?? null,
        siblingPendingCount: (pendingByUploader.get(report.uploader_id) ?? 1) - 1,
        nextLevel: sanction.nextLevel,
        nextAction: sanction.nextAction,
        nextSuspendedUntil: sanction.nextSuspendedUntil,

        posts: reportPosts,
      };
    });

    return res.status(200).json({ reports: payload });
  } catch (err) {
    console.error('admin/reports error:', err);
    return res.status(500).json({ error: toKoreanErrorMessage(err) });
  }
}
