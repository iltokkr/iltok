import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import styles from '@/styles/Mylist.module.css';
import { createClient } from '@supabase/supabase-js';
import { addHours, format, subHours } from 'date-fns';
import { AuthContext } from '@/contexts/AuthContext';
import BusinessVerificationModal from '@/components/BusinessVerificationModal';
import { event } from '@/lib/gtag';
import { BsBookmark, BsBookmarkFill } from 'react-icons/bs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
interface MyPost {
  id: number;
  updated_time: string;
  title: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
  board_type?: string;
  status?: string;
}

interface BookmarkedPost extends MyPost {
  salary_type?: string;
  salary_detail?: string;
  bookmark_count?: number;
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
  businessAddress
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [localPosts, setLocalPosts] = useState<MyPost[]>(posts);
  const authContext = useContext(AuthContext);
  const [bookmarkedPosts, setBookmarkedPosts] = useState<BookmarkedPost[]>([]);
  const [bookmarkCounts, setBookmarkCounts] = useState<Record<number, number>>({});

  // posts prop이 변경되면 localPosts 업데이트
  useEffect(() => {
    setLocalPosts(posts);
  }, [posts]);

  // 사업자 인증 상태: 미등록 / 심사중 / 인증완료
  const getBusinessStatus = () => {
    if (isAccept) return "인증완료";
    if (bizFile) return "심사중";
    return "미등록";
  };
  
