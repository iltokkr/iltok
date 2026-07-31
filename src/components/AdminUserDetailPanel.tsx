// 관리자 회원 상세 패널 — 회원 목록에서 누른 행 바로 아래에 펼쳐진다.
//
// 이 화면의 목적은 하나다: 운영자가 "이게 도배가 맞나"를 판단하고 경고를 보내는 것.
// 제목만 봐서는 판단할 수 없으므로
//   (1) 같은 지역 + 내용이 비슷한 공고를 미리 묶어 보여주고
//   (2) 고른 공고의 본문을 나란히 놓아 겹치는 문장을 색으로 짚어준다.

import React, { useMemo, useState } from 'react';
import type { AdminUserDetail } from '@/types/admin';
import { markSharedSentences } from '@/lib/spamText';
import { formatKST, formatDateShort, kindLabel, formatSanctionPreview } from '@/lib/adminFormat';
import styles from '@/styles/Admin.module.css';

interface Props {
  detail: AdminUserDetail | null;
  loading: boolean;
  selectedJdIds: number[];
  onToggleJd: (id: number) => void;
  onSelectMany: (ids: number[]) => void;
  reason: string;
  onReasonChange: (v: string) => void;
  adminNote: string;
  onAdminNoteChange: (v: string) => void;
  processing: boolean;
  onWarn: () => void;
  onClose: () => void;
  fallbackName: string;
}

