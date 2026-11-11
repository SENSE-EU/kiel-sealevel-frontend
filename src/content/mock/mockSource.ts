import type { ContentSource, Hotspot, RichText, Scene } from '@/content/types';
import type { Locale } from '@/i18n/locales';

type Localised = Record<Locale, string>;

const paragraph = (text: string): RichText => [
  { type: 'paragraph', children: [{ type: 'text', text }] },
];

const placeholderBody: Localised = {
  de: 'Platzhaltertext. Der endgültige Text kommt aus dem CMS, sobald er freigegeben ist.',
  en: 'Placeholder text. The final copy comes from the CMS once it has been cleared.',
};

interface MockHotspot {
  title: Localised;
  body?: Localised;
  video?: boolean;
}

interface MockScene {
  slug: string;
  title: Localised;
  teaser: Localised;
  viewpoints: Localised[];
  hotspots: MockHotspot[];
}

const numbered = (from: number, to: number): MockHotspot[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({
    title: { de: `Station ${from + i}`, en: `Hotspot ${from + i}` },
  }));

const scenes: MockScene[] = [
  {
    slug: 'munitions',
    title: { de: 'Munition im Meer', en: 'Munitions in the sea' },
    teaser: {
      de: 'Kolberger Heide · Kieler Außenförde',
      en: 'Kolberger Heide · Kiel outer fjord',
    },
    viewpoints: [
      { de: 'Über einem Munitionshaufen', en: 'Above a munition pile' },
      { de: 'Nahaufnahme einer Granathülle', en: 'Close on a single casing' },
      {
        de: 'Ein Vermessungsfahrzeug im Einsatz',
        en: 'A survey vehicle at work',
      },
      { de: 'Der Blasenschleier', en: 'The bubble curtain' },
    ],
    hotspots: [
      {
        title: { de: 'Was hier unten liegt', en: "What's down here" },
        body: {
          de: placeholderBody.de,
          en: 'Around 1.6 million tonnes of conventional ammunition — and up to 5,000 tonnes of chemical ammunition — lie in the North Sea and the Baltic: sea mines, bombs, grenades, phosphorus. Most dates from the two world wars. Some was deliberately dumped, some lost in accidents. It has rested on the seabed ever since.',
        },
      },
      {
        title: { de: 'Es bleibt nicht dicht', en: "It doesn't stay sealed" },
        video: true,
        body: {
          de: placeholderBody.de,
          en: 'The casings are rusting through. As they corrode, the sunken munitions release harmful substances into the water and sediment, year after year — a danger to marine life, plants and possibly people. The threat is no longer only an explosion; it is slow, spreading contamination.',
        },
      },
      { title: { de: 'Finden', en: 'Finding it' } },
      { title: { de: 'Bergen', en: 'Lifting it out' } },
      {
        title: {
          de: 'Das Meer bei der Arbeit schützen',
          en: 'Protecting the sea while you work',
        },
      },
      {
        title: {
          de: 'Jemand kümmert sich darum',
          en: 'Someone is dealing with it',
        },
      },
    ],
  },
  {
    slug: 'marine-biodiversity',
    title: {
      de: 'Meeresbiodiversität & Wassertemperatur',
      en: 'Marine biodiversity & water temperature',
    },
    teaser: {
      de: 'Kieler Förde · flache Seegraswiese',
      en: 'Kiel Fjord · shallow seagrass meadow',
    },
    viewpoints: [
      { de: 'In der Seegraswiese', en: 'Inside the seagrass meadow' },
      { de: 'Die Renaturierungsfläche', en: 'The restoration plot' },
      { de: 'Die Messstation', en: 'The monitoring station' },
      { de: 'Die Muschelbank am Rand', en: 'The mussel bed at the edge' },
    ],
    hotspots: numbered(1, 6),
  },
  {
    slug: 'stone-reefs',
    title: { de: 'Steinfischerei & Riffe', en: 'Stone fishing & reefs' },
    teaser: {
      de: 'Kieler Bucht · flaches Steinriff',
      en: 'Kiel Bay · shallow stone reef',
    },
    viewpoints: [
      { de: 'Das Blockfeld', en: 'The boulder field' },
      { de: 'Ein einzelner Findling', en: 'A single glacial erratic' },
      {
        de: 'Kahler Grund, wo Steine entnommen wurden',
        en: 'Bare seabed where stones were taken',
      },
      { de: 'Eine Renaturierungsfläche', en: 'A restoration plot' },
    ],
    hotspots: numbered(1, 6),
  },
];

function buildScene(mock: MockScene, locale: Locale): Scene {
  const hotspots = mock.hotspots.map((h, index): Hotspot => ({
    id: `${mock.slug}-hs-${index + 1}`,
    anchor: `hs_${index + 1}`,
    order: index + 1,
    title: h.title[locale],
    body: paragraph((h.body ?? placeholderBody)[locale]),
    image: { url: '/placeholders/media.svg', alt: h.title[locale] },
    video: h.video
      ? { url: '/placeholders/hotspot-video.webm', alt: '' }
      : null,
  }));
  if (mock.slug === 'munitions') {
    // Deliberately points at a node that doesn't exist: it must be hidden, with a console warning.
    hotspots.push({
      id: 'missing',
      anchor: 'hs_does_not_exist',
      order: 99,
      title: 'Missing anchor',
      body: '',
      image: null,
      video: null,
    });
  }
  return {
    id: mock.slug,
    slug: mock.slug,
    title: mock.title[locale],
    teaser: mock.teaser[locale],
    cardImage: null,
    model: null,
    startViewpointId: `${mock.slug}-vp-1`,
    viewpoints: mock.viewpoints.map((label, index) => ({
      id: `${mock.slug}-vp-${index + 1}`,
      name: label.en,
      anchor: `vp_${index + 1}`,
      order: index + 1,
      label: label[locale],
    })),
    hotspots,
    credits: '',
  };
}

/** Lets the app run with no backend. Not part of production builds. */
export const mockSource: ContentSource = {
  listScenes: async (locale) =>
    scenes.map((scene) => buildScene(scene, locale)),
  getScene: async (slug, locale) => {
    const scene = scenes.find((candidate) => candidate.slug === slug);
    return scene ? buildScene(scene, locale) : null;
  },
};
