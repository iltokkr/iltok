import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

loadEnv({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = 'auth_file';
const BATCH_SIZE = 100;

async function main() {
  let totalDeleted = 0;

  while (true) {
    // 파일 목록 조회
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET)
      .list('', { limit: BATCH_SIZE });

    if (listError) {
      console.error('목록 조회 실패:', listError);
      break;
    }

    if (!files || files.length === 0) {
      console.log('모든 파일 삭제 완료!');
      break;
    }

    const fileNames = files.map(f => f.name);

    const { error: deleteError } = await supabase.storage
      .from(BUCKET)
      .remove(fileNames);

    if (deleteError) {
      console.error('삭제 실패:', deleteError);
      break;
    }

    totalDeleted += fileNames.length;
    console.log(`삭제 중... ${totalDeleted}개 완료`);
  }

  console.log(`\n총 ${totalDeleted}개 삭제 완료`);
}

main();
