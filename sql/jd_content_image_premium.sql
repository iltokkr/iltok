-- =====================================================================
-- 유료 프리미엄 공고에 상세 이미지 셀프 업로드 허용
--   (jd_content_image_guard.sql + job_content_images_bucket_policy.sql 후속)
-- =====================================================================
-- 배경:
--   지금까지 jd.content_image 는 관리자 전용이었다. 유료 프리미엄 광고주가
--   직접 상세 이미지를 올릴 수 있게 열되, 다음 두 가지를 지켜야 한다.
--
--   1) "유료" 프리미엄만 열린다.
--      refresh-premium cron 이 매일 인기 공고 50건에 ad=true, ad_auto=true 를
--      찍는다(무료 자동 프리미엄). 이건 다음 날 해제되므로 업로드 대상이 아니다.
--      유료 광고는 ad_auto != true 로 구분한다.
--
--   2) ad 컬럼 자체를 먼저 잠가야 한다.
--      security_rls_lockdown.sql 의 jd_update_own 정책은 "본인 공고면 UPDATE 허용"
--      뿐이고 컬럼 제한이 없다. 즉 지금은 누구나 F12 콘솔에서
--        await supabase.from('jd').update({ ad: true }).eq('id', 내공고번호)
--      로 프리미엄을 스스로 켤 수 있다. 이 상태에서 content_image 를 ad 기준으로
--      열면 잠금이 장식이 된다. 그래서 ad 계열 컬럼 가드를 먼저 건다.
--
-- 적용: Supabase 대시보드 SQL Editor 에 통째로 붙여넣고 실행. 여러 번 실행해도 안전.
-- 선행: jd_content_image_guard.sql, job_content_images_bucket_policy.sql
-- =====================================================================

BEGIN;

-- ── 1. 프리미엄 관련 컬럼 가드 ────────────────────────────────────────
-- ad / ad_auto / ad_since / ad_until 은 관리자와 service_role(cron)만 바꿀 수 있다.
-- 예외(RAISE)가 아니라 값 되돌리기로 처리한다. 일반 회원의 공고 수정은
-- ...formData 를 통째로 보내므로 ad 가 늘 payload 에 실려 오는데,
-- 여기서 예외를 던지면 정상적인 수정까지 전부 실패한다.
CREATE OR REPLACE FUNCTION public.jd_guard_premium_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  jwt_role        text;
  caller_is_admin boolean;
BEGIN
  BEGIN
    jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  EXCEPTION WHEN others THEN
    jwt_role := NULL;
  END;

  -- 서버 API(service_role, refresh-premium cron)와 DB 직접 접속은 통과.
  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(u.is_admin, false) INTO caller_is_admin
  FROM public.users u
  WHERE u.id = auth.uid();

  IF COALESCE(caller_is_admin, false) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.ad       := false;
    NEW.ad_auto  := false;
    NEW.ad_since := NULL;
    NEW.ad_until := NULL;
  ELSE
    NEW.ad       := OLD.ad;
    NEW.ad_auto  := OLD.ad_auto;
    NEW.ad_since := OLD.ad_since;
    NEW.ad_until := OLD.ad_until;
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.jd_guard_premium_columns() IS
  'jd 의 프리미엄 컬럼(ad, ad_auto, ad_since, ad_until)은 관리자와 service_role 만 변경할 수 있다';

DROP TRIGGER IF EXISTS jd_guard_premium_columns_ins ON public.jd;
CREATE TRIGGER jd_guard_premium_columns_ins
  BEFORE INSERT ON public.jd
  FOR EACH ROW
  EXECUTE FUNCTION public.jd_guard_premium_columns();

DROP TRIGGER IF EXISTS jd_guard_premium_columns_upd ON public.jd;
CREATE TRIGGER jd_guard_premium_columns_upd
  BEFORE UPDATE ON public.jd
  FOR EACH ROW
  EXECUTE FUNCTION public.jd_guard_premium_columns();

-- ── 2. content_image 가드 완화 ────────────────────────────────────────
-- 관리자 / service_role 에 더해, "본인 소유 + 유료 프리미엄" 공고면 허용한다.
-- 판정은 NEW 가 아니라 OLD(이미 DB 에 저장된 값) 기준이다.
-- NEW 를 쓰면 같은 UPDATE 문에 ad=true 를 끼워 넣어 통과할 수 있다.
-- (1번 가드가 이미 막지만, 여기서도 이중으로 막아둔다)
CREATE OR REPLACE FUNCTION public.jd_guard_content_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  jwt_role        text;
  caller_is_admin boolean;
