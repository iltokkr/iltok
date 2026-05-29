import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'biz-files-backup');

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // users 테이블에서 company_name + biz_file 조회
  const { data: users, error } = await supabase
    .from('users')
    .select('company_name, biz_file')
    .not('biz_file', 'is', null)
    .neq('biz_file', '');

  if (error) {
    console.error('유저 조회 실패:', error);
    return;
  }

  console.log(`총 ${users.length}개 파일 다운로드 시작...`);

  let success = 0;
  let fail = 0;

  for (const user of users) {
    const { company_name, biz_file } = user;
    if (!biz_file) continue;

    // biz_file에서 storage 경로 추출 (URL이거나 경로)
    let filePath = biz_file;
    const storagePrefix = '/storage/v1/object/public/auth_file/';
    if (biz_file.includes(storagePrefix)) {
      filePath = biz_file.split(storagePrefix)[1];
    }

    const ext = extname(filePath) || '.jpg';
    // 파일명에 사용 불가한 문자 제거
    const safeName = (company_name || '이름없음').replace(/[\\/:*?"<>|]/g, '_');
    const fileName = `${safeName}${ext}`;
    const outputPath = join(OUTPUT_DIR, fileName);

    try {
      const { data, error: dlError } = await supabase.storage
        .from('auth_file')
        .download(filePath);

      if (dlError) throw dlError;

      const buffer = Buffer.from(await data.arrayBuffer());
      writeFileSync(outputPath, buffer);
      console.log(`✓ ${fileName}`);
      success++;
    } catch (e) {
      console.error(`✗ ${company_name}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\n완료: 성공 ${success}개, 실패 ${fail}개`);
  console.log(`저장 위치: ${OUTPUT_DIR}`);
}

main();
