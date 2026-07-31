-- =====================================================================
-- 도배 경고·정지 시스템 — 함수 / 트리거
-- 설계 문서: docs/superpowers/specs/2026-07-31-spam-warning-system-design.md (5절, 6절)
--
-- ※ sql/add_spam_warning_tables.sql 을 먼저 실행하세요.
-- Supabase 대시보드 > SQL Editor 에서 그대로 실행하면 됩니다.
-- 여러 번 실행해도 안전합니다.
--
-- 핵심 개념 — app.moderation_ctx
--   경고 관련 컬럼(users.warning_count / suspended_until / is_permanently_blocked)과
--   공고 등록 차단은 트리거로 강제한다. 이 트리거를 통과하려면 트랜잭션 안에서
--   app.moderation_ctx = 'on' 이 설정되어 있어야 한다.
--   issue_warning() 이 스스로 켜며, service role 이라도 이 플래그 없이는 값을 바꿀 수 없다.
--   운영자가 SQL Editor 에서 수동 조정할 때는 같은 트랜잭션에서 아래처럼 켜고 실행한다.
--
--     BEGIN;
--       SELECT set_config('app.moderation_ctx', 'on', true);
--       UPDATE users SET warning_count = 0, suspended_until = NULL,
--                        is_permanently_blocked = false
--        WHERE id = '<auth-uid>';
--     COMMIT;
-- =====================================================================


-- =====================================================================
-- 1. 경고 컬럼 보호 트리거 (설계 5.4)
--    users 에는 users_self_update 정책이 있어 본인이 자기 행을 수정할 수 있다.
--    경고 관련 컬럼만 이전 값으로 되돌린다. 나머지 수정은 그대로 통과시킨다.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.protect_moderation_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF COALESCE(current_setting('app.moderation_ctx', true), '') <> 'on' THEN
    NEW.warning_count          := OLD.warning_count;
    NEW.suspended_until        := OLD.suspended_until;
    NEW.is_permanently_blocked := OLD.is_permanently_blocked;
  END IF;
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.protect_moderation_columns() IS
  '경고/정지 컬럼을 app.moderation_ctx=on 없이는 변경하지 못하게 되돌린다';

DROP TRIGGER IF EXISTS users_protect_moderation ON users;
CREATE TRIGGER users_protect_moderation
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_moderation_columns();


-- =====================================================================
-- 2. 공고 등록 차단 트리거 (설계 6절)
--    RLS 는 건드리지 않아 기존 동작에 영향이 없다.
--
--    ★ 조회수 갱신은 반드시 통과해야 한다.
--      increment_view_count RPC 는 view_count 만 바꾸므로(2026-07-31 본문 확인)
--      아래 두 번째 조건에서 걸러진다. 이 조건이 없으면 정지된 이용자의 공고를
--      아무도 열람할 수 없게 된다. is_hidden 만 바꾸는 운영자 작업도 같은 조건으로 통과한다.
--
--    ★ 트리거 이름을 바꾸지 말 것.
--      jd 에는 sanitize_title_trigger 도 걸려 있고, 그 함수는 NEW.title 을 고쳐 쓴다.
--      Postgres 는 BEFORE 트리거를 이름 오름차순으로 실행하므로
--      'jd_...' 가 'sanitize_...' 보다 먼저 돌아 아래 비교가 원본 제목으로 이뤄진다.
--      순서가 뒤집히면 제목에 허용되지 않은 문자가 든 공고는 조회수 갱신조차 막힌다.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.enforce_posting_suspension()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_suspended_until        TIMESTAMPTZ;
  v_is_permanently_blocked BOOLEAN;
