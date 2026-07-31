-- =====================================================================
-- 경고 발송 전체 흐름 검증 (안전: 모든 변경이 자동으로 되돌려집니다)
--
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 실행하세요.
-- 실제 회원에게 1차 → 2차 → 3차 경고를 연속으로 발송해 보고,
-- 마지막에 일부러 오류를 내서 전부 롤백합니다.
--
-- "ERROR: 경고 발송 검증 결과 ..." 로 나오는 것이 정상입니다.
-- 실제로 경고가 나가거나 공고가 숨겨지지 않습니다.
--
-- 확인 항목
--   1) 수동 경고 후보를 만들고 issue_warning() 이 도는지
--   2) 1차 — 경고만, 고른 공고가 숨겨지는지, 팝업 대상으로 기록되는지
--   3) 2차 — 7일 정지가 걸리는지
--   4) 3차 — 영구 제한 + 그 회원의 모든 공고가 숨겨지는지
--   5) 같은 후보를 두 번 처리하려 하면 막히는지
-- =====================================================================

DO $flow$
DECLARE
  v_user       UUID;
  v_admin      UUID;
  v_name       TEXT;
  v_jd_all     BIGINT[];
  v_jd_pick    BIGINT[];
  v_report     BIGINT;
  v_warning    user_warnings%ROWTYPE;
  v_out        TEXT := '';
  v_active     INTEGER;
  v_hidden     INTEGER;
  v_wc         INTEGER;
  v_susp       TIMESTAMPTZ;
  v_perm       BOOLEAN;
  v_r1         TEXT;
  v_r2         TEXT;
