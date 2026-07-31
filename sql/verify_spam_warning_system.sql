-- =====================================================================
-- 도배 경고 시스템 — 설치 검증 (안전: 모든 변경이 자동으로 되돌려집니다)
--
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행하세요.
--
-- 이 스크립트는 실제로 계정을 정지시켜 동작을 확인한 뒤,
-- 마지막에 일부러 오류를 내서 전부 롤백합니다.
-- 따라서 "ERROR: 검증 결과 ..." 라고 나오는 것이 정상입니다.
-- 그 메시지 안의 내용을 읽으시면 됩니다. 데이터는 하나도 바뀌지 않습니다.
--
-- 확인 항목
--   1) 테이블·컬럼·함수·트리거가 다 생겼는지
--   2) 경고 횟수를 임의로 못 바꾸는지 (도배꾼이 자기 횟수를 되돌리지 못하게)
--   3) 정지 계정의 공고를 남이 볼 때 조회수가 정상적으로 올라가는지  ★ 가장 중요
--   4) 정지 계정의 끌어올리기·수정이 실제로 막히는지
--   5) jd 테이블에 updated_time 을 자동으로 건드리는 다른 트리거가 있는지
-- =====================================================================

DO $verify$
DECLARE
  v_user      UUID;
  v_jd        BIGINT;
  v_out       TEXT := '';
  v_int       INTEGER;
  v_before    INTEGER;
  v_after     INTEGER;
  v_missing   TEXT := '';
  v_triggers  TEXT := '';
  v_fn        TEXT;
