-- 구직정보 게시글용 추가 필드
-- jd 테이블에 구직자 정보 필드 추가

-- 기본 정보
ALTER TABLE jd ADD COLUMN IF NOT EXISTS korean_name VARCHAR(50);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS english_name VARCHAR(100);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS seeker_gender VARCHAR(10);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE jd ADD COLUMN IF NOT EXISTS nationality VARCHAR(50);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS visa_status VARCHAR(50);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS korean_ability VARCHAR(50);

-- 희망 근무 조건 (JSON 배열로 저장)
ALTER TABLE jd ADD COLUMN IF NOT EXISTS work_conditions TEXT;

-- 희망 지역 (JSON 배열로 저장, 최대 5개)
ALTER TABLE jd ADD COLUMN IF NOT EXISTS desired_regions TEXT;

-- 경력 사항 (JSON 배열로 저장)
ALTER TABLE jd ADD COLUMN IF NOT EXISTS career_history TEXT;


