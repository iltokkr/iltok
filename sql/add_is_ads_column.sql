-- jd 테이블에 광고(ads) 태그 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE jd ADD COLUMN IF NOT EXISTS is_ads BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_jd_is_ads ON jd(is_ads) WHERE is_ads = TRUE;
