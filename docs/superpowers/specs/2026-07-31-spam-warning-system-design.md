# 도배 경고·정지 시스템 설계

작성일: 2026-07-31
대상: 114114kr (Next.js Pages Router + Supabase)

## 1. 배경과 목표

채용공고를 반복 게재하거나 유사 공고 여러 건을 번갈아 끌어올리는 이용자가 있다.
현재는 운영자가 임의로 삭제하고 아무 통보도 하지 않아, 당사자는 버그로 오인하고 같은 행위를 반복한다.

목표는 세 가지다.

1. 도배 행위에 대해 누적 경고를 남기고, 당사자가 그 사실을 반드시 인지하게 한다.
2. 2회차에는 7일, 3회차에는 영구히 공고 등록을 제한한다.
3. 운영자가 누가 몇 회 경고를 받았는지, 왜 받았는지 언제든 확인할 수 있게 한다.

### 설계 원칙

- **자동 판정은 하지 않는다.** 시스템은 의심 후보만 제시하고, 경고 발송은 운영자의 클릭으로만 일어난다.
- **제목은 판정 근거가 아니다.** "생산직 급구" 같은 제목은 정상 공고끼리도 겹친다. 본문 내용이 기준이다.
- **차단은 데이터베이스에서 한다.** 화면에서만 막으면 우회된다.
- **경고 횟수는 당사자가 수정할 수 없어야 한다.** 현재 `users` 테이블은 본인 UPDATE가 열려 있다.

### 이번 범위에서 제외

- 이의 제기 기능 (문의는 기존 고객센터 경로 사용)
- 경고 횟수 자동 초기화 (누적만 하고, 필요 시 운영자가 수동 조정)
- 다른 지역 간 중복 판정 (지역이 다르면 도배로 보지 않는다)
- 자유게시판·구직정보 도배 (`board_type` 0 = 채용정보만 대상)

## 2. 용어

| 용어 | 의미 |
|---|---|
| 묶음(cluster) | 같은 작성자가 같은 구/군에 올린, 본문이 서로 유사한 공고들의 집합 |
| 후보(report) | 운영자 검토를 기다리는 묶음. `spam_reports` 한 행 |
| 경고(warning) | 운영자가 후보를 승인해 실제로 발송한 제재. `user_warnings` 한 행 |
| 회차(level) | 그 이용자의 누적 경고 순번. 1, 2, 3… |

## 3. 도배 판정 기준

### 3.1 본문 정규화

비교 전에 본문(`jd.contents`)을 다음 순서로 정리한다. 정규화 결과는 비교에만 쓰고 저장하지 않는다.

1. HTML 태그 제거
2. 전화번호 패턴 제거 (`010-1234-5678`, `01012345678`, `010 1234 5678`)
3. 숫자 제거 (급여·시간·인원 등 변동 값)
4. 이모지·장식 특수문자 제거
5. 연속 공백·줄바꿈을 공백 하나로 축약, 앞뒤 공백 제거

숫자를 지우는 이유는, 조건만 다르고 문장은 그대로인 재게재를 잡기 위해서다.
반대로 정말 다른 고객사라면 문장 구성 자체가 달라진다.

### 3.2 유사도

정규화된 본문끼리 `pg_trgm`의 `similarity()`로 비교한다. **임계값 0.80.**

이 값은 관찰 기간 동안 조정한다. `spam_reports.content_similarity`에 실제 값을 기록하므로,
운영자가 `dismissed` 처리한 후보들의 유사도 분포를 보면 적정선을 잡을 수 있다.

> pg_trgm은 문자 3-gram 기반이라 한국어에서도 동작하지만, 정형 문구 비중이 큰 공고에서
> 과다 검출될 수 있다. 관찰 기간에 오탐이 많으면 어절 단위 Jaccard 유사도로 교체한다.

### 3.3 묶음 구성

같은 `uploader_id` · 같은 `1depth_region` · 같은 `2depth_region` · `updated_time` 기준 30일 이내
공고들에 대해, 유사도 0.80 이상인 쌍을 간선으로 하는 그래프의 연결 요소를 묶음으로 본다.

