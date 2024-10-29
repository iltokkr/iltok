import React, { useState } from 'react';
import { useRouter } from 'next/router';
import style from '@/styles/JobDetail.module.css';
import { parseISO, format, subHours } from 'date-fns';

interface JobDetailType {
  id: number;
  updated_time: string;
  title: string;
  contents: string;
  uploader: {
    company_name: string;
    name: string;
    number: string;
  };
}

interface JobDetailProps {
  jobDetail: JobDetailType;
}

const JobDetail: React.FC<JobDetailProps> = ({ jobDetail }) => {
  const router = useRouter();
  const [copySuccess, setCopySuccess] = useState(false);

  const handleListClick = () => {
    router.push('/board');
  };

  const handleCopyPhoneNumber = (number: string) => {
    navigator.clipboard.writeText(number)
      .then(() => {
        alert('전화번호가 복사되었습니다!');
      })
      .catch(err => console.error('Failed to copy: ', err));
  };

  const renderContent = (contents: string) => {
    return contents.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  const formatDate = (dateString: string) => {
    const date = parseISO(dateString);
    const koreaTime = subHours(date, 9);

    return format(koreaTime, 'MM-dd HH:mm');
  };

  const formatPhoneNumber = (number: string) => {
    if (number.length === 12 && number.startsWith('82')) {
      const formattedNumber = `0${number.slice(2)}`;
      return `${formattedNumber.slice(0, 3)}-${formattedNumber.slice(3, 7)}-${formattedNumber.slice(7)}`;
    }
    return number;
  };

  return (
    <div className={style.layout}>
      {copySuccess && <div className={style.copyAlert}>전화번호가 복사되었습니다!</div>}
      
      <div className={style.articleTitle}>
        <h1>{jobDetail.title}</h1>
      </div>
      <ul className={style.articleMeta}>
        <li>등록일: {formatDate(jobDetail.updated_time)}</li>
        <li>글번호: {jobDetail.id}</li>
        <li></li>
      </ul>
      <ul className={`${style.articleMeta} ${style.bold}`}>
        <li>업체명: {jobDetail.uploader.company_name || "정보없음"}</li>
        <li>대표자명: {jobDetail.uploader.name || "정보없음"}</li>
      </ul>
      <div className={style.articleDetail}>
        <div className={style.content}>
            {renderContent(jobDetail.contents)}
          </div>
          {jobDetail.uploader.number && (
            <li>
              <span 
                onClick={() => handleCopyPhoneNumber(formatPhoneNumber(jobDetail.uploader.number))} 
               >
                전화번호: <span style={{ cursor: 'pointer', color: 'orange', textDecoration: 'underline' }}
                >{formatPhoneNumber(jobDetail.uploader.number)}</span>
              </span>
            </li>
      
          )}
          <li>*114114KR 통해서 연락한다고 말씀해주세요.</li>
      </div>
      <div className={style.articleFoot}>
        <div className={style.txt}>
          ※ 위 내용에 대한 오류와 사용자가 이를 신뢰하여 취한 조치에 대해 114114KR은 책임을 지지 않습니다.
        </div>
        <div className={style.txt}>
          ※ 114114KR 통해서 연락한다고 말씀해주세요.
        </div>
        <ul className={style.acts}>
          <li><a href="#" onClick={handleListClick}>목록</a></li>
        </ul>
      </div>
    </div>
  );
};

export default JobDetail;
