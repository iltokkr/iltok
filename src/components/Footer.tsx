import React, { useState } from 'react';
import styles from '@/styles/Footer.module.css';

const Footer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <strong 
          className={styles.toggleText} 
          onClick={() => setIsOpen(!isOpen)}
        >
          114114KR
        </strong>
        {isOpen && (
          <div className={styles.content}>
            <div className={styles.companyInfo}>
              <div className={styles.infoRow}>
                <p>(주)일톡</p>
                <div className={styles.divider}></div>
                <p>대표: 김민혁</p>
              </div>
              <div className={styles.detailInfo}>
                <div className={styles.infoRow}>
                  <p>사업자등록번호 : 593-81-03089</p>
                </div>
                <div className={styles.infoRow}>
                  <p>직업정보제공사업 신고번호 : J1516020230004</p>
                </div>
                <div className={styles.infoRow}>
                  <p>통신판매업 신고번호 : 2023-성남분당A-1011호</p>
                </div>
                <p className={styles.infoRow}>경기도 성남시 분당구 판교역로 192번길 16, 806호</p>
              </div>
              <p className={styles.infoRow}>copyright by 주식회사 일톡 All rights reserved.</p>
            </div>
          </div>
        )}
      </div>
    </footer>
  );
};

export default Footer;
