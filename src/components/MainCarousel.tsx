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
    infinite: true,
    speed: 700,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    pauseOnHover: false,
    arrows: true,
    fade: true,
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
          <div key={index}>
            <a href={image.link} rel="noopener noreferrer">
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