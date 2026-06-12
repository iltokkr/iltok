-- users 테이블에 '사업자 인증 승인 알림 표시 여부' 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
--
-- 용도: is_accept 가 false -> true 로 승인되었을 때, 사용자에게 1회만
--      "인증 완료 / 채용정보 공개" 모달을 띄우기 위한 표시값.
--   - accept_notified = false  : 아직 승인 알림을 보여주지 않음 (승인되면 알림 대상)
--   - accept_notified = true   : 이미 알림을 보여줌 (다시 띄우지 않음)

ALTER TABLE users ADD COLUMN IF NOT EXISTS accept_notified BOOLEAN NOT NULL DEFAULT FALSE;

-- 기존에 이미 인증 완료된 회원은 소급 알림이 뜨지 않도록 true 로 백필
UPDATE users SET accept_notified = TRUE WHERE is_accept = TRUE;
