import React from 'react';
import styles from '@/styles/Footer.module.css';

const Footer: React.FC = () => (
  <div className={styles.footer}>
    <ul className={styles.layout}>
      <li><a href="#" className={styles.companyInfo}>114114KR ▼</a></li>
      <li><a href="/faq" target="_blank">질문답변</a></li>		
      <li><a href="/manual" target="_blank">사용메뉴얼</a></li>
    </ul>
  </div>
);

export default Footer;