import { useLanguage } from '../context/LanguageContext';
import { getTranslation } from '../translations';

/**
 * Custom hook for translations
 * @returns {Function} t - Translation function
 */
const useTranslation = () => {
  const { currentLanguage } = useLanguage();
  
  /**
   * Translate a key
   * @param {string} key - Translation key
   * @param {Object} params - Optional parameters for interpolation
   * @returns {string} Translated text
   */
  const t = (key, params = {}) => {
    let translated = getTranslation(key, currentLanguage);
    
    // Simple parameter interpolation
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(param => {
        translated = translated.replace(`{{${param}}}`, params[param]);
      });
    }
    
    return translated;
  };
  
  return t;
};

export default useTranslation;

