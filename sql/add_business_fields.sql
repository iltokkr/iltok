-- users 테이블에 사업자등록번호, 사업장 소재지 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

-- ============================================
-- 1. 컬럼 추가
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS business_number VARCHAR(12),
  ADD COLUMN IF NOT EXISTS business_address VARCHAR(200);

-- 컬럼 설명 추가
COMMENT ON COLUMN users.business_number IS '사업자등록번호 (000-00-00000 형식)';
COMMENT ON COLUMN users.business_address IS '사업장 소재지';

-- ============================================
-- 2. 사업자등록번호 형식 검증 (선택사항)
-- 하이픈 포함 12자리 또는 숫자만 10자리 허용
-- ============================================
-- 기존 제약조건이 있으면 먼저 삭제
ALTER TABLE users DROP CONSTRAINT IF EXISTS business_number_format_chk;

-- 형식 제약조건 추가: 숫자 10자리 또는 하이픈 포함 12자리
ALTER TABLE users
  ADD CONSTRAINT business_number_format_chk
  CHECK (
    business_number IS NULL 
    OR business_number ~ '^[0-9]{10}$'           -- 숫자만 10자리
    OR business_number ~ '^[0-9]{3}-[0-9]{2}-[0-9]{5}$'  -- 000-00-00000 형식
  );

-- ============================================
-- 3. 유니크 인덱스 (선택사항 - 중복 사업자번호 방지)
-- ============================================
-- 빈 문자열과 NULL은 제외하고 유니크 적용
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_business_number
  ON users((NULLIF(business_number, '')))
  WHERE business_number IS NOT NULL AND business_number != '';

-- ============================================
-- 4. RLS 정책 (Row Level Security)
-- 주의: users 테이블에 이미 RLS가 설정되어 있을 수 있음
-- ============================================
-- RLS 활성화 (이미 활성화되어 있으면 무시됨)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있으면 삭제 후 재생성
DROP POLICY IF EXISTS "users_self_select" ON users;
DROP POLICY IF EXISTS "users_self_update" ON users;

-- 본인만 자신의 데이터 조회 가능
CREATE POLICY "users_self_select" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 본인만 자신의 데이터 수정 가능
CREATE POLICY "users_self_update" ON users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================
-- 5. 서비스 역할을 위한 정책 (관리자용)
-- Supabase 서비스 역할은 RLS 우회 가능
-- ============================================
-- 관리자가 모든 사용자 조회 필요시
-- DROP POLICY IF EXISTS "admin_select_all" ON users;
-- CREATE POLICY "admin_select_all" ON users
--   FOR SELECT TO service_role
--   USING (true);
