import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { registerSW } from 'virtual:pwa-register'

// Registrar auto-actualización del Service Worker
registerSW({ immediate: true })

const rootElement = document.getElementById('root')!
// The bootstrap error screen must not replace nodes owned by React.
rootElement.dataset.reactOwned = 'true'
createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
