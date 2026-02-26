-- job_application 테이블 (jd 테이블이 없을 때 사용)
-- jd REFERENCES 제거 - jd 테이블 생성 후 add_job_application_fk.sql로 FK 추가 가능

CREATE TABLE IF NOT EXISTS job_application (
  id BIGSERIAL PRIMARY KEY,
  jd_id BIGINT NOT NULL,
  users_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(jd_id, users_id)
);

CREATE INDEX IF NOT EXISTS idx_job_application_jd_id ON job_application(jd_id);
CREATE INDEX IF NOT EXISTS idx_job_application_users_id ON job_application(users_id);

ALTER TABLE job_application ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 있으면 제거 후 재생성 (재실행 시 오류 방지)
DROP POLICY IF EXISTS "job_application_select_own" ON job_application;
CREATE POLICY "job_application_select_own" ON job_application
  FOR SELECT USING (auth.uid() = users_id);

DROP POLICY IF EXISTS "job_application_insert_own" ON job_application;
CREATE POLICY "job_application_insert_own" ON job_application
  FOR INSERT WITH CHECK (auth.uid() = users_id);

DROP POLICY IF EXISTS "job_application_delete_own" ON job_application;
CREATE POLICY "job_application_delete_own" ON job_application
  FOR DELETE USING (auth.uid() = users_id);

DROP POLICY IF EXISTS "job_application_select" ON job_application;
CREATE POLICY "job_application_select" ON job_application
  FOR SELECT USING (true);

COMMENT ON TABLE job_application IS '채용공고 지원 - 북마크와 분리';
