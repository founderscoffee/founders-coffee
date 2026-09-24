import { host_map_loading, type Locale } from '@founders-coffee/i18n';
import { LoadingStatus } from '@founders-coffee/ui';

type HostMapSkeletonProps = {
  locale: Locale;
};

export const HostMapSkeleton = ({
  locale,
}: HostMapSkeletonProps): React.ReactElement => (
  <LoadingStatus
    label={host_map_loading({}, { locale })}
    isLabelHidden
    className="skeleton relative h-full min-h-64 w-full rounded-none motion-reduce:animate-none"
  >
    <div className="absolute start-3 top-3 h-11 w-36 rounded-full bg-base-100/60" />
  </LoadingStatus>
);
