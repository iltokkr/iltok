import React, { useState, useContext } from 'react';
import styles from '@/styles/Mylist.module.css';
import { createClient } from '@supabase/supabase-js';
import { addHours, format, subHours } from 'date-fns';
import { AuthContext } from '@/contexts/AuthContext';

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
}

interface MylistProps {
  posts: MyPost[];
  isAccept: boolean;
  isUpload: boolean;
  reloadTimes: number;
}


const Mylist: React.FC<MylistProps> = ({ 
  posts, 
  isAccept, 
  isUpload, 
  reloadTimes 
}) => {
  const [showModal, setShowModal] = useState(false);
  const authContext = useContext(AuthContext);

  const businessStatus = isAccept ? "인증" : "대기중";  

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

  const handleReload = async (postId: number) => {
    try {
      // Check if reload_times is available
      if (reloadTimes <= 0) {
        alert('재등록 가능 횟수가 소진되었습니다. 내일 다시 시도해주세요.');
        return;
      }

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
      console.error('재등록 실패:', error);
    }
  };

  const handleDelete = async (postId: number) => {
    try {
      if (!window.confirm('정말로 이 게시물을 삭제하시겠습니까?')) {
        return;
      }

      const { error } = await supabase
        .from('jd')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      
      // Show success modal
      setShowModal(true);
      setTimeout(() => {
        setShowModal(false);
        // Refresh the page to show updated list
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('게시물 삭제에 실패했습니다.');
    }
  };

  return (
    <div className={styles.layout}>
      <div className={styles.listHead}>
        총 {posts.length}개 <span className={styles.delAll}>(3개월이 지난글은 삭제될 수 있습니다.)</span>
      </div>

      <div className={styles.businessStatus}>
        <p>구인업체 사업자 인증상태 : <span className={styles.statusText}>{businessStatus}</span></p>
        <p>신규 등록 가능 여부 : <span className={styles.statusText}>{isUpload ? "불가능" : "가능"}</span></p>
        <p>재등록 가능 횟수 : <span className={styles.statusText}>{reloadTimes}회</span></p>
        <div className={styles.guideText}>
          <ul>
            <li>"재업로드"는 1일 1회 가능하며, 신규 등록 횟수와는 무관합니다.</li>
            <li>"수정"은 횟수와 상관없이 모두 가능하지만, 업로드 일시는 변경이 안되어 상위노출이 되지는 않습니다.</li>
          </ul>
      </div>
      </div>



      <ul className={styles.listWrap}>
        {posts.map((post) => (
          <li key={post.id}>
            <div className={styles.postInfo}>
              <div className={styles.postContent}>
                <span className={styles.time}>{formatDate(post.updated_time)}</span>
                <a href={`/jd/${post.id}`} className={styles.title}>
                  {post.title}
                </a>
                <em>({post['1depth_region']} {post['2depth_region']}) - {post['1depth_category']} {post['2depth_category']}</em>
              </div>
              <div className={styles.buttonGroup}>
                <span className={styles.recall}>
                  <a href={`/write?id=${post.id}`}>[수정]</a>
                </span>
                <span className={styles.recall}>
                  <a onClick={() => handleReload(post.id)}>[재업로드]</a>
                </span>
                <span className={styles.recall}>
                  <a onClick={() => handleDelete(post.id)}>[삭제]</a>
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
    </div>
  );
};

export default Mylist;
