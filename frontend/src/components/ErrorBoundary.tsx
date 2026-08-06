"use client";

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
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
    console.error(`ErrorBoundary caught an error in ${this.props.name || 'Component'}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="error-boundary">
          <h3>Something went wrong in {this.props.name || 'this component'}</h3>
          <p className="text-muted text-sm">{this.state.error?.message}</p>
          <button 
            className="btn btn-outline" 
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: 'var(--space-4)' }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
