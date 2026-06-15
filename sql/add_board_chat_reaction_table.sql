-- =====================================================================
-- 방장 채널 메시지 이모지 반응 (👍 ❤️ 😂 😮)
-- 비로그인 포함 누구나 반응 가능. 브라우저별 client_id 로 1인 1회 보장.
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
-- (board_chat 테이블이 먼저 있어야 합니다 — add_board_chat_table.sql)
-- =====================================================================

-- 이전 버전(로그인 전용) 테이블이 있으면 제거 후 재생성 (반응 데이터 초기화).
DROP TABLE IF EXISTS board_chat_reaction;

CREATE TABLE IF NOT EXISTS board_chat_reaction (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  chat_id     bigint NOT NULL REFERENCES board_chat(id) ON DELETE CASCADE,
  client_id   text NOT NULL,        -- 브라우저별 익명 식별자 (localStorage)
  user_id     uuid,                 -- 로그인 시 참고용 (없으면 NULL)
  emoji       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- 같은 브라우저가 같은 메시지에 같은 이모지는 한 번만
  UNIQUE (chat_id, client_id, emoji)
);

COMMENT ON TABLE board_chat_reaction IS '방장 채널 메시지 이모지 반응 (익명 허용, client_id 기준)';

CREATE INDEX IF NOT EXISTS idx_board_chat_reaction_chat ON board_chat_reaction (chat_id);

-- RLS
ALTER TABLE board_chat_reaction ENABLE ROW LEVEL SECURITY;

-- 읽기: 누구나 — 카운트 표시용
DROP POLICY IF EXISTS "bcr_select_all" ON board_chat_reaction;
CREATE POLICY "bcr_select_all" ON board_chat_reaction
  FOR SELECT
  USING (true);

-- 추가: 비로그인(anon) + 로그인(authenticated) 모두 허용
DROP POLICY IF EXISTS "bcr_insert_own" ON board_chat_reaction;
DROP POLICY IF EXISTS "bcr_insert_all" ON board_chat_reaction;
CREATE POLICY "bcr_insert_all" ON board_chat_reaction
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (char_length(client_id) BETWEEN 8 AND 64);

-- 취소(반응 끄기): 누구나 — 앱은 자기 client_id 행만 삭제하지만,
-- 익명 특성상 서버에서 소유권을 강제할 수는 없음 (저위험 감수).
DROP POLICY IF EXISTS "bcr_delete_own" ON board_chat_reaction;
DROP POLICY IF EXISTS "bcr_delete_all" ON board_chat_reaction;
CREATE POLICY "bcr_delete_all" ON board_chat_reaction
  FOR DELETE
  TO anon, authenticated
  USING (true);