  const businessStatus = getBusinessStatus();
  const isVerified = isAccept;  

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}-${day}`;
  };
  const now = new Date();
  const koreaTime = addHours(now, 9);

  const formatToday = (date: Date) => {
    return format(date, 'yyyy년 MM월 dd일');
  };

  useEffect(() => {
    const fetchBookmarkedPosts = async () => {
      if (!authContext?.user?.id) return;

      // First get all bookmarked post IDs
      const { data: bookmarkData } = await supabase
        .from('bookmark')
        .select('jd_id')
        .eq('users_id', authContext.user.id);

      if (bookmarkData) {
        // Then fetch the actual posts
        const { data: postsData } = await supabase
          .from('jd')
          .select('*')
          .in('id', bookmarkData.map(b => b.jd_id));

        if (postsData) {
          setBookmarkedPosts(postsData);
        }
      }
    };

    const fetchBookmarkCounts = async () => {
      const { data } = await supabase
        .from('bookmark')
        .select('jd_id');

      if (data) {
        const counts = data.reduce((acc, item) => {
          acc[item.jd_id] = (acc[item.jd_id] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        
        setBookmarkCounts(counts);
      }
    };

    fetchBookmarkedPosts();
    fetchBookmarkCounts();
  }, [authContext?.user?.id]);

  const handleReload = async (postId: number) => {
    try {
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

  // 마감 처리
  const handleClose = async (postId: number) => {
    try {
      const { error } = await supabase
        .from('jd')
        .update({ status: 'closed' })
        .eq('id', postId);

      if (error) throw error;
      
      // 로컬 상태 업데이트
      setLocalPosts(prev => prev.map(post => 
        post.id === postId ? { ...post, status: 'closed' } : post
      ));
      
      setShowModal(true);
      setTimeout(() => {
        setShowModal(false);
      }, 2000);
    } catch (error) {
      console.error('마감 처리 실패:', error);
      alert('마감 처리에 실패했습니다.');
    }
  };

  // 개시 처리 (상위 노출)
  const handleOpen = async (postId: number) => {
    try {
      const { error } = await supabase
        .from('jd')
        .update({ 
          status: 'active',
          updated_time: koreaTime // 상위 노출을 위해 시간 업데이트
        })
        .eq('id', postId);

      if (error) throw error;
      
      // 로컬 상태 업데이트
      setLocalPosts(prev => prev.map(post => 
        post.id === postId ? { ...post, status: 'active', updated_time: koreaTime.toISOString() } : post
      ));
      
      setShowModal(true);
      setTimeout(() => {
        setShowModal(false);
      }, 2000);
    } catch (error) {
      console.error('개시 처리 실패:', error);
      alert('개시 처리에 실패했습니다.');
    }
  };

  // 삭제 버튼 클릭 시 마감 권유 팝업 표시
  const handleDeleteClick = (postId: number) => {
    setShowDeleteConfirm(postId);
  };

  const handleDelete = async (postId: number) => {
    try {
      // 먼저 해당 게시글의 북마크 삭제
      const { error: bookmarkError } = await supabase
        .from('bookmark')
        .delete()
        .eq('jd_id', postId);

      if (bookmarkError) {
        console.error('북마크 삭제 실패:', bookmarkError);
      }

      // 해당 게시글의 댓글 삭제
      const { error: commentError } = await supabase
        .from('comment')
        .delete()
        .eq('jd_id', postId);

      if (commentError) {
        console.error('댓글 삭제 실패:', commentError);
      }

      // 게시글 삭제
      const { error } = await supabase
        .from('jd')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      
      setShowDeleteConfirm(null);
      
      // 로컬 상태 업데이트
      setLocalPosts(prev => prev.filter(post => post.id !== postId));
      
      setShowModal(true);
      setTimeout(() => {
        setShowModal(false);
      }, 2000);
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('게시물 삭제에 실패했습니다.');
    }
  };

  const handleRemoveBookmark = async (postId: number) => {
    try {
      const { error } = await supabase
        .from('bookmark')
        .delete()
        .eq('users_id', authContext?.user?.id)
        .eq('jd_id', postId);

      if (error) throw error;

      setBookmarkedPosts(prev => prev.filter(post => post.id !== postId));
      setBookmarkCounts(prev => ({
        ...prev,
        [postId]: (prev[postId] || 1) - 1
      }));
    } catch (error) {
      console.error('북마크 삭제 실패:', error);
    }
  };

  // Update the filter to compare with string '4' instead of number 4
  // 채용정보 (board_type='0' or undefined/null) 와 구직정보 (board_type='1')
  const regularPosts = localPosts.filter(post => !post.board_type || post.board_type === '0' || post.board_type === '1');
  const activePosts = regularPosts.filter(post => post.status !== 'closed');
  const closedPosts = regularPosts.filter(post => post.status === 'closed');
  const communityPosts = localPosts.filter(post => post.board_type === '4');

  return (
    <div className={styles.layout}>
      {/* 사업자 정보 카드 */}
      <div className={styles.businessCard}>
        <div className={styles.businessCardHeader}>
          <div className={styles.companyInfo}>
            <h2 className={styles.companyName}>{companyName || '업체명 미등록'}</h2>
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
            </div>
          </div>
          <button 
            className={styles.editInfoButton}
            onClick={() => setShowVerificationModal(true)}
          >
            {bizFile ? '수정하기' : '등록하기'} &gt;
          </button>
        </div>
      </div>

      {/* 인증 및 이용 현황 */}
      <div className={styles.statusCard}>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>사업자 인증</span>
          <span className={`${styles.statusBadge} ${isVerified ? styles.badgeVerified : businessStatus === '심사중' ? styles.badgePending : styles.badgeNotRegistered}`}>
            {businessStatus}
          </span>
        </div>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>오늘 공고 등록</span>
          <span className={styles.statusValue}>
            {isVerified ? (isUpload ? "완료 (1일 1회)" : "가능") : "인증 완료 후 이용"}
          </span>
        </div>
        <div className={styles.statusRow}>
          <span className={styles.statusLabel}>끌어올리기 횟수</span>
          <span className={styles.statusValue}>
            {isVerified ? `${reloadTimes}회 남음` : "인증 완료 후 이용"}
          </span>
        </div>
      </div>

      {/* 안내 문구 */}
      <div className={styles.guideCard}>
        <div className={styles.guideItem}>
          <img src="/icons/megaphone-icon.svg" alt="끌어올리기" className={styles.guideIconImg} />
          <span className={styles.guideText}><strong>끌어올리기</strong>를 하면 공고가 게시판 최상단으로 이동합니다.</span>
        </div>
        <div className={styles.guideItem}>
          <img src="/icons/recharge-icon.svg" alt="충전" className={styles.guideIconImg} />
          <span className={styles.guideText}>끌어올리기는 <strong>매일 00시, 06시, 12시, 18시</strong>에 1회씩 충전됩니다.</span>
        </div>
        <div className={styles.guideItem}>
          <img src="/icons/edit-icon.svg" alt="수정" className={styles.guideIconImg} />
          <span className={styles.guideText}>[수정]은 횟수 제한 없이 가능하지만, 게시판 순서는 변경되지 않습니다.</span>
        </div>
        <div className={styles.guideItem}>
          <img src="/icons/warning-icon.svg" alt="주의" className={styles.guideIconImg} />
          <span className={styles.guideText}>동일한 제목·내용의 중복 공고는 사전 안내 없이 삭제 및 계정 이용이 제한될 수 있습니다.</span>
        </div>
      </div>

      {/* 공고 목록 헤더 */}
      <div className={styles.listHead}>
        게시중인 공고 ({activePosts.length}건)
      </div>

      <ul className={styles.listWrap}>
        {activePosts.map((post) => (
          <li key={post.id}>
            <div className={styles.postInfo}>
              <div className={styles.postContent}>
                <span className={styles.time}>{formatDate(post.updated_time)}</span>
                <Link href={`/jd/${post.id}`} scroll={false} className={styles.title}>
                  {post.title}
                </Link>
                <em>({post['1depth_region']} {post['2depth_region']}) - {post['1depth_category']} {post['2depth_category']}</em>
              </div>
              <div className={styles.buttonGroup}>
                <span className={styles.recall}>
                  <a href={`/write?id=${post.id}`}>[수정]</a>
                </span>
                <span className={styles.recall}>
                  <a onClick={() => handleReload(post.id)}>[끌어올리기]</a>
                </span>
                <span className={styles.recall}>
                  <a onClick={() => handleClose(post.id)} className={styles.closeBtn}>[마감]</a>
                </span>
                <span className={styles.recall}>
                  <a onClick={() => handleDeleteClick(post.id)}>[삭제]</a>
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* 마감된 공고 */}
      {closedPosts.length > 0 && (
        <>
          <div className={styles.listHead} style={{ marginTop: '40px' }}>
            마감된 공고 ({closedPosts.length}건)
          </div>

          <ul className={styles.listWrap}>
            {closedPosts.map((post) => (
              <li key={post.id} className={styles.closedPost}>
                <div className={styles.postInfo}>
                  <div className={styles.postContent}>
                    <span className={styles.closedBadge}>마감</span>
                    <span className={styles.time}>{formatDate(post.updated_time)}</span>
                    <Link href={`/jd/${post.id}`} scroll={false} className={styles.title}>
                      {post.title}
                    </Link>
                    <em>({post['1depth_region']} {post['2depth_region']}) - {post['1depth_category']} {post['2depth_category']}</em>
                  </div>
                  <div className={styles.buttonGroup}>
                    <span className={styles.recall}>
                      <a onClick={() => handleOpen(post.id)} className={styles.openBtn}>[개시]</a>
                    </span>
                    <span className={styles.recall}>
                      <a onClick={() => handleDeleteClick(post.id)}>[삭제]</a>
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className={styles.listHead} style={{ marginTop: '40px' }}>
        커뮤니티 게시글 ({communityPosts.length}개)
      </div>

      <ul className={styles.listWrap}>
        {communityPosts.map((post) => (
          <li key={post.id}>
            <div className={styles.postInfo}>
              <div className={styles.postContent}>
                <span className={styles.time}>{formatDate(post.updated_time)}</span>
                <Link href={`/jd/${post.id}`} scroll={false} className={styles.title}>
                  {post.title}
                </Link>
              </div>
              <div className={styles.buttonGroup}>
                <span className={styles.recall}>
                  <a href={`/write?id=${post.id}`}>[수정]</a>
                </span>
                <span className={styles.recall}>
                  <a onClick={() => handleDeleteClick(post.id)}>[삭제]</a>
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className={styles.listHead} style={{ marginTop: '40px' }}>
        북마크한 공고 ({bookmarkedPosts.length}개)
      </div>

      <ul className={styles.listWrap}>
        {bookmarkedPosts.map((post) => (
          <li key={post.id}>
            <div className={styles.postInfo}>
              <div className={styles.postContent}>
                <span className={styles.time}>{formatDate(post.updated_time)}</span>
                <Link href={`/jd/${post.id}`} scroll={false} className={styles.title}>
                  {post.title}
                </Link>
                <em>
                  ({post['1depth_region']} {post['2depth_region']})
                </em>
              </div>
              <div className={styles.buttonGroup}>
                <span 
                  className={styles.recall}
                  onClick={() => handleRemoveBookmark(post.id)}
                >
                  <BsBookmarkFill /> {bookmarkCounts[post.id] || 0}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>

      
      
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

      {/* 삭제 확인 팝업 */}
      {showDeleteConfirm && (
        <div className={styles.deleteConfirmOverlay} onClick={() => setShowDeleteConfirm(null)}>
          <div className={styles.deleteConfirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.deleteConfirmTitle}>공고를 삭제하시겠습니까?</h3>
            <p className={styles.deleteConfirmText}>
              삭제하시면 복구가 불가능합니다.<br />
              채용이 완료된 경우 <strong>마감</strong>을 권장드립니다.
            </p>
            <div className={styles.deleteConfirmNote}>
              💡 마감된 공고는 언제든지 다시 개시할 수 있으며,<br />
              개시 시 게시판 상단에 노출됩니다.
            </div>
            <div className={styles.deleteConfirmButtons}>
              <button 
                className={styles.closeInsteadBtn}
                onClick={() => {
                  handleClose(showDeleteConfirm);
                  setShowDeleteConfirm(null);
                }}
              >
                마감하기
              </button>
              <button 
                className={styles.deleteConfirmBtn}
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                삭제하기
              </button>
            </div>
            <button 
              className={styles.cancelBtn}
              onClick={() => setShowDeleteConfirm(null)}
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Mylist;
