import React, { useState, useEffect, useContext } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';
import styles from '@/styles/Comment.module.css';
import { format, parseISO, subHours } from 'date-fns';
import LoginPopup from './LoginPopup';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CommentProps {
  jdId: number;
  initialComments: CommentType[];
}

interface CommentType {
  id: number;
  created_at: string;
  text: string;
  user_id: string;
  jd_id: number;
}

const Comment: React.FC<CommentProps> = ({ jdId, initialComments }) => {
  const [comments, setComments] = useState<CommentType[]>(initialComments);
  const [newComment, setNewComment] = useState('');
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const auth = useContext(AuthContext);

  if (!auth) throw new Error("AuthContext not found");
  const { user, isLoggedIn } = auth;

  useEffect(() => {
    fetchComments();
  }, [jdId]);

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('comment')
      .select(`
        id,
        created_at,
        text,
        user_id,
        jd_id
      `)
      .eq('jd_id', jdId)
      .order('created_at', { ascending: false });

    if (data && !error) {
      setComments(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLoggedIn) {
      setShowLoginPopup(true);
      return;
    }

    if (!newComment.trim()) return;

    const { data, error } = await supabase
      .from('comment')
      .insert([
        {
          jd_id: jdId,
          user_id: user?.id,
          text: newComment.trim()
        }
      ])
      .select()
      .single();

    if (!error && data) {
      setComments(prevComments => [data, ...prevComments]);
      setNewComment('');
    } else {
      console.error('Error posting comment:', error);
      alert('댓글 등록에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;

    const { error } = await supabase
      .from('comment')
      .delete()
      .eq('id', commentId);

    if (!error) {
      setComments(prevComments => prevComments.filter(comment => comment.id !== commentId));
    } else {
      console.error('Error deleting comment:', error);
      alert('댓글 삭제에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);
    return format(koreaTime, 'MM-dd HH:mm');
  };

  // 익명 사용자 이름 생성 함수
  const getAnonymousName = (userId: string) => {
    // userId의 마지막 4자리를 사용하여 익명 번호 생성
    const anonymousNumber = userId.slice(-4);
    return `익명${anonymousNumber}`;
  };

  return (
    <div className={styles.commentSection}>
      <h3 className={styles.commentTitle}>
        댓글 ({comments.length})
      </h3>
      
      <form onSubmit={handleSubmit} className={styles.commentForm}>
        {!isLoggedIn ? (
          <div 
            className={styles.commentInput}
            onClick={() => setShowLoginPopup(true)}
            style={{ cursor: 'pointer' }}
          >
            쾌적한 댓글 환경을 위해 휴대폰 인증 후 작성할 수 있습니다.<br />
            휴대폰 인증 후 댓글을 작성해보세요!
          </div>
        ) : (
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="댓글을 입력하세요"
            className={styles.commentInput}
          />
        )}
        <button 
          type="submit" 
          disabled={!isLoggedIn || !newComment.trim()}
          className={styles.submitButton}
        >
          등록
        </button>
      </form>

      <div className={styles.commentList}>
        {comments.map((comment) => (
          <div key={comment.id} className={styles.commentItem}>
            <div className={styles.commentHeader}>
              <span className={styles.userName}>{getAnonymousName(comment.user_id)}</span>
              <span className={styles.commentDate}>{formatDate(comment.created_at)}</span>
              {user && comment.user_id === user.id && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className={styles.deleteButton}
                  aria-label="댓글 삭제"
                >
                  ✕
                </button>
              )}
            </div>
            <p className={styles.commentText}>{comment.text}</p>
          </div>
        ))}
      </div>

      {showLoginPopup && <LoginPopup onClose={() => setShowLoginPopup(false)} />}
    </div>
  );
};

export default Comment; 