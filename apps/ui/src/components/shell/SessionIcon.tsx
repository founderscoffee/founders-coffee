import { direction, type Locale } from '@founders-coffee/i18n';

const iconProps = {
  viewBox: '0 0 20 20',
  width: 16,
  height: 16,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export const ProfileIcon = () => (
  <svg {...iconProps}>
    <circle cx="10" cy="6.75" r="3.25" />
    <path d="M3.75 16.75c0-2.9 2.8-4.5 6.25-4.5s6.25 1.6 6.25 4.5" />
  </svg>
);

export const ActivityIcon = () => (
  <svg {...iconProps}>
    <rect x="2.75" y="4.25" width="14.5" height="13" rx="2" />
    <path d="M13.25 2.75v3M6.75 2.75v3M2.75 8.5h14.5" />
  </svg>
);

export const SignOutIcon = ({ locale }: { locale: Locale }) => (
  <svg {...iconProps}>
    <g
      transform={
        direction(locale) === 'rtl' ? 'translate(20 0) scale(-1 1)' : undefined
      }
    >
      <path d="M12.25 5.25V4a1.5 1.5 0 0 0-1.5-1.5h-6A1.5 1.5 0 0 0 3.25 4v12a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5v-1.25" />
      <path d="M8.5 10h8.25M14 7.25 16.75 10 14 12.75" />
    </g>
  </svg>
);
