import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { getTranslation } from '../../translations';
import './LanguageToggle.css';

const LanguageToggle = () => {
  const { currentLanguage, changeLanguage, languages } = useLanguage();

  return (
    <div className="language-toggle">
      <div className="language-toggle-label">
        {getTranslation('language.toggle', currentLanguage)}:
      </div>
      <div className="language-buttons">
        {Object.keys(languages).map(langCode => (
          <button
            key={langCode}
            className={`language-button ${currentLanguage === langCode ? 'active' : ''}`}
            onClick={() => changeLanguage(langCode)}
          >
            {getTranslation(`language.${langCode}`, currentLanguage)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LanguageToggle;

