import { useTranslation } from 'react-i18next';
import { actionClass, StatusMessage } from './StatusMessage';

export function ContentUnavailable({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <StatusMessage
      title={t('status.unavailableTitle')}
      body={t('status.unavailableBody')}
      action={
        <button type="button" onClick={onRetry} className={actionClass}>
          {t('status.retry')}
        </button>
      }
    />
  );
}