**묶음 크기 3건 이상**일 때만 후보로 등록한다. `is_hidden = true`인 공고는 제외한다.

### 3.4 구분 신호

묶음 안의 공고들에 대해 다음 네 항목이 **전부 동일한지** 계산해 후보에 함께 기록한다.
판정 조건이 아니라 운영자의 판단 재료다.

| 신호 | 컬럼 | 의미 |
|---|---|---|
| 연락처 동일 | `contact_phone` | 다르면 서로 다른 고객사일 가능성이 높다. 가장 강한 신호 |
| 급여 동일 | `salary_type` + `salary_detail` | 조건이 같으면 같은 자리의 재게재 |
| 근무시간 동일 | `work_start_time` + `work_end_time` | 위와 같음 |
| 상세주소 동일 | `work_location_detail` | 같은 구라도 실제 사업장은 다를 수 있다 |

`contact_phone`은 미입력 시 작성자 전화번호로 채워지므로, 값이 서로 **다를 때만** 유의미하다.
같다고 해서 같은 고객사라는 근거는 되지 않는다. 운영자 화면에 이 점을 표기한다.

### 3.5 확신도

동일한 신호 개수로 3단계로 나눈다.

| 확신도 | 조건 |
|---|---|
| high | 4개 중 3개 이상 동일 |
| medium | 2개 동일 |
| low | 1개 이하 동일 |

`low`인 후보에는 "연락처와 급여가 모두 달라 서로 다른 고객사 공고일 가능성이 높습니다" 같은
안내 문구를 화면에 함께 띄워 빠르게 넘길 수 있게 한다.

### 3.6 끌어올리기 남용

3.3에서 만들어진 묶음을 그대로 쓴다. **한 묶음 안의 서로 다른 공고 3건 이상을 같은 날(KST) 끌어올린 경우**
`bump_abuse` 후보로 등록한다.

공고 하나를 하루 4회 끌어올리는 것은 정상 영업이므로 대상이 아니다.

끌어올리기는 현재 `jd.updated_time`을 덮어쓰기만 해서 이력이 남지 않는다. `jd_bump_log`를 새로 만들어
기록을 쌓아야 하며, **과거 이력은 소급할 수 없다.** 따라서 로그 테이블은 1단계에 먼저 넣는다.

## 4. 데이터 모델

기존 SQL 파일 규칙(`sql/add_*.sql`)을 따른다.

### 4.1 users 컬럼 추가

```sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS warning_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_permanently_blocked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_warning_count
  ON users (warning_count DESC) WHERE warning_count > 0;
```

JetAdmin 회원 목록에서 바로 정렬·필터할 수 있게 하기 위해 별도 테이블이 아니라 컬럼으로 둔다.

### 4.2 spam_reports — 검토 대기 후보

```sql
CREATE TABLE IF NOT EXISTS spam_reports (
  id                   BIGSERIAL PRIMARY KEY,
  uploader_id          UUID NOT NULL,
  kind                 TEXT NOT NULL CHECK (kind IN ('duplicate_posting','bump_abuse')),
  region_1depth        VARCHAR(20) NOT NULL,
  region_2depth        VARCHAR(30) NOT NULL,
  jd_ids               BIGINT[] NOT NULL,
  jd_count             INTEGER NOT NULL,
  content_similarity   NUMERIC(4,3) NOT NULL,
  same_contact         BOOLEAN NOT NULL DEFAULT FALSE,
  same_salary          BOOLEAN NOT NULL DEFAULT FALSE,
  same_worktime        BOOLEAN NOT NULL DEFAULT FALSE,
  same_location_detail BOOLEAN NOT NULL DEFAULT FALSE,
  confidence           TEXT NOT NULL CHECK (confidence IN ('high','medium','low')),
  cluster_key          TEXT NOT NULL,
  bump_date            DATE,
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','warned','dismissed')),
  reviewed_by          UUID,
  reviewed_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_spam_reports_cluster_open
  ON spam_reports (cluster_key) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_spam_reports_status
  ON spam_reports (status, created_at DESC);
```

