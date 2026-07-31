import React, { useEffect, useRef, useCallback } from 'react';
import styles from '@/styles/SpamWarningModal.module.css';

export interface SpamWarning {
  id: number;
  level: number;
  kind: 'duplicate_posting' | 'bump_abuse' | 'manual';
  /** 운영자가 직접 경고할 때 적어 넣은 사유. kind='manual' 에서만 쓴다 */
  reason_text?: string | null;
  region_1depth: string | null;
  region_2depth: string | null;
  jd_count: number | null;
  hidden_jd_titles: string[] | null;
  bump_date: string | null;
  suspended_until: string | null;
  is_permanent: boolean;
  created_at: string;
  history?: { level: number; kind: string; created_at: string }[];
}

interface Props {
  warning: SpamWarning;
  onConfirm: () => void;
}

/** ISO 날짜 문자열 → "2026년 8월 7일 15:20" (KST) */
function formatKST(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** "2026-08-01" 또는 ISO → "8월 1일" */
function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
  });
}

/** ISO → "2026년 6월 3일" (경고 이력은 시:분까지 필요 없다) */
function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** 경고 이력 종류 한글 */
function kindLabel(kind: string): string {
  if (kind === 'bump_abuse') return '끌어올리기 남용';
  if (kind === 'manual') return '운영자 조치';
  return '중복 게재';
}

/** 숨김 처리된 공고 제목을 최대 몇 건까지 보여줄지 — 나머지는 "외 N건" */
const MAX_VISIBLE_HIDDEN_TITLES = 3;

function buildBodyText(warning: SpamWarning): string {
  const { kind, level, region_1depth, region_2depth, jd_count, bump_date } = warning;

  const region = [region_1depth, region_2depth].filter(Boolean).join(' ');

  let reason: string;
  if (kind === 'manual') {
    // 운영자가 직접 쓴 사유를 그대로 보여준다
    reason =
      warning.reason_text?.trim() ||
      '운영 정책에 어긋나는 방식으로 채용공고를 등록하셨습니다.';
  } else if (kind === 'duplicate_posting') {
    const regionPart = region ? `${region}에 ` : '';
    const countPart = jd_count != null ? `${jd_count}건 ` : '';
    reason = `${regionPart}내용이 거의 같은 채용공고를 ${countPart}등록하셨습니다.`;
  } else {
    const regionPart = region ? `${region}에 등록하신 ` : '';
    const countPart = jd_count != null ? `${jd_count}건을 ` : '';
    const datePart = bump_date ? `${formatDateShort(bump_date)} 하루 동안 ` : '';
    reason = `${regionPart}내용이 거의 같은 공고 ${countPart}${datePart}번갈아 끌어올리셨습니다.`;
  }

  // 영구 제한은 후보 종류와 무관하게 이 회원의 공고를 전부 내린다
  if (level >= 3) {
    return `${reason} 등록하신 채용공고는 모두 숨김 처리되었습니다.`;
  }

  if (kind === 'duplicate_posting') {
    return `${reason} 가장 최근에 올린 1건만 남기고 나머지는 숨김 처리했습니다.`;
  }

  if (kind === 'manual' && (warning.hidden_jd_titles?.length ?? 0) > 0) {
    return `${reason} 아래 공고는 숨김 처리했습니다.`;
  }

  return reason;
}

