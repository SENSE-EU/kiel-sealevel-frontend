import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentUnavailable } from '@/components/ContentUnavailable';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { SceneCard } from '@/components/SceneCard';
import { useScenes } from '@/content/hooks';
import { themeForSlug } from '@/engine/themes';
import { useLocale } from './LocaleLayout';

// Three.js arrives after the page is already readable and usable, so it can't hold up the first view.
const LandingBackdrop = lazy(() =>
  import('@/components/landing/LandingBackdrop').then((m) => ({
    default: m.LandingBackdrop,
  })),
);

export function LandingRoute() {
  const { t } = useTranslation();
  const locale = useLocale();
  const scenes = useScenes(locale);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  const firstSlug =
    scenes.status === 'ready' ? scenes.data[0]?.slug : undefined;
  const backdropSlug = previewSlug ?? firstSlug ?? 'munitions';

  return (
    <div className="relative min-h-full overflow-x-hidden">
      <div
        className="fixed inset-0"
        style={{ background: themeForSlug(backdropSlug).backdrop }}
      >
        <Suspense fallback={null}>
          <LandingBackdrop slug={backdropSlug} />
        </Suspense>
      </div>

      <div className="relative flex min-h-dvh flex-col gap-6 p-6">
        <header className="flex items-center justify-between gap-3">
          <span className="font-display text-2xl font-bold tracking-[0.18em]">
            {t('appName')}
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm tracking-wider text-foam/60 sm:inline">
              {t('landing.kicker')}
            </span>
            <LanguageSwitch />
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-between gap-8">
          <div className="mt-4 max-w-xl">
            <h1 className="font-display text-4xl leading-tight font-light md:text-[3.25rem]">
              {t('landing.heading')}
            </h1>
            <p className="mt-3 text-lg leading-7 text-foam/70">
              {t('landing.intro')}
            </p>
          </div>

          <div>
            {scenes.status === 'loading' && (
              <LoadingIndicator label={t('status.loading')} />
            )}
            {scenes.status === 'error' && (
              <ContentUnavailable onRetry={scenes.retry} />
            )}
            {scenes.status === 'ready' &&
              (scenes.data.length === 0 ? (
                <p className="text-mist">{t('landing.empty')}</p>
              ) : (
                <>
                  <div className="grid items-end gap-4 md:grid-cols-3 md:gap-5">
                    {scenes.data.map((scene, index) => (
                      <SceneCard
                        key={scene.id}
                        scene={scene}
                        locale={locale}
                        number={index + 1}
                        onPreview={() => setPreviewSlug(scene.slug)}
                      />
                    ))}
                  </div>
                  <p className="mt-4 text-center text-sm text-foam/40">
                    {t('landing.choose')}
                  </p>
                </>
              ))}
          </div>
        </main>
      </div>
    </div>
  );
}
