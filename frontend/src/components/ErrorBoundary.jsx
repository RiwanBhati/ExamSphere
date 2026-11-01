import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '2.5rem',
          maxWidth: '600px',
          margin: '3rem auto',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          textAlign: 'center',
          color: '#f3f4f6'
        }}>
          <AlertTriangle size={40} color="#f87171" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#f87171' }}>
            Something went wrong in this view
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '1.25rem' }}>
            {this.state.error?.message || 'An unexpected error occurred while rendering.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', margin: '0 auto' }}
          >
            <RefreshCw size={14} />
            <span>Reload Page</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

