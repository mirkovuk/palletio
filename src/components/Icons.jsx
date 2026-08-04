/**
 * Icons.jsx — hand-rolled rather than a library.
 *
 * lucide-react would add ~30kB for eleven glyphs, and a reskin usually
 * replaces the icon set anyway. These are all 16px, 1.5 stroke, currentColor.
 */

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const IconPalette = (p) => (
  <svg {...base} {...p}>
    <path d="M8 1.5a6.5 6.5 0 0 0 0 13c.7 0 1.2-.5 1.2-1.2 0-.3-.1-.6-.3-.8-.2-.2-.3-.5-.3-.8 0-.7.5-1.2 1.2-1.2h1.4A3.3 3.3 0 0 0 14.5 7c0-3-2.9-5.5-6.5-5.5Z" />
    <circle cx="4.6" cy="7.4" r=".9" fill="currentColor" stroke="none" />
    <circle cx="6.8" cy="4.4" r=".9" fill="currentColor" stroke="none" />
    <circle cx="10.2" cy="4.8" r=".9" fill="currentColor" stroke="none" />
  </svg>
);

export const IconSparkle = (p) => (
  <svg {...base} {...p}>
    <path d="M7 1.8 8.3 5 11.5 6.3 8.3 7.6 7 10.8 5.7 7.6 2.5 6.3 5.7 5 7 1.8Z" />
    <path d="M12 9.5 12.7 11.2 14.4 11.9 12.7 12.6 12 14.3 11.3 12.6 9.6 11.9 11.3 11.2 12 9.5Z" />
  </svg>
);

export const IconEye = (p) => (
  <svg {...base} {...p}>
    <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
    <circle cx="8" cy="8" r="2.1" />
  </svg>
);

export const IconTag = (p) => (
  <svg {...base} {...p}>
    <path d="M2 7.2V2.6c0-.3.3-.6.6-.6h4.6c.2 0 .3 0 .4.2l6.2 6.2c.2.2.2.6 0 .8l-4.6 4.6a.6.6 0 0 1-.8 0L2.2 7.6a.6.6 0 0 1-.2-.4Z" />
    <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconDownload = (p) => (
  <svg {...base} {...p}>
    <path d="M8 2v7.5M4.8 6.8 8 10l3.2-3.2M2.5 12.5h11" />
  </svg>
);

export const IconCopy = (p) => (
  <svg {...base} {...p}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.4" />
    <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
  </svg>
);

export const IconLock = (p) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" />
    <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" />
  </svg>
);

export const IconUnlock = (p) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.4" />
    <path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.6-.8" />
  </svg>
);

export const IconTrash = (p) => (
  <svg {...base} {...p}>
    <path d="M2.8 4.2h10.4M6.2 4.2V3a.8.8 0 0 1 .8-.8h2a.8.8 0 0 1 .8.8v1.2M4.2 4.2l.5 8.4a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.5-8.4" />
  </svg>
);

export const IconShuffle = (p) => (
  <svg {...base} {...p}>
    <path d="M2 4h2.3c.9 0 1.7.5 2.1 1.2l2.2 3.6c.4.7 1.2 1.2 2.1 1.2H14M2 12h2.3c.9 0 1.7-.5 2.1-1.2l.6-1M9.4 5.6l.5-.8c.4-.7 1.2-1.2 2.1-1.2H14" />
    <path d="M12.2 2 14 3.8 12.2 5.6M12.2 8.4 14 10.2 12.2 12" />
  </svg>
);

export const IconPlus = (p) => (
  <svg {...base} {...p}>
    <path d="M8 3.2v9.6M3.2 8h9.6" />
  </svg>
);

export const IconUpload = (p) => (
  <svg {...base} {...p}>
    <path d="M8 10.5V3M4.8 6.2 8 3l3.2 3.2M2.5 12.5h11" />
  </svg>
);

