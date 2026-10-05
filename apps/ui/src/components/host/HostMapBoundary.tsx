import { Component, type ReactNode } from 'react';

import type { Locale } from '@founders-coffee/i18n';
import { logger, reportError } from '@founders-coffee/observability';

import { HostMapFailure } from './HostMapFailure';

type HostMapBoundaryProps = {
  locale: Locale;
  children: ReactNode;
};

type HostMapBoundaryState = {
  hasFailed: boolean;
};

export class HostMapBoundary extends Component<
  HostMapBoundaryProps,
  HostMapBoundaryState
> {
  override state: HostMapBoundaryState = { hasFailed: false };

  static getDerivedStateFromError = (): HostMapBoundaryState => ({
    hasFailed: true,
  });

  override componentDidCatch = (error: unknown): void => {
    reportError(error, { source: 'host_map' }, logger);
  };

  override render = (): ReactNode =>
    this.state.hasFailed ? (
      <HostMapFailure
        locale={this.props.locale}
        onRetry={() => window.location.reload()}
      />
    ) : (
      this.props.children
    );
}
