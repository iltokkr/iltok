import React, { useState, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/MainMenu.module.css';
import LoginPopup from './LoginPopup';
import SignupTypeModal from './SignupTypeModal';
import { AuthContext } from '@/contexts/AuthContext';

interface MainMenuProps {
  currentBoardType?: string;
  showMenuItems?: boolean;
}

const MainMenu: React.FC<MainMenuProps> = ({ currentBoardType = '0', showMenuItems = true }) => {
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [showSignupTypeModal, setShowSignupTypeModal] = useState(false);
  const [loginInitialUserType, setLoginInitialUserType] = useState<'business' | 'jobseeker' | undefined>(undefined);
  const auth = useContext(AuthContext);
  const router = useRouter();

  const handleSignupTypeSelect = (type: 'jobseeker' | 'business') => {
    setShowSignupTypeModal(false);
    if (type === 'business') {
      router.push('/signup/business');
    } else {
      setLoginInitialUserType(type);
      setShowLoginPopup(true);
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
          {showMenuItems && (
            <div className={styles.menuItems}>
              <li>
                <Link 
                  href={{ pathname: '/board', query: { board_type: '0' } }}
                  className={currentBoardType === '0' ? styles.focus : ''}
                >
                  채용정보
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
            </div>
          )}
          <div className={styles.menuRight}>
            {auth?.isLoggedIn ? (
              <>
                <a href="/my" className={styles.menuLink}>마이페이지</a>
                <span className={styles.menuSep}>|</span>
                <a href="#" onClick={(e) => { e.preventDefault(); auth.logout().then(() => router.push('/')); }} className={styles.menuLink}>로그아웃</a>
              </>
            ) : (
              <>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowLoginPopup(true); }} className={styles.menuLink}>로그인</a>
                <span className={styles.menuSep}>|</span>
                <a href="#" onClick={(e) => { e.preventDefault(); setShowSignupTypeModal(true); }} className={styles.menuLink}>회원가입</a>
              </>
            )}
            <span className={styles.menuSep}>|</span>
            <button className={styles.ctaBtn} onClick={handleFreeAdClick}>
              무료 공고 등록
            </button>
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
