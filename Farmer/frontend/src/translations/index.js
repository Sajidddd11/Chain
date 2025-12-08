import en from './en';
import bn from './bn';

const translations = {
  en,
  bn
};

export const getTranslation = (key, language) => {
  if (!translations[language] || !translations[language][key]) {
    // Fallback to English if translation is missing
    return translations.en[key] || key;
  }
  return translations[language][key];
};

export default translations;

