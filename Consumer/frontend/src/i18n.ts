import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import bnTranslations from './locales/bn.json';

const resources = {
    en: {
        translation: enTranslations
    },
    bn: {
        translation: bnTranslations
    }
};

i18n
    // Detect user language
    .use(LanguageDetector)
    // Pass the i18n instance to react-i18next
    .use(initReactI18next)
    // Initialize i18next
    .init({
        resources,
        fallbackLng: 'en',
        debug: false,

        interpolation: {
            escapeValue: false // React already escapes values
        },

        detection: {
            // Order of language detection
            order: ['localStorage', 'navigator', 'htmlTag'],
            // Keys to lookup language from
            lookupLocalStorage: 'i18nextLng',
            // Cache user language
            caches: ['localStorage'],
        }
    });

export default i18n;
