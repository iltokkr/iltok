// 공고 제목 작성 안내 — 제목 입력란 밑에 접혀 있다가 눌러서 펼친다.
//
// 수치 출처: 잡코리아 「지원율을 높이는 채용공고 작성 가이드」(2026, 채용공고 31,063건 분석).
// 그대로 옮기지 않고 이 사이트 맥락에 맞춰 걸렀다.
//   - 잡코리아는 사무직 기준이라 "10자 내외"를 권하지만, 여기 공고는 평균 34자다.
//     지역·근무형태를 빼라고 할 수는 없으므로 "짧을수록 유리"라는 방향만 전한다.
//   - 급여·근무시간·기숙사는 아래에 별도 입력란이 있다. 제목에 또 넣을 필요가 없다는 점이
//     이 사이트에서 제목을 줄일 수 있는 가장 현실적인 방법이라 맨 앞에 놓았다.

import React, { useState } from 'react';
import styles from '@/styles/TitleGuide.module.css';

interface Props {
  /** 지금 입력된 제목. 길이에 따라 한 줄짜리 힌트를 바꾼다 */
  title: string;
}

/** 규칙 앞에 붙는 체크 표시 */
const CheckIcon = () => (
  <svg
    className={styles.ruleIcon}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/** 길이에 따라 지금 이 제목이 어느 구간인지 알려준다 */
function lengthHint(len: number): { text: string; tone: 'good' | 'ok' | 'warn' } | null {
  if (len === 0) return null;
  if (len <= 15) return { text: '좋습니다. 짧은 제목이 가장 많이 눌립니다', tone: 'good' };
  if (len <= 25) return { text: '적당합니다', tone: 'ok' };
  return { text: '조금 깁니다. 급여·시간·기숙사는 아래 입력란에 따로 있습니다', tone: 'warn' };
}

const TitleGuide: React.FC<Props> = ({ title }) => {
  const [open, setOpen] = useState(false);
  const len = title.trim().length;
  const hint = lengthHint(len);
  const hasBracket = /[[\]()（）【】]/.test(title);

  return (
    <div className={styles.wrap}>
      {/* 입력 중에는 한 줄 힌트만 조용히 보여준다 */}
      {hint && (
        <p className={`${styles.liveHint} ${styles[hint.tone]}`}>
          {hint.text}
          {hasBracket && ' · 괄호 강조는 오히려 조회수를 낮춥니다'}
        </p>
      )}

      <button
        type="button"
        className={styles.toggle}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className={styles.toggleIcon} aria-hidden="true">
          {open ? '−' : '+'}
        </span>
        제목을 어떻게 써야 지원자가 더 많이 볼까요?
      </button>

      {open && (
        <div className={styles.panel}>
          <ul className={styles.rules}>
            <li>
              <CheckIcon />
              <div className={styles.ruleBody}>
                <strong>급여 · 근무시간 · 기숙사는 제목에서 빼세요.</strong>
                <span className={styles.desc}>
                  아래에 따로 입력란이 있고, 목록과 검색에서 그 값으로 보여집니다.
                  제목에 또 적으면 길어지기만 합니다.
                </span>
              </div>
            </li>
            <li>
              <CheckIcon />
              <div className={styles.ruleBody}>
                <strong>짧을수록 많이 눌립니다.</strong>
                <span className={styles.desc}>
                  제목이 짧은 공고가 조회수 <b className={styles.up}>24% 높고</b> 지원도{' '}
                  <b className={styles.up}>35% 많습니다</b>. 길어질수록 지원이 줄어듭니다.
                </span>
              </div>
            </li>
            <li>
              <CheckIcon />
              <div className={styles.ruleBody}>
                <strong>대괄호 강조는 역효과입니다.</strong>
                <span className={styles.desc}>
                  <code>[급구]</code> <code>[대기업]</code> 같은 강조를 넣은 공고가 오히려 조회수
                  <b className={styles.down}> 낮습니다</b>. 눈에 띄려다 오히려 광고처럼 보입니다.
                </span>
              </div>
            </li>
            <li>
              <CheckIcon />
              <div className={styles.ruleBody}>
                <strong>지역과 하는 일을 앞에 두세요.</strong>
                <span className={styles.desc}>
                  구직자가 가장 먼저 찾는 정보입니다. 그 뒤에 근무형태 정도만 붙이면 충분합니다.
                </span>
              </div>
            </li>
          </ul>

          <div className={styles.example}>
            <div className={styles.exRow}>
              <span className={`${styles.exTag} ${styles.exWorst}`}>클릭수 최저</span>
              <span className={styles.exBadText}>
                [상여금 빵빵][주간고정 월 330만]통근운행/친구와함께 근무가능
              </span>
            </div>
            <div className={styles.exRow}>
              <span className={`${styles.exTag} ${styles.exBad}`}>과한 정보</span>
              <span className={styles.exBadText}>
                [아산인주면] 자동차물류관리 서열파트 주간2교대 모집 월평균 330
              </span>
            </div>
            <div className={styles.exRow}>
              <span className={`${styles.exTag} ${styles.exGood}`}>조회수 높음</span>
              <span className={styles.exGoodText}>아산 자동차부품 생산직 2교대</span>
            </div>
          </div>

          <p className={styles.source}>
            잡코리아 채용공고 31,063건 분석 결과 (2026)
          </p>
        </div>
      )}
    </div>
  );
};

export default TitleGuide;
