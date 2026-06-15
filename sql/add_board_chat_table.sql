-- =====================================================================
-- 방장 채널(상단 채팅) 기능용 테이블 + 권한
-- 텔레그램 채널처럼 "방장(운영자)만 글을 올리고, 나머지는 읽기만" 하는 구조.
-- Supabase 대시보드 > SQL Editor 에서 그대로 실행하세요.
-- =====================================================================

-- 1) 관리자(방장) 식별용 컬럼 추가
--    이 코드베이스엔 admin 개념이 없었으므로 users 테이블에 플래그를 추가한다.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN users.is_admin IS '방장(운영자) 여부 — 상단 채널 작성 권한 등 관리자 기능에 사용';

-- 2) 채널 메시지 테이블
CREATE TABLE IF NOT EXISTS board_chat (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE board_chat IS '메인 게시판 상단 방장 채널 메시지 (단방향 브로드캐스트)';

CREATE INDEX IF NOT EXISTS idx_board_chat_created_at ON board_chat (created_at DESC);

-- 3) RLS — 여기가 진짜 잠금장치. 프론트의 입력칸 숨김은 보조일 뿐.
ALTER TABLE board_chat ENABLE ROW LEVEL SECURITY;

-- 읽기: 누구나(비로그인 포함) 가능
DROP POLICY IF EXISTS "board_chat_select_all" ON board_chat;
CREATE POLICY "board_chat_select_all" ON board_chat
  FOR SELECT
  USING (true);

-- 작성: 방장(is_admin = true)만 가능
DROP POLICY IF EXISTS "board_chat_insert_admin" ON board_chat;
CREATE POLICY "board_chat_insert_admin" ON board_chat
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- 삭제: 방장만 가능 (실수한 메시지 지우기용)
DROP POLICY IF EXISTS "board_chat_delete_admin" ON board_chat;
CREATE POLICY "board_chat_delete_admin" ON board_chat
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- =====================================================================
-- 4) 본인을 방장으로 지정 (★ 꼭 실행)
--    아래 'YOUR-AUTH-UID' 를 본인 계정의 auth UID 로 바꾸세요.
--    UID 찾는 법: 로그인한 상태에서 본인 이메일로 조회하거나,
--    Supabase 대시보드 > Authentication > Users 에서 본인 행의 UID 복사.
-- =====================================================================
-- UPDATE users SET is_admin = true WHERE id = 'YOUR-AUTH-UID';

-- (이메일로 찾기 예시 — auth.users 와 조인)
-- UPDATE users SET is_admin = true
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'kjpjjing@gmail.com');
