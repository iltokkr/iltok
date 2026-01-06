-- jd 테이블에 숨김 기능 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE jd ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;

-- 인덱스 추가 (선택사항 - 검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_jd_is_hidden ON jd(is_hidden);

