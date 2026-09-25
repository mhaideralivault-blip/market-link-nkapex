import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// After a new deploy, an already-open tab may ask for page chunks that no longer exist (blank screen).
// Reload once to pick up the new version; the flag stops a reload loop if the failure is something else.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  try {
    if (sessionStorage.getItem('chunk-reload') === String(Math.floor(Date.now() / 60000))) return;
    sessionStorage.setItem('chunk-reload', String(Math.floor(Date.now() / 60000)));
  } catch {
    /* storage unavailable: still try one reload below */
  }
  window.location.reload();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
