import React, { useState, useEffect } from 'react';
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    dots: true,
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
          dots: true
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
              <img
                src={isMobile && image.mobileSrc ? image.mobileSrc : image.src}
                alt={`Slide ${index + 1}`}
                className={styles.image}
              />
            </a>
          </div>
        ))}
      </Slider>
    </div>
  );
};

export default Carousel;