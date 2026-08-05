-- =====================================================================
-- 프리미엄 만료 후에도 본인 공고의 상세 이미지 "제거"는 허용
--   (jd_content_image_premium.sql 후속)
-- =====================================================================
-- 배경:
--   jd_content_image_premium.sql 는 유료 프리미엄(ad=true AND ad_auto!=true)
--   소유자에게만 content_image 변경을 허용했다. 그래서 프리미엄이 만료되면
--   광고주가 자기 공고에 붙은 이미지를 스스로 뗄 수 없고 관리자에게 문의해야 했다.
--
-- 이 파일이 바꾸는 것:
--   본인 소유 공고에 한해 content_image 를 NULL 로 만드는 것만 추가로 허용한다.
--   "설정·교체"는 여전히 관리자와 유료 프리미엄만 가능하다.
--   NEW.content_image IS NULL 조건이 핵심이다. 값이 들어오면 이 분기를 타지 않으므로
--   만료된 광고주가 다른 URL 로 바꿔치기할 수는 없다.
--
-- 같이 바뀐 코드 (src/components/writeComponent.tsx):
--   기존에는 대상이 아니면 저장 시 content_image 를 무조건 null 로 보냈다.
--   트리거가 되돌려줘서 지금까지 문제가 없었을 뿐이다. 이 SQL 로 NULL 을 허용하는 순간
--   만료된 광고주가 공고 문구만 고쳐도 이미지가 날아가므로, 폼 상태를 그대로 보내도록
--   함께 고쳤다. 둘 중 하나만 배포하면 안 된다.
--
-- 적용: Supabase 대시보드 SQL Editor 에 통째로 붙여넣고 실행. 여러 번 실행해도 안전.
-- 선행: jd_content_image_premium.sql
-- =====================================================================

BEGIN;

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

  -- 신규 등록 시점에는 아직 유료 프리미엄일 수 없다(jd_guard_premium_columns 가 ad 를 false 로 만든다).
  IF TG_OP = 'INSERT' THEN
    NEW.content_image := NULL;
    RETURN NEW;
  END IF;

  -- 본인 공고 + 이미 유료 프리미엄이면 설정·교체·제거 전부 허용.
  IF OLD.uploader_id = auth.uid()
     AND COALESCE(OLD.ad, false)
     AND COALESCE(OLD.ad_auto, false) = false
  THEN
    RETURN NEW;
  END IF;

  -- 프리미엄이 아니어도 본인 공고의 이미지를 "떼는 것"은 허용한다.
  -- 값을 넣는 경우는 여기 안 걸리므로 다른 URL 로 바꿔치기할 수 없다.
  IF OLD.uploader_id = auth.uid()
     AND NEW.content_image IS NULL
  THEN
    RETURN NEW;
  END IF;

  NEW.content_image := OLD.content_image;
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.jd_guard_content_image() IS
  'jd.content_image 설정·교체는 관리자·service_role·본인 소유 유료 프리미엄(ad=true AND ad_auto!=true)만. 제거(NULL)는 본인 소유면 프리미엄이 아니어도 허용';

COMMIT;

-- =====================================================================
-- 검증 1 — 만료된 광고주가 제거는 된다
--   ad=false 이고 content_image 가 있는 본인 공고에서 실행.
-- =====================================================================
--   await supabase.from('jd').update({ content_image: null }).eq('id', 내공고번호)
--   await supabase.from('jd').select('content_image').eq('id', 내공고번호).single()
--   → null 이면 성공

-- =====================================================================
-- 검증 2 — 바꿔치기는 여전히 막힌다
--   위와 같은 공고에서 다른 URL 을 넣어본다. 에러는 안 나지만 값이 안 바뀌어야 한다.
-- =====================================================================
--   await supabase.from('jd').update({ content_image: 'https://evil/x.jpg' }).eq('id', 내공고번호)
--   await supabase.from('jd').select('content_image').eq('id', 내공고번호).single()
--   → 원래 값 그대로면 성공

-- =====================================================================
-- 검증 3 — 정상 동작 회귀
-- =====================================================================
--   만료된 광고주가 공고 "문구만" 수정 → 상세 이미지가 그대로 남아 있어야 한다
--     (writeComponent 수정이 같이 배포됐는지 확인하는 항목이다)
--   유료 프리미엄 광고주: 업로드·교체·제거 전부 정상
--   관리자: 기존과 동일

-- =====================================================================
-- 롤백
-- =====================================================================
--   sql/jd_content_image_premium.sql 의 2번 섹션을 다시 실행하면
--   제거 허용 분기가 없는 버전으로 돌아간다.
