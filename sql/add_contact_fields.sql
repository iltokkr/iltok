-- 채용담당자 정보 (공고별 담당자명, 전화번호)
-- 공고 등록 시 상세내용 안내문 밑에 입력 가능

ALTER TABLE jd ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE jd ADD COLUMN IF NOT EXISTS contact_phone TEXT;

COMMENT ON COLUMN jd.contact_name IS '채용담당자명 (미입력 시 업로더 대표자명 사용)';
COMMENT ON COLUMN jd.contact_phone IS '채용담당자 전화번호 (미입력 시 업로더 전화번호 사용)';
