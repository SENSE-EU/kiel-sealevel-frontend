import { Link } from 'react-router';
import { ArrowUpRight } from '@/components/scene/icons';
import type { SceneSummary } from '@/content/types';
import type { Locale } from '@/i18n/locales';

export function SceneCard({
  scene,
  locale,
  number,
}: {
  scene: SceneSummary;
  locale: Locale;
  number: number;
}) {
  const sheen =
    'linear-gradient(160deg, rgb(255 255 255 / 0.12), rgb(255 255 255 / 0.03) 50%)';
  const image = scene.cardImage
    ? `, linear-gradient(rgb(3 21 32 / 0.2), rgb(3 21 32 / 0.85)), url(${JSON.stringify(scene.cardImage.url)})`
    : '';

  return (
    <Link
      to={`/${locale}/scenes/${scene.slug}`}
      style={{ backgroundImage: `${sheen}${image}` }}
      className="group flex min-h-36 flex-col rounded-card panel bg-cover bg-center p-4 transition-[border-color,translate] duration-500 ease-out hover:-translate-y-1 hover:border-signal/50 motion-reduce:hover:translate-y-0 md:min-h-44 md:p-5"
    >
      <span className="flex items-center justify-between text-signal">
        <span className="label">{String(number).padStart(2, '0')}</span>
        <span className="transition-[translate,color] duration-300 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
          <ArrowUpRight />
        </span>
      </span>
      <h2 className="mt-auto pt-6 display text-[1.375rem] leading-tight font-light [overflow-wrap:anywhere] hyphens-auto md:text-xl lg:text-[1.625rem]">
        {scene.title}
      </h2>
      <p className="mt-1.5 text-[0.8125rem] leading-snug text-mist">
        {scene.teaser}
      </p>
    </Link>
  );
}
