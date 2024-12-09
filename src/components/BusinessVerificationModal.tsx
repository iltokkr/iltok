import React, { useState, useContext, useEffect } from 'react';
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
  const [isLoading, setIsLoading] = useState(true);
  
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error("AuthContext must be used within an AuthProvider");
  }
  const { user } = auth;

  // 기존 데이터 불러오기
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('users')
          .select('company_name, name, policy_term, auth_term')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setCompanyName(data.company_name || '');
          setRepresentativeName(data.name || '');
          setTermsChecked(data.policy_term || false);
          setPolicyChecked(data.auth_term || false);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      console.error('User is not logged in');
      return;
    }

    try {
      let fileUrl = null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('auth_file')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('auth_file')
          .getPublicUrl(fileName);

        fileUrl = urlData.publicUrl;
      }

      const updateData: any = {
        company_name: companyName,
        name: representativeName,
        policy_term: termsChecked,
        auth_term: policyChecked,
        is_accept: false, // 수정 시 재검토가 필요하므로 인증 상태를 false로 변경
      };

      // 새 파일이 업로드된 경우에만 biz_file 업데이트
      if (fileUrl) {
        updateData.biz_file = fileUrl;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) throw updateError;

      alert('사업자 정보가 수정되었습니다. 관리자 승인 후 이용 가능합니다.');
      onClose();
      window.location.reload(); // 페이지 새로고침하여 상태 업데이트
    } catch (error) {
      console.error('Error updating user data:', error);
      alert('사업자 정보 수정 중 오류가 발생했습니다.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <p>로딩중...</p>
        </div>
      </div>
    );
  }

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
