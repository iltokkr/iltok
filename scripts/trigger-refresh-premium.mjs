// 1회성: refresh-premium 크론과 동일 로직을 로컬에서 실행 (Vercel env 미설정 우회용)
// 사용: node scripts/trigger-refresh-premium.mjs
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.join(process.cwd(), '.env.local') });

const PICK_COUNT = 50;
const MAX_PER_UPLOADER = 2;
const CANDIDATE_WINDOW_DAYS = 7;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  console.log('1) 후보 수집…');
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

  if (fetchError) {
    console.error('fetchError:', fetchError);
    process.exit(1);
  }

  const visibleCandidates = (candidates || []).filter(
    (c) => c.is_hidden !== true && c.is_wage_violation !== true,
  );
  console.log(`   raw=${candidates?.length ?? 0}, visible=${visibleCandidates.length}`);

  const now = Date.now();
  const scored = visibleCandidates
    .map((c) => {
      const ageMs = now - new Date(c.updated_time).getTime();
      const ageDays = Math.max(1, ageMs / (1000 * 60 * 60 * 24));
      return {
        id: c.id,
        uploader_id: c.uploader_id,
        view_count: c.view_count,
        score: (Number(c.view_count) || 0) / ageDays,
      };
    })
    .sort((a, b) => b.score - a.score);

  const uploaderCount = new Map();
  const selected = [];
  for (const item of scored) {
    const key = item.uploader_id ?? '__null__';
    const count = uploaderCount.get(key) || 0;
    if (count >= MAX_PER_UPLOADER) continue;
    selected.push(item);
    uploaderCount.set(key, count + 1);
    if (selected.length >= PICK_COUNT) break;
  }

  console.log(`2) 선택된 후보: ${selected.length}건`);
  if (selected.length === 0) {
    console.log('   후보가 없어서 종료 (기존 자동 프리미엄 유지)');
    return;
  }

  console.log('   샘플 5건:', selected.slice(0, 5).map((s) => ({ id: s.id, vc: s.view_count, score: Math.round(s.score) })));

  console.log('3) 기존 자동 프리미엄 해제…');
  const { error: clearError, count: clearedCount } = await supabase
    .from('jd')
    .update({ ad: false, ad_auto: false, ad_since: null, ad_until: null }, { count: 'exact' })
    .eq('ad_auto', true);
  if (clearError) {
    console.error('clearError:', clearError);
    process.exit(1);
  }
  console.log(`   cleared=${clearedCount ?? 0}`);

  console.log('4) 자동 프리미엄 세팅…');
  const adSince = new Date();
  const adUntil = new Date();
  adUntil.setDate(adUntil.getDate() + 1);
  adUntil.setHours(adUntil.getHours() + 1);

  const { error: updateError, count: updatedCount } = await supabase
    .from('jd')
    .update(
      {
        ad: true,
        ad_auto: true,
        ad_since: adSince.toISOString(),
        ad_until: adUntil.toISOString(),
      },
      { count: 'exact' },
    )
    .in('id', selected.map((s) => s.id));
  if (updateError) {
    console.error('updateError:', updateError);
    process.exit(1);
  }

  console.log(`   updated=${updatedCount ?? 0}`);
  console.log('완료.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
