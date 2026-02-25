/**
 * 채용정보 게시판 지역 상위 10개 조회 스크립트
 * 
 * 사용법: node scripts/top-regions.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        process.env[key.trim()] = value;
      }
    });
  }
}

loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getTopRegions() {
  const { data, error } = await supabase
    .from('jd')
    .select('1depth_region, 2depth_region')
    .eq('board_type', '0')
    .eq('ad', false)
    .or('is_hidden.is.null,is_hidden.eq.false');

  if (error) {
    console.error('조회 오류:', error);
    process.exit(1);
  }

  const regionCounts = {};
  for (const row of data || []) {
    const r1 = row['1depth_region'] || '';
    const r2 = row['2depth_region'] || '';
    const region = `${r1} ${r2}`.trim() || '(지역 미입력)';
    regionCounts[region] = (regionCounts[region] || 0) + 1;
  }

  const sorted = Object.entries(regionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return sorted;
}

getTopRegions().then((top10) => {
  console.log('\n=== 채용정보 게시판 지역 상위 10개 ===\n');
  top10.forEach(([region, count], i) => {
    console.log(`${i + 1}. ${region}: ${count}건`);
  });
  console.log('');
});
