-- users 테이블에 이메일, 아이디(로그인용) 컬럼 추가
-- 비밀번호는 Supabase Auth에서 관리

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS user_id VARCHAR(100);

COMMENT ON COLUMN users.email IS '로그인용 이메일';
COMMENT ON COLUMN users.user_id IS '로그인용 아이디 (이메일과 동일하게 사용 가능)';

-- 이메일 유니크 인덱스 (중복 가입 방지)
CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email 
  ON users((NULLIF(TRIM(email), ''))) 
  WHERE email IS NOT NULL AND TRIM(email) != '';
