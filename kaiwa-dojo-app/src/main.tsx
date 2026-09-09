import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ── Auto-recover from stale chunks after a new deployment on hosting ──
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    console.warn('Vite preload error detected, refreshing page for new assets...')
    window.location.reload()
  })

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event?.reason?.message || ''
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('dynamically imported module')
    ) {
      event.preventDefault()
      console.warn('Dynamic import chunk 404 detected, reloading to fetch latest assets...')
      window.location.reload()
    }
  })

  window.addEventListener('error', (event) => {
    const msg = event?.message || ''
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('dynamically imported module')
    ) {
      event.preventDefault()
      console.warn('Script loading error detected, reloading to fetch latest assets...')
      window.location.reload()
    }
  })
}

// ── Initialize Stored Theme & Text Size ──────────────────────
const savedTheme = localStorage.getItem('kaiwa_theme') || 'light'
const root = document.documentElement

if (savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  root.classList.add('dark')
} else {
  root.classList.remove('dark')
}

const savedTextSize = localStorage.getItem('kaiwa_text_size') || 'normal'
if (savedTextSize === 'small') root.style.fontSize = '14px'
else if (savedTextSize === 'normal') root.style.fontSize = '16px'
else if (savedTextSize === 'large') root.style.fontSize = '18px'
else if (savedTextSize === 'xlarge') root.style.fontSize = '20px'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
