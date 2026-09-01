import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { StoreConfigProvider } from './context/StoreConfigContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <LanguageProvider>
        <StoreConfigProvider>
          <App />
        </StoreConfigProvider>
      </LanguageProvider>
    </ErrorBoundary>
  </StrictMode>,
)