`cluster_key`는 `kind` + 정렬된 `jd_ids` + `bump_date`의 해시다. 배치가 매일 돌아도
같은 묶음이 중복 등록되지 않게 한다. `dismissed` 처리된 묶음이 공고 추가로 커지면
`jd_ids`가 바뀌므로 새 후보로 다시 올라온다 — 의도된 동작이다.

### 4.3 user_warnings — 경고 이력

```sql
CREATE TABLE IF NOT EXISTS user_warnings (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID NOT NULL,
  level            INTEGER NOT NULL,
  kind             TEXT NOT NULL,
  report_id        BIGINT REFERENCES spam_reports(id) ON DELETE SET NULL,
  region_1depth    VARCHAR(20),
  region_2depth    VARCHAR(30),
  jd_count         INTEGER,
  hidden_jd_ids    BIGINT[],
  hidden_jd_titles TEXT[],
  bump_date        DATE,
  suspended_until  TIMESTAMPTZ,
  is_permanent     BOOLEAN NOT NULL DEFAULT FALSE,
  admin_note       TEXT,
  issued_by        UUID,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_warnings_unack
  ON user_warnings (user_id) WHERE acknowledged_at IS NULL;
```

`hidden_jd_titles`를 함께 저장하는 이유는, 팝업에서 "어떤 공고가 숨겨졌는지" 보여줘야 하는데
그 공고가 나중에 삭제되어도 문구가 깨지지 않게 하기 위해서다.

### 4.4 jd_bump_log — 끌어올리기 기록

```sql
CREATE TABLE IF NOT EXISTS jd_bump_log (
  id          BIGSERIAL PRIMARY KEY,
  jd_id       BIGINT NOT NULL,
  uploader_id UUID NOT NULL,
  bumped_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jd_bump_log_uploader_date
  ON jd_bump_log (uploader_id, bumped_at DESC);
```

### 4.5 RLS

```sql
ALTER TABLE spam_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE jd_bump_log   ENABLE ROW LEVEL SECURITY;
```

- `spam_reports` — 일반 정책 없음. 관리자 API가 service role로만 접근한다.
- `user_warnings` — 본인의 행에 한해 SELECT 허용. UPDATE·INSERT 정책은 두지 않는다
  (확인 처리는 5.3의 RPC로만).
- `jd_bump_log` — 본인 `uploader_id`에 한해 INSERT 허용. SELECT 정책은 두지 않는다.

```sql
CREATE POLICY user_warnings_select_own ON user_warnings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY jd_bump_log_insert_own ON jd_bump_log
  FOR INSERT TO authenticated WITH CHECK (uploader_id = auth.uid());
```

## 5. 처리 흐름

### 5.1 경고 발송 (issue_warning)

관리자 화면의 "경고 발송" 버튼이 호출하는 `SECURITY DEFINER` 함수다.
API 라우트가 관리자 여부를 확인한 뒤 service role로 호출한다.

```
issue_warning(p_report_id BIGINT, p_admin_id UUID) RETURNS user_warnings
```

동작 순서:

1. `app.moderation_ctx`를 `'on'`으로 설정한다 (5.4·6절의 보호 트리거를 통과하기 위해).
2. 후보를 `FOR UPDATE`로 잠그고 `status = 'pending'`인지 확인한다. 아니면 예외.
3. `users.warning_count`를 1 증가시키고 그 값을 `level`로 삼는다.
4. 회차별 제재를 적용한다.
   - `level = 1` → 제재 없음
   - `level = 2` → `suspended_until = NOW() + INTERVAL '7 days'`
   - `level >= 3` → `is_permanently_blocked = true`, `suspended_until = NULL`
5. `kind = 'duplicate_posting'`이면 묶음 안에서 **`updated_time`이 가장 이른 1건을 남기고**
   나머지를 `is_hidden = true`로 바꾼다. `kind = 'bump_abuse'`면 공고를 건드리지 않는다.
6. 숨긴 공고의 id와 제목을 담아 `user_warnings` 행을 만든다 (`acknowledged_at = NULL`).
7. 후보를 `status = 'warned'`, `reviewed_by`, `reviewed_at`으로 갱신한다.
8. 같은 이용자의 다른 `pending` 후보 중 `jd_ids`가 겹치는 것은 `dismissed` 처리한다
   (한 사건으로 두 번 경고하지 않기 위해).

