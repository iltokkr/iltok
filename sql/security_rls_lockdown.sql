-- =====================================================================
-- 보안 RLS 잠금 마이그레이션  (무중단 롤아웃용 2단계 구성 / 뷰 방식)
-- =====================================================================
-- 목적: F12(브라우저)에서 anon 키로 재현되는 실측 취약점 차단
--   C1) 익명이 users 테이블에서 전 회원 이름·전화번호·이메일 덤프 가능
--   C2) 익명이 남의 채용공고(jd)를 수정·삭제 가능
--   M ) job_application 전체 공개 읽기(누가 어디 지원했는지 노출)
--
-- 실행 위치: Supabase 대시보드 > SQL Editor
--
-- ★ 롤아웃 순서 (다운타임 0) ★
--   1) [PART 1] 실행  ← 추가만 하는 비파괴 변경(뷰 + 집계 RPC). 구 코드에 영향 없음.
--   2) 이 커밋의 애플리케이션 코드 배포
--   3) [PART 2] 실행  ← 실제 RLS 잠금. 새 코드가 배포된 뒤에 실행해야 함.
--
--   비정규화 컬럼(uploader_is_accept) 방식은 기존 jd.title UNIQUE 제약과
--   대량 백필 UPDATE 가 충돌하여 폐기하고, is_accept 만 노출하는
--   SECURITY DEFINER 뷰(user_public) 로 대체함(백필 불필요, jd 무변경).
--   PostgREST 임베딩(jd -> user_public!inner) 동작은 실측 검증 완료.
--
-- 각 PART 는 여러 번 실행해도 안전(idempotent).
-- =====================================================================


-- #####################################################################
-- ## PART 1 — 추가(비파괴). 코드 배포 "전"에 실행.
-- #####################################################################
BEGIN;

-- ── 1-A. 게시판 필터용 승인여부 공개 뷰 ──
--   게시판은 anon 도 조회하므로 users 를 잠그면 users!inner(is_accept) 조인이 깨진다.
--   is_accept 만 노출하는 정의자(DEFINER) 뷰를 두고 게시판이 이 뷰를 조인한다.
--   (security_invoker = false → users 의 RLS 를 우회해 is_accept 공개)
CREATE OR REPLACE VIEW public.user_public
  WITH (security_invoker = false) AS
  SELECT id, is_accept FROM public.users;
GRANT SELECT ON public.user_public TO anon, authenticated;

-- ── 1-B. 지원 수 집계 RPC (개별 지원 행 노출 없이 집계값만) ──
CREATE OR REPLACE FUNCTION public.get_application_counts(jd_ids bigint[])
RETURNS TABLE (jd_id bigint, cnt bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT ja.jd_id::bigint AS jd_id, count(*)::bigint AS cnt
    FROM public.job_application ja
   WHERE ja.jd_id = ANY(jd_ids)
   GROUP BY ja.jd_id;
$$;
REVOKE ALL ON FUNCTION public.get_application_counts(bigint[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_application_counts(bigint[]) TO anon, authenticated;

COMMIT;


-- #####################################################################
-- ## PART 2 — 실제 잠금(파괴적). 새 코드 배포 "후"에 실행.
-- #####################################################################
BEGIN;

-- ── 2-A. users : 본인 행만 접근 (이름·전화·이메일 유출 차단)  [C1] ──
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 기존 정책(과거 대시보드에서 만든 USING(true) 등)을 이름과 무관하게 전부 제거
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', p.policyname);
  END LOOP;
END $$;

CREATE POLICY users_select_self ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_insert_self ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY users_update_self ON public.users
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- DELETE 정책 없음 = 클라이언트 삭제 불가. 회원탈퇴는 서버(service_role) 라우트가 처리.
--   (user_public 뷰는 security_invoker=false 라 이 잠금 후에도 is_accept 공개가 유지됨)

-- ── 2-B. jd : 읽기 공개, 쓰기/삭제는 소유자만  [C2] ──
ALTER TABLE public.jd ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'jd'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.jd', p.policyname);
  END LOOP;
END $$;

CREATE POLICY jd_public_select ON public.jd
  FOR SELECT USING (true);
CREATE POLICY jd_insert_own ON public.jd
  FOR INSERT WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY jd_update_own ON public.jd
  FOR UPDATE USING (auth.uid() = uploader_id) WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY jd_delete_own ON public.jd
  FOR DELETE USING (auth.uid() = uploader_id);
-- uploader_id 가 NULL 인 레거시/관리자 공고는 클라이언트가 손댈 수 없음(service_role 전용).

-- ── 2-C. job_application : 본인(지원자) 행만  [M] ──
--   공고 소유자의 "지원자 목록"은 /api/my/applicants/[postId] 가 service_role 로 처리.
--   게시판/목록의 "지원 수"는 PART 1 의 get_application_counts RPC 로 처리.
ALTER TABLE public.job_application ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'job_application'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.job_application', p.policyname);
  END LOOP;
END $$;

CREATE POLICY jobapp_select_own ON public.job_application
  FOR SELECT USING (auth.uid() = users_id);
CREATE POLICY jobapp_insert_own ON public.job_application
  FOR INSERT WITH CHECK (auth.uid() = users_id);
CREATE POLICY jobapp_delete_own ON public.job_application
  FOR DELETE USING (auth.uid() = users_id);

COMMIT;

-- =====================================================================
-- 이번 스크립트에 포함하지 않은 항목(후속):
--  * jd_view_log 의 UPDATE USING(true) : 익명 방문자도 체류시간을 기록해야 해서
--    RLS 로 좁히면 익명 분석이 깨진다. 영향은 광고 분석 데이터 오염(낮음)뿐이라
--    별도 서버 라우트로 옮기는 후속 작업으로 분리.
--  * login-email-lookup / check-* rate limit : 코드 측 개선 항목(별도).
--  * comment / job_seeker_profiles 공개 읽기 컬럼 정리(별도).
-- =====================================================================

-- =====================================================================
-- 롤백(문제 발생 시): PART 2 만 되돌리면 즉시 기능 복구된다.
--   ALTER TABLE public.users            DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.jd               DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.job_application  DISABLE ROW LEVEL SECURITY;
-- (단, 잠금을 풀면 취약점도 다시 열리므로 원인 파악 후 재적용할 것)
-- =====================================================================
