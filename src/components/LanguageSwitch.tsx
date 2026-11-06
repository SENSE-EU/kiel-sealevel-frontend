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
      className="flex gap-0.5 rounded-full border border-foam/20 bg-abyss/50 p-1 text-sm font-semibold backdrop-blur-sm"
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
            className={`rounded-full px-3.5 py-1 uppercase ${current ? 'bg-signal text-abyss' : 'text-foam/70 hover:text-foam'}`}
          >
            {locale}
          </Link>
        );
      })}
    </nav>
  );
}
