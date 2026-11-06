import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';
import { ContentUnavailable } from '@/components/ContentUnavailable';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { StatusMessage } from '@/components/StatusMessage';
import { useScenes } from '@/content/hooks';
import { useLocale } from './LocaleLayout';

/**
 * The demo has no landing page: the start URL opens the first scene from the CMS. The landing page with
 * scene cards lives on the v2 branch.
 */
export function FirstSceneRoute() {
  const { t } = useTranslation();
  const locale = useLocale();
  const scenes = useScenes(locale);

  if (scenes.status === 'loading')
    return (
      <div className="flex h-dvh items-center justify-center">
        <LoadingIndicator label={t('status.loading')} />
      </div>
    );
  if (scenes.status === 'error')
    return <ContentUnavailable onRetry={scenes.retry} />;

  const first = scenes.data[0];
  if (!first)
    return (
      <StatusMessage
        title={t('status.emptyTitle')}
        body={t('status.emptyBody')}
      />
    );
  return <Navigate to={`/${locale}/scenes/${first.slug}`} replace />;
}
