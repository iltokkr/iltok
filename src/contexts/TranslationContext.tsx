import React, { createContext, useContext, useState, useCallback } from 'react';

interface TranslationContextType {
  currentLanguage: string;
  setCurrentLanguage: (lang: string) => void;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('ko');

  return (
    <TranslationContext.Provider 
      value={{ 
        currentLanguage,
        setCurrentLanguage,
      }}
    >
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}; 