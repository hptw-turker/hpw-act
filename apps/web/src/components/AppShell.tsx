import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { usePersona } from '../state/persona';
import { ROUTE_LABEL } from '../personas';
import { PersonaSelect } from './PersonaSelect';
import { ScreenMenu } from './ScreenMenu';
import { useTx } from '../i18n/tx';

/** Header beyaz zemin: kırmızı wordmark header'ın kırmızı kotasını tüketir; başka kırmızı yok. Aktör seçici üst satırda; gezinme role göre.
    Footer sıcak siyah: beyaz metin, kırmızı wordmark, üstte 1 px beyaz hairline. */
export function AppShell() {
  const { t, lang, setLang } = useI18n(); const { persona } = usePersona(); const nav = useNavigate(); const tx = useTx();
  return (
    <>
      <a className="sr-only" href="#main">İçeriğe geç</a>
      <header className="header surface-white hairline-b">
        <div className="container header__top">
          <Link to="/" className="wordmark wordmark--red">{t('brand')} <small>{t('product')}</small></Link>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div style={{ minWidth: '30ch' }}><ScreenMenu /></div>
            <div style={{ minWidth: '28ch' }}><PersonaSelect onChange={() => nav('/')} /></div>
            <span className="caption">{persona.org} · {tx(persona.unitLabel)}</span>
            <button type="button" className="link caption" onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')} aria-label="Dil">{lang === 'tr' ? 'EN' : 'TR'}</button>
            <Link to="/giris" className="link caption">{t('nav.signout')}</Link>
          </div>
        </div>
        <div className="container">
          <nav className="nav caption" aria-label="Ana gezinme">
            {persona.nav.map(to => <NavLink key={to} to={to} end={to === '/'}>{tx(ROUTE_LABEL[to])}</NavLink>)}
          </nav>
        </div>
      </header>
      <main id="main"><Outlet /></main>
      <footer className="footer surface-ink hairline">
        <div className="container">
          <span className="wordmark wordmark--red">{t('brand')}</span>
          <span className="caption">{t('footer.line')}</span>
        </div>
      </footer>
    </>
  );
}
