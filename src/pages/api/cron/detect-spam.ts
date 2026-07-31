// 도배 의심 후보 자동 감지 (Vercel Cron, 매일 KST 03:00)
//
// 설계 문서: docs/superpowers/specs/2026-07-31-spam-warning-system-design.md (7절)
//
// 하는 일은 후보를 spam_reports 에 쌓는 것까지다. 경고는 절대 자동으로 나가지 않는다.
// 운영자가 /admin 에서 본문을 직접 보고 판단한 뒤 버튼을 눌러야 발송된다.
//
// 판정 기준 (같은 작성자 · 같은 구/군 · 30일 이내)
//   - 본문 유사도 0.80 이상으로 묶이고, 묶음 크기가 3건 이상
//   - 제목은 보지 않는다. "생산직 급구" 같은 제목은 정상 공고끼리도 겹친다
//
// 유사도 계산은 관리자 화면과 같은 lib/spamText 를 쓴다.
// 화면에서 "유사 2건"이라고 보이는 것과 배치가 잡는 것이 어긋나면 운영자가 시스템을 믿을 수 없다.

import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { config as loadEnv } from 'dotenv';
import { groupSimilarPosts, jaccardSimilarity } from '@/lib/spamText';
import { AdminJdSource, SELECT_JD_FIELDS, regionTextOf } from '@/lib/adminSpam';

