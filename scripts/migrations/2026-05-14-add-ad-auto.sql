-- 자동 프리미엄 광고 식별용 컬럼
-- 운영자가 결제한 진짜 광고와 cron이 매일 자동 선정한 광고를 구분
ALTER TABLE jd ADD COLUMN IF NOT EXISTS ad_auto boolean DEFAULT false;

-- 자동 프리미엄 갱신 시 빠르게 해제하기 위한 부분 인덱스
CREATE INDEX IF NOT EXISTS jd_ad_auto_active_idx
  ON jd (ad_auto) WHERE ad_auto = true;

-- 후보 조회용 부분 인덱스 (활성 + 채용공고 + view_count 정렬)
CREATE INDEX IF NOT EXISTS jd_premium_candidates_idx
  ON jd (board_type, updated_time DESC, view_count DESC)
  WHERE board_type = '0'
    AND COALESCE(is_hidden, false) = false
    AND COALESCE(is_wage_violation, false) = false;