BEGIN
  ----------------------------------------------------------------
  -- 1. 객체 존재 확인
  ----------------------------------------------------------------
  IF to_regclass('public.spam_reports')  IS NULL THEN v_missing := v_missing || 'spam_reports '; END IF;
  IF to_regclass('public.user_warnings') IS NULL THEN v_missing := v_missing || 'user_warnings '; END IF;
  IF to_regclass('public.jd_bump_log')   IS NULL THEN v_missing := v_missing || 'jd_bump_log '; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='users' AND column_name='warning_count')
    THEN v_missing := v_missing || 'users.warning_count '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='users' AND column_name='suspended_until')
    THEN v_missing := v_missing || 'users.suspended_until '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='users' AND column_name='is_permanently_blocked')
    THEN v_missing := v_missing || 'users.is_permanently_blocked '; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='user_warnings' AND column_name='reason_text')
    THEN v_missing := v_missing || 'user_warnings.reason_text '; END IF;

  IF to_regprocedure('public.issue_warning(bigint,uuid,text)') IS NULL
    THEN v_missing := v_missing || 'issue_warning() '; END IF;
  IF to_regprocedure('public.dismiss_report(bigint,uuid)') IS NULL
    THEN v_missing := v_missing || 'dismiss_report() '; END IF;
  IF to_regprocedure('public.acknowledge_warning(bigint)') IS NULL
    THEN v_missing := v_missing || 'acknowledge_warning() '; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='users_protect_moderation')
    THEN v_missing := v_missing || '트리거:users_protect_moderation '; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='jd_enforce_posting_suspension')
    THEN v_missing := v_missing || '트리거:jd_enforce_posting_suspension '; END IF;

  IF v_missing = '' THEN
    v_out := v_out || E'\n[1] 설치 확인 ......... 정상 (테이블·컬럼·함수·트리거 모두 있음)';
  ELSE
    v_out := v_out || E'\n[1] 설치 확인 ......... 빠짐! -> ' || v_missing;
  END IF;

  ----------------------------------------------------------------
  -- 2. 테스트 대상 고르기 — 공고가 있는 아무 회원 1명
  ----------------------------------------------------------------
  SELECT j.uploader_id, j.id
    INTO v_user, v_jd
    FROM jd j
    JOIN users u ON u.id = j.uploader_id
   WHERE j.board_type = '0'
     AND COALESCE(j.is_hidden, FALSE) = FALSE
     AND j.uploader_id IS NOT NULL
   ORDER BY j.id DESC
   LIMIT 1;

  IF v_user IS NULL THEN
    RAISE EXCEPTION '검증 결과 %', v_out || E'\n\n[중단] 테스트에 쓸 채용공고를 찾지 못했습니다.';
  END IF;

  ----------------------------------------------------------------
  -- 3. 경고 횟수 보호 — 플래그 없이 바꾸면 되돌아와야 정상
  ----------------------------------------------------------------
  SELECT COALESCE(warning_count, 0) INTO v_before FROM users WHERE id = v_user;
  UPDATE users SET warning_count = 999 WHERE id = v_user;
  SELECT COALESCE(warning_count, 0) INTO v_after FROM users WHERE id = v_user;

  IF v_after = v_before THEN
    v_out := v_out || E'\n[2] 경고횟수 보호 ..... 정상 (임의 변경이 되돌려짐)';
  ELSE
    v_out := v_out || E'\n[2] 경고횟수 보호 ..... 실패! 값이 ' || v_after || ' 로 바뀜. 도배꾼이 자기 경고를 지울 수 있습니다';
  END IF;

  ----------------------------------------------------------------
  -- 4. 이 회원을 7일 정지 상태로 만든다 (마지막에 롤백됨)
  ----------------------------------------------------------------
  PERFORM set_config('app.moderation_ctx', 'on', true);
  UPDATE users SET suspended_until = NOW() + INTERVAL '7 days' WHERE id = v_user;
  PERFORM set_config('app.moderation_ctx', '', true);

  ----------------------------------------------------------------
  -- 5. ★ 조회수 — 정지 계정 공고를 남이 볼 때 막히면 안 된다
  ----------------------------------------------------------------
  SELECT COALESCE(view_count, 0) INTO v_before FROM jd WHERE id = v_jd;
  BEGIN
    -- 인자 이름은 post_id (src/pages/jd/[id].tsx 의 호출 기준).
    -- 인자 타입이 integer 면 bigint 를 그대로 넘겼을 때 함수를 못 찾으므로 캐스팅해 넘긴다.
    PERFORM public.increment_view_count(post_id => v_jd::INT);
    SELECT COALESCE(view_count, 0) INTO v_after FROM jd WHERE id = v_jd;
    IF v_after > v_before THEN
      v_out := v_out || E'\n[3] 조회수 갱신 ....... 정상 (정지 계정 공고도 열람 가능)';
    ELSE
      v_out := v_out || E'\n[3] 조회수 갱신 ....... 함수는 통과했으나 값이 안 올라감 (확인 필요)';
    END IF;
  EXCEPTION
    WHEN undefined_function THEN
      -- 함수 이름/인자가 다를 수 있다. 트리거가 막은 게 아니므로 별도 표시.
      v_out := v_out || E'\n[3] 조회수 갱신 ....... increment_view_count(bigint) 를 찾지 못함 — 아래 [5] 로 직접 확인하세요';
    WHEN OTHERS THEN
      v_out := v_out || E'\n[3] 조회수 갱신 ....... ★막힘! ' || SQLERRM ||
               E'\n    -> 이대로 두면 정지된 회원의 공고를 아무도 열 수 없습니다. 반드시 고쳐야 합니다.';
  END;

  -- 트리거를 직접 자극: 조회수만 바꾸는 UPDATE 는 통과해야 한다
  BEGIN
    UPDATE jd SET view_count = COALESCE(view_count, 0) + 1 WHERE id = v_jd;
    v_out := v_out || E'\n[4] 조회수 직접갱신 ... 정상 (통과)';
  EXCEPTION WHEN OTHERS THEN
    v_out := v_out || E'\n[4] 조회수 직접갱신 ... ★막힘! ' || SQLERRM;
  END;

  ----------------------------------------------------------------
  -- 6. 끌어올리기·수정은 막혀야 정상
  ----------------------------------------------------------------
  BEGIN
    UPDATE jd SET updated_time = NOW() WHERE id = v_jd;
    v_out := v_out || E'\n[5] 끌어올리기 차단 ... 실패! 정지 상태인데 끌어올리기가 됐습니다';
  EXCEPTION WHEN OTHERS THEN
    v_out := v_out || E'\n[5] 끌어올리기 차단 ... 정상 (' || split_part(SQLERRM, E'\n', 1) || ')';
  END;

  BEGIN
    UPDATE jd SET title = title || ' ' WHERE id = v_jd;
    v_out := v_out || E'\n[6] 공고수정 차단 ..... 실패! 정지 상태인데 수정이 됐습니다';
  EXCEPTION WHEN OTHERS THEN
    v_out := v_out || E'\n[6] 공고수정 차단 ..... 정상';
  END;

  ----------------------------------------------------------------
  -- 7. jd 의 다른 BEFORE UPDATE 트리거 — updated_time 을 자동으로 건드리면 문제가 된다
  ----------------------------------------------------------------
  SELECT COALESCE(string_agg(tgname, ', '), '(없음)')
    INTO v_triggers
    FROM pg_trigger
   WHERE tgrelid = 'public.jd'::regclass
     AND NOT tgisinternal
     AND tgname <> 'jd_enforce_posting_suspension';

  v_out := v_out || E'\n[7] jd 의 다른 트리거 .. ' || v_triggers;

  ----------------------------------------------------------------
  -- 8. 일부러 오류를 내서 위 변경을 전부 되돌린다
  ----------------------------------------------------------------
  RAISE EXCEPTION E'검증 결과 (아래 내용을 확인하세요. 데이터는 되돌려졌습니다)%', v_out;
END
$verify$;
