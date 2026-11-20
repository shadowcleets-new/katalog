import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed.error && parsed.operationType) {
        readable = `Data access (${parsed.operationType} on ${parsed.path ?? 'collection'}): ${parsed.error}`;
      }
    } catch {
      // plain error string
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error) {
    console.error('Katalog ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--m3-surface)] p-6 text-[var(--m3-on-surface)]">
          <div className="w-full max-w-md rounded-3xl border border-[var(--m3-outline-variant)] bg-[var(--m3-surface-card)] p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-xl font-bold">Something interrupted Katalog</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--m3-on-surface-variant)]">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--m3-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--m3-on-primary)]"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
