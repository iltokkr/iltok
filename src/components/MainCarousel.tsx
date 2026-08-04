import React from 'react';
import Slider from 'react-slick';
import styles from '@/styles/MainCarousel.module.css';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

interface CarouselImage {
  src: string;
  mobileSrc?: string;
  link?: string;
  action?: 'popup' | 'navigate';
  navigateTo?: string;
}

interface CarouselProps {
  images: CarouselImage[];
  onAdPopupOpen?: () => void;
}

const Carousel: React.FC<CarouselProps> = ({ images, onAdPopupOpen }) => {
  const handleImageClick = (image: CarouselImage, e: React.MouseEvent) => {
    e.preventDefault();
    
    if (image.action === 'popup' && onAdPopupOpen) {
      onAdPopupOpen();
    } else if (image.action === 'navigate' && image.navigateTo) {
      window.location.href = image.navigateTo;
    } else if (image.link) {
      window.open(image.link, '_blank', 'noopener,noreferrer');
    }
  };

  const settings = {
    // 1장뿐이면 점 하나만 덩그러니 남으므로 숨긴다
    dots: images.length > 1,
    infinite: images.length > 1,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: images.length > 1,
    autoplaySpeed: 4000,
    pauseOnHover: true,
    arrows: images.length > 1,
    fade: true,
    cssEase: "ease-in-out",
    responsive: [
      {
        breakpoint: 768,
        settings: {
          arrows: false,
          dots: images.length > 1
        }
      }
    ]
  };

  return (
    <div className={styles.carousel}>
      <Slider {...settings}>
        {images.map((image, index) => (
          <div key={index} className={styles.slideWrapper}>
            <a 
              href="#" 
              onClick={(e) => handleImageClick(image, e)}
              style={{ cursor: 'pointer' }}
            >
              {/* 모바일 판정을 JS 로 하면 데스크톱 배너를 먼저 그렸다가 교체돼 상단이 한 번 밀린다.
                  picture/source 로 첫 페인트부터 알맞은 배너를 받도록 한다. */}
              <picture>
                {image.mobileSrc && (
                  <source media="(max-width: 767px)" srcSet={image.mobileSrc} />
                )}
                <img
                  src={image.src}
                  alt={`Slide ${index + 1}`}
                  className={styles.image}
                />
              </picture>
            </a>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default Carousel;