import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Dynamic Translation Provider
 * 
 * This component provides automatic translation for ANY page content
 * by using a comprehensive translation dictionary and DOM manipulation.
 * 
 * Works with React's virtual DOM by re-translating on every render cycle.
 */

// Comprehensive translation dictionary
const translationDictionary: Record<string, Record<string, string>> = {
    bn: {
        // Common UI Elements
        'Loading...': 'লোড হচ্ছে...',
        'Crunching numbers…': 'সংখ্যা গণনা করা হচ্ছে...',
        'Loading inventory…': 'তালিকা লোড হচ্ছে...',
        'Loading usage…': 'ব্যবহার লোড হচ্ছে...',
        'Loading tips…': 'টিপস লোড হচ্ছে...',

        // Dashboard
        'Welcome back,': 'স্বাগতম,',
        'Household overview': 'পরিবারের সংক্ষিপ্ত বিবরণ',
        'Quick actions': 'দ্রুত ক্রিয়া',
        'Items in inventory': 'তালিকায় আইটেম',
        'Expiring soon': 'শীঘ্রই মেয়াদ শেষ',
        'Usage this week': 'এই সপ্তাহের ব্যবহার',
        'Household size': 'পরিবারের আকার',
        'Budget utilization': 'বাজেট ব্যবহার',
        'Tracking': 'ট্র্যাকিং',
        'used': 'ব্যবহৃত',
        'Remaining:': 'অবশিষ্ট:',
        'Tracking since': 'থেকে ট্র্যাকিং',
        'Set Budget': 'বাজেট সেট করুন',
        'Inventory snapshot': 'তালিকা স্ন্যাপশট',
        'Recent usage': 'সাম্প্রতিক ব্যবহার',
        'Recommended resources': 'প্রস্তাবিত সম্পদ',
        'No inventory yet. Add your first item!': 'এখনও কোন তালিকা নেই। আপনার প্রথম আইটেম যোগ করুন!',
        'No usage entries yet. Try adding today\'s meals.': 'এখনও কোন ব্যবহারের এন্ট্রি নেই। আজকের খাবার যোগ করার চেষ্টা করুন।',
        'No personalized recommendations yet—record some consumption to get started.': 'এখনও কোন ব্যক্তিগত সুপারিশ নেই—শুরু করতে কিছু ব্যবহার রেকর্ড করুন।',
        'Track your food spending and stay within budget. Set a household budget to visualize how inventory purchases impact your limits.': 'আপনার খাদ্য ব্যয় ট্র্যাক করুন এবং বাজেটের মধ্যে থাকুন। তালিকা ক্রয় কীভাবে আপনার সীমা প্রভাবিত করে তা দেখতে একটি পরিবারের বাজেট সেট করুন।',

        // Inventory
        'Food Inventory': 'খাদ্য তালিকা',
        'Add Item': 'আইটেম যোগ করুন',
        'Item Name': 'আইটেমের নাম',
        'Quantity': 'পরিমাণ',
        'Unit': 'একক',
        'Category': 'বিভাগ',
        'Expiry Date': 'মেয়াদ শেষের তারিখ',
        'Purchase Date': 'ক্রয়ের তারিখ',
        'Price': 'মূল্য',
        'Notes': 'নোট',
        'Expired': 'মেয়াদ শেষ',
        'Fresh': 'তাজা',
        'Expires': 'মেয়াদ শেষ',
        'No date': 'কোন তারিখ নেই',
        'Unnamed item': 'নামহীন আইটেম',

        // Logs & Analytics
        'Usage & Analytics': 'ব্যবহার ও বিশ্লেষণ',
        'Track Consumption': 'ব্যবহার ট্র্যাক করুন',
        'Select Items to Track': 'ট্র্যাক করার জন্য আইটেম নির্বাচন করুন',
        'Recent History': 'সাম্প্রতিক ইতিহাস',
        'Consumption Analytics': 'ব্যবহার বিশ্লেষণ',
        'Total Units': 'মোট একক',
        'At Risk Items': 'ঝুঁকিপূর্ণ আইটেম',
        'Top Categories': 'শীর্ষ বিভাগ',
        'Smart Insights': 'স্মার্ট অন্তর্দৃষ্টি',
        'Track consumption and view insights': 'ব্যবহার ট্র্যাক করুন এবং অন্তর্দৃষ্টি দেখুন',
        'Log what you\'ve used to keep your inventory and nutrition insights accurate.': 'আপনার তালিকা এবং পুষ্টি অন্তর্দৃষ্টি সঠিক রাখতে আপনি যা ব্যবহার করেছেন তা লগ করুন।',
        'Select Items': 'আইটেম নির্বাচন করুন',
        'items available': 'আইটেম উপলব্ধ',
        'Available:': 'উপলব্ধ:',
        'Using': 'ব্যবহার করছি',
        'of stock': 'স্টকের',
        'Your pantry is empty': 'আপনার প্যান্ট্রি খালি',
        'Add items to your inventory to start tracking consumption.': 'ব্যবহার ট্র্যাক করা শুরু করতে আপনার তালিকায় আইটেম যোগ করুন।',
        'Notes (Optional)': 'নোট (ঐচ্ছিক)',
        'Save Usage Log': 'ব্যবহার লগ সংরক্ষণ করুন',
        'items': 'আইটেম',
        'Insights based on your usage history': 'আপনার ব্যবহারের ইতিহাসের উপর ভিত্তি করে অন্তর্দৃষ্টি',
        'Loading insights...': 'অন্তর্দৃষ্টি লোড হচ্ছে...',
        'No data available yet.': 'এখনও কোন তথ্য উপলব্ধ নেই।',
        'No usage recorded yet.': 'এখনও কোন ব্যবহার রেকর্ড করা হয়নি।',

        // Auth
        'Sign In': 'সাইন ইন',
        'Sign Up': 'নিবন্ধন করুন',
        'Email': 'ইমেইল',
        'Password': 'পাসওয়ার্ড',
        'Full Name': 'পুরো নাম',
        'Phone Number': 'ফোন নম্বর',
        'Create Account': 'অ্যাকাউন্ট তৈরি করুন',
        'Already have an account?': 'ইতিমধ্যে একটি অ্যাকাউন্ট আছে?',
        'Don\'t have an account?': 'অ্যাকাউন্ট নেই?',

        // Buttons & Actions
        'Save': 'সংরক্ষণ',
        'Cancel': 'বাতিল',
        'Delete': 'মুছুন',
        'Edit': 'সম্পাদনা',
        'Add': 'যোগ করুন',
        'Search': 'অনুসন্ধান',
        'Filter': 'ফিল্টার',
        'Close': 'বন্ধ করুন',
        'Back': 'পিছনে',
        'Next': 'পরবর্তী',
        'Submit': 'জমা দিন',

        // Time & Dates
        '7 Days': '৭ দিন',
        '30 Days': '৩০ দিন',

        // Numbers (for display)
        'BDT': 'টাকা',
    }
};

