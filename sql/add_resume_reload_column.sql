-- 이력서 끌어올리기 전용 컬럼 추가 (채용공고 reload_times와 분리)
-- Supabase SQL Editor에서 실행하세요
-- 정책: 하루 1회 사용, 사용 시 익일 00시(KST)에 충전

ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_reload_last_used_at TIMESTAMPTZ;

COMMENT ON COLUMN users.resume_reload_last_used_at IS '이력서 끌어올리기 마지막 사용 시각. 익일 00시(KST) 이후 재사용 가능';

-- 참고: users 테이블에 본인 행 UPDATE 권한이 있어야 함 (기존 reload_times와 동일)