export const IconDropper = (p) => (
  <svg {...base} {...p}>
    <path d="M9.8 2.6a1.9 1.9 0 0 1 2.7 2.7l-1 1 .8.8-1.2 1.2-.8-.8-4.6 4.6-2.2.6.6-2.2 4.6-4.6-.8-.8L8.3 3.9l.8.8 .7-1.1Z" />
  </svg>
);

export const IconGrip = (p) => (
  <svg {...base} {...p} strokeWidth={0}>
    <circle cx="6" cy="4" r="1.1" fill="currentColor" />
    <circle cx="10" cy="4" r="1.1" fill="currentColor" />
    <circle cx="6" cy="8" r="1.1" fill="currentColor" />
    <circle cx="10" cy="8" r="1.1" fill="currentColor" />
    <circle cx="6" cy="12" r="1.1" fill="currentColor" />
    <circle cx="10" cy="12" r="1.1" fill="currentColor" />
  </svg>
);

export const IconCheck = (p) => (
  <svg {...base} {...p}>
    <path d="M3 8.4 6.2 11.6 13 4.8" />
  </svg>
);

export const IconArrowRight = (p) => (
  <svg {...base} {...p}>
    <path d="M3 8h10M9.4 4.4 13 8l-3.6 3.6" />
  </svg>
);

export const IconSun = (p) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="3.1" />
    <path d="M8 1.4v1.4M8 13.2v1.4M2.4 8H1M15 8h-1.4M4 4l-1-1M13 13l-1-1M12 4l1-1M3 13l1-1" />
  </svg>
);

export const IconMoon = (p) => (
  <svg {...base} {...p}>
    <path d="M13.4 9.4A5.8 5.8 0 0 1 6.6 2.6a5.9 5.9 0 1 0 6.8 6.8Z" />
  </svg>
);

export const IconSettings = (p) => (
  <svg {...base} {...p}>
    <circle cx="8" cy="8" r="2.2" />
    <path d="M12.7 9.9a1 1 0 0 0 .2 1.1l.1.1a1.3 1.3 0 1 1-1.8 1.8l-.1-.1a1 1 0 0 0-1.7.7v.2a1.3 1.3 0 1 1-2.6 0v-.1a1 1 0 0 0-1.8-.7l-.1.1a1.3 1.3 0 1 1-1.8-1.8l.1-.1a1 1 0 0 0-.7-1.7h-.2a1.3 1.3 0 1 1 0-2.6h.1a1 1 0 0 0 .7-1.8l-.1-.1a1.3 1.3 0 0 1 1.8-1.8l.1.1a1 1 0 0 0 1.7-.7v-.2a1.3 1.3 0 0 1 2.6 0v.1a1 1 0 0 0 1.8.7l.1-.1a1.3 1.3 0 1 1 1.8 1.8l-.1.1a1 1 0 0 0 .7 1.7h.2a1.3 1.3 0 1 1 0 2.6h-.1a1 1 0 0 0-.9.7Z" />
  </svg>
);

export const IconLink = (p) => (
  <svg {...base} {...p}>
    <path d="M6.6 9.4a2.6 2.6 0 0 0 3.9.3l1.9-1.9a2.6 2.6 0 0 0-3.7-3.7l-1.1 1.1" />
    <path d="M9.4 6.6a2.6 2.6 0 0 0-3.9-.3L3.6 8.2a2.6 2.6 0 0 0 3.7 3.7l1.1-1.1" />
  </svg>
);

export const IconX = (p) => (
  <svg {...base} {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const IconWarning = (p) => (
  <svg {...base} {...p}>
    <path d="M7.1 2.6 1.7 12a1 1 0 0 0 .9 1.5h10.8a1 1 0 0 0 .9-1.5L8.9 2.6a1 1 0 0 0-1.8 0Z" />
    <path d="M8 6.2v2.6M8 11h.01" />
  </svg>
);

export const IconSave = (p) => (
  <svg {...base} {...p}>
    <path d="M12.5 13.5h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h7l3 3v7a1 1 0 0 1-1 1Z" />
    <path d="M5 2.5v3.6h5V2.5M5 13.5V9.4h6v4.1" />
  </svg>
);
