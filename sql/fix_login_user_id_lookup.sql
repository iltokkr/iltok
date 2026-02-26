-- 아이디/비밀번호 로그인 시 user_id로 email 조회
-- RLS 때문에 로그인 전(anon) 사용자는 users 테이블을 직접 조회할 수 없음
-- SECURITY DEFINER 함수로 로그인 시에만 email 조회 허용
--
-- ※ "relation users does not exist" 오류 시:
--    Supabase Table Editor에서 실제 테이블명 확인 (예: public.users)
--    테이블이 다른 이름이면 아래 users를 해당 이름으로 변경

CREATE OR REPLACE FUNCTION public.get_email_for_login(p_user_id text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT email FROM public.users
  WHERE user_id = TRIM(p_user_id)
    AND email IS NOT NULL
    AND TRIM(email) != ''
  LIMIT 1;
$$;

-- anon(비로그인) 사용자도 로그인을 위해 이 함수 호출 가능
GRANT EXECUTE ON FUNCTION public.get_email_for_login(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_for_login(text) TO authenticated;
