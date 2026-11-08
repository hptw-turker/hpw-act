import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useI18n } from './i18n';
import { enableDomTranslation, disableDomTranslation } from './i18n/domTranslate';
import { AppShell } from './components/AppShell';
import { Guard } from './components/Guard';
import Login from './pages/Login';
import Home from './pages/Home';
import Corporate from './pages/Corporate';
import Cycle from './pages/Cycle';
import ExcelAdmin from './pages/ExcelAdmin';
import Import from './pages/Import';
import UnitResults from './pages/UnitResults';
import Targets from './pages/Targets';
import LocalTargets from './pages/LocalTargets';
import { usePersona } from './state/persona';
import Actions from './pages/Actions';
import LocalExecutions from './pages/LocalExecutions';
import Evidence from './pages/Evidence';
import Scorecard from './pages/Scorecard';
import Organization from './pages/Organization';
import Users from './pages/Users';
import Settings from './pages/Settings';
import Customers from './pages/Customers';
import TenantSetup from './pages/TenantSetup';
import Methodology from './pages/Methodology';
import Audit from './pages/Audit';

const g = (el: JSX.Element) => <Guard>{el}</Guard>;

function TargetsRoute() { const { persona } = usePersona(); return persona.scope === 'unit' ? <LocalTargets /> : <Targets />; }

export default function App() {
  const { lang } = useI18n();
  useEffect(() => { if (lang === 'en') enableDomTranslation(); else disableDomTranslation(); return () => disableDomTranslation(); }, [lang]);
  return (
    <Routes>
      <Route path="/giris" element={<Login />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/donem" element={g(<Cycle />)} />
        <Route path="/excel" element={g(<ExcelAdmin />)} />
        <Route path="/kurumsal" element={g(<Corporate />)} />
        <Route path="/sonuclar" element={g(<Import />)} />
        <Route path="/birimler" element={g(<UnitResults />)} />
        <Route path="/hedefler" element={g(<TargetsRoute />)} />
        <Route path="/aksiyonlar" element={g(<Actions />)} />
        <Route path="/yerel-uygulamalar" element={g(<LocalExecutions />)} />
        <Route path="/kanit" element={g(<Evidence />)} />
        <Route path="/karne" element={g(<Scorecard />)} />
        <Route path="/organizasyon" element={g(<Organization />)} />
        <Route path="/kullanicilar" element={g(<Users />)} />
        <Route path="/ayarlar" element={g(<Settings />)} />
        <Route path="/musteriler" element={g(<Customers />)} />
        <Route path="/musteri-kur" element={g(<TenantSetup />)} />
        <Route path="/metodoloji" element={g(<Methodology />)} />
        <Route path="/denetim" element={g(<Audit />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
