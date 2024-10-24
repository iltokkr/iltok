import React, { useState, useContext } from 'react';
import styles from '@/styles/AdPopup.module.css';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';

// Supabase 클라이언트 초기화
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

interface AdPopupProps {
  onClose: () => void;
}

const AdPopup: React.FC<AdPopupProps> = ({ onClose }) => {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("AuthContext must be used within an AuthProvider");
  }

  const { user } = auth;

  const [vip, setVip] = useState('');
  const [phone, setPhone] = useState('');
  const [receipt, setReceipt] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      let fileUrl = null;
      
      // 파일 업로드 (세금계산서 선택 시)
      if (receipt === 'T' && file) {
        const { data, error } = await supabase.storage
          .from('ad_file')
          .upload(`${Date.now()}_${file.name}`, file);
        
        if (error) throw error;
        
        // 업로드된 파일의 public URL 가져오기
        const { data: publicUrlData } = supabase.storage
          .from('ad_file')
          .getPublicUrl(data.path);
        
        fileUrl = publicUrlData.publicUrl;
      }
      
      // receipt 값을 ad.type에 맞게 변환
      let adType;
      switch (receipt) {
        case '':
          adType = 'none';
          break;
        case 'C':
          adType = 'receipt';
          break;
        case 'T':
          adType = 'tax';
          break;
        default:
          adType = 'none';
      }
      
      // 데이터베이스에 정보 저장
      const { data, error } = await supabase
        .from('ad')
        .insert([
          {
            name: vip,
            number: phone,
            email: receipt === 'T' ? email : null,
            file_auth: fileUrl,
            type: adType,
            user: user ? user.id : null, // 로그인된 경우 user.id, 아니면 null
          },
        ]);
      
      if (error) throw error;
      
      console.log('Data saved successfully:', data);
      onClose(); // 성공 시 팝업 닫기
    } catch (error) {
      console.error('Error submitting data:', error);
      // 에러 처리 로직 추가 (예: 사용자에게 알림)
    }
  };

  return (
    <div className={styles.popWrap}>
      <div className={styles.popbox}>
        <div className={styles.title}>
          <div className={styles.tit}>PREMIUM 등록안내</div>
          <div className={styles.close} onClick={onClose}>X</div>
        </div>
        <div className={styles.cont}>
          <dl>
            <dt>상품내용 :</dt>
            <dd><b>TOP광고 영역 게시글 상위 노출</b></dd>
            <dt>상품금액 :</dt>
            <dd>30일/22만원(VAT포함)</dd>
            <dt>계좌번호 :</dt>
            <dd>
              <span id="account-number">국민은행 602437-04-005892</span>
            </dd>
            <dt>입금자명 :</dt>
            <dd>디플에이치알</dd>
            <dt>등록절차 :</dt>
            <dd>입금 후 신청</dd>
          </dl>
        </div>
        <form onSubmit={handleSubmit} className={styles.formContainer}>
          <div className={styles.radioGroup}>
            <label><input type="radio" name="receipt" value="" checked={receipt === ''} onChange={() => setReceipt('')} />안함</label>
            <label><input type="radio" name="receipt" value="C" checked={receipt === 'C'} onChange={() => setReceipt('C')} />현금영수증</label>
            <label><input type="radio" name="receipt" value="T" checked={receipt === 'T'} onChange={() => setReceipt('T')} />세금계산서</label>
          </div>
          <input 
            type="text" 
            value={vip} 
            onChange={(e) => setVip(e.target.value)} 
            placeholder="입금자명" 
            maxLength={20} 
            className={styles.inputAuth}
          />
          <input 
            type="text" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
            placeholder="휴대폰번호" 
            maxLength={11} 
            className={styles.inputAuth}
          />
          {receipt === 'T' && (
            <>
              <input 
                type="text" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="세금계산서발행 이메일" 
                maxLength={100} 
                className={styles.inputAuth}
              />
              <input 
                type="file" 
                onChange={(e) => setFile(e.target.files?.[0] || null)} 
                accept=".pdf,.jpg,.png"
                className={styles.inputAuth}
              />
            </>
          )}
          <button type="submit" className={styles.vipgo}>신청</button>
        </form>
      </div>
    </div>
  );
};

export default AdPopup;
