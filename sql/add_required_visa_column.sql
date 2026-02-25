-- jd 테이블에 채용정보용 비자 조건 컬럼 추가 (board_type='0')
-- JSON 배열 형태로 저장: ["E1-E7", "H-2", ...]

ALTER TABLE jd ADD COLUMN IF NOT EXISTS required_visa TEXT;

COMMENT ON COLUMN jd.required_visa IS '채용정보 공고의 희망 비자 조건 (JSON 배열)';
