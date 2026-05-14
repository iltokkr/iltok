-- 채용공고 조회 로그 테이블
-- 광고주(uploader)에게 광고 성과 분석을 제공하기 위한 트래킹 데이터
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS jd_view_log (
  id BIGSERIAL PRIMARY KEY,
  jd_id BIGINT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewer_user_id UUID,                          -- 비로그인 NULL
  session_id TEXT NOT NULL,                     -- 익명 식별자 (localStorage)
  referrer TEXT,                                -- document.referrer
  source TEXT,                                  -- 유입 분류: board / search / direct / category / etc
  user_agent TEXT,
  dwell_ms INTEGER                              -- 페이지 체류 시간(ms), beforeunload 시 갱신
);

CREATE INDEX IF NOT EXISTS idx_jd_view_log_jd_viewed
  ON jd_view_log(jd_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_jd_view_log_session
  ON jd_view_log(session_id);

CREATE INDEX IF NOT EXISTS idx_jd_view_log_viewer
  ON jd_view_log(viewer_user_id)
  WHERE viewer_user_id IS NOT NULL;

ALTER TABLE jd_view_log ENABLE ROW LEVEL SECURITY;

-- 누구나 INSERT 가능 (비로그인 포함)
DROP POLICY IF EXISTS "Anyone can insert view log" ON jd_view_log;
CREATE POLICY "Anyone can insert view log"
  ON jd_view_log FOR INSERT
  WITH CHECK (true);

-- 누구나 UPDATE 가능 (체류시간 PATCH용 — dwell_ms만 갱신되며 영향 미미)
DROP POLICY IF EXISTS "Anyone can update view log" ON jd_view_log;
CREATE POLICY "Anyone can update view log"
  ON jd_view_log FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- SELECT: 본인이 uploader인 jd의 로그만 조회 가능 (광고주 분석용)
DROP POLICY IF EXISTS "Owner can read view log" ON jd_view_log;
CREATE POLICY "Owner can read view log"
  ON jd_view_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jd
      WHERE jd.id = jd_view_log.jd_id
      AND jd.uploader_id = auth.uid()
    )
  );

COMMENT ON TABLE jd_view_log IS '채용공고 조회 로그 — 광고 성과 분석용';
COMMENT ON COLUMN jd_view_log.session_id IS '클라이언트 localStorage 익명 식별자';
COMMENT ON COLUMN jd_view_log.source IS '유입 경로: board, search, direct, category, etc';
COMMENT ON COLUMN jd_view_log.dwell_ms IS '페이지 체류 시간(ms), beforeunload 시 갱신';

-- ============================================================
-- 분석 페이지 공유 토큰
-- 운영자가 광고주에게 공유 링크로 분석 결과를 전달하는 용도.
-- 토큰을 가진 사람만 /my/analytics/<id>?t=<token> 으로 조회 가능.
-- ============================================================

ALTER TABLE jd ADD COLUMN IF NOT EXISTS analytics_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_jd_analytics_token
  ON jd(analytics_token)
  WHERE analytics_token IS NOT NULL;

COMMENT ON COLUMN jd.analytics_token IS '분석 페이지 공유 토큰 — 운영자가 발급, 광고주에게 링크로 전달';

-- ============================================================
-- 토큰 발급 예시 (운영자가 SQL Editor에서 실행)
--
--   UPDATE jd
--   SET analytics_token = encode(gen_random_bytes(16), 'hex')
--   WHERE id = 21159
--   RETURNING id, analytics_token;
--
-- 반환된 token으로 광고주에게 다음 링크 전달:
--   https://114114kr.com/my/analytics/21159?t=<analytics_token>
-- ============================================================
