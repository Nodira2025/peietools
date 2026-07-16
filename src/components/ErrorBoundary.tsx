import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f8fafc',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{
            background: 'white',
            borderRadius: '1rem',
            padding: '2rem',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem' }}>
              Algo salió mal
            </h1>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              Ocurrió un error inesperado. Intentá recargar la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                padding: '0.75rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '1rem',
              }}
            >
              Recargar Página
            </button>
            <details style={{ textAlign: 'left', marginTop: '1rem' }}>
              <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                Detalles técnicos
              </summary>
              <pre style={{
                background: '#f1f5f9',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                fontSize: '0.65rem',
                color: '#ef4444',
                overflow: 'auto',
                maxHeight: '200px',
                marginTop: '0.5rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {this.state.error?.toString()}
                {'\n\n'}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
