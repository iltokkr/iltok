-- =====================================================================
-- jd.content_image 관리자 전용 잠금 + ad-images 버킷
-- =====================================================================
-- 배경:
--   상세내용 위 이미지(jd.content_image)를 관리자만 넣을 수 있게 한다.
--   src/components/writeComponent.tsx 의 isAdmin 분기는 UI 편의일 뿐이다.
--   로그인한 회원이 F12 콘솔에서 아래처럼 자기 공고에 이미지를 붙일 수 있다.
--     await supabase.from('jd').update({ content_image: 'https://.../x.jpg' }).eq('id', 내공고)
--   sql/users_column_guard.sql 과 같은 트리거 방식으로 실제 경계를 만든다.
--
-- 왜 예외(RAISE)가 아니라 값 되돌리기인가:
--   is_ads 제휴 공고는 관리자가 이미지를 붙여두고, 글 자체는 제휴사 계정이 소유한다.
--   제휴사가 자기 공고를 수정할 때 예외를 던지면 저장이 통째로 실패한다.
--   그래서 "바꾸려는 시도만 무시하고 이전 값을 유지"한다. 저장은 정상 통과하고
--   이미지는 관리자가 넣은 그대로 남는다.
--
-- 적용: Supabase 대시보드 SQL Editor 에 통째로 붙여넣고 실행. 여러 번 실행해도 안전.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.jd_guard_content_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  jwt_role  text;
  caller_is_admin boolean;
BEGIN
  -- PostgREST 요청은 request.jwt.claims 에 role(anon/authenticated/service_role)이 들어온다.
  -- 마이그레이션·대시보드처럼 PostgREST 를 거치지 않은 접속은 이 설정이 없어 NULL 이다.
  BEGIN
    jwt_role := current_setting('request.jwt.claims', true)::jsonb ->> 'role';
  EXCEPTION WHEN others THEN
    jwt_role := NULL;
  END;

  -- 서버 API(service_role)와 DB 직접 접속은 그대로 통과시킨다.
  IF jwt_role IS NULL OR jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(u.is_admin, false) INTO caller_is_admin
  FROM public.users u
  WHERE u.id = auth.uid();

  IF COALESCE(caller_is_admin, false) THEN
    RETURN NEW;
  END IF;

  -- 관리자가 아니면 content_image 를 건드릴 수 없다.
  IF TG_OP = 'INSERT' THEN
    NEW.content_image := NULL;
  ELSE
    NEW.content_image := OLD.content_image;
  END IF;

  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.jd_guard_content_image() IS
  'jd.content_image 는 관리자(users.is_admin)와 service_role 만 설정·변경할 수 있다';

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

-- ── 이미지 저장 버킷 ──────────────────────────────────────────────────
-- 공개 읽기(공고 상세에서 <img> 로 바로 부른다) + 관리자만 업로드.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ad-images', 'ad-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS ad_images_public_read ON storage.objects;
CREATE POLICY ad_images_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'ad-images');

DROP POLICY IF EXISTS ad_images_admin_write ON storage.objects;
CREATE POLICY ad_images_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'ad-images'
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin)
  );

DROP POLICY IF EXISTS ad_images_admin_delete ON storage.objects;
CREATE POLICY ad_images_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'ad-images'
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin)
  );

COMMIT;

-- =====================================================================
-- 검증 1 — 공격 경로 차단 확인
--   "일반 회원"(is_admin=false)으로 로그인한 상태로 F12 콘솔에서 실행.
--   update 는 에러 없이 통과하지만, 다시 조회하면 content_image 가 null 이어야 한다.
-- =====================================================================
--   await supabase.from('jd').update({ content_image: 'https://evil/x.jpg' }).eq('id', 내공고번호)
--   await supabase.from('jd').select('content_image').eq('id', 내공고번호).single()
--   → data.content_image 가 null (또는 원래 값) 이면 잠금 성공

-- =====================================================================
-- 검증 2 — 정상 동작 회귀 확인 (전부 계속 성공해야 한다)
-- =====================================================================
--   관리자 계정으로 글쓰기 → 상세 이미지 업로드 → 저장 → 상세에서 이미지 표시
--   관리자 계정으로 수정 → 이미지 제거 → 저장 → 상세에서 이미지 사라짐
--   일반 회원 공고 등록·수정                 (content_image 없이 정상 저장)
--   제휴(is_ads) 공고를 제휴사 계정이 수정   (관리자가 넣은 이미지가 그대로 유지)

-- =====================================================================
-- 롤백
-- =====================================================================
--   DROP TRIGGER IF EXISTS jd_guard_content_image_ins ON public.jd;
--   DROP TRIGGER IF EXISTS jd_guard_content_image_upd ON public.jd;
--   DROP FUNCTION IF EXISTS public.jd_guard_content_image();
--   DROP POLICY IF EXISTS ad_images_public_read ON storage.objects;
--   DROP POLICY IF EXISTS ad_images_admin_write ON storage.objects;
--   DROP POLICY IF EXISTS ad_images_admin_delete ON storage.objects;
