export const GA_TRACKING_ID = 'G-RT5E0QKYVV'

// https://developers.google.com/analytics/devguides/collection/gtagjs/pages
export const pageview = (url: string) => {
  window.gtag('config', GA_TRACKING_ID, {
    page_path: url,
  })
}

// https://developers.google.com/analytics/devguides/collection/gtagjs/events
export const gtag = (...args: any[]) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag(...args)
  }
}

// window.gtag 타입 정의
declare global {
  interface Window {
    gtag: (...args: any[]) => void
  }
} 