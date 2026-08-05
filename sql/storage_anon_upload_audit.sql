-- =====================================================================
-- [진단] storage.objects 익명 업로드 허용 정책 찾기
-- =====================================================================
-- 발견된 증상 (2026-08-05, 프로덕션에서 실측):
--   로그인하지 않은 anon 키만으로 아래 세 버킷 모두 업로드가 성공했다.
--     job_content_images / auth_file / ad-images
--   ad-images 는 jd_content_image_guard.sql 로 "관리자만 INSERT" 정책을 걸었던
--   버킷인데도 통과했다. 즉 버킷별 정책 문제가 아니라, storage.objects 에
--   버킷 조건이 없는 허용(permissive) INSERT 정책이 하나 더 있다는 뜻이다.
--   RLS 허용 정책은 OR 로 합쳐지므로, 넓은 정책 하나가 좁은 정책들을 무력화한다.
--
-- 함께 확인된 것 (이쪽은 정상):
--   DELETE : anon 으로 job_content_images 삭제 시도 → 403 (정상 차단)
--   LIST   : anon 으로 auth_file 목록 조회 → [] (RLS 가 행을 걸러냄)
--            파일명 열거가 안 되므로 사업자등록증 파일이 쉽게 노출되지는 않는다.
--
-- 실제 피해 범위:
--   임의 파일 업로드 → 스토리지·egress 비용 낭비, Supabase 도메인에 임의 콘텐츠 호스팅.
--   덮어쓰기는 안 된다(코드가 upsert:false, 같은 키면 409).
--
-- 왜 바로 고치는 SQL 이 아니라 진단부터인가:
--   정책 이름을 모르는 상태에서 storage.objects 의 정책을 일괄 DROP 하면
--   사업자 인증서 업로드(auth_file)나 다른 정상 흐름이 같이 끊긴다.
--   아래 1번을 먼저 실행해 결과를 보고, 2번에서 이름을 지정해 지운다.
-- =====================================================================

-- ── 1) 현재 storage.objects 에 걸린 정책 전부 보기 ────────────────────
--    roles 에 anon 또는 public 이 있고 cmd 가 INSERT/ALL 인 행이 범인이다.
--    qual/with_check 에 bucket_id 조건이 없으면 전 버킷에 적용된다.
SELECT
  policyname,
  cmd,
  roles,
  permissive,
  qual        AS using_expr,
  with_check  AS check_expr
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename  = 'objects'
ORDER BY cmd, policyname;

-- ── 참고) RLS 자체가 켜져 있는지 ──────────────────────────────────────
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE oid = 'storage.objects'::regclass;


-- =====================================================================
-- 2) 범인을 찾은 뒤 실행 — 이름을 실제 값으로 바꿔서
-- =====================================================================
-- BEGIN;
--   DROP POLICY IF EXISTS "여기에_1번에서_찾은_정책명" ON storage.objects;
--
--   -- 지운 뒤 정상 흐름이 끊기지 않도록 아래를 보장한다.
--
--   -- (a) 사업자 인증서: 로그인한 회원이 자기 서류를 올릴 수 있어야 한다.
--   --     src/pages/signup/business.tsx, src/components/BusinessVerificationModal.tsx
--   DROP POLICY IF EXISTS auth_file_authenticated_write ON storage.objects;
--   CREATE POLICY auth_file_authenticated_write ON storage.objects
--     FOR INSERT TO authenticated
--     WITH CHECK (bucket_id = 'auth_file');
--
--   -- (b) 공고 상세 이미지: 관리자만.
--   --     sql/job_content_images_bucket_policy.sql 에서 이미 만들었다면 생략 가능.
--   DROP POLICY IF EXISTS job_content_images_admin_write ON storage.objects;
--   CREATE POLICY job_content_images_admin_write ON storage.objects
--     FOR INSERT TO authenticated
--     WITH CHECK (
--       bucket_id = 'job_content_images'
--       AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin)
--     );
-- COMMIT;


-- =====================================================================
-- 3) 조치 후 재검증 — 터미널에서. 세 줄 모두 에러가 떠야 정상이다.
--    (성공하면 {"Key":...} 가 돌아오고, 그건 아직 뚫려 있다는 뜻이다)
-- =====================================================================
--   URL=<NEXT_PUBLIC_SUPABASE_URL>
--   KEY=<NEXT_PUBLIC_SUPABASE_ANON_KEY>
--   for B in job_content_images auth_file ad-images; do
--     curl -s -X POST "$URL/storage/v1/object/$B/__probe__.txt" \
--       -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
--       -H "Content-Type: text/plain" --data-binary "probe"; echo " <- $B";
--   done
--
--   정상 흐름 회귀도 함께 확인한다:
--     기업 회원가입에서 사업자등록증 첨부 → 저장
--     사업자 정보 수정하기 모달에서 서류 재첨부 → 저장
--     관리자 계정으로 공고 상세 이미지 업로드 → 저장
