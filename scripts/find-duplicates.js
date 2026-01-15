/**
 * 중복 게시글 찾기 및 삭제 스크립트
 * 
 * 최근 3개월 게시글 중 contents가 90% 이상 동일한 게시글을 찾아 삭제합니다.
 * 
 * 사용법:
 * node scripts/find-duplicates.js 실행
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// .env.local 파일에서 환경변수 로드
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
    console.log('.env.local 파일에서 환경변수 로드됨');
  } else {
    console.log('.env.local 파일을 찾을 수 없습니다. 환경변수가 이미 설정되어 있어야 합니다.');
  }
}

loadEnv();

// ============================================
// 아래에 Supabase 정보를 입력하세요
// ============================================
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// 삭제 실행 여부 (false면 찾기만 하고 삭제하지 않음)
const EXECUTE_DELETE = false;

// 유사도 임계값 (0.9 = 90%)
const SIMILARITY_THRESHOLD = 0.9;

// ============================================

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * 두 문자열의 유사도를 계산 (Levenshtein Distance 기반)
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  // 빈 문자열 처리
  str1 = str1.trim();
  str2 = str2.trim();
  
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  // 긴 문자열에 대한 최적화: 길이 차이가 너무 크면 유사하지 않음
  const lengthDiff = Math.abs(str1.length - str2.length);
  const maxLength = Math.max(str1.length, str2.length);
  if (lengthDiff / maxLength > 0.3) return 0;
  
  // Levenshtein Distance 계산 (최적화된 버전)
  const len1 = str1.length;
  const len2 = str2.length;
  
  // 메모리 최적화: 2개의 행만 사용
  let prevRow = new Array(len2 + 1);
  let currRow = new Array(len2 + 1);
  
  for (let j = 0; j <= len2; j++) {
    prevRow[j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    currRow[0] = i;
    
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,      // 삭제
        currRow[j - 1] + 1,  // 삽입
        prevRow[j - 1] + cost // 교체
      );
    }
    
    [prevRow, currRow] = [currRow, prevRow];
  }
  
  const distance = prevRow[len2];
  return 1 - (distance / maxLength);
}

/**
 * 공백과 특수문자를 정규화
 */
function normalizeContent(content) {
  if (!content) return '';
  return content
    .replace(/\s+/g, ' ')  // 여러 공백을 하나로
    .replace(/\n+/g, ' ')  // 줄바꿈을 공백으로
    .trim()
    .toLowerCase();
}

