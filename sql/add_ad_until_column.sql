-- jd 테이블에 프리미엄 광고 만료일 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE jd ADD COLUMN IF NOT EXISTS ad_until TIMESTAMPTZ DEFAULT NULL;

-- 인덱스 추가 (만료 여부 필터링 성능 향상)
CREATE INDEX IF NOT EXISTS idx_jd_ad_until ON jd(ad_until) WHERE ad = TRUE;
