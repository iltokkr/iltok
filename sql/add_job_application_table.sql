-- 지원(지원하기)과 북마크(즐겨찾기) 분리
-- 북마크는 지원자 목록에 포함되지 않음

-- job_application 테이블: 구직자의 채용공고 지원
CREATE TABLE IF NOT EXISTS job_application (
  id BIGSERIAL PRIMARY KEY,
  jd_id BIGINT NOT NULL REFERENCES jd(id) ON DELETE CASCADE,
  users_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(jd_id, users_id)
);

CREATE INDEX IF NOT EXISTS idx_job_application_jd_id ON job_application(jd_id);
CREATE INDEX IF NOT EXISTS idx_job_application_users_id ON job_application(users_id);

-- RLS
ALTER TABLE job_application ENABLE ROW LEVEL SECURITY;

-- 구직자: 본인 지원 내역 조회/추가/삭제
CREATE POLICY "job_application_select_own" ON job_application
  FOR SELECT USING (auth.uid() = users_id);

CREATE POLICY "job_application_insert_own" ON job_application
  FOR INSERT WITH CHECK (auth.uid() = users_id);

CREATE POLICY "job_application_delete_own" ON job_application
  FOR DELETE USING (auth.uid() = users_id);

-- 지원자 수 공개 (게시판 목록 N명 표시) + 구인자 지원자 명단 조회
CREATE POLICY "job_application_select" ON job_application
  FOR SELECT USING (true);

COMMENT ON TABLE job_application IS '채용공고 지원 - 북마크와 분리';