const SpamWarningModal: React.FC<Props> = ({ warning, onConfirm }) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { level, suspended_until, is_permanent, hidden_jd_titles, history } = warning;

  // 마운트 시 확인 버튼에 초기 포커스
  useEffect(() => {
    confirmBtnRef.current?.focus();
  }, []);

  // 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 포커스 트랩
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      return; // ESC 닫기 금지
    }
    if (e.key !== 'Tab') return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  const isLevel1 = level === 1;
  const isLevel2 = level === 2;
  const isLevel3Plus = level >= 3;

  const accentClass = isLevel1 ? styles.accentWarning : styles.accentError;

  // 배지 텍스트
  const badgeText = isLevel1
    ? '1차 경고'
    : isLevel2
    ? '2차 경고'
    : `${level}차 경고`;

  // 제한 부배지
  const restrictBadge = isLevel2
    ? '7일 제한'
    : isLevel3Plus
    ? '영구 제한'
    : null;

  // 제목
  const title = isLevel1
    ? '도배성 공고 등록으로 경고를 받았습니다'
    : isLevel2
    ? '공고 등록이 7일간 제한됩니다'
    : '공고 등록이 영구히 제한되었습니다';

  const titleId = 'spam-warning-title';
  const bodyText = buildBodyText(warning);

  return (
    <div className={styles.overlay}>
      <div
        className={`${styles.modal} ${accentClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        onKeyDown={handleKeyDown}
      >
        {/* 헤더 밴드 */}
        <div className={styles.headerBand}>
          <div className={styles.iconWrap} aria-hidden="true">
            {isLevel1 ? (
              // 경고 삼각형
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.icon}>
                <path
                  d="M12 9v4m0 3.5v.5M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              // 정지 원
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.icon}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M4.93 4.93l14.14 14.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div className={styles.badges}>
            <span className={styles.levelBadge}>{badgeText}</span>
            {restrictBadge && (
              <span className={styles.restrictBadge}>{restrictBadge}</span>
            )}
          </div>
        </div>

        {/* 본문 영역 */}
        <div className={styles.body}>
          <h2 id={titleId} className={styles.title}>{title}</h2>

          {/* 이유 박스 */}
          <div className={styles.reasonBox}>
            <p className={styles.reasonText}>{bodyText}</p>
          </div>

          {/* 숨긴 공고 목록 — 많으면 앞의 몇 건만 보이고 나머지는 "외 N건".
              영구 제한은 끌어올리기 남용으로 받아도 공고가 숨겨지므로 종류로 가르지 않는다. */}
          {hidden_jd_titles &&
            hidden_jd_titles.length > 0 && (
              <div className={styles.hiddenListWrap}>
                <p className={styles.hiddenListLabel}>
                  숨김 처리된 공고 {hidden_jd_titles.length}건
                </p>
                <ul className={styles.hiddenList}>
                  {hidden_jd_titles.slice(0, MAX_VISIBLE_HIDDEN_TITLES).map((title, i) => (
                    <li key={i} className={styles.hiddenListItem}>
                      <span className={styles.hiddenListDot} aria-hidden="true" />
                      {title}
                    </li>
                  ))}
                </ul>
                {hidden_jd_titles.length > MAX_VISIBLE_HIDDEN_TITLES && (
                  <p className={styles.hiddenListMore}>
                    외 {hidden_jd_titles.length - MAX_VISIBLE_HIDDEN_TITLES}건
                  </p>
                )}
              </div>
            )}

          {/* 1차 전용: 다음 단계 안내 */}
          {isLevel1 && (
            <p className={styles.nextStepNote}>
              2회차 경고 시 7일간 공고 등록이 제한되며, 3회차에는 영구 제한됩니다.
            </p>
          )}

          {/* 2차 전용: 제한 내용 + 해제 일시 */}
          {isLevel2 && (
            <div className={styles.restrictionBlock}>
              {suspended_until && (
                <div className={styles.restrictionUntil}>
                  <span className={styles.restrictionUntilLabel}>제한 해제</span>
                  <span className={styles.restrictionUntilValue}>{formatKST(suspended_until)}</span>
                </div>
              )}
              <div className={styles.restrictionGrid}>
                <div className={styles.restrictionCol}>
                  <p className={styles.restrictionColTitle}>제한되는 기능</p>
                  <ul className={styles.restrictionList}>
                    <li>채용공고 등록</li>
                    <li>채용공고 수정</li>
                    <li>공고 끌어올리기</li>
                  </ul>
                </div>
                <div className={styles.restrictionCol}>
                  <p className={styles.restrictionColTitle}>계속 이용 가능</p>
                  <ul className={styles.restrictionList}>
                    <li>로그인</li>
                    <li>기존 공고 열람</li>
                    <li>지원자 확인</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* 3차 이상: 이력 + 고객센터 */}
          {isLevel3Plus && (
            <>
              {history && history.length > 0 && (
                <div className={styles.historyBlock}>
                  <p className={styles.historyLabel}>경고 이력</p>
                  <ul className={styles.historyList}>
                    {history.map((h, i) => (
                      <li key={i} className={styles.historyItem}>
                        <span className={styles.historyLevel}>{h.level}차</span>
                        <span className={styles.historyKind}>{kindLabel(h.kind)}</span>
                        <span className={styles.historyDate}>{formatDateOnly(h.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className={styles.contactBox}>
                <p className={styles.contactText}>
                  제한 사유에 이의가 있으시면 고객센터로 문의해 주십시오.
                </p>
                <a
                  className={styles.contactLink}
                  href="https://pf.kakao.com/_ywaMn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  고객센터 바로가기
                </a>
              </div>
            </>
          )}
        </div>

        {/* 확인 버튼 */}
        <div className={styles.footer}>
          <button
            ref={confirmBtnRef}
            type="button"
            className={`${styles.confirmButton} ${isLevel1 ? styles.confirmWarning : styles.confirmError}`}
            onClick={onConfirm}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpamWarningModal;
