-- 목록 화면용 본문 미리보기 컬럼
--
-- 배경: 게시판 목록이 select('*')로 jd.contents(본문 전체, 평균 714B = row의 73%)를
-- 전부 내려받으면서 화면에는 50~80자만 표시하고 있었다. 이로 인해 Supabase egress의
-- 97.8%가 PostgREST 응답으로 소모되어 무료 한도(5GB/월)를 초과했다.
--
-- 목록 쿼리는 이 컬럼을 contents:contents_preview 별칭으로 조회한다.
-- 생성 컬럼이므로 contents가 수정되면 자동 갱신되며, 글쓰기 코드는 변경할 필요가 없다.
-- 원본 contents는 상세 페이지와 검색(ilike)에서 그대로 사용한다.
--
-- 적용 결과: 목록 40건 응답 102.6KB -> 35.3KB (65.5% 절감)

alter table jd
  add column if not exists contents_preview text
  generated always as (left(contents, 100)) stored;