function ensureEnvLoaded() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.CRON_SECRET) return;
  const envPath = path.join(process.cwd(), '.env.local');
  loadEnv({ path: envPath, override: true });
  if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.CRON_SECRET) return;
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const srk = line.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/);
      if (srk && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = srk[1].trim().replace(/^["']|["']$/g, '');
      }
      const cs = line.match(/^CRON_SECRET=(.+)$/);
      if (cs && !process.env.CRON_SECRET) {
        process.env.CRON_SECRET = cs[1].trim().replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* ignore */
  }
}

const WINDOW_DAYS = 30;
/** 묶음이 이 크기 이상이어야 후보로 올린다. 2건은 오탈자 수정 재등록 같은 정상 사례가 섞인다 */
const MIN_CLUSTER_SIZE = 3;
/** 한 번에 훑을 공고 수 상한 */
const SCAN_LIMIT = 5000;
/** 한 번에 새로 만들 후보 수 상한 — 첫 실행에서 목록이 넘치는 것을 막는다 */
const MAX_NEW_REPORTS = 100;

/** 값이 전부 같고 비어 있지 않을 때만 "동일" 신호로 친다. 전부 비어 있으면 근거가 없는 것이다 */
const allSameNonEmpty = (values: (string | null | undefined)[]): boolean => {
  const first = values[0];
  if (first === null || first === undefined || first === '') return false;
  return values.every((v) => v === first);
};

const worktimeKeyOf = (jd: AdminJdSource): string =>
  [jd.work_start_time, jd.work_end_time, jd.is_two_shift, jd.work_start_time2, jd.work_end_time2]
    .map((v) => (v == null ? '' : String(v)))
    .join('|');

const salaryKeyOf = (jd: AdminJdSource): string =>
  [jd.salary_type, jd.salary_detail].map((v) => (v == null ? '' : String(v))).join('|');

/**
 * 후보 자동 감지 (Vercel Cron, 매일 KST 03:00)
 * 실패해도 서비스에는 영향이 없다. 로그만 남기고 다음 날 다시 돈다.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  ensureEnvLoaded();

  const expectedSecret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!expectedSecret || !supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Config error' });
  }
  if (req.headers.authorization !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data: jdRows, error: jdError } = await supabase
      .from('jd')
      .select(SELECT_JD_FIELDS)
      .eq('board_type', '0')
      .gte('updated_time', since)
      .limit(SCAN_LIMIT);
    if (jdError) throw jdError;

    const active = ((jdRows ?? []) as unknown as AdminJdSource[]).filter(
      (jd) => jd.uploader_id && jd.is_hidden !== true
    );

    // 작성자별로 나눈 뒤, 같은 지역 + 내용이 비슷한 것끼리 묶는다
    const byUploader = new Map<string, AdminJdSource[]>();
    for (const jd of active) {
      const list = byUploader.get(jd.uploader_id as string);
      if (list) list.push(jd);
      else byUploader.set(jd.uploader_id as string, [jd]);
    }

    type Candidate = {
      uploader_id: string;
      region_1depth: string;
      region_2depth: string;
      jd_ids: number[];
      jd_count: number;
      content_similarity: number;
      same_contact: boolean;
      same_salary: boolean;
      same_worktime: boolean;
      same_location_detail: boolean;
      confidence: 'high' | 'medium' | 'low';
      cluster_key: string;
      kind: 'duplicate_posting';
      status: 'pending';
    };

    const candidates: Candidate[] = [];

    byUploader.forEach((posts, uploaderId) => {
      if (posts.length < MIN_CLUSTER_SIZE) return;

      const groups = groupSimilarPosts(
        posts.map((jd) => ({
          id: jd.id,
          region: regionTextOf(jd['1depth_region'], jd['2depth_region']),
          contents: jd.contents ?? '',
        }))
      );
      if (groups.size === 0) return;

      const byGroup = new Map<number, AdminJdSource[]>();
      for (const jd of posts) {
        const g = groups.get(jd.id);
        if (g == null) continue;
        const arr = byGroup.get(g);
        if (arr) arr.push(jd);
        else byGroup.set(g, [jd]);
      }

      byGroup.forEach((members) => {
        if (members.length < MIN_CLUSTER_SIZE) return;

        // 묶음 안에서 가장 낮은 유사도를 기록한다. 관찰 기간에 기준값을 조정할 근거가 된다
        let minSim = 1;
        for (let i = 0; i < members.length; i += 1) {
          for (let j = i + 1; j < members.length; j += 1) {
            const s = jaccardSimilarity(members[i].contents ?? '', members[j].contents ?? '');
            if (s < minSim) minSim = s;
          }
        }

        const sameContact = allSameNonEmpty(members.map((m) => m.contact_phone));
        const sameSalary = allSameNonEmpty(members.map(salaryKeyOf));
        const sameWorktime = allSameNonEmpty(members.map(worktimeKeyOf));
        const sameLocation = allSameNonEmpty(members.map((m) => m.work_location_detail));

        const signals = [sameContact, sameSalary, sameWorktime, sameLocation].filter(Boolean).length;
        const confidence = signals >= 3 ? 'high' : signals === 2 ? 'medium' : 'low';

        const ids = members.map((m) => m.id).sort((a, b) => a - b);

        candidates.push({
          uploader_id: uploaderId,
          region_1depth: members[0]['1depth_region'] ?? '-',
          region_2depth: members[0]['2depth_region'] ?? '-',
          jd_ids: ids,
          jd_count: ids.length,
          content_similarity: Math.round(minSim * 1000) / 1000,
          same_contact: sameContact,
          same_salary: sameSalary,
          same_worktime: sameWorktime,
          same_location_detail: sameLocation,
          confidence,
          cluster_key: `dup:${ids.join(',')}`,
          kind: 'duplicate_posting',
          status: 'pending',
        });
      });
    });

    // ?dry=1 — 넣지 않고 무엇이 잡히는지만 본다.
    // 기준값을 조정할 때 실제 목록을 더럽히지 않고 결과를 확인하는 용도다.
    if (req.query.dry === '1') {
      const titleById = new Map(active.map((jd) => [jd.id, jd.title ?? '']));
      return res.status(200).json({
        dryRun: true,
        scanned: active.length,
        uploaders: byUploader.size,
        found: candidates.length,
        candidates: candidates
          .slice(0, 30)
          .map((c) => ({
            region: `${c.region_1depth} ${c.region_2depth}`,
            count: c.jd_count,
            similarity: c.content_similarity,
            confidence: c.confidence,
            signals: {
              contact: c.same_contact,
              salary: c.same_salary,
              worktime: c.same_worktime,
              location: c.same_location_detail,
            },
            titles: c.jd_ids.map((id) => titleById.get(id) ?? '').slice(0, 4),
          })),
      });
    }

    if (candidates.length === 0) {
      return res.status(200).json({ scanned: active.length, found: 0, inserted: 0, skipped: 0 });
    }

    // 이미 올라온 묶음은 건너뛴다.
    // status 를 가리지 않는 이유: 운영자가 무시한 묶음이 매일 다시 올라오면 목록을 신뢰할 수 없다.
    // 공고가 늘거나 줄면 jd_ids 가 바뀌어 cluster_key 도 달라지므로 새 후보로 다시 잡힌다.
    const keys = candidates.map((c) => c.cluster_key);
    const { data: existing, error: existErr } = await supabase
      .from('spam_reports')
      .select('cluster_key')
      .in('cluster_key', keys);
    if (existErr) throw existErr;

    const seen = new Set((existing ?? []).map((r) => r.cluster_key as string));
    const fresh = candidates.filter((c) => !seen.has(c.cluster_key));

    // 확신도 높은 것부터 넣는다. 상한에 걸려 잘리더라도 볼 만한 것이 먼저 남는다
    const rank = { high: 0, medium: 1, low: 2 } as const;
    fresh.sort((a, b) => rank[a.confidence] - rank[b.confidence] || b.jd_count - a.jd_count);

    const toInsert = fresh.slice(0, MAX_NEW_REPORTS);
    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from('spam_reports').insert(toInsert);
      if (insertErr) throw insertErr;
    }

    return res.status(200).json({
      scanned: active.length,
      uploaders: byUploader.size,
      found: candidates.length,
      inserted: toInsert.length,
      skipped: candidates.length - fresh.length,
      truncated: fresh.length - toInsert.length,
    });
  } catch (err) {
    console.error('detect-spam error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'unknown' });
  }
}
