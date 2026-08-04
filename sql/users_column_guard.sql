-- =====================================================================
-- users 권한·인증·쿼터 컬럼 잠금  (security_rls_lockdown.sql 후속)
-- =====================================================================
-- 배경:
--   security_rls_lockdown.sql 의 users_update_self 는 행 제한만 건다.
--     CREATE POLICY users_update_self ON public.users
--       FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
--   컬럼 제한이 없어서 로그인한 회원이 F12 콘솔에서 자기 행의 컬럼을 바꿀 수 있다.
--   화면의 readOnly 는 UI 편의일 뿐 보안 경계가 아니다.
--
-- 이미 보호되고 있는 것 (여기서 다시 다루지 않는다):
--   warning_count / suspended_until / is_permanently_blocked 는
--   sql/add_spam_warning_functions.sql 의 protect_moderation_columns() 트리거가
--   app.moderation_ctx='on' 없이는 이전 값으로 되돌린다. service_role 도 예외가 아니다.
--   → 도배 경고·정지 시스템은 직접 UPDATE 로 무력화되지 않는다.
--   다만 is_admin 을 스스로 켜면 관리자 API(requireAdmin)를 통과해 issue_warning 등
--   정식 경로로 제재를 조작할 수 있으므로, 아래 is_admin 잠금이 그 입구를 막는다.
--
-- 이 파일이 막는 것 (현재 무방비):
--   is_admin                   : 스스로 관리자 승격 → 관리자 API 전체 접근  [Critical]
--   is_accept                  : 사업자 인증 셀프 승인 → 심사 없이 공고 노출  [High]
--   reload_times               : 공고 끌어올리기 잔여 횟수 조작  [Medium]
--   resume_reload_last_used_at : 이력서 끌어올리기 쿨다운 우회  [Low]
--
-- 왜 컬럼 GRANT 가 아니라 트리거인가:
--   GRANT UPDATE (col,...) 는 "어떤 컬럼을 쓸 수 있나"만 정하고 값은 못 본다.
--   그런데 아래 셋은 값 방향까지 제한해야 한다.
--     is_accept                  : 정보 수정 시 false 로 내리는 건 정상, true 로 올리면 셀프 승인
--     reload_times               : 끌어올리기로 1 감소는 정상, 증가는 쿼터 조작
--     resume_reload_last_used_at : 현재 시각으로 갱신은 정상, 과거로 되돌리면 쿨다운 우회
--
-- 이번 범위에서 제외한 것 (의도적):
--   user_type / number / user_id / email 은 지금 클라이언트가 정당하게 쓴다.
--   src/pages/signup/business.tsx 의 upsert(onConflict:'id') 가 기업 가입·전환 때
--   user_type·number·user_id 를 직접 넣는다. 여기서 막으면 가입이 깨진다.
--   → 이 컬럼들까지 잠그려면 그 upsert 를 먼저 service_role API 로 옮겨야 한다. (후속 과제)
--
-- 트리거 이름에 대하여:
--   users 에는 protect_moderation_columns 를 실행하는 users_protect_moderation 트리거가
--   이미 있다. 이 파일의 트리거는 그와 겹치는 컬럼을 건드리지 않으므로 실행 순서와 무관하다.
--
-- 적용: Supabase 대시보드 SQL Editor 에 통째로 붙여넣고 실행. 여러 번 실행해도 안전.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.users_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
DECLARE
  jwt_role text;
BEGIN
  -- PostgREST 요청은 request.jwt.claims 에 role(anon/authenticated/service_role)이 들어온다.
  -- 마이그레이션·대시보드처럼 PostgREST 를 거치지 않은 접속은 이 설정이 없어 NULL 이다.
  BEGIN
    jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  EXCEPTION WHEN others THEN
    jwt_role := NULL;
  END;

  -- 서버 API(service_role)와 DB 직접 접속은 그대로 통과시킨다.
  -- 관리자 기능은 src/lib/adminAuth.ts 의 requireAdmin 을 거쳐 service_role 로 수행된다.
  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- ── 클라이언트가 절대 못 바꾸는 컬럼 ──
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    RAISE EXCEPTION 'USERS_COLUMN_FORBIDDEN: is_admin' USING ERRCODE = '42501';
  END IF;

  -- ── 값 방향만 제한하는 컬럼 ──

  -- 사업자 인증: 내리는 건 허용(정보 수정 시 재심사), 올리는 건 관리자만.
  IF COALESCE(NEW.is_accept, false) AND NOT COALESCE(OLD.is_accept, false) THEN
    RAISE EXCEPTION 'USERS_COLUMN_FORBIDDEN: is_accept' USING ERRCODE = '42501';
  END IF;

  -- 끌어올리기 잔여 횟수: 감소만 허용.
  IF COALESCE(NEW.reload_times, 0) > COALESCE(OLD.reload_times, 0) THEN
    RAISE EXCEPTION 'USERS_COLUMN_FORBIDDEN: reload_times' USING ERRCODE = '42501';
  END IF;

  -- 이력서 끌어올리기 시각: 과거로 되돌려 쿨다운을 우회하지 못하게 한다.
  IF OLD.resume_reload_last_used_at IS NOT NULL
     AND (NEW.resume_reload_last_used_at IS NULL
          OR NEW.resume_reload_last_used_at < OLD.resume_reload_last_used_at) THEN
    RAISE EXCEPTION 'USERS_COLUMN_FORBIDDEN: resume_reload_last_used_at' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.users_guard_privileged_columns() IS
  'is_admin/is_accept/reload_times/resume_reload_last_used_at 를 클라이언트가 유리하게 바꾸지 못하게 막는다';

DROP TRIGGER IF EXISTS users_guard_privileged ON public.users;
CREATE TRIGGER users_guard_privileged
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.users_guard_privileged_columns();

COMMIT;

-- =====================================================================
-- 검증 1 — 공격 경로 차단 확인
--   브라우저 F12 콘솔에서 "일반 회원"(is_admin=false)으로 로그인한 상태로 실행.
--   네 건 모두 error 가 떠야 한다. error 가 null 이면 잠금이 안 걸린 것이다.
-- =====================================================================
--   const uid = (await supabase.auth.getUser()).data.user.id
--   await supabase.from('users').update({ is_admin: true }).eq('id', uid)
--   await supabase.from('users').update({ is_accept: true }).eq('id', uid)
--   await supabase.from('users').update({ reload_times: 9999 }).eq('id', uid)
--   await supabase.from('users').update({ resume_reload_last_used_at: '2000-01-01' }).eq('id', uid)

-- =====================================================================
-- 검증 2 — 정상 동작 회귀 확인 (전부 계속 성공해야 한다)
-- =====================================================================
--   기업 회원가입 / 개인→기업 전환      (signup/business.tsx 의 upsert)
--   사업자 정보 수정하기 모달 저장       (is_accept 를 false 로 내림)
--   공고 끌어올리기                      (reload_times 1 감소)
--   이력서 끌어올리기                    (resume_reload_last_used_at 를 현재 시각으로)
--   승인 알림 1회 표시                   (accept_notified 를 true 로)
--   비밀번호 재설정 완료                 (password_set 을 true 로)
--   관리자 화면 경고 발송/해제           (service_role → 트리거 통과)
--   /my/edit 관리자 저장                 (service_role API → 트리거 통과)

-- =====================================================================
-- 롤백
-- =====================================================================
--   DROP TRIGGER IF EXISTS users_guard_privileged ON public.users;
--   DROP FUNCTION IF EXISTS public.users_guard_privileged_columns();
