-- 개인회원 가입/지원 기능 지원
-- Supabase SQL Editor에서 실행하세요

-- 1. job_seeker_profiles: 본인 프로필 읽기 정책 추가 (회원정보 수정 시 필요)
DROP POLICY IF EXISTS "Users can read own profile" ON job_seeker_profiles;
CREATE POLICY "Users can read own profile" ON job_seeker_profiles
  FOR SELECT USING (auth.uid() = user_id);

-- 2. users 테이블에 policy_term 컬럼이 없으면 추가 (개인회원 약관 동의)
ALTER TABLE users ADD COLUMN IF NOT EXISTS policy_term BOOLEAN DEFAULT false;

-- 3. bookmark 테이블: 지원(지원하기) 시 사용 - 이미 users_id, jd_id 구조라면 별도 수정 불필요
-- 기업 공고관리 지원자 명단 = bookmark에서 jd_id별 users_id 조회
