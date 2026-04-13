-- jd 테이블에 프리미엄 광고 시작일 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE jd ADD COLUMN IF NOT EXISTS ad_since TIMESTAMPTZ DEFAULT NULL;
