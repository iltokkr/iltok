import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import styles from '@/styles/Mylist.module.css';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';
import { addHours, format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ResumeItem {
  id: number;
  title: string;
  updated_time: string;
  is_hidden?: boolean;
}

const ResumeList: React.FC = () => {
  const auth = useContext(AuthContext);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resumeReloadLastUsedAt, setResumeReloadLastUsedAt] = useState<string | null>(null);
  const [showReloadModal, setShowReloadModal] = useState(false);
  const [showHideSuccessModal, setShowHideSuccessModal] = useState(false);
  const [showUnhideSuccessModal, setShowUnhideSuccessModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ResumeItem | null>(null);

  useEffect(() => {
    if (auth?.user?.id) {
      fetchResumes();
      fetchUserResumeReload();
    } else {
      setIsLoading(false);
    }
  }, [auth?.user?.id]);

  const fetchResumes = async () => {
    if (!auth?.user?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('jd')
        .select('id, title, updated_time, is_hidden')
        .eq('uploader_id', auth.user.id)
        .eq('board_type', '1')
        .order('updated_time', { ascending: false });

      if (error) throw error;
      setResumes(data || []);
    } catch (err) {
      console.error('Error fetching resumes:', err);
      setResumes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserResumeReload = async () => {
    if (!auth?.user?.id) return;
    try {
      const { data } = await supabase
        .from('users')
        .select('resume_reload_last_used_at')
        .eq('id', auth.user.id)
        .single();
      setResumeReloadLastUsedAt(data?.resume_reload_last_used_at ?? null);
    } catch {
      setResumeReloadLastUsedAt(null);
    }
  };

  // 이력서 끌어올리기 사용 가능 여부 (하루 1회, 익일 00시 충전)
  const canUseResumeReload = (): boolean => {
    if (!resumeReloadLastUsedAt) return true;
    try {
      const now = new Date();
      const kstNow = toZonedTime(now, 'Asia/Seoul');
      const todayStr = format(kstNow, 'yyyy-MM-dd');
      const lastUsed = parseISO(resumeReloadLastUsedAt);
      const kstLastUsed = toZonedTime(lastUsed, 'Asia/Seoul');
      const lastUsedStr = format(kstLastUsed, 'yyyy-MM-dd');
      return todayStr > lastUsedStr;
    } catch {
      return true;
    }
  };

  const handleReload = async (postId: number) => {
    if (!auth?.user?.id) return;
    if (!canUseResumeReload()) {
      alert('끌어올리기는 하루 1회만 가능합니다. 익일 00시에 충전됩니다.');
      return;
    }
    try {
      const koreaTime = addHours(new Date(), 9);

      const [postUpdate, userUpdate] = await Promise.all([
        supabase.from('jd').update({ updated_time: koreaTime }).eq('id', postId),
        supabase.from('users').update({ resume_reload_last_used_at: new Date().toISOString() }).eq('id', auth.user.id)
      ]);

      if (postUpdate.error) throw postUpdate.error;
      if (userUpdate.error) throw userUpdate.error;

      setShowReloadModal(true);
      setResumeReloadLastUsedAt(new Date().toISOString());
      setTimeout(() => {
        setShowReloadModal(false);
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('끌어올리기 실패:', error);
      alert('끌어올리기에 실패했습니다.');
    }
  };

  const handleHide = async (postId: number) => {
    try {
      const { error } = await supabase.from('jd').update({ is_hidden: true }).eq('id', postId);
      if (error) throw error;
      setShowHideSuccessModal(true);
    } catch (error) {
      console.error('숨기기 실패:', error);
      alert('숨기기에 실패했습니다.');
    }
  };

  const handleUnhide = async (postId: number) => {
    try {
      const { error } = await supabase.from('jd').update({ is_hidden: false }).eq('id', postId);
      if (error) throw error;
      setShowUnhideSuccessModal(true);
    } catch (error) {
      console.error('숨김 해제 실패:', error);
      alert('숨김 해제에 실패했습니다.');
    }
  };

  const openDeleteModal = (r: ResumeItem) => {
    setDeleteTarget(r);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error: commentError } = await supabase.from('comment').delete().eq('jd_id', deleteTarget.id);
      if (commentError) console.error('댓글 삭제 실패:', commentError);

      const { error } = await supabase.from('jd').delete().eq('id', deleteTarget.id);
      if (error) throw error;

      setShowDeleteModal(false);
      setDeleteTarget(null);
      setShowReloadModal(true);
      setTimeout(() => {
        setShowReloadModal(false);
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('이력서 삭제에 실패했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className={styles.layout}>
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.guideCard}>
        <div className={styles.guideItem}>
          <span className={styles.guideCheck} aria-hidden>✓</span>
          <span className={styles.guideText}>등록한 이력서 목록입니다. 수정 버튼을 눌러 내용을 변경할 수 있습니다.</span>
        </div>
        <div className={styles.guideItem}>
          <span className={styles.guideCheck} aria-hidden>✓</span>
          <span className={styles.guideText}><strong>끌어올리기</strong>를 하면 이력서가 인재정보 게시판 최상단으로 이동합니다.</span>
        </div>
        <div className={styles.guideItem}>
          <span className={styles.guideCheck} aria-hidden>✓</span>
          <span className={styles.guideText}><strong>끌어올리기</strong>는 하루 1회 사용 가능하며, 사용 시 익일 00시에 충전됩니다.</span>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <Link href="/write?board_type=1" className={styles.infoEditBtn}>
          새 이력서 등록
        </Link>
      </div>
      <div className={`${styles.tableWrap} ${styles.appliedTableWrap}`}>
        <table className={styles.adsTable}>
          <thead>
            <tr>
              <th>수정일</th>
              <th>제목</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {resumes.length === 0 ? (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
                  등록된 이력서가 없습니다. 새 이력서를 등록해보세요.
                </td>
              </tr>
            ) : (
              resumes.map((r) => (
                <tr key={r.id} className={r.is_hidden ? styles.hiddenPost : ''}>
                  <td className={styles.colDate}>{formatDate(r.updated_time)}</td>
                  <td className={styles.colAd}>
                    <div className={styles.adInfo}>
                      <Link href={`/jd/${r.id}`} className={styles.postItemTitle}>
                        {r.title || '(제목 없음)'}
                      </Link>
                      {r.is_hidden && <span className={styles.hiddenBadge}>숨김</span>}
                    </div>
                  </td>
                  <td className={styles.colManage}>
                    <div className={styles.manageBtns}>
                      <Link href={`/write?board_type=1&id=${r.id}`} className={styles.manageBtn}>
                        수정
                      </Link>
                      {!r.is_hidden && (
                        <button
                          type="button"
                          className={styles.manageBtn}
                          onClick={() => handleReload(r.id)}
                          disabled={!canUseResumeReload()}
                          title={!canUseResumeReload() ? '익일 00시에 충전됩니다' : undefined}
                        >
                          끌어올리기
                        </button>
                      )}
                      {r.is_hidden ? (
                        <button type="button" className={styles.manageBtn} onClick={() => handleUnhide(r.id)}>
                          숨김해제
                        </button>
                      ) : (
                        <button type="button" className={styles.manageBtn} onClick={() => handleHide(r.id)}>
                          숨김
                        </button>
                      )}
                      <button type="button" className={styles.manageBtn} onClick={() => openDeleteModal(r)}>
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 끌어올리기 성공 모달 */}
      {showReloadModal && (
        <div className={styles.modal}>
          <p>처리되었습니다.</p>
        </div>
      )}

      {/* 숨김 성공 모달 */}
      {showHideSuccessModal && (
        <div className={styles.successModalOverlay}>
          <div className={styles.successModal}>
            <img src="/icons/check-circle.svg" alt="완료" className={styles.successIconImg} />
            <h3 className={styles.successTitle}>이력서가 숨김 처리되었습니다</h3>
            <p className={styles.successDesc}>인재정보 게시판에서 더 이상 노출되지 않습니다.</p>
            <button
              className={styles.successBtn}
              onClick={() => {
                setShowHideSuccessModal(false);
                window.location.reload();
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && deleteTarget && (
        <div className={styles.deleteModalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.deleteModalClose} onClick={() => setShowDeleteModal(false)}>
              ×
            </button>
            <h3 className={styles.deleteModalTitle}>이력서를 삭제하시겠습니까?</h3>
            <div className={styles.deleteModalContent}>
              <p className={styles.deleteModalPostTitle}>{deleteTarget.title || '(제목 없음)'}</p>
            </div>
            <div className={styles.deleteModalDesc}>
              <p>삭제하면 복구할 수 없습니다.</p>
            </div>
            <div className={styles.deleteModalButtons}>
              <button className={styles.deleteBtn} onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }}>
                취소
              </button>
              <button className={styles.deleteConfirmBtn} onClick={confirmDelete}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 숨김 해제 성공 모달 */}
      {showUnhideSuccessModal && (
        <div className={styles.successModalOverlay}>
          <div className={styles.successModal}>
            <img src="/icons/check-circle.svg" alt="완료" className={styles.successIconImg} />
            <h3 className={styles.successTitle}>이력서가 숨김 해제되었습니다</h3>
            <div className={styles.unhideTip}>[끌어올리기]로 상단 노출이 가능합니다.</div>
            <button
              className={styles.successBtn}
              onClick={() => {
                setShowUnhideSuccessModal(false);
                window.location.reload();
              }}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeList;
