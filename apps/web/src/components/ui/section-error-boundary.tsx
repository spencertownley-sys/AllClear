'use client';

import * as React from 'react';
import { ErrorBanner } from './error-banner';

interface Props {
  label: string;
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/** Isolates a failing section so the rest of the screen still renders (UI/UX Notes §3). */
export class SectionErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[section:${this.props.label}]`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorBanner
          message={`Couldn't load ${this.props.label} for this location.`}
          onRetry={() => {
            this.setState({ error: null });
            if (typeof window !== 'undefined') window.location.reload();
          }}
        />
      );
    }
    return this.props.children;
  }
}
