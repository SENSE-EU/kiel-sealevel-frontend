import { lazy, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { ContentUnavailable } from '@/components/ContentUnavailable';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { useScene } from '@/content/hooks';
import { useLocale } from './LocaleLayout';
import { NotFoundRoute } from './NotFoundRoute';

// Three.js is only downloaded once someone enters a scene, which keeps the landing page light.
const SceneExperience = lazy(() =>
  import('@/components/scene/SceneExperience').then((m) => ({
    default: m.SceneExperience,
  })),
);

function FullScreenLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex h-dvh items-center justify-center">
      <LoadingIndicator label={t('status.loading')} />
    </div>
  );
}

function SceneLoader({ slug }: { slug: string }) {
  const locale = useLocale();
  const scene = useScene(slug, locale);

  if (scene.status === 'loading') return <FullScreenLoading />;
  if (scene.status === 'error')
    return <ContentUnavailable onRetry={scene.retry} />;
  if (!scene.data) return <NotFoundRoute />;
  return (
    <Suspense fallback={<FullScreenLoading />}>
      <SceneExperience scene={scene.data} locale={locale} />
    </Suspense>
  );
}

export function SceneRoute() {
  const { slug = '' } = useParams();
  return <SceneLoader key={slug} slug={slug} />;
}
