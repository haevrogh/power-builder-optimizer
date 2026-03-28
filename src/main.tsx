import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'

// Auto-update service worker: when a new version is detected,
// skip waiting and reload the page so user always gets fresh code.
registerSW({
  onNeedRefresh() {
    // New content available — reload immediately
    window.location.reload()
  },
  onOfflineReady() {
    // App cached for offline use
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
