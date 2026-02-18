import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Apply theme attribute before React renders to avoid a flash on refresh.
(() => {
  const saved = localStorage.getItem('sentraexam_theme_mode');
  const initial =
    saved === 'light' || saved === 'dark'
      ? saved
      : window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
        ? 'dark'
        : 'light';
  document.documentElement.dataset.theme = initial;
})();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
