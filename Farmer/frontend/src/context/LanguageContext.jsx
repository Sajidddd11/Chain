import React, { createContext, useContext, useState, useEffect } from 'react';

// Create a context for language
const LanguageContext = createContext();

// Available languages
export const languages = {
  en: 'English',
  bn: 'বাংলা' // Bengali
};

// Language provider component
export const LanguageProvider = ({ children }) => {
  // Get saved language from localStorage or default to English
  const [currentLanguage, setCurrentLanguage] = useState(
    localStorage.getItem('agrisense-language') || 'en'
  );

  // Update localStorage when language changes
  useEffect(() => {
    localStorage.setItem('agrisense-language', currentLanguage);
  }, [currentLanguage]);

  // Function to change language
  const changeLanguage = (lang) => {
    if (languages[lang]) {
      setCurrentLanguage(lang);
    }
  };

  // Context value
  const value = {
    currentLanguage,
    changeLanguage,
    languages
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Custom hook to use the language context
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

