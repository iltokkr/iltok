import React, { useState, useEffect } from 'react';
import Slider from 'react-slick';
import styles from '@/styles/MainCarousel.module.css';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

interface CarouselProps {
  images: { src: string; link: string; mobileSrc?: string }[];
}

const Carousel: React.FC<CarouselProps> = ({ images }) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const settings = {
    dots: false,
    infinite: images.length > 1,
    speed: 700,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: images.length > 1,
    autoplaySpeed: 5000,
    pauseOnHover: false,
    arrows: images.length > 1,
    fade: false,
    cssEase: "linear",
    responsive: [
      {
        breakpoint: 768,
        settings: {
          arrows: false
        }
      }
    ]
  };

  return (
    <div className={styles.carousel}>
      <Slider {...settings}>
        {images.map((image, index) => (
          <div key={index} className={styles.slideWrapper}>
            <a href={image.link} target="_blank" rel="noopener noreferrer">
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