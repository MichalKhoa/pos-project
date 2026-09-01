import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { StoreConfigProvider } from './context/StoreConfigContext.jsx'

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element #root not found in document.');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <LanguageProvider>
          <StoreConfigProvider>
            <App />
          </StoreConfigProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (err) {
  console.error('Fatal initialization error:', err);
  document.body.innerHTML = `
    <div style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 600px; margin: 4rem auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border: 1px solid #e2e8f0; color: #0f172a;">
      <h2 style="color: #e11d48; margin-top: 0;">Chyba spuštění aplikace (Startup Error)</h2>
      <p style="color: #475569; font-size: 0.95rem;">Došlo k chybě při inicializaci pokladního systému:</p>
      <pre style="background: #f1f5f9; padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.85rem; color: #b91c1c;">${err?.message || err}</pre>
      <button onclick="localStorage.clear(); location.reload();" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #2563eb; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer;">
        Vymazat mezipaměť a restartovat
      </button>
    </div>
  `;
}
