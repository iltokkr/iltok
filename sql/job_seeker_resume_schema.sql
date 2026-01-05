-- =====================================================
-- 구직자 이력서 기능을 위한 데이터베이스 스키마
-- =====================================================

-- 1. users 테이블에 회원 유형 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type VARCHAR(20) DEFAULT 'business';
-- 'business' = 기업회원, 'individual' = 구직자(개인회원)

-- 2. users 테이블에 "다시 보지 않기" 체크박스 상태 저장
ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_resume_popup BOOLEAN DEFAULT false;

-- 3. jd 테이블에 마감/개시 상태 필드 추가
ALTER TABLE jd ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
-- 'active' = 게시중, 'closed' = 마감

-- 4. jd 테이블에 구직자 이력서 필드 추가 (board_type='1'인 경우 사용)
ALTER TABLE jd ADD COLUMN IF NOT EXISTS korean_name VARCHAR(50);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS english_name VARCHAR(100);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE jd ADD COLUMN IF NOT EXISTS nationality VARCHAR(50);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS visa_status VARCHAR(50);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS korean_ability VARCHAR(50);
ALTER TABLE jd ADD COLUMN IF NOT EXISTS work_conditions TEXT; -- JSON 형태로 저장: ["주간", "야간", "일당", ...]
ALTER TABLE jd ADD COLUMN IF NOT EXISTS desired_regions TEXT; -- JSON 형태로 저장: ["서울시 강남구", "경기 수원시", ...]
ALTER TABLE jd ADD COLUMN IF NOT EXISTS career_history TEXT; -- JSON 형태로 저장

-- 5. 경력 정보 테이블 (선택사항 - jd.career_history를 JSON으로 사용해도 됨)
-- CREATE TABLE IF NOT EXISTS career_history (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   jd_id INTEGER REFERENCES jd(id) ON DELETE CASCADE,
--   company_name VARCHAR(100),
--   work_status VARCHAR(20), -- '재직중', '계약종료'
--   start_date DATE,
--   end_date DATE,
--   job_duties TEXT, -- JSON 형태로 저장: ["식품생산직", "기기부품제조", ...]
--   created_at TIMESTAMP DEFAULT NOW()
-- );

-- =====================================================
-- 인덱스 추가 (검색 성능 향상)
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);
CREATE INDEX IF NOT EXISTS idx_jd_status ON jd(status);
CREATE INDEX IF NOT EXISTS idx_jd_board_type_status ON jd(board_type, status);

-- =====================================================
-- 사용 예시
-- =====================================================

-- 구직자 이력서 등록 예시:
-- INSERT INTO jd (
--   uploader_id, board_type, title, contents,
--   korean_name, english_name, gender, birth_date,
--   nationality, visa_status, korean_ability,
--   work_conditions, desired_regions, career_history,
--   '1depth_category', '2depth_category'
-- ) VALUES (
--   'user-uuid', '1', '구직합니다', '열심히 하겠습니다',
--   '홍길동', 'Hong Gil Dong', '남', '1990-05-15',
--   '중국', '취업비자(E1-E7)', '대화가 가능해요',
--   '["주간", "야간", "일당"]',
--   '["서울시 강남구", "경기 수원시"]',
--   '[{"company":"ABC공장","status":"계약종료","start":"2022-01","end":"2022-12","duties":["식품생산직"]}]',
--   '생산·건설', '생산직'
-- );

-- 게시글 마감 처리:
-- UPDATE jd SET status = 'closed' WHERE id = 123;

-- 게시글 재개시 (상위 노출):
-- UPDATE jd SET status = 'active', updated_time = NOW() WHERE id = 123;

-- 게시중인 글만 조회:
-- SELECT * FROM jd WHERE status = 'active' AND board_type = '0' ORDER BY updated_time DESC;

