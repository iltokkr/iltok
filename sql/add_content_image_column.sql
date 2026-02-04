-- jd 테이블에 상세 내용 위 이미지 URL 컬럼 추가 (is_ads 글용)
-- Supabase SQL Editor에서 실행하세요

ALTER TABLE jd ADD COLUMN IF NOT EXISTS content_image TEXT;
