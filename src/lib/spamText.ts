// 도배 판정용 본문 정규화 · 문장 비교
//
// 설계 문서 3.1 의 정규화 규칙을 그대로 구현한다.
//   1. HTML 태그 제거
//   2. 전화번호 패턴 제거
//   3. 숫자 제거
//   4. 이모지·장식 특수문자 제거
//   5. 연속 공백·줄바꿈을 공백 하나로 축약, 앞뒤 공백 제거
//
// 관리자 화면의 문장 단위 비교(1단계)와 자동 감지 배치(2단계)가 같은 규칙을 써야 하므로
// 여기 한 곳에만 둔다. 정규화 결과는 비교에만 쓰고 저장하지 않는다.

/** HTML 을 사람이 읽는 평문으로. 줄바꿈 태그는 개행으로 살린다 */
export const stripHtml = (raw: string): string =>
  (raw || '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&amp;/gi, '&');

// 010-1234-5678 / 01012345678 / 010 1234 5678 / 02-123-4567
const PHONE_PATTERN = /0\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{4}/g;

// 이모지는 대부분 astral plane(서로게이트 쌍)에 있다.
const SURROGATE_PAIR = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;

// BMP 안의 장식 문자 — 특수 공백, 화살표, 도형, 별표, 딩벳, 원문자,
// CJK 구두점, 이모지 변이 선택자, 전각 기호.
// 한글(AC00~D7AF)·한자·영문은 건드리지 않는다.
// 정규식 리터럴 대신 문자열로 조립해 각 구간이 무엇인지 읽히게 둔다.
const BMP_DECORATION = new RegExp(
  '[' +
    '\\u2000-\\u206F' + // 일반 구두점·특수 공백
    '\\u2190-\\u21FF' + // 화살표
    '\\u2300-\\u23FF' + // 기술 기호
    '\\u2460-\\u24FF' + // 원문자
    '\\u25A0-\\u27BF' + // 도형·기타 기호·별표·딩벳
    '\\u2B00-\\u2BFF' + // 추가 화살표·도형
    '\\u3000-\\u303F' + // CJK 구두점
    '\\uFE00-\\uFE0F' + // 이모지 변이 선택자
    '\\uFF01-\\uFF0F\\uFF1A-\\uFF20\\uFF3B-\\uFF40\\uFF5B-\\uFF65' + // 전각 기호
    ']',
  'g'
);

/**
 * 비교용 정규화. HTML 은 이미 제거된 평문이 들어온다고 가정한다.
 * (원본 HTML 이라면 normalizeContents 를 써라)
 *
 * keepDigits 옵션이 쓰임새를 가른다.
 *   false(기본) — 숫자·전화번호를 지운다. 조건만 바꿔 재게재한 도배를 잡아야 하는
 *                 **자동 감지**용. "일당 150,000원"과 "일당 130,000원"이 같은 문장이 된다.
 *   true        — 숫자를 남긴다. 운영자가 두 공고의 **차이를 눈으로 찾는** 관리자 화면용.
 *                 급여·연락처가 다르면 다른 고객사일 가능성이 높다는 게 판단의 핵심 근거라,
 *                 여기서 숫자를 지우면 정작 봐야 할 차이가 가려진다.
 */
export const normalizeForCompare = (
  text: string,
  opts?: { keepDigits?: boolean }
): string => {
  const base = text || '';
  const stripped = opts?.keepDigits
    ? base
    : base.replace(PHONE_PATTERN, ' ').replace(/[0-9０-９]/g, '');
  return stripped
    .replace(SURROGATE_PAIR, '')
    .replace(BMP_DECORATION, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

/** 원본 본문(HTML 포함)을 비교용 문자열로 */
export const normalizeContents = (raw: string): string =>
  normalizeForCompare(stripHtml(raw));

/** 본문을 문장 단위로 쪼갠다. 기준은 마침표·물음표·느낌표·줄바꿈 */
export const splitSentences = (raw: string): string[] =>
  stripHtml(raw)
    .split(/[.!?\n\r]+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0);

/**
 * 정규화된 두 본문의 어절 단위 자카드 유사도 (0~1).
 *
 * 자동 감지(2단계)는 Postgres 의 pg_trgm 을 쓰지만, 관리자 화면은 이미 가져온 본문을
 * 그 자리에서 묶어 보여줘야 해서 JS 쪽에도 계산이 필요하다.
 * 정확한 수치보다 "이 공고들이 서로 비슷한가"를 가르는 용도라 어절 집합 비교로 충분하다.
 */
export const jaccardSimilarity = (aRaw: string, bRaw: string): number => {
  const toSet = (s: string) =>
    new Set(normalizeContents(s).split(' ').filter((w) => w.length > 1));
  const a = toSet(aRaw);
  const b = toSet(bRaw);
  if (a.size === 0 || b.size === 0) return 0;

  let shared = 0;
  a.forEach((w) => {
    if (b.has(w)) shared += 1;
  });
  return shared / (a.size + b.size - shared);
};

/**
 * 한 회원의 공고들을 "같은 지역 + 내용이 비슷한 것"끼리 묶어 그룹 번호를 매긴다.
 * 2건 이상 묶인 것만 번호를 받고, 나머지는 null 이다.
 *
 * 운영자가 공고 제목만 보고는 중복인지 알 수 없으므로, 화면이 이 번호로
 * "이 5건이 서로 비슷합니다" 를 먼저 짚어주기 위한 것이다. 판단은 사람이 한다.
 */
export const groupSimilarPosts = (
  posts: { id: number; region: string; contents: string }[],
  // 0.80 은 실제 데이터로 정한 값이다. 0.6~0.7 에서는 정형 문구만 겹치는 서로 다른 일자리가
  // 연쇄적으로 이어져 한 덩어리(11건)가 됐고, 0.8 부터 묶음이 2~4건으로 줄어 실제 중복만 남았다.
  threshold = 0.8
): Map<number, number> => {
  const result = new Map<number, number>();

  // 지역이 다르면 도배로 보지 않으므로 애초에 같은 지역끼리만 비교한다
  const byRegion = new Map<string, typeof posts>();
  for (const p of posts) {
    const list = byRegion.get(p.region);
    if (list) list.push(p);
    else byRegion.set(p.region, [p]);
  }

  let groupNo = 0;

  byRegion.forEach((list) => {
    if (list.length < 2) return;

    // 유사한 쌍을 이어붙여 연결 요소를 만든다
    const parent = new Map<number, number>(list.map((p) => [p.id, p.id]));
    const find = (x: number): number => {
      let root = x;
      while (parent.get(root) !== root) root = parent.get(root)!;
      return root;
    };
    const union = (x: number, y: number) => {
      const rx = find(x);
      const ry = find(y);
      if (rx !== ry) parent.set(rx, ry);
    };

    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        if (jaccardSimilarity(list[i].contents, list[j].contents) >= threshold) {
          union(list[i].id, list[j].id);
        }
      }
    }

    const members = new Map<number, number[]>();
    for (const p of list) {
      const root = find(p.id);
      const arr = members.get(root);
      if (arr) arr.push(p.id);
      else members.set(root, [p.id]);
    }

    members.forEach((ids) => {
      if (ids.length < 2) return;
      groupNo += 1;
      for (const id of ids) result.set(id, groupNo);
    });
  });

  return result;
};

/**
 * 여러 공고의 본문을 받아, 각 문장이 묶음 안의 다른 공고에도 나오는지(shared) 표시한다.
 * 반환 배열의 순서는 입력 순서와 같다.
 *
 * 정규화 결과가 빈 문자열인 문장(숫자·기호만 있는 줄)은 비교 근거가 없으므로 shared 로 보지 않는다.
 * 한 공고 안에서만 반복되는 문장도 shared 가 아니다 — 다른 공고에 있을 때만 shared 다.
 *
 * 관리자 화면은 keepDigits=true 로 부른다. 급여·인원처럼 숫자만 다른 문장을 "같다"고
 * 칠해버리면 운영자가 봐야 할 차이가 가려지기 때문이다.
 */
export const markSharedSentences = (
  contentsList: string[],
  opts?: { keepDigits?: boolean }
): { text: string; shared: boolean }[][] => {
  const perPost = contentsList.map((c) => splitSentences(c));

  // 정규화 문장 → 그 문장이 등장한 공고 인덱스 집합
  const owners = new Map<string, Set<number>>();
  perPost.forEach((sentences, idx) => {
    sentences.forEach((s) => {
      const key = normalizeForCompare(s, opts);
      if (!key) return;
      const set = owners.get(key);
      if (set) set.add(idx);
      else owners.set(key, new Set([idx]));
    });
  });

  return perPost.map((sentences) =>
    sentences.map((text) => {
      const key = normalizeForCompare(text, opts);
      const set = key ? owners.get(key) : undefined;
      return { text, shared: !!set && set.size > 1 };
    })
  );
};
