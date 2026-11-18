const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
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

export const Check = ({ className = 'size-3' }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 24 24" className={className} {...stroke}>
    <path d="m5 12 5 5 9-10" />
  </svg>
);

export const Expand = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-4" {...stroke}>
    <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
  </svg>
);

export const Collapse = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-4" {...stroke}>
    <path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7" />
  </svg>
);

export const ArrowRight = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" {...stroke}>
    <path d="M5 12h14m-5-5 5 5-5 5" />
  </svg>
);

export const ArrowUpRight = () => (
  <svg aria-hidden viewBox="0 0 24 24" className="size-3.5" {...stroke}>
    <path d="M7 17 17 7M8 7h9v9" />
  </svg>
);
