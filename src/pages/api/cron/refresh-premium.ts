import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import fs from 'fs';
import { config as loadEnv } from 'dotenv';

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
  } catch { /* ignore */ }
}

const PICK_COUNT = 50;
const MAX_PER_UPLOADER = 2;
const CANDIDATE_WINDOW_DAYS = 30;

/**
 * 자동 프리미엄 광고 갱신 (Vercel Cron, 매일 KST 00:30)
 * - 운영자 결제 광고(ad_auto != true)는 절대 안 건드림
 * - 후보: 최근 30일 내 등록, 활성, 사업자 인증된 채용공고
 * - 점수: view_count / (days_since_post + 1)
 * - 다양성: 같은 uploader_id는 최대 2건
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  ensureEnvLoaded();

  const expectedSecret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!expectedSecret || !supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Config error' });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1) 후보 수집 (해제보다 먼저 — 후보 0건이면 기존 자동 프리미엄을 그대로 유지)
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - CANDIDATE_WINDOW_DAYS);

    const { data: candidates, error: fetchError } = await supabase
      .from('jd')
      .select(`
        id,
        uploader_id,
        view_count,
        updated_time,
        ad,
        ad_auto,
        is_hidden,
        is_wage_violation,
        users!inner(is_accept)
      `)
      .eq('board_type', '0')
      .eq('users.is_accept', true)
      .gte('updated_time', windowStart.toISOString())
      .gt('view_count', 0)
      .order('view_count', { ascending: false })
      .limit(1000);

    if (fetchError) throw fetchError;

    // is_hidden / is_wage_violation 은 NULL 인 경우가 정상 — 클라이언트에서 필터링
    // (.neq('col', true) 는 NULL 행을 제외해버려서 후보가 0건이 되는 버그가 있었음)
    const visibleCandidates = (candidates || []).filter(
      (c: any) => c.is_hidden !== true && c.is_wage_violation !== true
    );

    // 2) 점수 계산 + 정렬
    const now = Date.now();
    const scored = visibleCandidates
      .map((c: any) => {
        const ageMs = now - new Date(c.updated_time).getTime();
        const ageDays = Math.max(1, ageMs / (1000 * 60 * 60 * 24));
        return {
          id: c.id as number,
          uploader_id: c.uploader_id as string | null,
          score: (Number(c.view_count) || 0) / ageDays,
        };
      })
      .sort((a, b) => b.score - a.score);

    // 3) uploader 다양성 보정 — 같은 업체 최대 2건
    const uploaderCount = new Map<string, number>();
    const selected: number[] = [];
    for (const item of scored) {
      const key = item.uploader_id ?? '__null__';
      const count = uploaderCount.get(key) || 0;
      if (count >= MAX_PER_UPLOADER) continue;
      selected.push(item.id);
      uploaderCount.set(key, count + 1);
      if (selected.length >= PICK_COUNT) break;
    }

    if (selected.length === 0) {
      // 후보가 없으면 기존 자동 프리미엄을 그대로 유지 (해제 금지)
      return res.status(200).json({
        ok: true,
        cleared: 0,
        candidates: candidates?.length ?? 0,
        visibleCandidates: visibleCandidates.length,
        selected: 0,
        note: 'No eligible candidates — keeping existing auto premiums',
      });
    }

    // 4) 기존 자동 프리미엄 해제 (유료 광고는 ad_auto != true 라 안 건드림)
    const { error: clearError, count: clearedCount } = await supabase
      .from('jd')
      .update({ ad: false, ad_auto: false, ad_since: null, ad_until: null }, { count: 'exact' })
      .eq('ad_auto', true);

    if (clearError) throw clearError;

    // 5) 자동 프리미엄 세팅
    const adSince = new Date();
    const adUntil = new Date();
    adUntil.setDate(adUntil.getDate() + 1);
    adUntil.setHours(adUntil.getHours() + 1); // 다음 cron 실행 사이 1h 여유

    const { error: updateError } = await supabase
      .from('jd')
      .update({
        ad: true,
        ad_auto: true,
        ad_since: adSince.toISOString(),
        ad_until: adUntil.toISOString(),
      })
      .in('id', selected);

    if (updateError) throw updateError;

    return res.status(200).json({
      ok: true,
      cleared: clearedCount ?? 0,
      candidates: candidates?.length ?? 0,
      visibleCandidates: visibleCandidates.length,
      selected: selected.length,
      ids: selected,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('refresh-premium error:', err);
    return res.status(500).json({ error: msg });
  }
}
