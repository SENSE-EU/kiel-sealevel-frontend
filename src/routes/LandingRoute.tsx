import { useTranslation } from 'react-i18next';
import { ContentUnavailable } from '@/components/ContentUnavailable';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { SceneCard } from '@/components/SceneCard';
import { useScenes } from '@/content/hooks';
import { themeForSlug } from '@/engine/themes';
import { useLocale } from './LocaleLayout';

export function LandingRoute() {
  const { t } = useTranslation();
  const locale = useLocale();
  const scenes = useScenes(locale);

  return (
    <div className="relative min-h-full overflow-x-hidden">
      {/* A still from the S1 scene; no 3D is downloaded before a visitor has picked a scene. Tall narrow
          screens get a portrait crop. The theme colour shows until it loads. */}
      <div
        aria-hidden
        className="fixed inset-0"
        style={{ background: themeForSlug('munitions').backdrop }}
      >
        <picture>
          <source
            media="(max-aspect-ratio: 4/5)"
            srcSet="/hero/seabed-portrait.jpg"
          />
          <img
            src="/hero/seabed-1600.jpg"
            srcSet="/hero/seabed-1600.jpg 1600w, /hero/seabed-2560.jpg 2560w"
            sizes="100vw"
            alt=""
            fetchPriority="high"
            className="size-full object-cover"
          />
        </picture>
        {/* Darker at the top and bottom, where the text and the cards sit. */}
        <div className="absolute inset-0 bg-[linear-gradient(rgb(3_21_32/0.55),rgb(3_21_32/0.05)_40%,rgb(3_21_32/0.1)_60%,rgb(3_21_32/0.6))]" />
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
