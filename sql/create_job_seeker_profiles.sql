-- 구직자 프로필/이력서 테이블 생성
-- Supabase SQL Editor에서 실행하세요

CREATE TABLE IF NOT EXISTS job_seeker_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 기본 정보
  korean_name VARCHAR(50) NOT NULL,           -- 한글 이름
  english_name VARCHAR(100),                  -- 영문 이름
  gender VARCHAR(10),                         -- 성별: '남성', '여성'
  birth_year INTEGER,                         -- 생년
  birth_month INTEGER,                        -- 월
  birth_day INTEGER,                          -- 일
  
  -- 프로필 이미지
  profile_image_url TEXT,                     -- 프로필 사진 URL
  
  -- 희망 업무 (복수 선택 가능)
  desired_jobs TEXT[],                        -- 희망업무 배열: ['식품생산직', '건설', ...]
  
  -- 국적 및 체류자격
  nationality VARCHAR(50),                    -- 국적: '중국', '베트남', '필리핀', etc.
  visa_status VARCHAR(50),                    -- 체류자격: '취업비자(E1-E7)', '결혼비자(F6)', etc.
  
  -- 한국어 능력
  korean_ability VARCHAR(50),                 -- '대화가 가능해요', '기초 수준이에요', '유창해요', etc.
  
  -- 희망 근무조건 (복수 선택 가능)
  work_time_preference TEXT[],                -- ['주간', '야간', '주야교대']
  pay_type_preference TEXT[],                 -- ['일당', '주급', '월급']
  work_duration_preference TEXT[],            -- ['장기', '단기']
  work_day_preference TEXT[],                 -- ['평일', '주말']
  dormitory_needed BOOLEAN DEFAULT FALSE,     -- 기숙사 필요 여부
  
  -- 사장님께 한마디
  message_to_employer TEXT,                   -- 사장님께 한마디
  
  -- 거주지 정보
  zip_code VARCHAR(10),                       -- 우편번호
  address TEXT,                               -- 주소
  address_detail TEXT,                        -- 상세 주소
  
  -- 근무 희망 지역 (최대 5개)
  preferred_regions TEXT[],                   -- ['서울시 강남구', '서울시 강동구', ...]
  
  -- 메타 정보
  is_published BOOLEAN DEFAULT TRUE,          -- 공개 여부
  view_count INTEGER DEFAULT 0,               -- 조회수
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- 유니크 제약조건: 한 사용자당 하나의 프로필만
  UNIQUE(user_id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_job_seeker_profiles_user_id ON job_seeker_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_job_seeker_profiles_nationality ON job_seeker_profiles(nationality);
CREATE INDEX IF NOT EXISTS idx_job_seeker_profiles_visa_status ON job_seeker_profiles(visa_status);
CREATE INDEX IF NOT EXISTS idx_job_seeker_profiles_created_at ON job_seeker_profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_seeker_profiles_is_published ON job_seeker_profiles(is_published);

-- RLS (Row Level Security) 설정
ALTER TABLE job_seeker_profiles ENABLE ROW LEVEL SECURITY;

-- 정책: 모든 사용자가 공개된 프로필 읽기 가능
CREATE POLICY "Public profiles are viewable by everyone" 
  ON job_seeker_profiles FOR SELECT 
  USING (is_published = true);

-- 정책: 본인만 자신의 프로필 수정 가능
CREATE POLICY "Users can update own profile" 
  ON job_seeker_profiles FOR UPDATE 
  USING (auth.uid() = user_id);

-- 정책: 본인만 프로필 생성 가능
CREATE POLICY "Users can insert own profile" 
  ON job_seeker_profiles FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- 정책: 본인만 프로필 삭제 가능
CREATE POLICY "Users can delete own profile" 
  ON job_seeker_profiles FOR DELETE 
  USING (auth.uid() = user_id);

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_job_seeker_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS update_job_seeker_profile_updated_at ON job_seeker_profiles;
CREATE TRIGGER update_job_seeker_profile_updated_at
  BEFORE UPDATE ON job_seeker_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_job_seeker_profile_updated_at();

-- 조회수 증가 함수
CREATE OR REPLACE FUNCTION increment_profile_view_count(profile_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE job_seeker_profiles
  SET view_count = view_count + 1
  WHERE id = profile_id;
END;
$$ LANGUAGE plpgsql;

-- Storage bucket for profile images (선택사항 - Supabase Storage 사용 시)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true);



