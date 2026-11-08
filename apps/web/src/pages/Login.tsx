import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { usePersona } from '../state/persona';
import { Kicker } from '../components/Kicker';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { FitText } from '../components/FitText';
import { PersonaSelect } from '../components/PersonaSelect';

/** Giriş: e-posta alanı → müşteri (tenant) eşlemesi → o müşterinin giriş yöntemi (kurumsal SSO ya da HPTW hesabı). HPTW personeli ayrı kimlik alanından girer.
    Prototipte ikinci bölümde rol seçilir; gerçek sistemde rol kimlikten gelir. Manifesto Red: tam ekran kırmızı, yalnız beyaz. */
const TENANTS: Record<string, { name: string; method: string }> = {
  'atlasholding.com.tr': { name: 'Atlas Holding', method: 'Kurumsal SSO · Entra' },
  'betasigorta.com.tr': { name: 'Beta Sigorta', method: 'Kurumsal SSO · Okta' },
  'gammaperakende.com': { name: 'Gamma Perakende', method: 'HPTW hesabı · e-posta + tek kullanımlık kod' },
  'happyplacetowork.com.tr': { name: 'Happy Place to Work (personel)', method: 'HPTW kimlik alanı · yalnız yetkili müşteri listesi' },
};
export default function Login() {
  const { t } = useI18n(); const nav = useNavigate(); const { persona } = usePersona();
  const [email, setEmail] = useState('emre.celik@atlasholding.com.tr');
  const domain = email.split('@')[1] ?? ''; const tenant = TENANTS[domain];
  return (
    <div className="surface-red manifesto">
      <div className="container"><span className="wordmark">{t('brand')}</span></div>
      <div className="container crop">
        <Kicker>{t('login.kicker')}</Kicker>
        <FitText as="h1" className="display-xxl enter" maxPx={176} minPx={64} style={{ marginTop: 'var(--s-2)' }}>{t('login.claim')}</FitText>
      </div>
      <div className="container grid">
        <div className="col-6 stack">
          <p className="body-l measure">{t('login.sub')}</p>
          <div style={{ maxWidth: '44ch' }}><Field id="email" type="email" label="Kurumsal e-posta" value={email} onChange={e => setEmail(e.target.value)} hint={tenant ? `${tenant.name} · ${tenant.method}` : 'Bu e-posta alanı bir müşteriye tanımlı değil; HPTW danışmanınıza yazın'} /></div>
          <Button variant="secondary" onClick={() => nav('/')} disabled={!tenant} disabledReason={!tenant ? 'Tanımsız e-posta alanı' : undefined}>{tenant ? `${tenant.name} · ${tenant.method.split(' · ')[0]} ile devam et` : 'Devam et'}</Button>
        </div>
        <div className="col-6 stack">
          <Kicker>Prototip: rol seç (gerçek sistemde rol kimlikten gelir)</Kicker>
          <div style={{ maxWidth: '48ch' }}><PersonaSelect id="aktor-giris" /></div>
          <Button variant="secondary" onClick={() => nav('/')}>{persona.roleLabel} olarak gir →</Button>
          <p className="caption">{persona.org} · {persona.unitLabel} · {persona.name} · Atlas Holding 2026 Ana Ölçüm</p>
        </div>
      </div>
    </div>
  );
}
