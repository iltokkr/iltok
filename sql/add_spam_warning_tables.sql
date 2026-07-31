-- =====================================================================
-- 도배 경고·정지 시스템 — 테이블 / 컬럼 / 인덱스 / RLS
-- 설계 문서: docs/superpowers/specs/2026-07-31-spam-warning-system-design.md (4절)
--
-- Supabase 대시보드 > SQL Editor 에서 그대로 실행하세요.
-- 여러 번 실행해도 안전합니다 (IF NOT EXISTS / DROP IF EXISTS).
-- 함수와 트리거는 add_spam_warning_functions.sql 에 있습니다. 이 파일을 먼저 실행하세요.
-- =====================================================================

-- ============================================
-- 0. 확장 — pg_trgm (본문 유사도 계산용)
--    2단계 자동 감지에서 similarity() 를 쓴다. 미리 켜둔다.
--    Supabase 는 확장을 extensions 스키마에 모아둔다.
--    ※ extensions 스키마가 없는 환경이면 아래 줄을
--      CREATE EXTENSION IF NOT EXISTS pg_trgm;  로 바꿔 실행하세요.
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ============================================
-- 1. users 컬럼 추가 — 누적 경고 / 정지 상태
--    JetAdmin 회원 목록에서 바로 정렬·필터하기 위해 별도 테이블이 아니라 컬럼으로 둔다.
-- ============================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_permanently_blocked BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.warning_count IS '누적 경고 횟수 — issue_warning() 으로만 증가. 본인 UPDATE 는 트리거가 되돌린다';
COMMENT ON COLUMN users.suspended_until IS '공고 등록 제한 만료 일시 (2회차 경고 시 7일). NULL 이면 기간 제한 없음';
COMMENT ON COLUMN users.is_permanently_blocked IS '공고 등록 영구 제한 (3회차 이상 경고)';

-- 경고를 받은 회원만 인덱싱 (대부분의 회원은 0)
CREATE INDEX IF NOT EXISTS idx_users_warning_count
  ON users (warning_count DESC)
  WHERE warning_count > 0;

-- ============================================
-- 2. spam_reports — 운영자 검토 대기 후보
--    자동 감지 배치(2단계)가 채우고, 운영자가 경고 발송 / 무시로 처리한다.
--    ※ uploader_id 는 jd.uploader_id / users.id 와 같은 auth.users(id) UUID 다.
-- ============================================
CREATE TABLE IF NOT EXISTS spam_reports (
  id                   BIGSERIAL PRIMARY KEY,
  uploader_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind                 TEXT NOT NULL
                       CHECK (kind IN ('duplicate_posting', 'bump_abuse', 'manual')),
  region_1depth        TEXT NOT NULL,              -- jd."1depth_region" 값 (예: '경기')
  region_2depth        TEXT NOT NULL,              -- jd."2depth_region" 값 (예: '수원시')
  jd_ids               BIGINT[] NOT NULL,          -- 묶음에 속한 jd.id 목록
  jd_count             INTEGER NOT NULL,
  content_similarity   NUMERIC(4,3) NOT NULL,      -- 묶음 내 최저 유사도 (0.000 ~ 1.000)
  same_contact         BOOLEAN NOT NULL DEFAULT FALSE,
  same_salary          BOOLEAN NOT NULL DEFAULT FALSE,
  same_worktime        BOOLEAN NOT NULL DEFAULT FALSE,
  same_location_detail BOOLEAN NOT NULL DEFAULT FALSE,
  confidence           TEXT NOT NULL
                       CHECK (confidence IN ('high', 'medium', 'low')),
  cluster_key          TEXT NOT NULL,              -- kind + 정렬된 jd_ids + bump_date 해시
  bump_date            DATE,                       -- kind='bump_abuse' 일 때만 사용 (KST 기준 날짜)
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'warned', 'dismissed')),
  reason_text          TEXT,                       -- kind='manual' 일 때 사용자 팝업에 그대로 보이는 사유
  reviewed_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 이 파일의 이전 버전을 이미 실행한 환경을 위한 보정 (재실행해도 안전).
