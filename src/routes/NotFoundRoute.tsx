import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { actionClass, StatusMessage } from '@/components/StatusMessage';
import { useLocale } from './LocaleLayout';

export function NotFoundRoute() {
  const { t } = useTranslation();
  const locale = useLocale();
  return (
    <StatusMessage
      title={t('status.notFoundTitle')}
      body={t('status.notFoundBody')}
      action={
        <Link to={`/${locale}`} className={actionClass}>
          {t('status.backHome')}
        </Link>
      }
    />
  );
}
