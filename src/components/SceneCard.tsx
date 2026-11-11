import { Link } from 'react-router';
import type { SceneSummary } from '@/content/types';
import { themeForSlug } from '@/engine/themes';
import type { Locale } from '@/i18n/locales';

export function SceneCard({
  scene,
  locale,
  number,
  onPreview,
}: {
  scene: SceneSummary;
  locale: Locale;
  number: number;
  onPreview: () => void;
}) {
  const image = scene.cardImage ? `url("${scene.cardImage.url}")` : null;
  const shade = `linear-gradient(${themeForSlug(scene.slug).tint}, #0b2c3c 50%, #041420 95%)`;

  return (
    <Link
      to={`/${locale}/scenes/${scene.slug}`}
      onPointerEnter={onPreview}
      onFocus={onPreview}
      style={{ backgroundImage: image ? `${shade}, ${image}` : shade }}
      className="flex min-h-36 flex-col justify-end rounded-2xl border border-foam/20 bg-cover bg-center p-5 transition duration-200 hover:-translate-y-1 hover:border-signal hover:shadow-2xl motion-reduce:transform-none md:min-h-46"
    >
      <span className="font-display text-sm font-medium tracking-[0.14em] text-signal">
        {String(number).padStart(2, '0')}
      </span>
      <h2 className="font-display text-xl leading-tight font-semibold">
        {scene.title}
      </h2>
      <p className="mt-1 text-sm text-mist">{scene.teaser}</p>
    </Link>
  );
}