export function DynamicTranslationProvider() {
    const { i18n } = useTranslation();
    const translationAppliedRef = useRef(false);

    useEffect(() => {
        if (i18n.language === 'en') {
            translationAppliedRef.current = false;
            return;
        }

        const dictionary = translationDictionary[i18n.language as keyof typeof translationDictionary];
        if (!dictionary) return;

        // Function to translate a single text node
        const translateText = (text: string): string => {
            // Try exact match first
            if (dictionary[text]) {
                return dictionary[text];
            }

            // Try trimmed match
            const trimmed = text.trim();
            if (dictionary[trimmed]) {
                return text.replace(trimmed, dictionary[trimmed]);
            }

            // Try partial matches for common patterns
            for (const [key, value] of Object.entries(dictionary)) {
                if (text.includes(key)) {
                    return text.replace(key, value);
                }
            }

            return text;
        };

        // Function to walk through DOM and translate text nodes
        const translateNode = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const originalText = node.textContent || '';
                if (originalText.trim()) {
                    const translated = translateText(originalText);
                    if (translated !== originalText) {
                        node.textContent = translated;
                    }
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as HTMLElement;

                // Skip certain elements
                if (['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT'].includes(element.tagName)) {
                    return;
                }

                // Translate attributes
                if (element.hasAttribute('placeholder')) {
                    const placeholder = element.getAttribute('placeholder') || '';
                    const translated = translateText(placeholder);
                    if (translated !== placeholder) {
                        element.setAttribute('placeholder', translated);
                    }
                }

                if (element.hasAttribute('title')) {
                    const title = element.getAttribute('title') || '';
                    const translated = translateText(title);
                    if (translated !== title) {
                        element.setAttribute('title', translated);
                    }
                }

                if (element.hasAttribute('aria-label')) {
                    const ariaLabel = element.getAttribute('aria-label') || '';
                    const translated = translateText(ariaLabel);
                    if (translated !== ariaLabel) {
                        element.setAttribute('aria-label', translated);
                    }
                }

                // Recursively translate children
                Array.from(node.childNodes).forEach(translateNode);
            }
        };

        // Apply translations with a slight delay to ensure DOM is ready
        const applyTranslations = () => {
            const mainContent = document.querySelector('main') || document.body;
            translateNode(mainContent);
            translationAppliedRef.current = true;
        };

        // Initial translation
        setTimeout(applyTranslations, 100);

        // Re-translate on DOM mutations (for dynamic content)
        const observer = new MutationObserver((mutations) => {
            let shouldTranslate = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
                            shouldTranslate = true;
                        }
                    });
                }
            });

            if (shouldTranslate) {
                setTimeout(applyTranslations, 50);
            }
        });

        const mainContent = document.querySelector('main') || document.body;
        observer.observe(mainContent, {
            childList: true,
            subtree: true,
            characterData: false,
        });

        return () => {
            observer.disconnect();
        };
    }, [i18n.language]);

    return null;
}
