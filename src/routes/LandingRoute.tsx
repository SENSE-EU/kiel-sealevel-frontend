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

      <div className="relative flex min-h-dvh flex-col gap-8 p-5 md:p-6">
        <header className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2.5">
            <span aria-hidden className="size-2 rounded-full bg-signal" />
            <span className="text-[0.8125rem] font-semibold tracking-[0.28em]">
              {t('appName')}
            </span>
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden label text-signal sm:inline">
              {t('landing.kicker')}
            </span>
            <LanguageSwitch />
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-between gap-8">
          <div className="mt-6 max-w-2xl md:mt-10">
            <h1 className="display text-[2.875rem] leading-[1] font-light tracking-[-0.02em] text-balance md:text-[5rem]">
              {t('landing.heading')}
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-[1.5] text-pretty text-mist md:text-xl">
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
                <p className="text-sm text-mist">{t('landing.empty')}</p>
              ) : (
                <>
                  <div className="grid items-stretch gap-2.5 md:grid-cols-3 md:gap-3">
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
                  <p className="mt-4 text-center label text-foam/70">
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