BEGIN
  BEGIN
    jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  EXCEPTION WHEN others THEN
    jwt_role := NULL;
  END;

  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(u.is_admin, false) INTO caller_is_admin
  FROM public.users u
  WHERE u.id = auth.uid();

  IF COALESCE(caller_is_admin, false) THEN
    RETURN NEW;
  END IF;

  -- 신규 등록 시점에는 아직 유료 프리미엄일 수 없다(1번 가드가 ad 를 false 로 만든다).
  IF TG_OP = 'INSERT' THEN
    NEW.content_image := NULL;
    RETURN NEW;
  END IF;

  -- 본인 공고 + 이미 유료 프리미엄(ad=true, ad_auto!=true)이면 허용.
  IF OLD.uploader_id = auth.uid()
     AND COALESCE(OLD.ad, false)
     AND COALESCE(OLD.ad_auto, false) = false
  THEN
    RETURN NEW;
  END IF;

  NEW.content_image := OLD.content_image;
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.jd_guard_content_image() IS
  'jd.content_image 는 관리자·service_role, 그리고 본인 소유 유료 프리미엄(ad=true AND ad_auto!=true) 공고만 설정·변경할 수 있다';

-- 트리거 자체는 jd_content_image_guard.sql 에서 만든 것을 그대로 쓴다.
-- 혹시 없을 경우를 대비해 다시 걸어둔다.
DROP TRIGGER IF EXISTS jd_guard_content_image_ins ON public.jd;
CREATE TRIGGER jd_guard_content_image_ins
  BEFORE INSERT ON public.jd
  FOR EACH ROW
  EXECUTE FUNCTION public.jd_guard_content_image();

DROP TRIGGER IF EXISTS jd_guard_content_image_upd ON public.jd;
CREATE TRIGGER jd_guard_content_image_upd
  BEFORE UPDATE ON public.jd
  FOR EACH ROW
  EXECUTE FUNCTION public.jd_guard_content_image();

-- ── 3. 스토리지 업로드 정책 완화 ──────────────────────────────────────
-- 관리자이거나, 유료 프리미엄 공고를 하나라도 가진 회원이면 업로드 허용.
-- (업로드 시점에는 어느 공고에 붙일지 알 수 없으므로 "보유 여부"로 판정한다.
--  실제로 공고에 붙는 단계는 2번 트리거가 공고 단위로 다시 검사한다)
DROP POLICY IF EXISTS job_content_images_admin_write ON storage.objects;
DROP POLICY IF EXISTS job_content_images_premium_write ON storage.objects;
CREATE POLICY job_content_images_premium_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job_content_images'
    AND (
      EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin)
      OR EXISTS (
        SELECT 1 FROM public.jd j
        WHERE j.uploader_id = auth.uid()
          AND j.board_type = '0'
          AND COALESCE(j.ad, false)
          AND COALESCE(j.ad_auto, false) = false
      )
    )
  );

-- 삭제는 관리자만 유지한다. 광고주는 공고에서 이미지를 떼면 되고,
-- 스토리지 원본까지 지울 필요는 없다(다른 공고가 같은 URL 을 쓸 수도 있다).

COMMIT;

-- =====================================================================
-- 검증 1 — 프리미엄 자가 부여 차단 (1번 가드)
--   일반 회원으로 로그인한 상태로 F12 콘솔에서 실행.
--   에러는 안 나지만, 다시 조회하면 ad 가 false 로 남아 있어야 한다.
-- =====================================================================
--   await supabase.from('jd').update({ ad: true }).eq('id', 내공고번호)
--   await supabase.from('jd').select('ad, ad_auto').eq('id', 내공고번호).single()
--   → ad 가 false 면 성공

-- =====================================================================
-- 검증 2 — 무료 자동 프리미엄(ad_auto=true)은 못 올린다
--   ad_auto=true 인 공고 소유자로 로그인 → 공고 수정 → 상세 이미지 잠김 상태
--   콘솔에서 강제로 넣어도 조회하면 content_image 가 원래 값이어야 한다.
-- =====================================================================
--   await supabase.from('jd').update({ content_image: 'https://evil/x.jpg' }).eq('id', 자동프리미엄공고)
--   await supabase.from('jd').select('content_image').eq('id', 자동프리미엄공고).single()

-- =====================================================================
-- 검증 3 — 정상 동작 회귀
-- =====================================================================
--   관리자: 글쓰기·수정 → 상세 이미지 업로드 → 저장 → 상세에서 표시
--   유료 프리미엄 광고주(ad=true, ad_auto=false): 공고 수정 → 업로드 → 저장 → 표시
--   일반 회원: 공고 등록·수정이 에러 없이 되고, 상세 이미지는 잠김 안내로 보인다
--   cron: /api/cron/refresh-premium 수동 호출 → ad_auto 공고가 정상 교체된다
--         (service_role 이라 1번 가드를 통과해야 한다. 통과 못 하면 여기서 티가 난다)

-- =====================================================================
-- 롤백
-- =====================================================================
--   DROP TRIGGER IF EXISTS jd_guard_premium_columns_ins ON public.jd;
--   DROP TRIGGER IF EXISTS jd_guard_premium_columns_upd ON public.jd;
--   DROP FUNCTION IF EXISTS public.jd_guard_premium_columns();
--   DROP POLICY IF EXISTS job_content_images_premium_write ON storage.objects;
--   -- content_image 가드는 jd_content_image_guard.sql 을 다시 실행하면 관리자 전용으로 돌아간다.
