import React from 'react';
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
  };
}

interface JobDetailProps {
  jobDetail: JobDetailType;
}

const JobDetail: React.FC<JobDetailProps> = ({ jobDetail }) => {
  const router = useRouter();

  const handleListClick = () => {
    router.push('/board');
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


  return (
    <div className={style.layout}>
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
        <li></li>
      </ul>
      <div className={style.articleDetail}>
        <div className={style.content}>
            {renderContent(jobDetail.contents)}
          </div>
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
