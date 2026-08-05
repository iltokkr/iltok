-- =====================================================================
-- storage.objects 익명 업로드 차단 (storage_anon_upload_audit.sql 진단 결과 반영)
-- =====================================================================
-- 진단으로 확인된 INSERT 정책 3개:
--
--   insert all user o5j2r7_0            {public}         with_check: true
--     → 조건이 하나도 없다. 버킷 구분도, 로그인 여부도 보지 않는다.
--       {public} 은 anon + authenticated 를 모두 포함하므로
--       로그인하지 않은 사람도 아무 버킷에나 파일을 올릴 수 있었다.
--       ad-images(관리자 전용 정책을 걸어둔 버킷)까지 뚫린 원인이 이것이다.
--
--   job_content_images_insert_authenticated  {authenticated}  bucket_id 체크만
--     → 관리자 확인이 없다. 로그인한 일반 회원이면 누구나 올릴 수 있다.
--       허용 정책은 OR 로 합쳐지므로 job_content_images_admin_write 를 무력화한다.
--
--   job_content_images_admin_write      {authenticated}  bucket + is_admin  ← 유지
--
-- 함정:
--   auth_file(사업자등록증) 에는 INSERT 정책이 하나도 없다.
--   지금 업로드가 되는 건 오로지 위 전역 정책 덕분이다.
--   그것만 지우면 기업 회원가입·사업자 정보 수정의 서류 첨부가 깨진다.
--   그래서 아래에서 auth_file 전용 정책을 함께 만든다.
--
-- SELECT 정책은 job_content_images 용으로 3개가 중복돼 있다(기능상 동일).
--   Allow public read 82cgqo_0 / job_content_images_public_read / job_content_images_select_public
--   하나만 남기고 정리한다. auth_file 은 SELECT 정책이 없어도 된다 —
--   공개 버킷의 /object/public/ 직접 접근은 RLS 를 타지 않고,
--   정책이 없으니 목록 조회(list)는 막혀 파일명 열거가 안 된다(현 상태 유지가 바람직).
--
-- 적용: Supabase 대시보드 SQL Editor 에 통째로 붙여넣고 실행. 여러 번 실행해도 안전.
-- =====================================================================

BEGIN;

-- ── 1) 구멍 막기 ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "insert all user o5j2r7_0" ON storage.objects;
DROP POLICY IF EXISTS job_content_images_insert_authenticated ON storage.objects;

-- ── 2) 끊기면 안 되는 정상 흐름 보장 ──────────────────────────────────
-- 사업자등록증: 로그인한 회원이 자기 서류를 올린다.
--   src/pages/signup/business.tsx (기업 가입·전환)
--   src/components/BusinessVerificationModal.tsx (사업자 정보 수정)
DROP POLICY IF EXISTS auth_file_authenticated_write ON storage.objects;
CREATE POLICY auth_file_authenticated_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'auth_file');

-- 공고 상세 이미지: 관리자만. (이미 있으면 그대로 재생성)
DROP POLICY IF EXISTS job_content_images_admin_write ON storage.objects;
CREATE POLICY job_content_images_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job_content_images'
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_admin)
  );

-- ── 3) 중복 SELECT 정책 정리 (기능 변화 없음) ─────────────────────────
DROP POLICY IF EXISTS "Allow public read 82cgqo_0" ON storage.objects;
DROP POLICY IF EXISTS job_content_images_select_public ON storage.objects;
-- job_content_images_public_read 하나만 남긴다.

COMMIT;

-- =====================================================================
-- 검증 1 — 익명 업로드 차단 확인 (터미널)
--   세 줄 모두 에러가 떠야 한다. {"Key":...} 가 돌아오면 아직 뚫린 것이다.
-- =====================================================================
--   URL=<NEXT_PUBLIC_SUPABASE_URL>
--   KEY=<NEXT_PUBLIC_SUPABASE_ANON_KEY>
--   for B in job_content_images auth_file ad-images; do
--     printf '%s <- ' "$(curl -s -X POST "$URL/storage/v1/object/$B/__probe__.txt" \
--       -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
--       -H 'Content-Type: text/plain' --data-binary probe)"; echo "$B";
--   done

-- =====================================================================
-- 검증 2 — 정상 동작 회귀 확인 (전부 계속 성공해야 한다)
-- =====================================================================
--   기업 회원가입에서 사업자등록증 첨부 → 저장          (auth_file 업로드)
--   사업자 정보 수정하기 모달에서 서류 재첨부 → 저장     (auth_file 업로드)
--   관리자 계정으로 공고 상세 이미지 업로드 → 저장       (job_content_images 업로드)
--   일반 회원 계정으로 공고 상세 이미지 업로드 시도      → 실패해야 정상
--   기존 상세 이미지가 공고 상세에서 계속 보이는지        (공개 읽기 유지)

-- =====================================================================
-- 롤백 (구멍을 다시 여는 것이므로 권장하지 않음)
-- =====================================================================
--   CREATE POLICY "insert all user o5j2r7_0" ON storage.objects
--     FOR INSERT TO public WITH CHECK (true);
