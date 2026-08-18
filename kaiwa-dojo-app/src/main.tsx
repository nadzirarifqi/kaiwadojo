import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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
