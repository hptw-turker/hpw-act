import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { I18nProvider } from './i18n';
import { PersonaProvider } from './state/persona';
import App from './App';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter;
// Tek dosyalık prototip ilk açılışta giriş (manifesto) ekranından başlar
if (import.meta.env.VITE_ROUTER === 'hash' && !window.location.hash) window.location.hash = '#/giris';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <PersonaProvider>
        <Router>
          <App />
        </Router>
      </PersonaProvider>
    </I18nProvider>
  </StrictMode>,
);
