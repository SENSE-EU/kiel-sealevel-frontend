import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useParams } from 'react-router';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/locales';

export function LocaleLayout() {
  const { locale } = useParams();
  const { i18n } = useTranslation();
  const valid = isLocale(locale);

  useEffect(() => {
    if (!valid) return;
    void i18n.changeLanguage(locale);
    document.documentElement.lang = locale;
  }, [i18n, locale, valid]);

  return valid ? <Outlet /> : <Navigate to={`/${DEFAULT_LOCALE}`} replace />;
}

export function useLocale() {
  const { locale } = useParams();
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}
