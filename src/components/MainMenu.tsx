import React from 'react';
import styles from '@/styles/MainMenu.module.css';

const MainMenu: React.FC = () => (
  <ul className={styles.mainMenu}>
    <li><a className={styles.focus} href="/board?bo_table=job">구인정보</a></li>
    <li><a href="/board?bo_table=offer">구직정보</a></li>
    <li><a href="/board?bo_table=sale">중고시장</a></li>
    <li><a href="/board?bo_table=house">부동산정보</a></li>
  </ul>
);

export default MainMenu;