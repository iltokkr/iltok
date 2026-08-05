-- =====================================================================
-- job_content_images 버킷 관리자 전용 잠금 (jd_content_image_guard.sql 후속)
-- =====================================================================
-- 배경:
--   jd_content_image_guard.sql 은 'ad-images' 버킷을 만들고 거기에만
--   관리자 전용 INSERT/DELETE 정책을 걸었다. 그런데 실제 코드
--   src/components/writeComponent.tsx 는 'job_content_images' 에 업로드한다.
--   (커밋 58847bd 에서 버킷명이 바뀌었는데 SQL 이 따라가지 않았다)
--
--   그래서 지금 상태는:
--     ad-images          : 정책은 걸렸지만 아무도 쓰지 않는다
--     job_content_images : 실제로 쓰이는데 관리자 정책이 없다
--
-- 무엇이 이미 막혀 있나:
--   jd.content_image 컬럼은 jd_guard_content_image() 트리거가 지킨다.
--   이 트리거는 버킷과 무관하므로, 비관리자가 업로드에 성공하더라도
--   그 URL 을 공고에 붙이지는 못한다. 즉 "남의 공고에 이미지 삽입"은 이미 불가능하다.
--
-- 그래도 이 파일이 필요한 이유:
--   정책 없는 공개 버킷은 로그인만 하면 파일을 밀어 넣을 수 있다.
--   공고에 못 붙일 뿐, 임의 이미지 호스팅·스토리지/egress 낭비는 가능하다.
--
-- 적용: Supabase 대시보드 SQL Editor 에 통째로 붙여넣고 실행. 여러 번 실행해도 안전.
-- =====================================================================

BEGIN;

-- 버킷이 없으면 만들고, 있으면 공개 읽기만 보장한다.
INSERT INTO storage.buckets (id, name, public)
VALUES ('job_content_images', 'job_content_images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 공고 상세에서 <img> 로 바로 부르므로 읽기는 공개.
DROP POLICY IF EXISTS job_content_images_public_read ON storage.objects;
CREATE POLICY job_content_images_public_read ON storage.objects
  FOR SELECT USING (bucket_id = 'job_content_images');

-- 업로드·삭제는 관리자만.
DROP POLICY IF EXISTS job_content_images_admin_write ON storage.objects;
CREATE POLICY job_content_images_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job_content_images'
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin)
  );

DROP POLICY IF EXISTS job_content_images_admin_delete ON storage.objects;
CREATE POLICY job_content_images_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'job_content_images'
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin)
  );

-- 쓰지 않는 ad-images 버킷의 정책을 정리한다.
-- 버킷 자체는 남긴다(그 안에 파일이 있으면 삭제가 실패하고 트랜잭션이 통째로 깨진다).
DROP POLICY IF EXISTS ad_images_public_read ON storage.objects;
DROP POLICY IF EXISTS ad_images_admin_write ON storage.objects;
DROP POLICY IF EXISTS ad_images_admin_delete ON storage.objects;

COMMIT;

-- =====================================================================
-- 검증 1 — 공격 경로 차단 확인
--   "일반 회원"(is_admin=false)으로 로그인한 상태로 F12 콘솔에서 실행.
--   error 가 떠야 한다. error 가 null 이면 잠금이 안 걸린 것이다.
-- =====================================================================
--   const f = new File([new Uint8Array([1,2,3])], 'x.jpg', { type: 'image/jpeg' })
--   await supabase.storage.from('job_content_images').upload('content/probe.jpg', f)

-- =====================================================================
-- 검증 2 — 정상 동작 회귀 확인
-- =====================================================================
--   관리자 계정으로 글쓰기·수정 → 상세 이미지 업로드 → 저장 → 상세에서 표시
--   기존에 올라간 이미지가 계속 보이는지 (읽기는 공개이므로 영향 없어야 한다)
--     https://vkczyskacwdsxjvykles.supabase.co/storage/v1/object/public/job_content_images/...

-- =====================================================================
-- 롤백
-- =====================================================================
--   DROP POLICY IF EXISTS job_content_images_public_read ON storage.objects;
--   DROP POLICY IF EXISTS job_content_images_admin_write ON storage.objects;
--   DROP POLICY IF EXISTS job_content_images_admin_delete ON storage.objects;
