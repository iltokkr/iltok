import React, { useState, useContext } from 'react';
import styles from '@/styles/BusinessVerificationModal.module.css';
import { createClient } from '@supabase/supabase-js';
import { AuthContext } from '@/contexts/AuthContext';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )  

interface BusinessVerificationModalProps {
  onClose: () => void;
}

const BusinessVerificationModal: React.FC<BusinessVerificationModalProps> = ({ onClose }) => {
  const [companyName, setCompanyName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [termsChecked, setTermsChecked] = useState(false);
  const [policyChecked, setPolicyChecked] = useState(false);
  
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("AuthContext must be used within an AuthProvider");
  }
  const { user } = auth;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      console.error('User is not logged in');
      return;
    }

    console.log('User ID:', user.id);

    try {
      let fileUrl = null;

      // 파일 업로드
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('auth_file')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // 파일 URL 가져오기
        const { data: urlData } = supabase.storage
          .from('auth_file')
          .getPublicUrl(fileName);

        fileUrl = urlData.publicUrl;
      }

      // 사용자 데이터 업데이트
      const { error: updateError } = await supabase
        .from('users')
        .update({
          company_name: companyName,
          name: representativeName,
          policy_term: termsChecked,
          auth_term: policyChecked,
          biz_file: fileUrl, // 업로드된 파일의 URL을 저장
        })
        .eq('id', user.id)
        .select();

      if (updateError) throw updateError;

      console.log('Form submitted and data updated successfully');
      onClose(); // 모달 닫기
    } catch (error) {
      console.error('Error updating user data:', error);
      // 여기에 에러 처리 로직 추가 (예: 사용자에게 에러 메시지 표시)
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h3 className={styles.modalTitle}>구인업체는 사업자 인증이 필요합니다.</h3>
        <h5 className={styles.modalSubtitle}>현재 고객님의 사업자 인증이 완료되지 않아 모든 게시글이 비공개 상태입니다.</h5>
        <button className={styles.closeButton} onClick={onClose}>&times;</button>

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="companyName">업체명</label>
            <input
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              maxLength={20}
              required
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="representativeName">대표자명</label>
            <input
              type="text"
              id="representativeName"
              value={representativeName}
              onChange={(e) => setRepresentativeName(e.target.value)}
              maxLength={20}
              required
            />
          </div>


          <div className={styles.formGroup}>
            <label htmlFor="businessLicense">사업자 등록증</label>
            <input
              type="file"
              id="businessLicense"
              onChange={handleFileChange}
              required
            />
          </div>

          <div className={styles.checkboxGroup}>
            <label>
              <input
                type="checkbox"
                checked={termsChecked}
                onChange={() => setTermsChecked(!termsChecked)}
                required
              />
              <a href="#" onClick={() => console.log('Open terms popup')}>이용약관</a>에 동의합니다. (필수)
            </label>
            <label>
              <input
                type="checkbox"
                checked={policyChecked}
                onChange={() => setPolicyChecked(!policyChecked)}
                required
              />
              <a href="#" onClick={() => console.log('Open policy popup')}>개인정보처리방침</a>에 동의합니다. (필수)
            </label>
          </div>

          <button type="submit" className={styles.submitButton}>등록하기</button>
        </form>

        <div className={styles.footer}>
          <h4>사업자 인증이 실패한 경우:</h4>
          <ul>
            <li>등록한 사업자 등록증 사진이 뚜렷하게 보이지 않는 경우</li>
            <li>최신이 아닌 사업자 등록정보 또는 휴/페업 사업자의 경우</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BusinessVerificationModal;