BEGIN
  ----------------------------------------------------------------
  -- 준비: 공개 공고가 3건 이상인 회원 1명
  ----------------------------------------------------------------
  SELECT j.uploader_id,
         array_agg(j.id ORDER BY j.updated_time DESC NULLS LAST, j.id DESC)
    INTO v_user, v_jd_all
    FROM jd j
   WHERE j.board_type = '0'
     AND COALESCE(j.is_hidden, FALSE) = FALSE
     AND j.uploader_id IS NOT NULL
   GROUP BY j.uploader_id
  HAVING COUNT(*) >= 3
   ORDER BY COUNT(*) DESC
   LIMIT 1;

  IF v_user IS NULL THEN
    RAISE EXCEPTION '경고 발송 검증 결과 %', E'\n[중단] 공고 3건 이상인 회원을 찾지 못했습니다.';
  END IF;

  SELECT COALESCE(company_name, name, user_id, '(이름없음)') INTO v_name FROM users WHERE id = v_user;
  SELECT id INTO v_admin FROM users WHERE is_admin = TRUE LIMIT 1;
  IF v_admin IS NULL THEN v_admin := v_user; END IF;

  v_active := array_length(v_jd_all, 1);
  v_jd_pick := ARRAY[v_jd_all[1], v_jd_all[2]];

  v_out := v_out || format(E'\n대상: %s (공개 공고 %s건) — 이 중 2건을 골라 경고합니다', v_name, v_active);

  ----------------------------------------------------------------
  -- 1차 경고
  ----------------------------------------------------------------
  INSERT INTO spam_reports (
    uploader_id, kind, region_1depth, region_2depth, jd_ids, jd_count,
    content_similarity, confidence, cluster_key, status, reason_text
  )
  SELECT v_user, 'manual', COALESCE(j."1depth_region", '-'), COALESCE(j."2depth_region", '-'),
         v_jd_pick, 2, 0, 'high', 'verify-test-1', 'pending',
         '테스트 사유 문구입니다.'
    FROM jd j WHERE j.id = v_jd_pick[1]
  RETURNING id INTO v_report;

  SELECT * INTO v_warning FROM public.issue_warning(v_report, v_admin, '검증 테스트');
  PERFORM set_config('app.moderation_ctx', '', true);  -- 뒤 검사에 영향 없게 초기화

  SELECT warning_count, suspended_until, is_permanently_blocked
    INTO v_wc, v_susp, v_perm FROM users WHERE id = v_user;

  SELECT COUNT(*) INTO v_hidden FROM jd WHERE id = ANY (v_jd_pick) AND is_hidden = TRUE;

  v_out := v_out || format(
    E'\n\n[1차] 회차=%s (1이어야 정상) / 정지=%s (없어야 정상) / 영구=%s (false 여야 정상)'
    || E'\n      고른 공고 2건 중 숨겨진 수=%s (2여야 정상)'
    || E'\n      경고기록: 사유="%s" 미확인=%s (t 여야 팝업이 뜸)',
    v_wc,
    COALESCE(v_susp::TEXT, '없음'),
    v_perm,
    v_hidden,
    COALESCE(v_warning.reason_text, '(비어있음)'),
    (v_warning.acknowledged_at IS NULL)
  );

  ----------------------------------------------------------------
  -- 같은 후보를 두 번 처리하면 막혀야 정상
  ----------------------------------------------------------------
  BEGIN
    PERFORM public.issue_warning(v_report, v_admin, NULL);
    v_r1 := '실패! 같은 후보로 두 번 경고가 나갔습니다';
  EXCEPTION WHEN OTHERS THEN
    v_r1 := '정상 (' || split_part(SQLERRM, E'\n', 1) || ')';
  END;
  PERFORM set_config('app.moderation_ctx', '', true);
  v_out := v_out || E'\n\n[중복 발송 차단] ' || v_r1;

  ----------------------------------------------------------------
  -- 2차 경고 — 7일 정지가 걸려야 정상
  ----------------------------------------------------------------
  INSERT INTO spam_reports (
    uploader_id, kind, region_1depth, region_2depth, jd_ids, jd_count,
    content_similarity, confidence, cluster_key, status
  ) VALUES (v_user, 'manual', '-', '-', ARRAY[v_jd_all[3]], 1, 0, 'high', 'verify-test-2', 'pending')
  RETURNING id INTO v_report;

  PERFORM public.issue_warning(v_report, v_admin, NULL);
  PERFORM set_config('app.moderation_ctx', '', true);

  SELECT warning_count, suspended_until, is_permanently_blocked
    INTO v_wc, v_susp, v_perm FROM users WHERE id = v_user;

  v_out := v_out || format(
    E'\n\n[2차] 회차=%s (2여야 정상) / 정지해제=%s / 영구=%s (false 여야 정상)',
    v_wc,
    COALESCE(to_char(v_susp AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI'), '없음 — 실패!'),
    v_perm
  );

  -- 정지 상태에서 끌어올리기가 막히는지
  BEGIN
    UPDATE jd SET updated_time = NOW() WHERE id = v_jd_all[1];
    v_r2 := '실패! 정지 상태인데 끌어올리기가 됐습니다';
  EXCEPTION WHEN OTHERS THEN
    v_r2 := '정상';
  END;
  v_out := v_out || E'\n      정지 중 끌어올리기 차단: ' || v_r2;

  ----------------------------------------------------------------
  -- 3차 경고 — 영구 제한 + 모든 공고 숨김
  ----------------------------------------------------------------
  INSERT INTO spam_reports (
    uploader_id, kind, region_1depth, region_2depth, jd_ids, jd_count,
    content_similarity, confidence, cluster_key, status
  ) VALUES (v_user, 'manual', '-', '-', ARRAY[v_jd_all[1]], 1, 0, 'high', 'verify-test-3', 'pending')
  RETURNING id INTO v_report;

  SELECT * INTO v_warning FROM public.issue_warning(v_report, v_admin, NULL);
  PERFORM set_config('app.moderation_ctx', '', true);

  SELECT warning_count, suspended_until, is_permanently_blocked
    INTO v_wc, v_susp, v_perm FROM users WHERE id = v_user;

  SELECT COUNT(*) INTO v_active
    FROM jd WHERE uploader_id = v_user
     AND COALESCE(board_type, '0') <> '4'
     AND COALESCE(is_hidden, FALSE) = FALSE;

  v_out := v_out || format(
    E'\n\n[3차] 회차=%s (3이어야 정상) / 영구제한=%s (true 여야 정상)'
    || E'\n      남은 공개 공고=%s건 (0이어야 정상)'
    || E'\n      이 경고로 숨긴 공고=%s건',
    v_wc, v_perm, v_active,
    COALESCE(array_length(v_warning.hidden_jd_ids, 1), 0)
  );

  ----------------------------------------------------------------
  -- 되돌리기
  ----------------------------------------------------------------
  RAISE EXCEPTION E'경고 발송 검증 결과 (데이터는 전부 되돌려졌습니다)%', v_out;
END
$flow$;
