import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("Uncaught React Error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes('dynamically imported module') ||
                           this.state.error?.message?.includes('Loading chunk') ||
                           this.state.error?.name === 'ChunkLoadError';

      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justify: 'center',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            padding: '2.5rem',
            borderRadius: '1rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            maxWidth: '500px',
            width: '100%'
          }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '1rem', color: isChunkError ? '#38bdf8' : '#f87171' }}>
              {isChunkError ? '🚀 Nová verze pokladny' : '⚠️ Chyba aplikace Himmel POS'}
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              {isChunkError
                ? 'Byla nasazena nová aktualizace komponent pokladního systému. Stiskněte tlačítko pro načtení nejnovější verze.'
                : 'Došlo k neočekávané chybě při vykreslování rozhraní. Stiskněte tlačítko níže pro obnovení pokladny.'}
            </p>
            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              🔄 Obnovit Pokladnu
            </button>
            {this.state.error && (
              <details style={{ marginTop: '1.5rem', textAlign: 'left', color: '#64748b', fontSize: '0.8rem', wordBreak: 'break-all' }}>
                <summary style={{ cursor: 'pointer', marginBottom: '0.5rem' }}>Detail chyby (pro správce)</summary>
                <pre style={{ backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '0.375rem', overflowX: 'auto' }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
