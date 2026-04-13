import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { FaSearch } from 'react-icons/fa';
import styles from '@/styles/Mylist.module.css';
import supabase from '@/lib/supabase';
import { addHours, format, parseISO, subHours } from 'date-fns';
import { AuthContext } from '@/contexts/AuthContext';
import BusinessVerificationModal from '@/components/BusinessVerificationModal';
import { event } from '@/lib/gtag';

interface MyPost {
  id: number;
  updated_time: string;
  title: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
  board_type?: string;
  is_hidden?: boolean;
  salary_type?: string;
  salary_detail?: string;
  is_wage_violation?: boolean;
  ad?: boolean;
  ad_until?: string | null;
}

interface MylistProps {
  posts: MyPost[];
  isAccept: boolean;
  isUpload: boolean;
  reloadTimes: number;
  bizFile: string | null;
  companyName: string | null;
  managerName: string | null;
  phoneNumber: string | null;
  businessNumber: string | null;
  businessAddress: string | null;
  activeSection?: 'ads' | 'info';
  userType?: string | null;
  userId?: string | null;
  email?: string | null;
}

const Mylist: React.FC<MylistProps> = ({ 
  posts, 
  isAccept, 
  isUpload, 
  reloadTimes,
  bizFile,
  companyName,
  managerName,
  phoneNumber,
  businessNumber,
  businessAddress,
  activeSection = 'ads',
  userType,
  userId,
  email,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetPost, setDeleteTargetPost] = useState<MyPost | null>(null);
  const [showHideSuccessModal, setShowHideSuccessModal] = useState(false);
  const [showUnhideSuccessModal, setShowUnhideSuccessModal] = useState(false);
  const [showWageViolationModal, setShowWageViolationModal] = useState(false);
  const [applicationCounts, setApplicationCounts] = useState<Record<number, number>>({});
  const [searchKeyword, setSearchKeyword] = useState('');
  const [localPosts, setLocalPosts] = useState<MyPost[]>(posts);
  const authContext = useContext(AuthContext);

  useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  const regularPosts = localPosts.filter(post => post.board_type === '0');
  const filteredPosts = searchKeyword.trim()
    ? regularPosts.filter(post => post.title.toLowerCase().includes(searchKeyword.trim().toLowerCase()))
    : regularPosts;

  useEffect(() => {
    if (regularPosts.length === 0) {
      setApplicationCounts({});
      return;
    }
    const fetchApplicationCounts = async () => {
      const ids = regularPosts.map((p) => p.id);
      const { data } = await supabase.from('job_application').select('jd_id').in('jd_id', ids);
      const counts: Record<number, number> = {};
      (data || []).forEach((b: { jd_id: number }) => {
        counts[b.jd_id] = (counts[b.jd_id] || 0) + 1;
      });
      setApplicationCounts(counts);
    };
    fetchApplicationCounts();
  }, [localPosts]);

  // 사업자 인증 상태: 미등록 / 심사중 / 인증완료
  const getBusinessStatus = () => {
    if (isAccept) return "인증완료";
    if (bizFile) return "심사중";
    return "미등록";
  };
  
  const businessStatus = getBusinessStatus();
  const isVerified = isAccept;  

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);
    return format(koreaTime, 'MM-dd');
  };

  const formatDateFull = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);
    return format(koreaTime, 'yyyy년 MM월 dd일 HH시 mm분');
  };
  const now = new Date();
  const koreaTime = addHours(now, 9);

  const formatToday = (date: Date) => {
    return format(date, 'yyyy년 MM월 dd일');
  };

  // 최저임금 위반 여부 확인 (시급이 10,320원 미만인 경우)
  const checkWageViolation = (post: MyPost): boolean => {
    if (post.salary_type !== '시급' || !post.salary_detail) return false;
    const salaryNum = Number(post.salary_detail.replace(/,/g, ''));
    return !isNaN(salaryNum) && salaryNum < 10320;
  };

  const handleReload = async (postId: number) => {
    try {
      // 해당 게시물 찾기
      const targetPost = localPosts.find(p => p.id === postId);

      // 최저임금 위반 체크
      if (targetPost && (targetPost.is_wage_violation || checkWageViolation(targetPost))) {
        setShowWageViolationModal(true);
        return;
      }

      // Check if reload_times is available
      if (reloadTimes <= 0) {
        alert('끌어올리기 횟수가 모두 소진되었습니다. 다음 충전 시간까지 기다려주세요.');
        event({
          action: 'reload_post_failed',
          category: 'my_list',
          label: 'no_remaining_reload_times'
        });
        return;
      }

      event({
        action: 'reload_post',
        category: 'my_list',
        label: `post_id_${postId}`,
        value: reloadTimes - 1  // 남은 재등록 횟수를 value로 전달
      });

      // Update both the post's updated_time and user's reload_times
      const [postUpdate, userUpdate] = await Promise.all([
        supabase
          .from('jd')
          .update({ updated_time: koreaTime })
          .eq('id', postId),
        supabase
          .from('users')
          .update({ reload_times: reloadTimes - 1 })
          .eq('id', authContext?.user?.id)
      ]);

      if (postUpdate.error) throw postUpdate.error;
      if (userUpdate.error) throw userUpdate.error;
      
      setShowModal(true);
      setTimeout(() => {
        setShowModal(false);
        window.location.reload(); // 페이지를 새로고침하여 업데이트된 상태를 반영
      }, 2000);
    } catch (error) {
      console.error('끌어올리기 실패:', error);
      event({
        action: 'reload_post_error',
        category: 'my_list',
        label: `post_id_${postId}`
      });
    }
  };

  // 삭제 확인 모달 열기
  const openDeleteModal = (post: MyPost) => {
    setDeleteTargetPost(post);
    setShowDeleteModal(true);
  };

  // 실제 삭제 실행
  const confirmDelete = async () => {
    if (!deleteTargetPost) return;
    
    try {
      // 게시글 삭제 시 job_application은 jd CASCADE로 자동 삭제됨

      // 해당 게시글의 댓글 삭제
      const { error: commentError } = await supabase
        .from('comment')
        .delete()
        .eq('jd_id', deleteTargetPost.id);

      if (commentError) {
        console.error('댓글 삭제 실패:', commentError);
      }

      // 게시글 삭제
      const { error } = await supabase
        .from('jd')
        .delete()
        .eq('id', deleteTargetPost.id);

      if (error) throw error;

      setLocalPosts(prev => prev.filter(p => p.id !== deleteTargetPost.id));
      setShowDeleteModal(false);
      setDeleteTargetPost(null);

      setShowModal(true);
      setTimeout(() => setShowModal(false), 2000);
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('게시물 삭제에 실패했습니다.');
    }
  };

  // 삭제 대신 숨김 처리
  const hideInsteadOfDelete = async () => {
    if (!deleteTargetPost) return;

    try {
      const { error } = await supabase
        .from('jd')
        .update({ is_hidden: true })
        .eq('id', deleteTargetPost.id);

      if (error) throw error;

      setLocalPosts(prev => prev.map(p => p.id === deleteTargetPost.id ? { ...p, is_hidden: true } : p));
      setShowDeleteModal(false);
      setDeleteTargetPost(null);
      setShowHideSuccessModal(true);
    } catch (error) {
      console.error('숨기기 실패:', error);
      alert('숨기기에 실패했습니다.');
    }
  };

  // 게시글 숨기기
  const handleHide = async (postId: number) => {
    try {
      const { error } = await supabase
        .from('jd')
        .update({ is_hidden: true })
        .eq('id', postId);

      if (error) throw error;

      setLocalPosts(prev => prev.map(p => p.id === postId ? { ...p, is_hidden: true } : p));
      setShowHideSuccessModal(true);
    } catch (error) {
      console.error('숨기기 실패:', error);
      alert('숨기기에 실패했습니다.');
    }
  };

  // 게시글 숨김 해제 (원래 위치로 복원)
  const handleUnhide = async (postId: number) => {
    try {
      // 해당 게시물 찾기
      const targetPost = localPosts.find(p => p.id === postId);

      // 최저임금 위반 체크
      if (targetPost && (targetPost.is_wage_violation || checkWageViolation(targetPost))) {
        setShowWageViolationModal(true);
        return;
      }

      const { error } = await supabase
        .from('jd')
        .update({ is_hidden: false })
        .eq('id', postId);

      if (error) throw error;

      setLocalPosts(prev => prev.map(p => p.id === postId ? { ...p, is_hidden: false } : p));
      setShowUnhideSuccessModal(true);
    } catch (error) {
      console.error('숨김 해제 실패:', error);
      alert('숨김 해제에 실패했습니다.');
    }
  };

  const showInfoSection = activeSection === 'info' && userType === 'business';

  return (
    <div className={styles.layout}>
      {/* 사업자 정보 카드 - 회원정보 탭에서만 표시 */}
      {showInfoSection && (
      <div className={styles.businessCard}>
        {/* 상단: 인사말 + 상태 */}
        <div className={styles.cardGreetingRow}>
          <p className={styles.cardGreeting}>{companyName || '업체명 미등록'}님</p>
          <span className={`${styles.statusBadge} ${styles.statusBadgeOnCard} ${isVerified ? styles.badgeVerified : businessStatus === '심사중' ? styles.badgePending : styles.badgeNotRegistered}`}>
            {businessStatus}
          </span>
        </div>

        {/* 정보 그리드 */}
        <div className={styles.contactInfo}>
          <span className={styles.contactItem}>
            <span className={styles.contactLabel}>사업자번호</span>
            <span className={styles.contactValue}>{businessNumber || '-'}</span>
          </span>
          <span className={styles.contactItem}>
            <span className={styles.contactLabel}>소재지</span>
            <span className={styles.contactValue}>{businessAddress || '-'}</span>
          </span>
          <span className={styles.contactItem}>
            <span className={styles.contactLabel}>대표자</span>
            <span className={styles.contactValue}>{managerName || '-'}</span>
          </span>
          <span className={styles.contactItem}>
            <span className={styles.contactLabel}>연락처</span>
            <span className={styles.contactValue}>{phoneNumber || '-'}</span>
          </span>
          <span className={styles.contactItem}>
            <span className={styles.contactLabel}>아이디</span>
            <span className={styles.contactValue}>{userId || '미설정'}</span>
          </span>
          <span className={styles.contactItem}>
            <span className={styles.contactLabel}>이메일</span>
            <span className={styles.contactValue}>{email || '미설정'}</span>
          </span>
        </div>

        {/* 하단 버튼 */}
        <div className={styles.cardButtonRow}>
          <button
            className={styles.editInfoButton}
            onClick={() => setShowVerificationModal(true)}
          >
            {bizFile ? '사업자 정보 수정하기' : '등록하기'} &gt;
          </button>
          <Link href="/my/edit" className={styles.editInfoButton}>
            로그인 정보 수정 &gt;
          </Link>
        </div>
      </div>
      )}

      {/* 미승인 상태 안내 배너 - 공고관리에서만 표시 */}
      {!showInfoSection && userType === 'business' && !isVerified && (
        <div className={styles.unapprovedBanner}>
          <span className={styles.unapprovedBannerIcon}>⚠️</span>
          <span>
            현재 <strong>{businessStatus}</strong> 상태이므로, 채용정보가 게시판에 업로드 되지 않습니다. 심사는 당일~익일 내 완료됩니다.
          </span>
        </div>
      )}

      {/* 안내 문구 - 공고관리에서만 표시 */}
      {!showInfoSection && (
      <div className={styles.guideCard}>
        <div className={`${styles.guideItem} ${styles.guideItemWithBtn}`}>
          <span className={styles.guideCheck} aria-hidden>✓</span>
          <span className={styles.guideText}>기업은 <strong>사업자 인증</strong>이 필요합니다. 인증 전 게시글은 비공개 상태입니다.</span>
          {userType === 'business' && !isVerified && (
            <button type="button" className={styles.guideVerifyBtn} onClick={() => setShowVerificationModal(true)}>
              인증하기 &gt;
            </button>
          )}
        </div>
        <div className={styles.guideItem}>
          <span className={styles.guideCheck} aria-hidden>✓</span>
          <span className={styles.guideText}><strong>끌어올리기</strong>를 하면 공고가 게시판 최상단으로 이동합니다.</span>
        </div>
        <div className={styles.guideItem}>
          <span className={styles.guideCheck} aria-hidden>✓</span>
          <span className={styles.guideText}><strong>끌어올리기</strong>는 매일 00시, 06시, 12시, 18시에 1회씩 충전됩니다.</span>
        </div>
      </div>
      )}

      {!showInfoSection && (
      <>
      <div className={styles.searchWrap}>
        <div className={styles.searchField}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="공고명으로 검색"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
          <span className={styles.searchIcon} aria-hidden="true">
            <FaSearch />
          </span>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.adsTable}>
          <thead>
            <tr>
              <th>작성일</th>
              <th className={styles.thAdManage}>공고관리</th>
              <th>지원자</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosts.map((post) => (
              <tr key={post.id} className={post.is_hidden ? styles.hiddenPost : ''}>
                <td className={styles.colDate}>{formatDateFull(post.updated_time)}</td>
                <td className={styles.colAd}>
                  <div className={styles.adInfo}>
                    <Link href={`/jd/${post.id}`} scroll={false} className={styles.postItemTitle}>
                      {post.title}
                    </Link>
                    <span className={styles.adMeta}>
                      {post['1depth_region']} {post['2depth_region']} | {post['1depth_category']} {post['2depth_category']}
                    </span>
                    {post.ad && (
                      <span className={styles.premiumBadge}>
                        프리미엄{post.ad_until ? ` (~${format(parseISO(post.ad_until), 'MM/dd')})` : ''}
                      </span>
                    )}
                    {post.is_hidden && <span className={styles.hiddenBadge}>숨김</span>}
                    {(post.is_wage_violation || checkWageViolation(post)) && (
                      <span className={styles.wageViolationBadge}>⚠️ 최저임금 위반</span>
                    )}
                  </div>
                </td>
                <td className={styles.colApplicant}>
                  <Link
                    href={`/my/applicants/${post.id}`}
                    className={styles.applicantBtn}
                  >
                    {applicationCounts[post.id] || 0}명
                  </Link>
                </td>
                <td className={styles.colManage}>
                  <div className={styles.manageBtns}>
                    <a href={`/write?id=${post.id}`} className={styles.manageBtn}>수정</a>
                    {!post.is_hidden && (
                      <button type="button" className={styles.manageBtn} onClick={() => handleReload(post.id)}>끌어올리기</button>
                    )}
                    {post.is_hidden ? (
                      <button type="button" className={styles.manageBtn} onClick={() => handleUnhide(post.id)}>숨김해제</button>
                    ) : (
                      <button type="button" className={styles.manageBtn} onClick={() => handleHide(post.id)}>숨김</button>
                    )}
                    <button type="button" className={styles.manageBtn} onClick={() => openDeleteModal(post)}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}

      
      {showModal && (
        <div className={styles.modal}>
          <p>처리되었습니다.</p>
        </div>
      )}

      {showVerificationModal && (
        <BusinessVerificationModal 
          onClose={() => setShowVerificationModal(false)} 
        />
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && deleteTargetPost && (
        <div className={styles.deleteModalOverlay} onClick={() => setShowDeleteModal(false)}>
          <div className={styles.deleteModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.deleteModalClose} onClick={() => setShowDeleteModal(false)}>
              ×
            </button>
            <h3 className={styles.deleteModalTitle}>채용공고를 삭제하시겠습니까?</h3>
            
            <div className={styles.deleteModalContent}>
              <p className={styles.deleteModalPostTitle}>{deleteTargetPost.title}</p>
              <p className={styles.deleteModalPostInfo}>
                {deleteTargetPost['1depth_region']} {deleteTargetPost['2depth_region']}
              </p>
            </div>

            <div className={styles.deleteModalWarning}>
              <img src="/icons/warning-triangle.svg" alt="경고" className={styles.warningIconImg} />
              <span>삭제대신 <span className={styles.highlightText}>숨김</span>하세요!</span>
            </div>
            
            <div className={styles.deleteModalDesc}>
              <p>- "숨김" 처리하면 게재가 중단되며, 후속 관리가 편리합니다.</p>
              <p>- 삭제하면 관련된 모든 데이터가 함께 삭제됩니다.</p>
            </div>

            <div className={styles.deleteModalButtons}>
              <button className={styles.deleteBtn} onClick={confirmDelete}>
                삭제하기
              </button>
              <button className={styles.hideBtn} onClick={hideInsteadOfDelete}>
                게시글 숨기기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 숨김 성공 모달 */}
      {showHideSuccessModal && (
        <div className={styles.successModalOverlay}>
          <div className={styles.successModal}>
            <img src="/icons/check-circle.svg" alt="완료" className={styles.successIconImg} />
            <h3 className={styles.successTitle}>게시글이 숨김 처리되었습니다</h3>
            <p className={styles.successDesc}>게시판에서 더 이상 노출되지 않습니다.</p>
            <button
              className={styles.successBtn}
              onClick={() => setShowHideSuccessModal(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 숨김 해제 성공 모달 */}
      {showUnhideSuccessModal && (
        <div className={styles.successModalOverlay}>
          <div className={styles.successModal}>
            <img src="/icons/check-circle.svg" alt="완료" className={styles.successIconImg} />
            <h3 className={styles.successTitle}>게시글이 숨김 해제되었습니다</h3>
            <div className={styles.unhideTip}>
              [끌어올리기]로 상단 노출이 가능합니다.
            </div>
            <button
              className={styles.successBtn}
              onClick={() => setShowUnhideSuccessModal(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 최저임금 위반 경고 모달 */}
      {showWageViolationModal && (
        <div className={styles.successModalOverlay}>
          <div className={styles.wageViolationModal}>
            <div className={styles.wageViolationIcon}>⚠️</div>
            <h3 className={styles.wageViolationTitle}>최저임금 위반 공고</h3>
            <p className={styles.wageViolationDesc}>
              이 공고의 시급이 2025년 최저임금(10,320원) 미만입니다.
            </p>
            <p className={styles.wageViolationDesc}>
              <strong>시급을 10,320원 이상으로 수정</strong>해야<br />
              숨김해제 및 끌어올리기가 가능합니다.
            </p>
            <button 
              className={styles.successBtn}
              onClick={() => setShowWageViolationModal(false)}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Mylist;
