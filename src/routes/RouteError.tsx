import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router';
import { actionClass, StatusMessage } from '@/components/StatusMessage';

/** Last line of defence, so a crash is never a blank page. */
export function RouteError() {
  const { t } = useTranslation();
  const error = useRouteError();

  useEffect(() => console.error('[app] Unhandled error', error), [error]);

  return (
    <StatusMessage
      title={t('status.crashTitle')}
      body={t('status.crashBody')}
      action={
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={actionClass}
        >
          {t('status.reload')}
        </button>
      }
    />
  );
}
