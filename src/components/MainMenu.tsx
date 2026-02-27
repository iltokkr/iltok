import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
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
    if (!auth?.isLoggedIn) {
      setShowLoginPopup(true);
    } else {
      router.push('/write');
    }
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
              ) : mounted && (userType === 'business' || userType === 'both') && auth?.isLoggedIn ? (
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
                    <Link href="/my" className={currentSection === 'ads' ? styles.focus : styles.menuLink}>
                      공고관리
                    </Link>
                  </li>
                  <li>
                    <Link href="/my?section=info" className={currentSection === 'info' ? styles.focus : styles.menuLink}>
                      회원정보
                    </Link>
                  </li>
                  <li>
                    <a href="/write" onClick={handleFreeAdClick} className={`${styles.menuCtaLink} ${router.pathname === '/write' ? styles.focus : ''}`}>
                      공고등록
                    </a>
                  </li>
                </>
              ) : mounted && userType === 'jobseeker' && auth?.isLoggedIn ? (
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
                    <Link href="/my?section=applications" className={currentSection === 'applications' ? styles.focus : styles.menuLink}>
                      지원공고
                    </Link>
                  </li>
                  <li>
                    <Link href="/my?section=resume" className={`${styles.menuCtaLink} ${currentSection === 'resume' ? styles.focus : ''}`}>
                      이력서 작성
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
              <>
                {(() => {
                  const section = router.pathname === '/my' ? (router.query.section as string) : currentSection;
                  const showPersonal = userType === 'jobseeker' || (userType === 'both' && (section === 'applications' || section === 'info' || section === 'resume' || section !== 'ads'));
                  const serviceHref = showPersonal ? '/my?section=applications' : '/my';
                  const serviceLabel = showPersonal ? (userId ? <><span className={styles.userTag}>{userId}님</span> 개인서비스</> : '개인서비스') : (userId ? <><span className={styles.userTag}>{userId}님</span> 기업서비스</> : '기업서비스');
                  return (
                    <a
                      href={serviceHref}
                      className={styles.menuLink}
                      onClick={(e) => { e.preventDefault(); router.push(serviceHref); }}
                    >
                      {userType === 'jobseeker' ? (userId ? <><span className={styles.userTag}>{userId}님</span> 개인서비스</> : '개인서비스') : userType === 'business' ? (userId ? <><span className={styles.userTag}>{userId}님</span> 기업서비스</> : '기업서비스') : serviceLabel}
                    </a>
                  );
                })()}
                <span className={styles.menuSep}>|</span>
                <a href="#" onClick={(e) => { e.preventDefault(); auth.logout().then(() => router.push('/board')); }} className={styles.menuLink}>로그아웃</a>
              </>
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