전 과정이 하나의 트랜잭션이다.

### 5.2 후보 무시 (dismiss_report)

`status = 'dismissed'`, `reviewed_by`, `reviewed_at`만 기록한다. 다른 부수 효과는 없다.

### 5.3 경고 확인 (acknowledge_warning)

```
acknowledge_warning(p_warning_id BIGINT) RETURNS void
```

`SECURITY DEFINER`. `auth.uid()`가 해당 경고의 `user_id`와 같을 때만 `acknowledged_at = NOW()`를 기록한다.
사용자가 `user_warnings`를 직접 UPDATE할 수 없게 하기 위해 RPC로만 열어둔다.

### 5.4 경고 컬럼 보호

`users`에는 `users_self_update` 정책이 있어 본인이 자기 행을 수정할 수 있다.
경고 관련 컬럼만 되돌리는 `BEFORE UPDATE` 트리거를 건다.

```sql
CREATE OR REPLACE FUNCTION protect_moderation_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.moderation_ctx', true), '') <> 'on' THEN
    NEW.warning_count          := OLD.warning_count;
    NEW.suspended_until        := OLD.suspended_until;
    NEW.is_permanently_blocked := OLD.is_permanently_blocked;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER users_protect_moderation
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION protect_moderation_columns();
```

`issue_warning`과 관리자 수동 조정만 `app.moderation_ctx`를 켠다.
service role이라도 이 플래그 없이는 값을 바꿀 수 없으므로, 실수로 인한 변경도 함께 막힌다.

## 6. 공고 등록 차단

`jd`에 `BEFORE INSERT OR UPDATE` 트리거를 건다. RLS는 건드리지 않아 기존 동작에 영향이 없다.

```sql
CREATE OR REPLACE FUNCTION enforce_posting_suspension()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE u RECORD;
BEGIN
  IF coalesce(current_setting('app.moderation_ctx', true), '') = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.updated_time IS NOT DISTINCT FROM OLD.updated_time
     AND NEW.title        IS NOT DISTINCT FROM OLD.title
     AND NEW.contents     IS NOT DISTINCT FROM OLD.contents THEN
    RETURN NEW;
  END IF;

  SELECT suspended_until, is_permanently_blocked INTO u
    FROM users WHERE id = NEW.uploader_id;

  IF u.is_permanently_blocked THEN
    RAISE EXCEPTION 'POSTING_BLOCKED_PERMANENT';
  END IF;

  IF u.suspended_until IS NOT NULL AND u.suspended_until > NOW() THEN
    RAISE EXCEPTION 'POSTING_SUSPENDED_UNTIL:%',
      to_char(u.suspended_until AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI');
  END IF;

  RETURN NEW;
END $$;
```

**조회수 갱신은 통과시켜야 한다.** `increment_view_count` RPC와 `jd_view_log` 체류시간 갱신은
`updated_time`·`title`·`contents`를 바꾸지 않으므로 위 두 번째 조건에서 걸러진다.
이 조건이 없으면 정지된 이용자의 공고를 아무도 열람할 수 없게 된다.

`is_hidden`만 바꾸는 운영자 작업도 같은 조건으로 통과한다.

### 화면 쪽 처리

`writeComponent.tsx`(등록·수정)와 `Mylist.tsx`(끌어올리기)에서 위 예외 메시지를 잡아
사용자에게 안내한다. 정지 상태면 애초에 버튼을 비활성화하고 사유를 보여주되,
DB 트리거가 최종 방어선이다.

## 7. 감지 배치

`src/pages/api/cron/detect-spam.ts` — 기존 `cron/refresh-premium.ts` 패턴을 따른다.
`vercel.json`에 매일 03:00 KST 실행으로 등록한다.

동작:

