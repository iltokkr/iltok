import styles from '@/styles/Privacy.module.css';

export default function Privacy() {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>개인정보처리방침</h1>
      
      <div className={styles.content}>
        <p>주식회사 일톡(이하 "회사")은 이용자의 개인정보를 중요시하며, 관련 법령에 따라 이를 안전하게 관리하기 위해 최선을 다하고 있습니다. 본 개인정보 처리방침은 회사가 제공하는 서비스 이용과 관련하여 이용자의 개인정보 수집, 이용, 보관, 제공 등에 대한 사항을 규정합니다.</p>

        <section>
          <h2>제1조 수집하는 개인정보 항목</h2>
          <p>회사는 다음과 같은 개인정보를 수집합니다:</p>
          
          <h3>필수 수집 항목:</h3>
          <ul>
            <li>이름</li>
            <li>연락처(전화번호, 이메일 등)</li>
            <li>로그인 ID 및 비밀번호</li>
            <li>생년월일, 국적, 비자종류, 거주지역</li>
          </ul>

          <h3>선택 수집 항목:</h3>
          <ul>
            <li>사진</li>
            <li>장애 여부</li>
            <li>병역 사항</li>
            <li>취업 우대 사항</li>
          </ul>
        </section>

        <section>
          <h2>제2조 개인정보의 수집 및 이용 목적</h2>
          <p>회사는 수집한 개인정보를 다음과 같은 목적을 위해 사용합니다:</p>

          <h3>서비스 제공 및 운영:</h3>
          <ul>
            <li>구인구직 매칭 서비스 제공</li>
            <li>이력서 작성 및 관리</li>
            <li>채용 정보 제공 및 알선</li>
            <li>맞춤형 채용 정보 제공</li>
          </ul>

          <h3>회원 관리:</h3>
          <ul>
            <li>회원제 서비스 이용에 따른 본인 확인</li>
            <li>개인 식별 및 부정 이용 방지</li>
            <li>가입 의사 확인 및 연령 확인</li>
            <li>고객 문의 및 불만 처리</li>
          </ul>

          <h3>서비스 개선 및 마케팅:</h3>
          <ul>
            <li>서비스 이용 통계 및 분석</li>
            <li>이벤트 및 광고성 정보 제공</li>
            <li>신규 서비스 개발 및 맞춤형 서비스 제공</li>
          </ul>
        </section>

        <section>
          <h2>제3조 개인정보의 보유 및 이용 기간</h2>
          <p>회사는 이용자의 개인정보를 수집 및 이용 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관련 법령에 따라 보존할 필요가 있는 경우에는 법령에서 정한 기간 동안 보존합니다.</p>
          
          <ul>
            <li>계약 또는 청약철회 등에 관한 기록: 5년</li>
            <li>대금 결제 및 재화 등의 공급에 관한 기록: 5년</li>
            <li>소비자의 불만 또는 분쟁 처리에 관한 기록: 3년</li>
          </ul>
        </section>

        <section>
          <h2>제4조 개인정보의 제3자 제공</h2>
          <p>회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만, 다음의 경우에는 예외로 합니다:</p>
          
          <ul>
            <li>이용자가 사전에 동의한 경우</li>
            <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
          </ul>
        </section>

        <section>
          <h2>제5조 개인정보 처리의 위탁</h2>
          <p>회사는 서비스 향상을 위해 개인정보 처리를 외부 전문 기관에 위탁할 수 있으며, 이 경우 위탁받는 자와 위탁 업무의 내용을 공개하고, 개인정보가 안전하게 관리될 수 있도록 필요한 조치를 취합니다.</p>
        </section>

        <section>
          <h2>제6조 이용자의 권리와 행사 방법</h2>
          <p>이용자는 언제든지 자신의 개인정보에 대한 다음과 같은 권리를 행사할 수 있습니다:</p>
          
          <ul>
            <li>개인정보 열람 요구</li>
            <li>오류 등이 있을 경우 정정 요구</li>
            <li>삭제 요구</li>
            <li>처리 정지 요구</li>
          </ul>
          
          <p>이러한 요청은 회사의 고객센터를 통해 하실 수 있으며, 회사는 지체 없이 조치하겠습니다.</p>
        </section>

        <section>
          <h2>제7조 개인정보의 파기 절차 및 방법</h2>
          <p>회사는 개인정보 보유 기간의 경과, 처리 목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다.</p>

          <h3>파기 절차:</h3>
          <p>파기 사유가 발생한 개인정보를 선정하고, 개인정보 보호 책임자의 승인을 받아 파기합니다.</p>

          <h3>파기 방법:</h3>
          <ul>
            <li>전자적 파일 형태의 정보는 복구 및 재생이 불가능한 방법을 사용</li>
            <li>종이 문서 형태의 정보는 분쇄하거나 소각</li>
          </ul>
        </section>

        <section>
          <h2>제8조 개인정보의 안전성 확보 조치</h2>
          <p>회사는 이용자의 개인정보를 안전하게 관리하기 위해 다음과 같은 조치를 취하고 있습니다:</p>

          <ul>
            <li>관리적 조치: 내부 관리 계획 수립 및 시행, 정기적 직원 교육 등</li>
            <li>기술적 조치: 개인정보 처리 시스템 등의 접근 권한 관리, 접근 통제 시스템 설치, 고유 식별 정보의 암호화</li>
            <li>물리적 조치: 전산실, 자료 보관실 등의 접근 통제</li>
          </ul>
        </section>

        <section>
          <h2>제9조 개인정보 보호 책임자</h2>
          <p>회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 이용자의 불만 처리 및 피해 구제 등을 위해 아래와 같이 개인정보 보호 책임자를 지정하고 있습니다:</p>

          <ul>
            <li>개인정보 보호 책임자: 김민혁</li>
            <li>연락처: iltok.kr@gmail.com</li>
            <li>고객센터: https://pf.kakao.com/_ywaMn</li>
          </ul>
        </section>

        <section>
          <h2>제10조 개인정보 처리방침의 변경</h2>
          <p>본 개인정보 처리방침은 법령 및 회사의 정책에 따라 변경될 수 있으며, 변경 사항은 회사의 웹사이트를 통해 공지합니다.</p>
        </section>

        <section>
          <h2>제11조 시행일</h2>
          <p>본 개인정보 처리방침은 2024년 10월 1일부터 시행됩니다.</p>
        </section>
      </div>
    </div>
  );
} 