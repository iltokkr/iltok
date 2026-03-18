-- 기업회원 아이디/비밀번호 전환 여부 컬럼 추가
-- Supabase SQL Editor에서 실행

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set boolean DEFAULT false;

-- 이미 이메일과 user_id가 있는 기업회원은 전환 완료로 표시
-- (기존에 정식 signup 페이지를 통해 가입한 회원)
UPDATE users
SET password_set = true
WHERE user_type IN ('business', 'both')
  AND email IS NOT NULL
  AND email != ''
  AND user_id IS NOT NULL
  AND user_id != '';

-- 결과 확인
SELECT user_type, password_set, COUNT(*)
FROM users
WHERE user_type IN ('business', 'both')
GROUP BY user_type, password_set
ORDER BY user_type, password_set;
