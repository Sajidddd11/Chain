import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export function LanguageSwitcher() {
    const { i18n, t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const languages = [
        { code: 'en', name: t('language.english'), flag: '🇬🇧' },
        { code: 'bn', name: t('language.bengali'), flag: '🇧🇩' }
    ];

    const changeLanguage = (langCode: string) => {
        i18n.changeLanguage(langCode);
        setIsOpen(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="lang-btn"
                title={t('language.selectLanguage')}
                style={{
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    border: 'none',
                    backgroundColor: isOpen ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.8)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                }}
            >
                <Globe size={18} />
            </button>

            {isOpen && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '0',
                        marginBottom: '0.5rem',
                        background: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                        minWidth: '160px',
                        zIndex: 1000,
                        overflow: 'hidden',
                        padding: '0.5rem',
                        border: '1px solid rgba(0,0,0,0.1)'
                    }}
                >
                    <div style={{
                        padding: '0.5rem 0.75rem',
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        color: '#94a3b8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}>
                        {t('language.selectLanguage')}
                    </div>
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.6rem 0.75rem',
                                background: i18n.language === lang.code ? '#f0fdf4' : 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                color: i18n.language === lang.code ? '#166534' : '#334155',
                                transition: 'background 0.2s ease',
                                textAlign: 'left',
                                fontWeight: i18n.language === lang.code ? '600' : '500'
                            }}
                        >
                            <span style={{ fontSize: '1.2rem' }}>{lang.flag}</span>
                            <span>{lang.name}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
