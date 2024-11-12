import { create } from 'zustand';

interface LanguageState {
  currentLanguage: string;
  changeLanguage: (language: string) => void;
}

export const useLanguage = create<LanguageState>((set) => ({
  currentLanguage: 'ko', // 기본값
  changeLanguage: (language: string) => {
    console.log('Language changed to:', language); // 디버깅용
    set({ currentLanguage: language });
  },
})); 