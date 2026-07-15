import React, { useState, useContext, useEffect, useRef } from 'react';
import Link from 'next/link';
import { FaUserCircle, FaChevronDown, FaExchangeAlt } from 'react-icons/fa';
import { useRouter } from 'next/router';
import styles from '@/styles/MainMenu.module.css';
import LoginPopup from './LoginPopup';
import SignupTypeModal from './SignupTypeModal';
import { AuthContext } from '@/contexts/AuthContext';
import { UserContext } from '@/contexts/UserContext';

interface MainMenuProps {
  currentBoardType?: string;
  showMenuItems?: boolean;
  /** 기업회원 메뉴에서 현재 섹션 (공고관리/회원정보), 개인회원은 지원공고/이력서 포함 */
  currentSection?: 'ads' | 'info' | 'applications' | 'resume';
}

const MainMenu: React.FC<MainMenuProps> = ({ currentBoardType = '0', showMenuItems = true, currentSection }) => {
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [showSignupTypeModal, setShowSignupTypeModal] = useState(false);
  const [loginInitialUserType, setLoginInitialUserType] = useState<'business' | 'jobseeker' | undefined>(undefined);
  const [mounted, setMounted] = useState(false);
  const auth = useContext(AuthContext);
  const userProfile = useContext(UserContext);
  const router = useRouter();

  useEffect(() => setMounted(true), []);

  const userType = userProfile?.userType ?? null;
  const activeLoginType = mounted ? (localStorage.getItem('iltok_active_login_type') as 'business' | 'jobseeker' | null) : null;
  // DB user_type이 진실의 원천. activeLoginType(localStorage)은 'both' 계정에서 어느 모드인지 구분할 때,
  // 그리고 userType 로딩 전 깜빡임 방지용으로만 쓴다. (my.tsx와 동일한 규칙 — 메뉴/본문 불일치 방지)
  const effectiveUserType = userType === 'both' ? (activeLoginType ?? 'business') : (userType ?? activeLoginType);
  const userId = userProfile?.userId ?? null;
  const isUserLoading = userProfile?.isUserLoading ?? false;

  const handleSignupTypeSelect = (type: 'jobseeker' | 'business') => {
    setShowSignupTypeModal(false);
    if (type === 'business') {
      router.push('/signup/business');
    } else {
      router.push('/signup/personal');
    }
  };

  const handleLoginClick = () => {
    setLoginInitialUserType(undefined);
    setShowLoginPopup(true);
  };

  const handleFreeAdClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push('/write');
  };

  // both 계정: 재로그인 없이 개인↔기업 모드 전환 (localStorage 플래그만 변경 후 이동)
  const handleModeSwitch = (target: 'jobseeker' | 'business') => {
    localStorage.setItem('iltok_active_login_type', target);
    router.push(target === 'jobseeker' ? '/my?section=applications' : '/my');
  };

  // 프로필 드롭다운 (PC) — 계정 관련 항목을 우측 프로필 메뉴로 모음
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showProfileMenu) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showProfileMenu]);

  const goProfile = (href: string) => {
    setShowProfileMenu(false);
    router.push(href);
  };

  return (
    <>
      <ul className={styles.mainMenu}>
        <div className={styles.layout}>
          <div className={styles.menuItems}>
          {showMenuItems ? (
              !mounted ? (
                <span className={styles.menuItemsPlaceholder} aria-hidden="true" />
              ) : auth?.isLoading || (isUserLoading && !userType) ? (
                /* 로딩 중: 비로그인 메뉴 표시 */
                <>
                  <li>
                    <Link href={{ pathname: '/board', query: { board_type: '0' } }} className={currentBoardType === '0' ? styles.focus : ''}>
                      채용정보
                    </Link>
                  </li>
                  <li>
                    <Link href={{ pathname: '/board', query: { board_type: '1' } }} className={currentBoardType === '1' ? styles.focus : ''}>
                      인재정보
                    </Link>
                  </li>
                  <li>
                    <a href="https://pf.kakao.com/_ywaMn" target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
                      고객센터
                    </a>
                  </li>
                  <li>
                    <a href="/write" onClick={handleFreeAdClick} className={`${styles.menuCtaLink} ${router.pathname === '/write' ? styles.focus : ''}`}>
                      공고등록
                    </a>
                  </li>
                </>
              ) : mounted && effectiveUserType === 'business' && auth?.isLoggedIn ? (
                <>
                  <li>
                    <Link 
                      href={{ pathname: '/board', query: { board_type: '0' } }}
                      className={router.pathname === '/board' && (router.query.board_type === '0' || !router.query.board_type) ? styles.focus : ''}
                    >
                      채용정보
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href={{ pathname: '/board', query: { board_type: '1' } }}
                      className={router.pathname === '/board' && router.query.board_type === '1' ? styles.focus : ''}
                    >
                      인재정보
                    </Link>
                  </li>
                  <li>
                    <a
                      href="https://pf.kakao.com/_ywaMn"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.externalLink}
                    >
                      고객센터
                    </a>
                  </li>
                  <li>
                    <a href="/write" onClick={handleFreeAdClick} className={`${styles.menuCtaLink} ${router.pathname === '/write' ? styles.focus : ''}`}>
                      공고등록
                    </a>
                  </li>
                </>
              ) : mounted && effectiveUserType === 'jobseeker' && auth?.isLoggedIn ? (
                <>
                  <li>
                    <Link 
                      href={{ pathname: '/board', query: { board_type: '0' } }}
                      className={router.pathname === '/board' && (router.query.board_type === '0' || !router.query.board_type) ? styles.focus : ''}
                    >
                      채용정보
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href={{ pathname: '/board', query: { board_type: '1' } }}
                      className={router.pathname === '/board' && router.query.board_type === '1' ? styles.focus : ''}
                    >
                      인재정보
                    </Link>
                  </li>
                  <li>
                    <a
                      href="https://pf.kakao.com/_ywaMn"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.externalLink}
                    >
                      고객센터
                    </a>
                  </li>
                </>
              ) : (
                <>
                  <li>
                    <Link 
                      href={{ pathname: '/board', query: { board_type: '0' } }}
                      className={currentBoardType === '0' ? styles.focus : ''}
                    >
                      채용정보
                    </Link>
                  </li>
                  <li>
                    <Link 
                      href={{ pathname: '/board', query: { board_type: '1' } }}
                      className={currentBoardType === '1' ? styles.focus : ''}
                    >
                      인재정보
                    </Link>
                  </li>
                  <li>
                    <a 
                      href="https://pf.kakao.com/_ywaMn"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.externalLink}
                    >
                      고객센터
                    </a>
                  </li>
                  <li>
                    <a href="/write" onClick={handleFreeAdClick} className={`${styles.menuCtaLink} ${router.pathname === '/write' ? styles.focus : ''}`}>
                      공고등록
                    </a>
                  </li>
                </>
              )
            ) : (
              <li>
                <a href="/write" onClick={handleFreeAdClick} className={`${styles.menuCtaLink} ${router.pathname === '/write' ? styles.focus : ''}`}>
                  공고등록
                </a>
              </li>
            )}
            </div>
          <div className={styles.menuRight}>
            {!mounted ? (
              <span className={styles.menuPlaceholder} aria-hidden="true" />
            ) : auth?.isLoading || (isUserLoading && !userType) ? (
              <>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowLoginPopup(true); }} className={styles.menuLink}>로그인</a>
                <span className={styles.menuSep}>|</span>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowSignupTypeModal(true); }} className={styles.menuLink}>회원가입</a>
              </>
            ) : auth?.isLoggedIn ? (
              <div className={styles.profileWrap} ref={profileRef}>
                <button
                  type="button"
                  className={styles.profileBtn}
                  onClick={() => setShowProfileMenu((v) => !v)}
                  aria-expanded={showProfileMenu}
                  aria-label="내 메뉴"
                >
                  <FaUserCircle className={styles.profileAvatar} />
                  <FaChevronDown className={`${styles.profileCaret} ${showProfileMenu ? styles.profileCaretOpen : ''}`} />
                </button>
                {showProfileMenu && (
                  <div className={styles.profileMenu}>
                    <div className={styles.profileHeader}>
                      <span className={styles.profileName}>{userId ? `${userId}님` : '회원님'}</span>
                      <span className={styles.profileRole}>{effectiveUserType === 'jobseeker' ? '개인회원' : '기업회원'}</span>
                    </div>
                    <div className={styles.profileDivider} />
                    {effectiveUserType === 'business' ? (
                      <>
                        <button type="button" className={styles.profileItem} onClick={() => goProfile('/my')}>공고관리</button>
                        <button type="button" className={styles.profileItem} onClick={() => goProfile('/my?section=info')}>회원정보</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className={styles.profileItem} onClick={() => goProfile('/my?section=applications')}>지원공고</button>
                        <button type="button" className={styles.profileItem} onClick={() => goProfile('/my?section=resume')}>이력서 작성</button>
                        <button type="button" className={styles.profileItem} onClick={() => goProfile('/my?section=info')}>회원정보</button>
                      </>
                    )}
                    {userType === 'both' && (
                      <>
                        <div className={styles.profileDivider} />
                        <button
                          type="button"
                          className={`${styles.profileItem} ${styles.profileSwitch}`}
                          onClick={() => { setShowProfileMenu(false); handleModeSwitch(effectiveUserType === 'business' ? 'jobseeker' : 'business'); }}
                        >
                          <FaExchangeAlt /> {effectiveUserType === 'business' ? '개인 전환' : '기업 전환'}
                        </button>
                      </>
                    )}
                    <div className={styles.profileDivider} />
                    <button
                      type="button"
                      className={`${styles.profileItem} ${styles.profileLogout}`}
                      onClick={() => { setShowProfileMenu(false); auth.logout().then(() => router.push('/board')); }}
                    >
                      로그아웃
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowLoginPopup(true); }} className={styles.menuLink}>로그인</a>
                <span className={styles.menuSep}>|</span>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowSignupTypeModal(true); }} className={styles.menuLink}>회원가입</a>
              </>
            )}
          </div>
        </div>
      </ul>
      {showSignupTypeModal && (
        <SignupTypeModal
          onClose={() => setShowSignupTypeModal(false)}
          onSelect={handleSignupTypeSelect}
        />
      )}
      {showLoginPopup && (
        <LoginPopup
          onClose={() => setShowLoginPopup(false)}
          initialUserType={loginInitialUserType}
        />
      )}
    </>
  );
};

export default MainMenu;
