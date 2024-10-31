import React, { useState, useEffect } from 'react';
import styles from '@/styles/MainCarousel.module.css'; // 스타일을 위한 CSS 모듈

interface CarouselProps {
  images: { src: string; link: string; mobileSrc?: string }[]; // 모바일 이미지를 위한 선택적 속성 추가
}

const Carousel: React.FC<CarouselProps> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false); // 모바일 여부 상태 추가

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  // 5초마다 자동으로 다음 슬라이드로 이동
  useEffect(() => {
    const interval = setInterval(nextSlide, 5000); // 5000ms = 5초
    return () => clearInterval(interval); // 컴포넌트 언마운트 시 인터벌 클리어
  }, []);

  // 클라이언트 측에서만 window 객체 사용
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768); // 모바일 기준 (768px)
    };

    handleResize(); // 초기 렌더링 시 모바일 여부 확인
    window.addEventListener('resize', handleResize); // 윈도우 크기 변경 시 모바일 여부 확인

    return () => {
      window.removeEventListener('resize', handleResize); // 클린업
    };
  }, []);

  // 화면 크기에 따라 이미지 선택
  const currentImage = isMobile && images[currentIndex].mobileSrc ? images[currentIndex].mobileSrc : images[currentIndex].src;

  return (
    <div className={styles.carousel}>
      <div className={styles.slide}>
        {images.length > 0 && (
          <a href={images[currentIndex].link} rel="noopener noreferrer">
            <img 
              src={currentImage} // 선택된 이미지 사용
              alt={`Slide ${currentIndex + 1}`} 
              className={styles.image} 
              style={{ transition: 'opacity 1s ease-in-out' }} // Smooth transition effect
            />
          </a>
        )}
      </div>
    </div>
  );
};

export default Carousel; 