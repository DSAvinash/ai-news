import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[React Error Boundary Caught]:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-container-margin bg-surface-container-lowest border border-red-200 rounded-lg shadow-sm text-center my-stack-md animate-fadeIn">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-stack-sm">
            <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
          <h3 className="text-headline-sm font-bold text-primary mb-1">
            {this.props.fallbackTitle || 'Something went wrong'}
          </h3>
          <p className="text-body-sm text-on-surface-variant max-w-md mx-auto mb-stack-md leading-relaxed">
            We encountered an unexpected problem loading this section. The rest of the application remains accessible.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 bg-primary text-white hover:bg-inverse-surface rounded-lg text-body-sm font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-sm">refresh</span> Retry Section
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="px-4 py-2 bg-surface-container-low border border-outline-variant hover:bg-surface-container text-primary rounded-lg text-body-sm font-semibold transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
