import React, { useState, useContext, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import styles from '@/styles/MainMenu.module.css';
import LoginPopup from './LoginPopup';
import SignupTypeModal from './SignupTypeModal';
import { AuthContext } from '@/contexts/AuthContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface MainMenuProps {
  currentBoardType?: string;
  showMenuItems?: boolean;
  /** 기업회원 메뉴에서 현재 섹션 (공고관리/회원정보), 개인회원은 지원공고 포함 */
  currentSection?: 'ads' | 'info' | 'applications';
}

const MainMenu: React.FC<MainMenuProps> = ({ currentBoardType = '0', showMenuItems = true, currentSection }) => {
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [showSignupTypeModal, setShowSignupTypeModal] = useState(false);
  const [loginInitialUserType, setLoginInitialUserType] = useState<'business' | 'jobseeker' | undefined>(undefined);
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
        .single()
        .then(({ data }) => {
          if (cancelled) return;
          setUserType(data?.user_type || null);
          setUserId(data?.user_type === 'jobseeker' ? (data?.name || data?.user_id || data?.email || null) : (data?.user_id || data?.email || null));
        });
      return () => { cancelled = true; };
    } else {
      setUserType(null);
      setUserId(null);
    }
  }, [auth?.user?.id]);

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
          {showMenuItems && (
            <div className={styles.menuItems}>
              {!mounted || auth?.isLoading || (auth?.isLoggedIn && userType === null) ? (
                <span className={styles.menuItemsPlaceholder} aria-hidden="true" />
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
                    <Link href="/my" className={currentSection === 'ads' ? styles.focus : styles.menuLink}>
                      공고관리
                    </Link>
                  </li>
                  <li>
                    <Link href="/my?section=info" className={currentSection === 'info' ? styles.focus : styles.menuLink}>
                      회원정보
                    </Link>
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
                    <Link href="/my?section=applications" className={currentSection === 'applications' ? styles.focus : styles.menuLink}>
                      지원공고
                    </Link>
                  </li>
                  <li>
                    <Link href="/my?section=info" className={currentSection === 'info' ? styles.focus : styles.menuLink}>
                      회원정보
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
              )}
            </div>
          )}
          <div className={styles.menuRight}>
            {!mounted || auth?.isLoading || (auth?.isLoggedIn && userType === null) ? (
              <span className={styles.menuPlaceholder} aria-hidden="true" />
            ) : auth?.isLoggedIn ? (
              <>
                <a href="/my" className={styles.menuLink}>{(() => {
                  const showPersonalLabel = userType === 'jobseeker' || (userType === 'both' && (currentSection === 'applications' || currentSection === 'info'));
                  return showPersonalLabel ? (userId ? <><span className={styles.userTag}>{userId}님</span> 개인서비스</> : '개인서비스') : (userType === 'business' || userType === 'both') ? (userId ? <><span className={styles.userTag}>{userId}님</span> 기업서비스</> : '기업서비스') : '마이페이지';
                })()}</a>
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
