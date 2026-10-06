import { Component, type ReactNode } from 'react';

import { logger, reportError } from '@founders-coffee/observability';

type ErrorBoundaryProps = {
  source: string;
  fallback: ReactNode;
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasFailed: boolean;
};

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasFailed: false };

  static getDerivedStateFromError = (): ErrorBoundaryState => ({
    hasFailed: true,
  });

  override componentDidCatch = (error: unknown): void => {
    reportError(error, { source: this.props.source }, logger);
  };

  override render = (): ReactNode =>
    this.state.hasFailed ? this.props.fallback : this.props.children;
}