1. 최근 30일 이내, `board_type = '0'`, `is_hidden = false`인 공고를 작성자·지역별로 조회한다.
2. 작성자가 같은 지역에 3건 이상 올린 그룹만 남긴다 (그 외는 애초에 후보가 될 수 없다).
3. 각 그룹에서 본문을 정규화하고 쌍별 유사도를 계산해 묶음을 만든다.
4. 크기 3 이상인 묶음마다 구분 신호와 확신도를 계산해 `spam_reports`에 넣는다.
   `cluster_key` 유니크 인덱스가 중복 등록을 막는다.
5. 같은 묶음들에 대해 `jd_bump_log`를 조회해, 하루에 3건 이상 끌어올린 날이 있으면
   `bump_abuse` 후보를 추가로 넣는다.

유사도 계산은 Postgres RPC(`detect_duplicate_clusters`)로 내려 pg_trgm을 쓴다.
전체 본문을 Node로 끌어오지 않는다.

배치가 실패해도 서비스에는 영향이 없다. 실패 시 로그만 남긴다.

## 8. 관리자 페이지

경로 `/admin`. 접근 제어는 기존 `users.is_admin`을 재사용한다 (방장 채널에서 이미 쓰고 있다).

`getServerSideProps`에서 세션의 `is_admin`을 확인하고, 아니면 `/board`로 리다이렉트한다.
데이터는 전부 API 라우트를 통해서만 오간다.

### 8.1 화면 구성

**요약** — 검토 대기 건수, 이번 달 발송한 경고 수, 현재 정지 중인 계정 수.

**검토 대기 목록** — 후보 한 건이 카드 하나다. 확신도 높은 순, 같은 확신도 안에서는 최신 순.

카드에 담기는 것:

- 작성자명 · 지역 · 공고 건수 · 누적 경고 횟수 · 등록 기간
- 확신도 배지
- 구분 신호 배지 4개 (동일/다름을 색으로 구분)
- 공고 본문 나란히 비교. **겹치는 문장과 다른 문장을 서로 다른 배경색으로 표시한다.**
  기본 2건을 펼쳐 보여주고 나머지는 접어둔다
- 확신도가 `low`면 "연락처와 급여가 모두 달라 서로 다른 고객사 공고일 가능성이 높습니다" 안내
- 발송 결과 미리보기 — "경고 시 2회차 · 8월 7일까지 7일 제한"
- 버튼: 경고 발송 / 무시

3회차 영구 제한이 되는 경우에는 발송 전에 한 번 더 확인을 받는다.

문장 단위 비교는 정규화된 본문을 마침표·줄바꿈으로 쪼개 집합 연산으로 처리한다.
서버에서 계산해 내려보낸다.

**회원 조회** — 이름·아이디·전화번호로 검색해 누적 경고 횟수와 이력을 본다.
자동 감지에 걸리지 않은 도배를 발견했을 때 직접 경고를 발송하는 경로이기도 하다
(사유와 대상 공고를 직접 지정).

### 8.2 API 라우트

모두 service role을 쓰며, 요청자의 `is_admin`을 먼저 확인한다.

| 라우트 | 용도 |
|---|---|
| `GET /api/admin/spam-reports` | 후보 목록. 공고 본문과 문장 비교 결과를 포함 |
| `POST /api/admin/spam-reports/warn` | `issue_warning` 호출 |
| `POST /api/admin/spam-reports/dismiss` | `dismiss_report` 호출 |
| `GET /api/admin/users` | 회원 검색 + 경고 이력 |
| `POST /api/admin/warnings` | 수동 경고 발송 |

## 9. 사용자 알림 팝업

`UserProvider`에 이미 `AcceptApprovedModal`을 띄우는 구조가 있다. 같은 자리에 붙인다.

프로필 조회 시 `user_warnings`에서 `acknowledged_at IS NULL`인 가장 최근 행을 함께 가져와,
있으면 `SpamWarningModal`을 띄운다. 확인 버튼을 누르면 `acknowledge_warning` RPC를 호출한다.

**닫기 수단은 확인 버튼뿐이다.** X 버튼, 배경 클릭, ESC 모두 막는다.
미확인 경고가 여러 건이면 오래된 것부터 하나씩 보여준다.

### 회차별 문구

