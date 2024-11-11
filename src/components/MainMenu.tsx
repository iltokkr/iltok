import React from 'react';
import Link from 'next/link';
import styles from '@/styles/MainMenu.module.css';

interface MainMenuProps {
  currentBoardType: string;
}

const MainMenu: React.FC<MainMenuProps> = ({ currentBoardType }) => (
  <ul className={styles.mainMenu}>
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
    {/* <li>
      <Link href="/board?board_type=2" className={currentBoardType === '2' ? styles.focus : ''}>
        중고시장
      </Link>
    </li>
    <li>
      <Link href="/board?board_type=3" className={currentBoardType === '3' ? styles.focus : ''}>
        부동산정보
      </Link>
    </li> */}
  </ul>
);

export default MainMenu;
