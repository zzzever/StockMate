import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import { useAppStore } from './store/useAppStore'

// Sync html class with darkMode on app startup
const { darkMode } = useAppStore.getState()
if (darkMode) {
  document.documentElement.classList.add('dark')
  document.documentElement.style.colorScheme = 'dark'
} else {
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = 'light'
}

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  console.warn('[unhandledrejection]', { reason: event.reason, message: event.reason instanceof Error ? event.reason.message : String(event.reason) });
  // Prevent the default browser console error from showing in production
  // while still capturing the error for debugging.
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