BEGIN
  -- 운영 작업(issue_warning 등)은 무조건 통과
  IF COALESCE(current_setting('app.moderation_ctx', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  -- 게재 행위가 아닌 UPDATE 는 통과 (조회수, 체류시간, is_hidden, 광고 필드 등)
  IF TG_OP = 'UPDATE'
     AND NEW.updated_time IS NOT DISTINCT FROM OLD.updated_time
     AND NEW.title        IS NOT DISTINCT FROM OLD.title
     AND NEW.contents     IS NOT DISTINCT FROM OLD.contents THEN
    RETURN NEW;
  END IF;

  IF NEW.uploader_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.suspended_until, u.is_permanently_blocked
    INTO v_suspended_until, v_is_permanently_blocked
    FROM users u
   WHERE u.id = NEW.uploader_id;

  -- users 행이 없으면 판단 근거가 없으므로 통과
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_is_permanently_blocked, FALSE) THEN
    RAISE EXCEPTION 'POSTING_BLOCKED_PERMANENT';
  END IF;

  IF v_suspended_until IS NOT NULL AND v_suspended_until > NOW() THEN
    RAISE EXCEPTION 'POSTING_SUSPENDED_UNTIL:%',
      to_char(v_suspended_until AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI');
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.enforce_posting_suspension() IS
  '정지·영구제한 계정의 공고 등록/수정/끌어올리기를 DB 단에서 차단. 조회수 갱신은 통과';

DROP TRIGGER IF EXISTS jd_enforce_posting_suspension ON jd;
CREATE TRIGGER jd_enforce_posting_suspension
  BEFORE INSERT OR UPDATE ON jd
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_posting_suspension();


-- =====================================================================
-- 3. issue_warning — 경고 발송 (설계 5.1)
--    관리자 API 가 요청자의 is_admin 을 확인한 뒤 service role 로 호출한다.
--    전 과정이 하나의 트랜잭션이다 (함수 본문 = 단일 트랜잭션).
-- =====================================================================
DROP FUNCTION IF EXISTS public.issue_warning(BIGINT, UUID);
DROP FUNCTION IF EXISTS public.issue_warning(BIGINT, UUID, TEXT);

CREATE FUNCTION public.issue_warning(
  p_report_id  BIGINT,
  p_admin_id   UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS user_warnings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_report        spam_reports%ROWTYPE;
  v_warning       user_warnings%ROWTYPE;
  v_level         INTEGER;
  v_suspended     TIMESTAMPTZ := NULL;
  v_permanent     BOOLEAN     := FALSE;
  v_keep_id       BIGINT;
  v_hidden_ids    BIGINT[]    := '{}'::BIGINT[];
  v_hidden_titles TEXT[]      := '{}'::TEXT[];
BEGIN
  -- (1) 보호 트리거 통과용 플래그. 세 번째 인자 true = 이 트랜잭션에서만 유효.
  PERFORM set_config('app.moderation_ctx', 'on', true);

  -- (2) 후보를 잠그고 pending 인지 재확인 — 동시 클릭으로 두 번 발송되는 것을 막는다.
  SELECT * INTO v_report
    FROM spam_reports
   WHERE id = p_report_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPORT_NOT_FOUND:%', p_report_id;
  END IF;

  IF v_report.status <> 'pending' THEN
    RAISE EXCEPTION 'REPORT_ALREADY_REVIEWED:%', v_report.status;
  END IF;

  -- (2-1) 같은 회원에게 하루에 두 번 경고가 나가지 않게 막는다.
  --       한 회원이 여러 묶음으로 잡히는 일이 흔한데, 묶음마다 경고를 누르면
  --       같은 행위 하나로 하루 만에 1차 → 2차 → 3차 영구 제한이 되어버린다.
  --       경고는 회원의 행위에 대한 것이지 묶음 하나하나에 대한 것이 아니다.
  --       남은 묶음은 hide_report_posts() 로 공고만 내리면 된다.
  IF EXISTS (
    SELECT 1
      FROM user_warnings
     WHERE user_id = v_report.uploader_id
       AND created_at > NOW() - INTERVAL '24 hours'
  ) THEN
    RAISE EXCEPTION 'WARNING_TOO_SOON';
  END IF;

  -- (3) 회차 계산 — 대상 회원 행도 함께 잠근다.
  SELECT COALESCE(u.warning_count, 0) + 1 INTO v_level
    FROM users u
   WHERE u.id = v_report.uploader_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND:%', v_report.uploader_id;
  END IF;

  -- (4) 회차별 제재
  IF v_level = 2 THEN
    v_suspended := NOW() + INTERVAL '7 days';
  ELSIF v_level >= 3 THEN
    v_permanent := TRUE;
  END IF;

  UPDATE users
     SET warning_count          = v_level,
         suspended_until        = CASE
                                    WHEN v_permanent THEN NULL
                                    ELSE COALESCE(v_suspended, suspended_until)
                                  END,
         is_permanently_blocked = is_permanently_blocked OR v_permanent
   WHERE id = v_report.uploader_id;

  -- (5) 공고 숨김 처리
  --     영구 제한(3회차 이상)   : 후보 종류와 무관하게 이 회원의 모든 공고를 숨긴다.
  --                              더 이상 공고를 등록할 수 없는 계정이라 남겨둘 이유가 없다.
  --                              자유게시판 글(board_type='4')은 공고가 아니므로 제외한다.
  --     수동 경고(1·2차)        : 운영자가 직접 고른 공고이므로 jd_ids 를 전부 숨긴다. 1건도 남기지 않는다.
  --     중복 게재(1·2차)        : 가장 최근에 올린 1건만 남기고 묶음의 나머지를 숨긴다.
  --                              조건이 바뀌어 다시 올린 경우 최신 공고가 유효한 자리이기 때문.
  --     끌어올리기 남용(1·2차)  : 공고를 건드리지 않는다.
  IF v_permanent THEN
    WITH hidden AS (
      UPDATE jd
         SET is_hidden = TRUE
       WHERE uploader_id = v_report.uploader_id
         AND COALESCE(board_type, '0') <> '4'
         AND COALESCE(is_hidden, FALSE) = FALSE
      RETURNING id, title
    )
    SELECT COALESCE(array_agg(h.id ORDER BY h.id), '{}'::BIGINT[]),
           COALESCE(array_agg(h.title::TEXT ORDER BY h.id), '{}'::TEXT[])
      INTO v_hidden_ids, v_hidden_titles
      FROM hidden h;

  ELSIF v_report.kind = 'manual' THEN
    WITH hidden AS (
      UPDATE jd
         SET is_hidden = TRUE
       WHERE id = ANY (v_report.jd_ids)
         AND COALESCE(is_hidden, FALSE) = FALSE
      RETURNING id, title
    )
    SELECT COALESCE(array_agg(h.id ORDER BY h.id), '{}'::BIGINT[]),
           COALESCE(array_agg(h.title::TEXT ORDER BY h.id), '{}'::TEXT[])
      INTO v_hidden_ids, v_hidden_titles
      FROM hidden h;

  ELSIF v_report.kind = 'duplicate_posting' THEN
    SELECT j.id INTO v_keep_id
      FROM jd j
     WHERE j.id = ANY (v_report.jd_ids)
     ORDER BY j.updated_time DESC NULLS LAST, j.id DESC
     LIMIT 1;

    WITH hidden AS (
      UPDATE jd
         SET is_hidden = TRUE
       WHERE id = ANY (v_report.jd_ids)
         AND (v_keep_id IS NULL OR id <> v_keep_id)
         AND COALESCE(is_hidden, FALSE) = FALSE
      RETURNING id, title
    )
    SELECT COALESCE(array_agg(h.id ORDER BY h.id), '{}'::BIGINT[]),
           COALESCE(array_agg(h.title::TEXT ORDER BY h.id), '{}'::TEXT[])
      INTO v_hidden_ids, v_hidden_titles
      FROM hidden h;
  END IF;

  -- (6) 경고 이력 생성 (acknowledged_at = NULL → 팝업 대상)
  INSERT INTO user_warnings (
    user_id, level, kind, report_id,
    region_1depth, region_2depth, jd_count,
    hidden_jd_ids, hidden_jd_titles, bump_date,
    suspended_until, is_permanent, reason_text, admin_note, issued_by
  ) VALUES (
    v_report.uploader_id, v_level, v_report.kind, v_report.id,
    v_report.region_1depth, v_report.region_2depth, v_report.jd_count,
    v_hidden_ids, v_hidden_titles, v_report.bump_date,
    v_suspended, v_permanent, v_report.reason_text, p_admin_note, p_admin_id
  )
  RETURNING * INTO v_warning;

  -- (7) 후보 처리 완료
  UPDATE spam_reports
     SET status      = 'warned',
         reviewed_by = p_admin_id,
         reviewed_at = NOW()
   WHERE id = v_report.id;

  -- (8) 같은 이용자의 다른 pending 후보 중 공고가 겹치는 것은 무시 처리한다
  --     (한 사건으로 두 번 경고하지 않기 위해).
  UPDATE spam_reports
     SET status      = 'dismissed',
         reviewed_by = p_admin_id,
         reviewed_at = NOW()
   WHERE status      = 'pending'
     AND id         <> v_report.id
     AND uploader_id = v_report.uploader_id
     AND jd_ids && v_report.jd_ids;

  RETURN v_warning;
END;
$fn$;

COMMENT ON FUNCTION public.issue_warning(BIGINT, UUID, TEXT) IS
  '후보를 승인해 경고를 발송한다. 회차 증가 → 제재 적용 → 대상 공고 숨김 → 이력 생성 → 겹치는 후보 정리를 한 트랜잭션으로 처리';


-- =====================================================================
-- 4. dismiss_report — 후보 무시 (설계 5.2)
--    status / reviewed_by / reviewed_at 만 기록한다. 다른 부수 효과는 없다.
-- =====================================================================
DROP FUNCTION IF EXISTS public.dismiss_report(BIGINT, UUID);

CREATE FUNCTION public.dismiss_report(
  p_report_id BIGINT,
  p_admin_id  UUID
)
RETURNS spam_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_report spam_reports%ROWTYPE;
BEGIN
  SELECT * INTO v_report
    FROM spam_reports
   WHERE id = p_report_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPORT_NOT_FOUND:%', p_report_id;
  END IF;

  IF v_report.status <> 'pending' THEN
    RAISE EXCEPTION 'REPORT_ALREADY_REVIEWED:%', v_report.status;
  END IF;

  UPDATE spam_reports
     SET status      = 'dismissed',
         reviewed_by = p_admin_id,
         reviewed_at = NOW()
   WHERE id = v_report.id
  RETURNING * INTO v_report;

  RETURN v_report;
END;
$fn$;

COMMENT ON FUNCTION public.dismiss_report(BIGINT, UUID) IS
  '검토 대기 후보를 무시 처리한다 (부수 효과 없음)';


-- =====================================================================
-- 4-1. hide_report_posts — 경고 없이 공고만 숨김
--
--   한 회원이 여러 묶음으로 잡혔을 때, 묶음마다 경고를 주면 하루 만에 영구 제한이 된다.
--   경고는 한 번만 주고 나머지 묶음은 이 함수로 공고만 내린다.
--   경고 횟수·정지 상태는 건드리지 않고, 당사자에게 팝업도 뜨지 않는다.
--   판단이 애매한 묶음을 일단 내려둘 때도 쓴다.
-- =====================================================================
DROP FUNCTION IF EXISTS public.hide_report_posts(BIGINT, UUID);

CREATE FUNCTION public.hide_report_posts(
  p_report_id BIGINT,
  p_admin_id  UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_report spam_reports%ROWTYPE;
  v_hidden INTEGER := 0;
BEGIN
  -- 공고 숨김은 게재 행위가 아니지만, 정지 계정의 공고도 내릴 수 있어야 하므로 플래그를 켠다
  PERFORM set_config('app.moderation_ctx', 'on', true);

  SELECT * INTO v_report FROM spam_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPORT_NOT_FOUND:%', p_report_id;
  END IF;
  IF v_report.status <> 'pending' THEN
    RAISE EXCEPTION 'REPORT_ALREADY_REVIEWED:%', v_report.status;
  END IF;

  WITH hidden AS (
    UPDATE jd
       SET is_hidden = TRUE
     WHERE id = ANY (v_report.jd_ids)
       AND COALESCE(is_hidden, FALSE) = FALSE
    RETURNING id
  )
  SELECT COUNT(*) INTO v_hidden FROM hidden;

  UPDATE spam_reports
     SET status      = 'hidden',
         reviewed_by = p_admin_id,
         reviewed_at = NOW()
   WHERE id = v_report.id;

  RETURN v_hidden;
END;
$fn$;

COMMENT ON FUNCTION public.hide_report_posts(BIGINT, UUID) IS
  '경고 없이 후보 묶음의 공고만 숨긴다. 경고 횟수·정지 상태는 그대로이고 팝업도 뜨지 않는다';


-- =====================================================================
-- 5. acknowledge_warning — 경고 확인 (설계 5.3)
--    사용자가 user_warnings 를 직접 UPDATE 할 수 없게 RPC 로만 열어둔다.
--    auth.uid() 가 해당 경고의 user_id 와 같을 때만 기록된다.
-- =====================================================================
DROP FUNCTION IF EXISTS public.acknowledge_warning(BIGINT);

CREATE FUNCTION public.acknowledge_warning(p_warning_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  UPDATE user_warnings
     SET acknowledged_at = NOW()
   WHERE id              = p_warning_id
     AND user_id         = auth.uid()
     AND acknowledged_at IS NULL;
END;
$fn$;

COMMENT ON FUNCTION public.acknowledge_warning(BIGINT) IS
  '본인 경고를 확인 처리한다. 팝업의 확인 버튼이 호출';


-- =====================================================================
-- 6. 실행 권한
--    ★ 함수는 기본적으로 PUBLIC 에 EXECUTE 가 열린다.
--      SECURITY DEFINER 함수이므로 반드시 회수하고 필요한 역할에만 부여한다.
-- =====================================================================
REVOKE ALL ON FUNCTION public.issue_warning(BIGINT, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_warning(BIGINT, UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_warning(BIGINT, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.dismiss_report(BIGINT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dismiss_report(BIGINT, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dismiss_report(BIGINT, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.hide_report_posts(BIGINT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hide_report_posts(BIGINT, UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hide_report_posts(BIGINT, UUID) TO service_role;

-- 확인 처리는 로그인한 본인이 호출한다 (함수 내부에서 auth.uid() 로 검증).
REVOKE ALL ON FUNCTION public.acknowledge_warning(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acknowledge_warning(BIGINT) FROM anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_warning(BIGINT) TO authenticated, service_role;


-- =====================================================================
-- 7. 검증용 쿼리 (설계 11절) — 필요할 때 주석을 풀고 실행하세요.
-- =====================================================================
-- -- 경고 컬럼 보호 확인: 값이 그대로여야 정상
-- UPDATE users SET warning_count = 99 WHERE id = '<auth-uid>';
-- SELECT warning_count FROM users WHERE id = '<auth-uid>';
--
-- -- 정지 계정 만들기 (운영자 수동)
-- BEGIN;
--   SELECT set_config('app.moderation_ctx', 'on', true);
--   UPDATE users SET suspended_until = NOW() + INTERVAL '7 days'
--    WHERE id = '<auth-uid>';
-- COMMIT;
--
-- -- 조회수 갱신이 막히지 않는지 확인 (예외가 나면 안 된다)
-- SELECT increment_view_count(<jd-id>);
