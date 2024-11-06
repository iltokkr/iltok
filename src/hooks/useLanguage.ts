import { useState, useEffect } from 'react';

export const useLanguage = () => {
  const [currentLanguage, setCurrentLanguage] = useState('ko');

  useEffect(() => {
    // 초기 로드 시 localStorage에서 언어 설정 가져오기
    const savedLanguage = localStorage.getItem('preferredLanguage');
    if (savedLanguage) {
      setCurrentLanguage(savedLanguage);
    }
  }, []);

  const changeLanguage = (language: string) => {
    setCurrentLanguage(language);
    localStorage.setItem('preferredLanguage', language);
  };

  return { currentLanguage, changeLanguage };
}; 