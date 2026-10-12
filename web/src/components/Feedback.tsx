import { Component, type ReactNode } from 'react';
import { NETWORK_ERROR } from '../lib/format';

export function RetryNotice({ message = NETWORK_ERROR, retry }: { message?: string; retry: () => unknown }) {
  return <div className="notice notice--error" role="alert"><p>{message}</p><button type="button" className="btn" onClick={() => void retry()}>Retry</button></div>;
}
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <main className="page"><h1 className="masthead__title">SCOOP</h1><RetryNotice message="This page could not load. Try again." retry={() => window.location.reload()} /></main> : this.props.children;
  }
}