| 회차 | 배지 | 제목 |
|---|---|---|
| 1 | 1차 경고 | 도배성 공고 등록으로 경고를 받았습니다 |
| 2 | 2차 경고 · 7일 제한 | 공고 등록이 7일간 제한됩니다 |
| 3+ | 3차 경고 · 영구 제한 | 공고 등록이 영구히 제한되었습니다 |

본문은 **왜 걸렸는지만** 적는다. 도배 기준을 설명하거나 훈계하지 않는다.

- 중복 게재: "경기 수원시에 내용이 거의 같은 채용공고를 4건 등록하셨습니다.
  가장 먼저 올린 1건만 남기고 나머지는 숨김 처리했습니다."
- 끌어올리기: "경기 수원시에 등록하신 내용이 거의 같은 공고 5건을 8월 1일 하루 동안 번갈아 끌어올리셨습니다."

1차에는 다음 단계 안내를 한 줄 넣는다. 2차에는 제한 해제 일시와 누적 횟수, 그리고
막히는 것(등록·수정·끌어올리기)과 되는 것(로그인·기존 공고 열람·지원자 확인)을 구분해 보여준다.
3차에는 전체 경고 이력과 고객센터 안내를 넣는다.

## 10. 구현 순서

### 1단계 — 기반과 수동 운영

자동 감지 없이도 경고를 주고받을 수 있는 상태까지 만든다.

- 테이블·컬럼·RLS (4절)
- `issue_warning` / `dismiss_report` / `acknowledge_warning` (5절)
- 경고 컬럼 보호 트리거, 공고 차단 트리거 (5.4·6절)
- **`jd_bump_log` 기록 시작** — `Mylist.tsx`·`ResumeList.tsx`의 끌어올리기에 INSERT 추가.
  3단계에서 쓸 데이터가 지금부터 쌓여야 한다
- `/admin` 페이지 뼈대 + 회원 조회 + 수동 경고
- `SpamWarningModal` + `UserProvider` 연동
- 등록·수정·끌어올리기 화면의 정지 안내

### 2단계 — 중복 게재 자동 감지

- `detect_duplicate_clusters` RPC (pg_trgm)
- `api/cron/detect-spam.ts` + `vercel.json` 등록
- `/admin` 검토 대기 목록 + 본문 비교 화면

여기까지 오면 후보가 자동으로 쌓인다. **첫 2주는 경고를 발송하지 않고 후보만 관찰해
유사도 0.80이 적절한지 확인한다.**

### 3단계 — 끌어올리기 남용 감지

`jd_bump_log`가 2~3주치 쌓인 뒤 착수한다.

- 배치에 `bump_abuse` 판정 추가
- 관리자 화면에 끌어올리기 후보 표시

## 11. 검증 방법

- `pg_trgm` 임계값: 운영 데이터로 실제 도배 사례와 정상 다중 게재 사례를 각각 골라
  유사도를 측정하고, 두 분포가 0.80에서 갈리는지 확인한다.
- 경고 컬럼 보호: 일반 사용자 세션으로 `users.warning_count` UPDATE를 시도해 값이 그대로인지 확인한다.
- 공고 차단: 정지 상태 계정으로 등록·수정·끌어올리기를 시도해 각각 막히는지,
  같은 상태에서 공고 조회수가 정상 증가하는지 확인한다.
- 팝업: 미확인 경고가 있는 계정으로 로그인해 팝업이 뜨는지, 확인 후 재접속 시 다시 뜨지 않는지,
  미확인 경고 2건이면 순차로 뜨는지 확인한다.
- 중복 경고 방지: 같은 묶음에 대해 경고를 발송한 뒤, 겹치는 다른 후보가 `dismissed`되는지 확인한다.

## 12. 미결 사항

- 유사도 임계값 0.80은 관찰 기간의 실측으로 확정한다.
- `pg_trgm`이 한국어 공고에서 과다 검출되면 어절 단위 Jaccard로 교체한다. 교체 시
  `spam_reports.content_similarity`의 의미가 바뀌므로 기존 후보는 초기화한다.
- 영구 제한 계정의 이의 제기 처리 절차는 정하지 않았다. 현재는 운영자가 JetAdmin에서
  `is_permanently_blocked`와 `warning_count`를 직접 조정하는 것으로 갈음한다.
