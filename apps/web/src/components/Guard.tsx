import { useLocation, Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { usePersona } from '../state/persona';
import { Kicker } from './Kicker';
import { SCOPE_LABEL } from '../personas';
/** Politika karar noktası (prototip): rolün gezinmesinde olmayan ekran gösterilmez; neden reddedildiği açıklanır. Kırmızı yok. */
export function Guard({ children }: { children: ReactNode }) {
  const { persona, can } = usePersona(); const loc = useLocation();
  if (can(loc.pathname)) return <>{children}</>;
  return (
    <section className="section surface-white">
      <div className="container grid">
        <div className="col-12"><Kicker>Yetki kararı · ret · rol: {persona.roleLabel} · kapsam: {SCOPE_LABEL[persona.scope]}</Kicker></div>
        <div className="col-8 stack">
          <h1 className="h1">Bu ekran {persona.roleLabel} için görünür değil.</h1>
          <p className="body-l measure">Görünürlük rolden değil, sorumluluk ilişkisinden gelir: bu rolün {persona.unitLabel} kapsamında {loc.pathname} ekranındaki kayıtlara ilişkisi yok. Kararı yetki politikası verir, ekran yalnız yansıtır.</p>
          <p><Link to="/" className="link bold">Dikkat kuyruğuna dön</Link></p>
        </div>
      </div>
    </section>
  );
}