ALTER TABLE spam_reports
  ADD COLUMN IF NOT EXISTS reason_text TEXT;

ALTER TABLE spam_reports DROP CONSTRAINT IF EXISTS spam_reports_kind_check;
ALTER TABLE spam_reports ADD CONSTRAINT spam_reports_kind_check
  CHECK (kind IN ('duplicate_posting', 'bump_abuse', 'manual'));

-- status 에 'hidden' 추가 — 경고 없이 공고만 숨긴 경우.
-- 한 회원이 여러 묶음으로 잡혔을 때 묶음마다 경고를 주면 하루 만에 영구 제한이 된다.
-- 경고는 한 번만 주고 나머지 묶음은 숨김만 하라는 뜻이다.
ALTER TABLE spam_reports DROP CONSTRAINT IF EXISTS spam_reports_status_check;
ALTER TABLE spam_reports ADD CONSTRAINT spam_reports_status_check
  CHECK (status IN ('pending', 'warned', 'dismissed', 'hidden'));

COMMENT ON TABLE spam_reports IS '도배 의심 후보 — 운영자 검토 대기. 자동 판정은 하지 않는다';
COMMENT ON COLUMN spam_reports.kind IS '후보 종류. manual 은 자동 감지가 아니라 운영자가 직접 만든 경고 대상';
COMMENT ON COLUMN spam_reports.cluster_key IS 'kind + 정렬된 jd_ids + bump_date 의 해시. 배치가 매일 돌아도 같은 묶음이 중복 등록되지 않게 한다';
COMMENT ON COLUMN spam_reports.content_similarity IS '묶음 내 본문 유사도. 임계값 조정을 위한 관찰 데이터로도 쓴다';
COMMENT ON COLUMN spam_reports.reason_text IS '수동 경고 사유. issue_warning() 이 user_warnings.reason_text 로 그대로 옮긴다';

-- 같은 묶음이 pending 으로 두 번 올라오지 않게 한다.
-- 이미 처리(warned/dismissed)된 묶음은 공고가 추가되면 jd_ids 가 바뀌어 새 후보로 다시 올라온다 — 의도된 동작.
CREATE UNIQUE INDEX IF NOT EXISTS idx_spam_reports_cluster_open
  ON spam_reports (cluster_key)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_spam_reports_status
  ON spam_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_spam_reports_uploader
  ON spam_reports (uploader_id, created_at DESC);

-- ============================================
-- 3. user_warnings — 실제로 발송된 경고 이력
--    hidden_jd_titles 를 함께 저장하는 이유: 팝업에서 "어떤 공고가 숨겨졌는지" 보여줘야 하는데
--    그 공고가 나중에 삭제되어도 문구가 깨지지 않게 하기 위해서다.
-- ============================================
CREATE TABLE IF NOT EXISTS user_warnings (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level            INTEGER NOT NULL,               -- 그 이용자의 누적 경고 순번 (1, 2, 3...)
  kind             TEXT NOT NULL,                  -- 'duplicate_posting' | 'bump_abuse' | 'manual'
  report_id        BIGINT REFERENCES spam_reports(id) ON DELETE SET NULL,
  region_1depth    TEXT,
  region_2depth    TEXT,
  jd_count         INTEGER,
  hidden_jd_ids    BIGINT[],                       -- 이 경고로 숨김 처리된 공고 id
  hidden_jd_titles TEXT[],                         -- 위 공고의 제목 스냅샷 (삭제되어도 문구 유지)
  bump_date        DATE,
  suspended_until  TIMESTAMPTZ,                    -- 이 경고로 적용된 제한 만료 일시
  is_permanent     BOOLEAN NOT NULL DEFAULT FALSE,
  reason_text      TEXT,                           -- 수동 경고 시 사용자 팝업에 그대로 보이는 사유
  admin_note       TEXT,                           -- 운영 메모. 사용자에게는 보이지 않는다
  issued_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at  TIMESTAMPTZ                     -- 당사자가 팝업에서 확인한 시각
);