const AdminUserDetailPanel: React.FC<Props> = ({
  detail,
  loading,
  selectedJdIds,
  onToggleJd,
  onSelectMany,
  reason,
  onReasonChange,
  adminNote,
  onAdminNoteChange,
  processing,
  onWarn,
  onClose,
  fallbackName,
}) => {
  const [confirmingPermanent, setConfirmingPermanent] = useState(false);
  // 본문을 펼쳐 둔 공고. 고르는 것(체크박스)과 보는 것은 별개다 —
  // 내용을 확인하려고 숨김 대상으로 찍어야 한다면 순서가 거꾸로다.
  const [openPostIds, setOpenPostIds] = useState<number[]>([]);

  const togglePostOpen = (id: number) =>
    setOpenPostIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const posts = detail?.posts ?? [];

  // 본문을 펼쳐 둔 공고들끼리 문장을 대조한다.
  // 비교를 체크박스(숨길 대상)에 묶으면 "왜 유사한지" 보려고 처벌 대상으로 찍어야 해서,
  // 보는 행위와 고르는 행위를 갈라놓았다.
  // keepDigits: 급여·인원처럼 숫자만 다른 문장을 "같다"고 칠하면 정작 봐야 할 차이가 가려진다.
  const openedPosts = useMemo(
    () => posts.filter((p) => openPostIds.includes(p.id)),
    [posts, openPostIds]
  );

  const diffByPostId = useMemo(() => {
    if (openedPosts.length < 2) return null;
    const marked = markSharedSentences(
      openedPosts.map((p) => p.contents ?? ''),
      { keepDigits: true }
    );
    const map = new Map<number, { text: string; shared: boolean }[]>();
    openedPosts.forEach((p, i) => map.set(p.id, marked[i] ?? []));
    return map;
  }, [openedPosts]);

  // 유사 묶음별로 공고를 나눠둔다. 묶이지 않은 공고는 마지막에 따로 모은다.
  const groups = useMemo(() => {
    const map = new Map<number, typeof posts>();
    const loners: typeof posts = [];
    for (const p of posts) {
      if (p.similarGroup == null) {
        loners.push(p);
        continue;
      }
      const arr = map.get(p.similarGroup);
      if (arr) arr.push(p);
      else map.set(p.similarGroup, [p]);
    }
    return { grouped: Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length), loners };
  }, [posts]);

  const renderPostItem = (post: (typeof posts)[number]) => {
    const selected = selectedJdIds.includes(post.id);
    const opened = openPostIds.includes(post.id);
    const meta = [
      post.region,
      post.salaryText,
      post.worktimeText,
      post.contactPhone,
      post.locationDetail,
      post.updatedTime ? formatDateShort(post.updatedTime) : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <li
        key={post.id}
        className={`${styles.postCheckItem} ${selected ? styles.postCheckItemSelected : ''}`}
      >
        <div className={styles.postRow}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleJd(post.id)}
            title="경고 시 숨길 공고로 선택"
          />
          <button
            type="button"
            className={styles.postTitleBtn}
            onClick={() => togglePostOpen(post.id)}
            aria-expanded={opened}
          >
            <span className={styles.postCheckTitle}>{post.title}</span>
            <span className={styles.postCheckMeta}>{meta}</span>
          </button>
          <span className={styles.postRowActions}>
            <button
              type="button"
              className={styles.postToggleBtn}
              onClick={() => togglePostOpen(post.id)}
            >
              {opened ? '본문 접기' : '본문 보기'}
            </button>
            <a
              className={styles.postOpenLink}
              href={`/jd/${post.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              공고 열기
            </a>
          </span>
        </div>

        {opened &&
          (diffByPostId?.has(post.id) ? (
            // 두 건 이상 펼쳐 두면 그 자리에서 바로 겹치는 문장이 칠해진다
            <div className={styles.postBody}>
              {diffByPostId.get(post.id)!.map((s, i) => (
                <p
                  key={i}
                  className={`${styles.sentence} ${
                    s.shared ? styles.sentenceShared : styles.sentenceUnique
                  }`}
                >
                  {s.text}
                </p>
              ))}
            </div>
          ) : (
            <pre className={styles.postBody}>
              {post.contents?.trim() ? post.contents : '(본문이 비어 있습니다)'}
            </pre>
          ))}
      </li>
    );
  };

  return (
    <div className={styles.userDetail}>
      <div className={styles.userDetailHeader}>
        <span className={styles.userDetailName}>{detail?.displayName ?? fallbackName}</span>
        <button type="button" className={styles.userDetailClose} onClick={onClose}>
          닫기
        </button>
      </div>

      {loading ? (
        <div className={styles.emptyState} style={{ padding: 32 }}>
          <div className={styles.spinner} />
          <span>불러오는 중...</span>
        </div>
      ) : !detail ? null : (
        <>
          {/* ── 경고 이력 ── */}
          <div className={styles.userDetailSection}>
            <p className={styles.userDetailSectionTitle}>경고 이력</p>
            {detail.warnings.length === 0 ? (
              <p className={styles.mutedNote}>경고 이력 없음</p>
            ) : (
              <ul className={styles.warningHistoryList}>
                {detail.warnings.map((w) => (
                  <li key={w.id} className={styles.warningHistoryBlock}>
                    <div className={styles.warningHistoryItem}>
                      <span className={styles.warningLevel}>{w.level}차</span>
                      <span className={styles.warningKind}>{kindLabel(w.kind)}</span>
                      {w.region && <span className={styles.mutedNote}>{w.region}</span>}
                      <span className={styles.warningDate}>{formatKST(w.createdAt)}</span>
                      {w.acknowledgedAt ? (
                        <span className={styles.warningAcked}>확인됨</span>
                      ) : (
                        <span className={styles.warningUnacked}>미확인</span>
                      )}
                    </div>
                    {w.reasonText && (
                      <p className={styles.warningExtra}>
                        <span className={styles.warningExtraLabel}>본인에게 보인 사유</span>
                        {w.reasonText}
                      </p>
                    )}
                    {w.adminNote && (
                      <p className={styles.warningExtra}>
                        <span className={styles.warningExtraLabel}>운영 메모</span>
                        {w.adminNote}
                      </p>
                    )}
                    {w.hiddenJdTitles && w.hiddenJdTitles.length > 0 && (
                      <p className={styles.warningExtra}>
                        <span className={styles.warningExtraLabel}>숨긴 공고</span>
                        {w.hiddenJdTitles.length}건
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── 정지 상태 ── */}
          <div className={styles.userDetailSection}>
            <p className={styles.userDetailSectionTitle}>정지 상태</p>
            <div className={styles.suspensionInfo}>
              {detail.isPermanentlyBlocked ? (
                <>
                  <span className={`${styles.userStatusBadge} ${styles.statusPermanent} ${styles.suspensionBadge}`}>
                    영구 제한
                  </span>
                  <span className={styles.suspensionText}>모든 공고 등록 영구 차단</span>
                </>
              ) : detail.suspendedUntil ? (
                <>
                  <span className={`${styles.userStatusBadge} ${styles.statusSuspended} ${styles.suspensionBadge}`}>
                    정지 중
                  </span>
                  <span className={styles.suspensionText}>
                    {formatKST(detail.suspendedUntil)} 해제 예정
                  </span>
                </>
              ) : (
                <>
                  <span className={`${styles.userStatusBadge} ${styles.statusNormal} ${styles.suspensionBadge}`}>
                    정상
                  </span>
                  <span className={styles.mutedNote}>제한 없음</span>
                </>
              )}
            </div>
          </div>

          {/* ── 공고 목록 ── */}
          <div className={styles.userDetailSection}>
            <p className={styles.userDetailSectionTitle}>
              채용공고 ({posts.length}건)
              <span className={styles.sectionHint}>
                제목을 누르면 본문이 펼쳐집니다 · 체크는 경고 시 숨길 공고를 고르는 것입니다
              </span>
            </p>

            {openedPosts.length >= 2 && (
              <p className={styles.diffLegend}>
                본문 {openedPosts.length}건을 대조 중입니다 ·{' '}
                <span className={styles.legendShared}>빨강</span> 다른 공고에도 있는 문장 ·{' '}
                <span className={styles.legendUnique}>초록</span> 이 공고에만 있는 문장
              </p>
            )}

            {posts.length === 0 ? (
              <p className={styles.mutedNote}>공개된 공고 없음</p>
            ) : (
              <>
                {groups.grouped.length === 0 ? (
                  <p className={styles.mutedNote} style={{ marginBottom: 10 }}>
                    같은 지역에 내용이 비슷한 공고 묶음은 없습니다.
                  </p>
                ) : (
                  groups.grouped.map(([groupNo, items]) => (
                    <div key={groupNo} className={styles.postGroup}>
                      <div className={styles.postGroupHeader}>
                        <span className={styles.similarGroupBadge}>
                          {items[0].region} · 내용 유사 {items.length}건
                        </span>
                        <span className={styles.postGroupActions}>
                          <button
                            type="button"
                            className={styles.postGroupSelect}
                            onClick={() => setOpenPostIds(items.map((i) => i.id))}
                          >
                            본문 비교
                          </button>
                          <button
                            type="button"
                            className={styles.postGroupSelect}
                            onClick={() => onSelectMany(items.map((i) => i.id))}
                          >
                            숨김 대상으로 선택
                          </button>
                        </span>
                      </div>
                      <ul className={styles.postCheckList}>{items.map(renderPostItem)}</ul>
                    </div>
                  ))
                )}

                {groups.loners.length > 0 && (
                  <div className={styles.postGroup}>
                    <div className={styles.postGroupHeader}>
                      <span className={styles.mutedNote}>묶이지 않은 공고 {groups.loners.length}건</span>
                    </div>
                    <ul className={styles.postCheckList}>{groups.loners.map(renderPostItem)}</ul>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── 수동 경고 발송 ── */}
          <div className={styles.userDetailSection}>
            <p className={styles.userDetailSectionTitle}>경고 발송</p>

            <div className={styles.actionPreview} style={{ marginBottom: 12, borderRadius: 8 }}>
              <span className={styles.actionPreviewLabel}>경고 시</span>
              <span className={styles.actionPreviewText}>
                {formatSanctionPreview(detail.nextLevel, detail.nextAction, detail.nextSuspendedUntil)}
              </span>
              {detail.nextAction === 'permanent' && (
                <span className={styles.actionPreviewBadge}>되돌리기 어려움</span>
              )}
            </div>

            <div className={styles.manualWarnForm}>
              <div>
                <label className={styles.formLabel}>
                  사유 문구
                  <span className={styles.formLabelSub}>본인 팝업에 그대로 보입니다</span>
                </label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="비우면 기본 문구가 나갑니다"
                  value={reason}
                  onChange={(e) => onReasonChange(e.target.value)}
                  rows={2}
                />
              </div>
              <div>
                <label className={styles.formLabel}>
                  운영 메모
                  <span className={styles.formLabelSub}>
                    본인에게는 보이지 않고, 이 회원의 경고 이력에만 남습니다
                  </span>
                </label>
                <textarea
                  className={styles.formTextarea}
                  placeholder="판단 근거를 남겨두면 나중에 문의가 왔을 때 확인할 수 있습니다"
                  value={adminNote}
                  onChange={(e) => onAdminNoteChange(e.target.value)}
                  rows={2}
                />
              </div>

              {confirmingPermanent ? (
                <div className={styles.permanentConfirmBox} style={{ margin: 0 }}>
                  <p className={styles.permanentConfirmTitle}>영구 제한 확인</p>
                  <p className={styles.permanentConfirmDesc}>
                    경고를 발송하면 이 회원이 <strong>영구 제한</strong>됩니다. 고른 공고뿐 아니라
                    이 회원의 공개 공고 <strong>{posts.length}건 전부</strong>가 숨김 처리되며,
                    되돌리려면 데이터베이스를 직접 고쳐야 합니다. 계속하시겠습니까?
                  </p>
                  <div className={styles.permanentConfirmBtns}>
                    <button
                      className={styles.btnConfirmPermanent}
                      onClick={() => {
                        setConfirmingPermanent(false);
                        onWarn();
                      }}
                      disabled={processing}
                    >
                      {processing ? '처리 중...' : '영구 제한 경고 발송'}
                    </button>
                    <button
                      className={styles.btnCancelConfirm}
                      onClick={() => setConfirmingPermanent(false)}
                      disabled={processing}
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.formActions}>
                  <button
                    className={styles.btnWarn}
                    disabled={processing}
                    onClick={() => {
                      if (detail.nextAction === 'permanent') setConfirmingPermanent(true);
                      else onWarn();
                    }}
                  >
                    {processing ? '처리 중...' : '경고 발송'}
                  </button>
                  <span className={styles.mutedNote}>
                    {selectedJdIds.length > 0
                      ? `고른 공고 ${selectedJdIds.length}건이 숨겨집니다`
                      : '고른 공고가 없으면 경고만 나가고 공고는 그대로 둡니다'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminUserDetailPanel;
