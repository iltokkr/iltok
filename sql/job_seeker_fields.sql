-- =====================================================
-- 구직정보 이력서 필드 추가
-- =====================================================

-- jd 테이블에 구직자 이력서 필드 추가 (board_type='1'인 경우 사용)
ALTER TABLE jd ADD COLUMN IF NOT EXISTS korean_name VARCHAR(50);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS english_name VARCHAR(100);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS seeker_gender VARCHAR(10);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE jd ADD COLUMN IF NOT EXISTS nationality VARCHAR(50);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS visa_status VARCHAR(50);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS korean_ability VARCHAR(50);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS work_conditions TEXT; -- JSON 형태로 저장: ["주간", "야간", "일당", ...]
ALTER TABLE jd ADD COLUMN IF NOT EXISTS desired_regions TEXT; -- JSON 형태로 저장: ["서울 강남구", "경기 수원시", ...]
ALTER TABLE jd ADD COLUMN IF NOT EXISTS career_history TEXT; -- JSON 형태로 저장

-- =====================================================
-- 사용 예시
-- =====================================================

-- 구직자 이력서 등록 예시:
-- INSERT INTO jd (
--   uploader_id, board_type, title, contents,
--   korean_name, english_name, seeker_gender, birth_date,
--   nationality, visa_status, korean_ability,
--   work_conditions, desired_regions, career_history,
--   '1depth_category', '2depth_category', '1depth_region', '2depth_region'
-- ) VALUES (
--   'user-uuid', '1', '구직합니다', '열심히 하겠습니다',
--   '홍길동', 'Hong Gil Dong', '남성', '1990-05-15',
--   '중국', '취업비자(E1-E7)', '대화가 가능해요',
--   '["주간", "야간", "일당"]',
--   '["서울 강남구", "경기 수원시"]',
--   '[{"id":"1","company_name":"ABC공장","work_status":"계약종료","start_date":"2022-01","end_date":"2022-12","job_duties":["생산·건설"]}]',
--   '생산·건설', '생산직', '서울', '강남구'
-- );


