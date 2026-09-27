import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './ui/App.tsx';
import { store } from './state/store';

// The browser asks before closing or reloading the tab while the program in memory is modified.
window.addEventListener('beforeunload', (e) => store.onBeforeUnload(e));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
