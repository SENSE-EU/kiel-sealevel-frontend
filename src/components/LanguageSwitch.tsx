import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';
import { LOCALES } from '@/i18n/locales';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const { pathname } = useLocation();
  const rest = pathname.split('/').slice(2).join('/');
  const suffix = rest ? `/${rest}` : '';

  return (
    <nav
      aria-label={t('language.label')}
      className="flex h-9 items-center rounded-full panel px-1 label"
    >
      {LOCALES.map((locale) => {
        const current = i18n.language === locale;
        return (
          <Link
            key={locale}
            to={`/${locale}${suffix}`}
            lang={locale}
            hrefLang={locale}
            aria-label={t(`language.${locale}`)}
            aria-current={current ? 'true' : undefined}
            className={`flex h-7 items-center rounded-full px-2.5 transition-colors ${current ? 'bg-signal text-abyss' : 'text-mist hover:text-foam'}`}
          >
            {locale}
          </Link>
        );
      })}
    </nav>
  );
}
