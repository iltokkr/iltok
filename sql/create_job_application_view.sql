-- job_application 상세 뷰 (Supabase 에디터에서 지원자 정보 확인용)
-- Supabase SQL Editor에서 실행하세요

CREATE OR REPLACE VIEW job_application_detail AS
SELECT
  ja.id,
  ja.created_at                          AS 지원일시,
  ja.jd_id                               AS 공고ID,
  j.title                                AS 공고제목,
  ja.users_id                            AS 지원자UUID,
  u.name                                 AS 지원자이름,
  u.number                               AS 연락처,
  u.email                                AS 이메일,
  u.user_id                              AS 아이디,
  -- 구직자 프로필 (jd 테이블 board_type='1' 에서 가져옴)
  p.korean_name                          AS 한글이름,
  p.english_name                         AS 영문이름,
  p.seeker_gender                        AS 성별,
  p.birth_date                           AS 생년월일,
  p.nationality                          AS 국적,
  p.visa_status                          AS 비자,
  p.korean_ability                       AS 한국어능력,
  p.desired_regions                      AS 희망지역,
  p.work_conditions                      AS 희망근무조건,
  p.career_history                       AS 경력사항
FROM job_application ja
LEFT JOIN jd j ON j.id = ja.jd_id
LEFT JOIN users u ON u.id = ja.users_id
LEFT JOIN LATERAL (
  SELECT *
  FROM jd
  WHERE uploader_id = ja.users_id AND board_type = '1'
  ORDER BY updated_time DESC
  LIMIT 1
) p ON true
ORDER BY ja.created_at DESC;

COMMENT ON VIEW job_application_detail IS '지원 내역 + 지원자 정보 + 구직자 프로필(jd board_type=1) + 공고 제목 조인 뷰';
