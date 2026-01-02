import React from 'react';
import Link from 'next/link';
import styles from '@/styles/MainMenu.module.css';

interface MainMenuProps {
  currentBoardType: string;
}

const MainMenu: React.FC<MainMenuProps> = ({ currentBoardType }) => {
  return (
    <ul className={styles.mainMenu}>
      <div className={styles.layout}>
        <div className={styles.menuItems}>
          <li>
            <Link 
              href={{ pathname: '/board', query: { board_type: '0' } }}
              className={currentBoardType === '0' ? styles.focus : ''}
            >
              구인정보
            </Link>
          </li>
          <li>
            <Link 
              href={{ pathname: '/board', query: { board_type: '1' } }}
              className={currentBoardType === '1' ? styles.focus : ''}
            >
              구직정보
            </Link>
          </li>
          <li>
            <Link 
              href={{ pathname: '/board', query: { board_type: '4' } }}
              className={currentBoardType === '4' ? styles.focus : ''}
            >
              자유게시판
            </Link>
          </li>
        </div>
      </div>
    </ul>
  );
};

export default MainMenu;