-- 이 파일의 이전 버전을 이미 실행한 환경을 위한 보정 (재실행해도 안전).
ALTER TABLE user_warnings
  ADD COLUMN IF NOT EXISTS reason_text TEXT;

COMMENT ON TABLE user_warnings IS '도배 경고 발송 이력 — 회차(level)별 제재 내용 포함';
COMMENT ON COLUMN user_warnings.reason_text IS '수동 경고 사유 — 사용자 팝업에 그대로 노출된다. 자동 후보는 NULL';
COMMENT ON COLUMN user_warnings.hidden_jd_titles IS '숨김 처리된 공고 제목 스냅샷 — 공고가 삭제되어도 팝업 문구가 깨지지 않게 한다';
COMMENT ON COLUMN user_warnings.acknowledged_at IS 'NULL 이면 미확인. acknowledge_warning() RPC 로만 기록된다';

-- 팝업 노출 판단용 — 미확인 경고 조회
CREATE INDEX IF NOT EXISTS idx_user_warnings_unack
  ON user_warnings (user_id)
  WHERE acknowledged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_warnings_user_created
  ON user_warnings (user_id, created_at DESC);

-- ============================================
-- 4. jd_bump_log — 끌어올리기 기록
--    현재 끌어올리기는 jd.updated_time 을 덮어쓰기만 해서 이력이 남지 않는다.
--    3단계(끌어올리기 남용 감지)에서 쓸 데이터라 과거는 소급할 수 없다. 지금부터 쌓는다.
-- ============================================
CREATE TABLE IF NOT EXISTS jd_bump_log (
  id          BIGSERIAL PRIMARY KEY,
  jd_id       BIGINT NOT NULL,
  uploader_id UUID NOT NULL,
  bumped_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE jd_bump_log IS '공고/이력서 끌어올리기 기록 — 끌어올리기 남용 감지(3단계)용. 기록 실패가 끌어올리기를 막지 않는다';

-- jd_id 에 FK 를 걸지 않는 이유: 공고가 삭제되어도 남용 이력은 남아야 한다.
CREATE INDEX IF NOT EXISTS idx_jd_bump_log_uploader_date
  ON jd_bump_log (uploader_id, bumped_at DESC);

CREATE INDEX IF NOT EXISTS idx_jd_bump_log_jd
  ON jd_bump_log (jd_id, bumped_at DESC);

-- ============================================
-- 5. RLS
--    - spam_reports  : 일반 정책 없음. 관리자 API 가 service role 로만 접근한다.
--    - user_warnings : 본인 행 SELECT 만 허용. UPDATE/INSERT 정책은 두지 않는다
--                      (확인 처리는 acknowledge_warning() RPC 로만).
--    - jd_bump_log   : 본인 uploader_id 에 한해 INSERT 만 허용. SELECT 정책 없음.
-- ============================================
ALTER TABLE spam_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE jd_bump_log   ENABLE ROW LEVEL SECURITY;

-- spam_reports: 정책을 하나도 만들지 않는다 → service role 외에는 아무것도 못 한다.

DROP POLICY IF EXISTS "user_warnings_select_own" ON user_warnings;
CREATE POLICY "user_warnings_select_own" ON user_warnings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "jd_bump_log_insert_own" ON jd_bump_log;
CREATE POLICY "jd_bump_log_insert_own" ON jd_bump_log
  FOR INSERT
  TO authenticated
  WITH CHECK (uploader_id = auth.uid());

-- 테이블 권한 (Supabase 기본 권한이 이미 있으면 사실상 무동작).
-- 실제 제한은 위 RLS 정책이 한다.
GRANT SELECT ON user_warnings TO authenticated;
GRANT INSERT ON jd_bump_log   TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE jd_bump_log_id_seq TO authenticated;

-- =====================================================================
-- 다음 단계: sql/add_spam_warning_functions.sql 을 실행하세요.
-- =====================================================================
