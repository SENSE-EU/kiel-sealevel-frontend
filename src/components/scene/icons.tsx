const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const ChevronLeft = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-4" {...stroke}>
    <path d="m14 6-5 6 5 6" />
  </svg>
);

export const ChevronRight = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-4" {...stroke}>
    <path d="m10 6 5 6-5 6" />
  </svg>
);

export const Close = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-4" {...stroke}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);

export const Play = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-current">
    <path d="M7 4.5v15l13-7.5z" />
  </svg>
);

export const Pause = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-current">
    <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
  </svg>
);
