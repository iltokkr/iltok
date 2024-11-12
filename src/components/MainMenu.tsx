import React, { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import styles from '@/styles/MainMenu.module.css';
import { useLanguage } from '@/hooks/useLanguage';

interface MainMenuProps {
  currentBoardType: string;
}

const MainMenu: React.FC<MainMenuProps> = ({ currentBoardType }) => {
  const { currentLanguage, changeLanguage } = useLanguage();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLanguageChange = useCallback((lang: string) => {
    changeLanguage(lang);
    setIsDropdownOpen(false);

    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'language_change', {
        event_category: 'Language',
        event_label: lang,
        from_language: currentLanguage
      });
    }
  }, [changeLanguage, currentLanguage]);

  return (
    <ul className={styles.mainMenu}>
      <div className={styles.layout}>
        <div className={styles.menuItems}>
          <li>
            <Link href="/board?board_type=0" className={currentBoardType === '0' ? styles.focus : ''}>
              구인정보
            </Link>
          </li>
          <li>
            <Link href="/board?board_type=1" className={currentBoardType === '1' ? styles.focus : ''}>
              구직정보
            </Link>
          </li>
        </div>
        
        <div className={styles.languageSelector} ref={dropdownRef}>
          <button 
            className={styles.languageButton}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-label="Select language"
          >
            {currentLanguage === 'ko' && '한국어'}
            {currentLanguage === 'en' && 'English'}
            {currentLanguage === 'zh' && '中文'}
            {currentLanguage === 'ja' && '日本語'}
            <span className={styles.arrow}>▼</span>
          </button>
          
          {isDropdownOpen && (
            <div className={styles.dropdown}>
              <button 
                className={`${styles.languageOption} ${currentLanguage === 'ko' ? styles.active : ''}`}
                onClick={() => handleLanguageChange('ko')}
                aria-selected={currentLanguage === 'ko'}
              >
                한국어
              </button>
              <button 
                className={`${styles.languageOption} ${currentLanguage === 'en' ? styles.active : ''}`}
                onClick={() => handleLanguageChange('en')}
                aria-selected={currentLanguage === 'en'}
              >
                English
              </button>
              <button 
                className={`${styles.languageOption} ${currentLanguage === 'zh' ? styles.active : ''}`}
                onClick={() => handleLanguageChange('zh')}
                aria-selected={currentLanguage === 'zh'}
              >
                中文
              </button>
              <button 
                className={`${styles.languageOption} ${currentLanguage === 'ja' ? styles.active : ''}`}
                onClick={() => handleLanguageChange('ja')}
                aria-selected={currentLanguage === 'ja'}
              >
                日本語
              </button>
            </div>
          )}
        </div>
      </div>
    </ul>
  );
};

export default MainMenu;
