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
  const [businessNumber, setBusinessNumber] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [existingFile, setExistingFile] = useState<string | null>(null);
  const [termsChecked, setTermsChecked] = useState(false);
  const [policyChecked, setPolicyChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
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
          .select('company_name, name, business_number, business_address, policy_term, auth_term, biz_file')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (data) {
          setCompanyName(data.company_name || '');
          setRepresentativeName(data.name || '');
          setBusinessNumber(data.business_number || '');
          setBusinessAddress(data.business_address || '');
          setTermsChecked(data.policy_term || false);
          setPolicyChecked(data.auth_term || false);
          setExistingFile(data.biz_file || null);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user]);

  // 사업자등록번호 포맷팅 (000-00-00000)
  const formatBusinessNumber = (value: string) => {
    const numbers = value.replace(/[^0-9]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 5)}-${numbers.slice(5, 10)}`;
  };

  // 사업자등록번호 형식 검사 (000-00-00000)
  const isValidBusinessNumber = (value: string) => {
    const pattern = /^\d{3}-\d{2}-\d{5}$/;
    return pattern.test(value);
  };

  const handleBusinessNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatBusinessNumber(e.target.value);
    setBusinessNumber(formatted);
    
    // 입력 중 에러 메시지 제거 (완전히 입력되면 유효성 검사)
    if (errors.businessNumber) {
      setErrors({...errors, businessNumber: ''});
    }
  };

  // 사업자등록번호 필드 blur 시 유효성 검사
  const handleBusinessNumberBlur = () => {
    if (businessNumber && !isValidBusinessNumber(businessNumber)) {
      setErrors({...errors, businessNumber: '사업자 등록번호가 올바르지 않습니다.'});
    }
  };

  // 유효성 검사
  const validateForm = () => {
    const newErrors: {[key: string]: string} = {};
    
    if (!companyName.trim()) {
      newErrors.companyName = '업체명을 입력해주세요.';
    }
    if (!representativeName.trim()) {
      newErrors.representativeName = '대표자명을 입력해주세요.';
    }
    if (!businessNumber.trim()) {
      newErrors.businessNumber = '사업자등록번호를 입력해주세요.';
    } else if (!isValidBusinessNumber(businessNumber)) {
      newErrors.businessNumber = '사업자 등록번호가 올바르지 않습니다.';
    }
    if (!businessAddress.trim()) {
      newErrors.businessAddress = '사업장 소재지를 입력해주세요.';
    }
    // 기존 파일이 없고 새 파일도 없는 경우에만 에러
    if (!file && !existingFile) {
      newErrors.file = '사업자 등록증을 첨부해주세요.';
    }
    if (!termsChecked) {
      newErrors.terms = '이용약관에 동의해주세요.';
    }
    if (!policyChecked) {
      newErrors.policy = '개인정보처리방침에 동의해주세요.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    if (!user) {
      console.error('User is not logged in');
      return;
    }

    setIsSubmitting(true);

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
        business_number: businessNumber,
        business_address: businessAddress,
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

      alert('사업자 정보가 등록되었습니다. 관리자 승인 후 이용 가능합니다.');
      onClose();
      window.location.reload(); // 페이지 새로고침하여 상태 업데이트
    } catch (error) {
      console.error('Error updating user data:', error);
      alert('사업자 정보 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
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
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <span className={styles.loadingText}>로딩 중...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        {/* 헤더 */}
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>사업자 인증</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {/* 바디 */}
        <div className={styles.modalBody}>
          {/* 경고 박스 */}
          <div className={styles.warningBox}>
            <p className={styles.warningText}>
              채용업체는 <strong>사업자 인증</strong>이 필요합니다.<br />
              인증 전 게시글은 비공개 상태입니다.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* 업체명 */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>업체명 <span className={styles.required}>*</span></label>
              <input
                type="text"
                className={`${styles.formInput} ${errors.companyName ? styles.inputError : ''}`}
                value={companyName}
                onChange={(e) => { setCompanyName(e.target.value); setErrors({...errors, companyName: ''}); }}
                placeholder="업체명을 입력하세요"
                maxLength={20}
              />
              {errors.companyName && <span className={styles.errorText}>{errors.companyName}</span>}
            </div>

            {/* 대표자명 */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>대표자명 <span className={styles.required}>*</span></label>
              <input
                type="text"
                className={`${styles.formInput} ${errors.representativeName ? styles.inputError : ''}`}
                value={representativeName}
                onChange={(e) => { setRepresentativeName(e.target.value); setErrors({...errors, representativeName: ''}); }}
                placeholder="대표자명을 입력하세요"
                maxLength={20}
              />
              {errors.representativeName && <span className={styles.errorText}>{errors.representativeName}</span>}
            </div>

            {/* 사업자등록번호 */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>사업자등록번호 <span className={styles.required}>*</span></label>
              <input
                type="text"
                className={`${styles.formInput} ${errors.businessNumber ? styles.inputError : ''}`}
                value={businessNumber}
                onChange={handleBusinessNumberChange}
                onBlur={handleBusinessNumberBlur}
                placeholder="000-00-00000"
                maxLength={12}
              />
              {errors.businessNumber && <span className={styles.errorText}>{errors.businessNumber}</span>}
            </div>

            {/* 사업장 소재지 */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>사업장 소재지 <span className={styles.required}>*</span></label>
              <input
                type="text"
                className={`${styles.formInput} ${errors.businessAddress ? styles.inputError : ''}`}
                value={businessAddress}
                onChange={(e) => { setBusinessAddress(e.target.value); setErrors({...errors, businessAddress: ''}); }}
                placeholder="사업장 주소를 입력하세요"
                maxLength={100}
              />
              {errors.businessAddress && <span className={styles.errorText}>{errors.businessAddress}</span>}
            </div>

            {/* 사업자 등록증 */}
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>사업자 등록증 <span className={styles.required}>*</span></label>
              <div className={`${styles.fileInputWrapper} ${errors.file ? styles.fileError : ''}`}>
                <label className={styles.fileInputLabel}>
                  <span className={styles.fileInputButton}>파일 선택</span>
                  <span className={styles.fileName}>
                    {file ? file.name : existingFile ? '기존 파일 있음 (새 파일로 교체 가능)' : '선택된 파일 없음'}
                  </span>
                  <input
                    type="file"
                    className={styles.fileInput}
                    onChange={(e) => { handleFileChange(e); setErrors({...errors, file: ''}); }}
                    accept="image/*,.pdf"
                  />
                </label>
              </div>
              {errors.file && <span className={styles.errorText}>{errors.file}</span>}
            </div>

            {/* 체크박스 */}
            <div className={styles.checkboxGroup}>
              <label className={`${styles.checkboxLabel} ${errors.terms ? styles.checkboxError : ''}`}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={termsChecked}
                  onChange={() => { setTermsChecked(!termsChecked); setErrors({...errors, terms: ''}); }}
                />
                <span className={styles.checkboxText}>
                  <a href="/privacy-policy" target="_blank">이용약관</a>에 동의합니다. (필수)
                </span>
              </label>
              {errors.terms && <span className={styles.errorText}>{errors.terms}</span>}
              <label className={`${styles.checkboxLabel} ${errors.policy ? styles.checkboxError : ''}`}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={policyChecked}
                  onChange={() => { setPolicyChecked(!policyChecked); setErrors({...errors, policy: ''}); }}
                />
                <span className={styles.checkboxText}>
                  <a href="/privacy" target="_blank">개인정보처리방침</a>에 동의합니다. (필수)
                </span>
              </label>
              {errors.policy && <span className={styles.errorText}>{errors.policy}</span>}
            </div>

            {/* 등록 버튼 */}
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? '등록 중...' : '등록하기'}
            </button>
          </form>

          {/* 푸터 안내 */}
          <div className={styles.footer}>
            <h4 className={styles.footerTitle}>사업자 인증이 실패하는 경우</h4>
            <ul className={styles.footerList}>
              <li>등록한 사업자 등록증 사진이 뚜렷하게 보이지 않는 경우</li>
              <li>최신이 아닌 사업자 등록정보 또는 휴/폐업 사업자의 경우</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessVerificationModal;