async function main() {
  console.log('='.repeat(60));
  console.log('중복 게시글 찾기 스크립트 시작');
  console.log('='.repeat(60));
  console.log(`유사도 임계값: ${SIMILARITY_THRESHOLD * 100}%`);
  console.log(`삭제 모드: ${EXECUTE_DELETE ? 'ON (실제 삭제)' : 'OFF (찾기만)'}`);
  console.log('');
  
  // 3개월 전 날짜 계산
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const dateStr = threeMonthsAgo.toISOString();
  
  console.log(`조회 기간: ${dateStr} 이후`);
  console.log('');
  
  // 최근 3개월 게시글 가져오기
  console.log('게시글 가져오는 중...');
  
  let allPosts = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('jd')
      .select('id, title, contents, updated_time, uploader_id')
      .gte('updated_time', dateStr)
      .order('updated_time', { ascending: false })
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error('데이터 조회 오류:', error);
      return;
    }
    
    if (!data || data.length === 0) break;
    
    allPosts = allPosts.concat(data);
    console.log(`  ${allPosts.length}개 로드됨...`);
    
    if (data.length < batchSize) break;
    from += batchSize;
  }
  
  console.log(`총 ${allPosts.length}개 게시글 로드 완료`);
  console.log('');
  
  if (allPosts.length === 0) {
    console.log('게시글이 없습니다.');
    return;
  }
  
  // 중복 찾기
  console.log('중복 게시글 찾는 중... (시간이 걸릴 수 있습니다)');
  
  const duplicateGroups = [];
  const processedIds = new Set();
  
  for (let i = 0; i < allPosts.length; i++) {
    if (processedIds.has(allPosts[i].id)) continue;
    
    const post1 = allPosts[i];
    const content1 = normalizeContent(post1.contents);
    
    if (!content1 || content1.length < 20) continue; // 너무 짧은 게시글은 건너뜀
    
    const duplicates = [post1];
    
    for (let j = i + 1; j < allPosts.length; j++) {
      if (processedIds.has(allPosts[j].id)) continue;
      
      const post2 = allPosts[j];
      const content2 = normalizeContent(post2.contents);
      
      if (!content2 || content2.length < 20) continue;
      
      const similarity = calculateSimilarity(content1, content2);
      
      if (similarity >= SIMILARITY_THRESHOLD) {
        duplicates.push({ ...post2, similarity });
        processedIds.add(post2.id);
      }
    }
    
    if (duplicates.length > 1) {
      duplicateGroups.push(duplicates);
      processedIds.add(post1.id);
    }
    
    // 진행률 표시
    if ((i + 1) % 100 === 0) {
      console.log(`  ${i + 1}/${allPosts.length} 처리됨... (${duplicateGroups.length}개 중복 그룹 발견)`);
    }
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log(`총 ${duplicateGroups.length}개의 중복 그룹 발견`);
  console.log('='.repeat(60));
  console.log('');
  
  if (duplicateGroups.length === 0) {
    console.log('중복 게시글이 없습니다.');
    return;
  }
  
  // 중복 게시글 상세 출력
  const idsToDelete = [];
  
  for (let g = 0; g < duplicateGroups.length; g++) {
    const group = duplicateGroups[g];
    console.log(`\n[그룹 ${g + 1}] ${group.length}개 중복 게시글:`);
    
    // 날짜순 정렬 (최신이 먼저)
    group.sort((a, b) => new Date(b.updated_time) - new Date(a.updated_time));
    
    for (let i = 0; i < group.length; i++) {
      const post = group[i];
      const date = new Date(post.updated_time).toLocaleString('ko-KR');
      const titlePreview = (post.title || '').substring(0, 40);
      const contentPreview = (post.contents || '').substring(0, 50).replace(/\n/g, ' ');
      const similarityStr = post.similarity ? ` (유사도: ${(post.similarity * 100).toFixed(1)}%)` : ' (원본)';
      
      if (i === 0) {
        console.log(`  ✓ [유지] ID: ${post.id} | ${date} | "${titlePreview}..."`);
      } else {
        console.log(`  ✗ [삭제] ID: ${post.id} | ${date} | "${titlePreview}..."${similarityStr}`);
        idsToDelete.push(post.id);
      }
    }
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log(`삭제 대상: ${idsToDelete.length}개 게시글`);
  console.log('='.repeat(60));
  
  // 삭제 실행
  if (EXECUTE_DELETE && idsToDelete.length > 0) {
    console.log('\n삭제 진행 중...');
    
    // 배치로 삭제 (50개씩)
    const batchSize = 50;
    let deletedCount = 0;
    
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('jd')
        .delete()
        .in('id', batch);
      
      if (error) {
        console.error(`삭제 오류 (batch ${i / batchSize + 1}):`, error);
      } else {
        deletedCount += batch.length;
        console.log(`  ${deletedCount}/${idsToDelete.length} 삭제됨...`);
      }
    }
    
    console.log(`\n✓ 총 ${deletedCount}개 게시글 삭제 완료`);
  } else if (idsToDelete.length > 0) {
    console.log('\n[테스트 모드] 실제 삭제하지 않았습니다.');
    console.log('삭제하려면 스크립트의 EXECUTE_DELETE를 true로 변경하세요.');
    console.log(`\n삭제 대상 ID 목록: ${idsToDelete.join(', ')}`);
  }
}

main().catch(console.error);
