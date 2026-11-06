import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, isLocale, LOCALES } from './locales';
import de from './messages/de.json';
import en from './messages/en.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: { translation: typeof en };
  }
}

const urlLocale = window.location.pathname.split('/')[1];

// UI chrome only. Everything editorial comes localised from the CMS.
void i18n.use(initReactI18next).init({
  resources: { de: { translation: de }, en: { translation: en } },
  lng: isLocale(urlLocale) ? urlLocale : DEFAULT_LOCALE,
  fallbackLng: [...LOCALES],
  interpolation: { escapeValue: false },
});

export default i18n;
