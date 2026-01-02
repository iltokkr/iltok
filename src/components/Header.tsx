import React, { useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import styles from '@/styles/Header.module.css';
import LoginPopup from './LoginPopup';
import { AuthContext } from '@/contexts/AuthContext';
import { FaHome, FaUser, FaPen, FaSignOutAlt, FaTimes } from 'react-icons/fa';

const Header: React.FC = () => {
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const auth = useContext(AuthContext);
  const router = useRouter();

  if (!auth) throw new Error("AuthContext not found");

  const { isLoggedIn, logout } = auth;

  const handleAuthRequiredAction = (e: React.MouseEvent, action: string) => {
    e.preventDefault();
    if (!isLoggedIn) {
      setShowLoginPopup(true);
    } else {
      router.push(action === '글쓰기' ? '/write' : '/my');
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
    document.body.style.overflow = !showMobileMenu ? 'hidden' : 'auto';
  };

  useEffect(() => {
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.layout}>
          <div className={styles.path}>
            <a className={styles.logoTxt} href="/board"><em>114</em>114KR.COM</a>
          </div>
          {!showMobileMenu && (
            <button 
              className={styles.mobileMenuButton} 
              onClick={toggleMobileMenu}
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
            <li><a href="/my" onClick={(e) => handleAuthRequiredAction(e, '내가쓴글')}> 마이페이지</a></li>
            <li><a className={styles.focus} href="/write"> 글쓰기</a></li>
            {isLoggedIn && (
              <li><a href="#" onClick={handleLogout}> 로그아웃</a></li>
            )}
          </ul>
        </div>
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
