import { loading, type Locale } from '@founders-coffee/i18n';
import { LoadingStatus } from '@founders-coffee/ui';

import logoDraw from '../../assets/logo-draw.webp';

type RouteTransitionProps = { locale: Locale };

export const RouteTransition = ({ locale }: RouteTransitionProps) => (
  <LoadingStatus
    label={loading({}, { locale })}
    isLabelHidden
    className="min-h-[60vh] flex-col justify-center"
  >
    <picture>
      <source
        media="(prefers-reduced-motion: reduce)"
        srcSet="/branding/pwa-logo-165.webp"
      />
      <img
        src={logoDraw}
        alt=""
        width={96}
        height={96}
        decoding="async"
        className="size-24 object-contain"
      />
    </picture>
  </LoadingStatus>
);
