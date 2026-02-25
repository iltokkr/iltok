import React, { useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/Header.module.css';
import LoginPopup from './LoginPopup';
import { AuthContext } from '@/contexts/AuthContext';
import { FaTimes, FaSearch } from 'react-icons/fa';

const Header: React.FC = () => {
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const auth = useContext(AuthContext);
  const router = useRouter();

  if (!auth) throw new Error("AuthContext not found");

  const { isLoggedIn } = auth;

  const handleFreeAdClick = (e: React.MouseEvent, closeMenu = false) => {
    e.preventDefault();
    if (closeMenu) toggleMobileMenu();
    if (!isLoggedIn) {
      setShowLoginPopup(true);
    } else {
      router.push('/write');
    }
  };

  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
    document.body.style.overflow = !showMobileMenu ? 'hidden' : 'auto';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowMobileSearch(false);
    if (searchKeyword.trim()) {
      router.push({
        pathname: '/board',
        query: { board_type: '0', keyword: searchKeyword.trim(), searchType: 'both' }
      });
    } else {
      router.push({ pathname: '/board', query: { board_type: '0' } });
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchKeyword(value);
    if (value === '' && router.pathname === '/board' && router.query.keyword) {
      const { keyword, searchType, page, ...rest } = router.query;
      router.push({ pathname: '/board', query: rest });
    }
  };

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  useEffect(() => {
    if (router.pathname === '/board' && router.query.keyword) {
      setSearchKeyword((router.query.keyword as string) || '');
    }
  }, [router.pathname, router.query.keyword]);

  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.layout}>
          <div className={styles.path}>
            <a className={styles.logoTxt} href="/board">
              <span className={styles.logoChar} style={{ animationDelay: '0ms' }}>1</span>
              <span className={styles.logoChar} style={{ animationDelay: '50ms' }}>1</span>
              <span className={styles.logoChar} style={{ animationDelay: '100ms' }}>4</span>
              <span className={styles.logoChar} style={{ animationDelay: '150ms' }}>1</span>
              <span className={styles.logoChar} style={{ animationDelay: '200ms' }}>1</span>
              <span className={styles.logoChar} style={{ animationDelay: '250ms' }}>4</span>
              <span className={styles.logoSuffix}>KR</span>
              <span className={styles.logoDomain}>.com</span>
            </a>
            <span className={styles.tagline}>
              <span className={styles.taglineText}>외국인 특화 채용 플랫폼</span>
            </span>
          </div>
          <div className={styles.searchWrap}>
            <form className={styles.searchForm} onSubmit={handleSearch}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="어떤 알바를 찾으세요?"
                value={searchKeyword}
                onChange={handleSearchChange}
              />
              <button type="submit" className={styles.searchButton} aria-label="검색">
                <FaSearch />
              </button>
            </form>
            <button
              type="button"
              className={styles.mobileSearchToggle}
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              aria-label="검색"
              aria-expanded={showMobileSearch}
            >
              <FaSearch />
            </button>
          </div>
          {!showMobileMenu && (
            <button 
              className={styles.mobileMenuButton} 
              onClick={toggleMobileMenu}
              aria-label="메뉴"
            >
              ☰
            </button>
          )}
          <ul className={`${styles.topr} ${showMobileMenu ? styles.showMobileMenu : ''}`}>
            {showMobileMenu && (
              <button 
                className={styles.closeButton} 
                onClick={toggleMobileMenu}
              >
                <FaTimes />
              </button>
            )}
            <li className={styles.mobileOnlyCta}>
              <a href="/write" onClick={(e) => handleFreeAdClick(e, true)}>
                무료 공고 등록
              </a>
            </li>
          </ul>
        </div>
        {showMobileSearch && (
          <div className={styles.mobileSearchBar}>
            <form className={styles.mobileSearchForm} onSubmit={handleSearch}>
              <input
                type="text"
                className={styles.mobileSearchInput}
                placeholder="어떤 알바를 찾으세요?"
                value={searchKeyword}
                onChange={handleSearchChange}
                autoFocus
              />
              <button type="submit" className={styles.mobileSearchButton} aria-label="검색">
                <FaSearch />
              </button>
            </form>
          </div>
        )}
      </div>
      <div 
        className={`${styles.overlay} ${showMobileMenu ? styles.showOverlay : ''}`}
        onClick={toggleMobileMenu}
      ></div>
      {showLoginPopup && <LoginPopup onClose={() => setShowLoginPopup(false)} />}
    </>
  );
};

export default Header;
