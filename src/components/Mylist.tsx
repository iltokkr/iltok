import React from 'react';
import styles from '@/styles/Mylist.module.css';

interface MyPost {
  id: number;
  created_at: string;
  title: string;
  '1depth_region': string;
  '2depth_region': string;
  '1depth_category': string;
  '2depth_category': string;
}

interface MylistProps {
  posts: MyPost[];
  isAccept: boolean;  // businessStatus 대신 isAccept를 받습니다.
}


const Mylist: React.FC<MylistProps> = ({ posts, isAccept }) => {
  const businessStatus = isAccept ? "인증" : "대기중";  

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}-${day}`;
  };

  return (
    <div className={styles.layout}>
      <div className={styles.listHead}>
        총 {posts.length}개 <span className={styles.delAll}>(3개월이 지난글은 삭제될 수 있습니다.)</span>
      </div>
      <div className={styles.businessStatus}>
        구인업체 사업자 인증상태 : <span className={styles.statusText}>{businessStatus}</span>
      </div>
      <ul className={styles.listWrap}>
        {posts.map((post) => (
          <li key={post.id}>
            <div className={styles.postInfo}>
            <span className={styles.recall}>
              <a href={`/write?id=${post.id}`}>[재업로드]</a>
            </span>
              <span className={styles.time}>{formatDate(post.created_at)}</span>
              <a href={`/jd/${post.id}`} className={styles.title}>
                {post.title}
              </a>
              <em>({post['1depth_region']} {post['2depth_region']}) - {post['1depth_category']} {post['2depth_category']}</em>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Mylist;
