import { useState, useEffect } from 'react';

export const useReadPosts = () => {
  const [readPosts, setReadPosts] = useState<Set<number>>(new Set());

  // 컴포넌트 마운트 시 localStorage에서 읽은 게시물 목록을 불러옴
  useEffect(() => {
    const stored = localStorage.getItem('readPosts');
    if (stored) {
      setReadPosts(new Set(JSON.parse(stored)));
    }
  }, []);

  // 게시물을 읽은 것으로 표시
  const markAsRead = (postId: number) => {
    setReadPosts(prev => {
      const newSet = new Set(prev).add(postId);
      localStorage.setItem('readPosts', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  // 게시물이 읽었는지 확인
  const isRead = (postId: number) => {
    return readPosts.has(postId);
  };

  return { markAsRead, isRead };
}; 