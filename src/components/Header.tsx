import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/Header.module.css';
import LoginPopup from './LoginPopup';
import SignupTypeModal from './SignupTypeModal';
import { AuthContext } from '@/contexts/AuthContext';
import { FaSearch, FaTimes, FaBars } from 'react-icons/fa';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const Header: React.FC = () => {
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [showSignupTypeModal, setShowSignupTypeModal] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [userType, setUserType] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const auth = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (auth?.user?.id) {
      setUserType(null);
      setUserId(null);
      let cancelled = false;
      supabase
        .from('users')
        .select('user_type, user_id, email, name')
        .eq('id', auth.user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.error('Header users 조회 오류:', error);
            setUserType('jobseeker');
            setUserId(null);
            return;
          }
          setUserType(data?.user_type || 'jobseeker');
          setUserId(data?.user_type === 'jobseeker' ? (data?.name || data?.user_id || data?.email || null) : (data?.user_id || data?.email || null));
        });
      return () => { cancelled = true; };
    } else {
      setUserType(null);
      setUserId(null);
    }
  }, [auth?.user?.id]);

  if (!auth) throw new Error("AuthContext not found");

  const { isLoggedIn } = auth;

  const currentBoardType = (router.pathname === '/board' ? (router.query.board_type as string) : null) || '0';
  const currentSection = (router.pathname === '/my' ? (router.query.section as string) : router.pathname === '/write' && router.query.board_type === '1' ? 'resume' : undefined) as 'ads' | 'info' | 'applications' | 'resume' | undefined;
  const showMenuItems = !['/signup/business', '/signup/personal', '/privacy', '/privacy-policy'].includes(router.pathname) && !router.pathname.startsWith('/resume');

  const handleFreeAdClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowMobileMenu(false);
    if (!isLoggedIn) {
      setShowLoginPopup(true);
    } else {
      router.push('/write');
    }
  };

  const handleSignupTypeSelect = (type: 'jobseeker' | 'business') => {
    setShowSignupTypeModal(false);
    setShowMobileMenu(false);
    if (type === 'business') {
      router.push('/signup/business');
    } else {
      router.push('/signup/personal');
    }
  };

  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
    document.body.style.overflow = !showMobileMenu ? 'hidden' : 'auto';
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(false);
    document.body.style.overflow = 'auto';
  };

  useEffect(() => {
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

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
          <div className={styles.headerRight}>
            {(mounted && isLoggedIn && userId && (userType === 'business' || userType === 'both' || userType === 'jobseeker')) ? (
              <span className={styles.mobileUserName}>{userId}님</span>
            ) : null}
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
            <button
              type="button"
              className={styles.mobileMenuBtn}
              onClick={toggleMobileMenu}
              aria-label="메뉴"
            >
              <FaBars />
            </button>
          </div>
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
      <div className={`${styles.mobileMenuOverlay} ${showMobileMenu ? styles.showOverlay : ''}`} onClick={closeMobileMenu} />
      <div className={`${styles.mobileMenu} ${showMobileMenu ? styles.showMobileMenu : ''}`}>
        <button className={styles.mobileMenuClose} onClick={closeMobileMenu} aria-label="닫기">
          <FaTimes />
        </button>
        <nav className={styles.mobileMenuNav}>
          {showMenuItems && (
            <>
              <Link href={{ pathname: '/board', query: { board_type: '0' } }} onClick={closeMobileMenu} className={styles.mobileMenuLink}>
                채용정보
              </Link>
              {(userType === 'business' || userType === 'both') && isLoggedIn && (
                <>
                  <Link href="/my" onClick={closeMobileMenu} className={styles.mobileMenuLink}>공고관리</Link>
                  <Link href="/my?section=info" onClick={closeMobileMenu} className={styles.mobileMenuLink}>회원정보</Link>
                </>
              )}
              {userType === 'jobseeker' && isLoggedIn && (
                <>
                  <Link href="/my?section=applications" onClick={closeMobileMenu} className={styles.mobileMenuLink}>지원공고</Link>
                  <Link href="/my?section=info" onClick={closeMobileMenu} className={styles.mobileMenuLink}>회원정보</Link>
                </>
              )}
              {(!isLoggedIn || userType === null) && showMenuItems && (
                <Link href="/my?section=info" onClick={closeMobileMenu} className={styles.mobileMenuLink}>회원정보</Link>
              )}
              {userType !== 'jobseeker' && (
                <a href="/write" onClick={handleFreeAdClick} className={styles.mobileMenuCta}>
                  공고등록
                </a>
              )}
              <a href="https://pf.kakao.com/_ywaMn" target="_blank" rel="noopener noreferrer" className={styles.mobileMenuLink} onClick={closeMobileMenu}>
                고객센터
              </a>
            </>
          )}
          {!showMenuItems && userType !== 'jobseeker' && (
            <a href="/write" onClick={handleFreeAdClick} className={styles.mobileMenuCta}>
              공고등록
            </a>
          )}
          <div className={styles.mobileMenuAuthWrap}>
          <div className={styles.mobileMenuDivider} />
          <div className={styles.mobileMenuAuthSection}>
            {isLoggedIn && userId && (userType === 'business' || userType === 'both' || userType === 'jobseeker') && (
              <span className={styles.mobileMenuUserTag}>{userId}님</span>
            )}
            {isLoggedIn ? (
              <>
                <a
                  href={userType === 'jobseeker' ? '/my?section=applications' : (userType === 'both' && (currentSection === 'applications' || currentSection === 'info' || currentSection === 'resume' || currentSection !== 'ads') ? '/my?section=applications' : '/my')}
                  className={styles.mobileMenuLink}
                  onClick={(e) => {
                    e.preventDefault();
                    const href = userType === 'jobseeker' ? '/my?section=applications' : (userType === 'both' && (currentSection === 'applications' || currentSection === 'info' || currentSection === 'resume' || currentSection !== 'ads') ? '/my?section=applications' : '/my');
                    closeMobileMenu();
                    router.push(href);
                  }}
                >
                  {userType === 'jobseeker' ? '개인서비스' : (userType === 'both' && (currentSection === 'applications' || currentSection === 'info' || currentSection === 'resume' || currentSection !== 'ads') ? '개인서비스' : '기업서비스')}
                </a>
                <a href="#" onClick={(e) => { e.preventDefault(); auth.logout().then(() => { closeMobileMenu(); router.push('/board'); }); }} className={styles.mobileMenuLink}>
                  로그아웃
                </a>
              </>
            ) : (
              <>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowMobileMenu(false); setShowLoginPopup(true); }} className={styles.mobileMenuLink}>
                  로그인
                </a>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowMobileMenu(false); setShowSignupTypeModal(true); }} className={styles.mobileMenuLink}>
                  회원가입
                </a>
              </>
            )}
          </div>
          </div>
        </nav>
      </div>
      {showLoginPopup && <LoginPopup onClose={() => setShowLoginPopup(false)} />}
      {showSignupTypeModal && <SignupTypeModal onClose={() => setShowSignupTypeModal(false)} onSelect={handleSignupTypeSelect} />}
    </>
  );
};

export default Header;
