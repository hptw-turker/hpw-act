import { useNavigate } from 'react-router-dom';
import { usePersona } from '../state/persona';
import { ROUTE_LABEL, type Persona } from '../personas';
import { useTx } from '../i18n/tx';

const GROUPS: [string, string[]][] = [
  ['Yönetim', ['ceo', 'gmy']],
  ['İnsan Kaynakları', ['hr_admin', 'hrbp']],
  ['Saha', ['region_head', 'branch_manager', 'action_owner', 'enabler', 'viewer']],
  ['Sistem yönetimi (yönetici paneli)', ['hpw_admin', 'hpw_consultant', 'hpw_methodologist', 'hpw_auditor']],
];

/** Üstteki açılır menü: her ekran grubuna (rol × ekran) tek seçimle ulaşılır. Seçim aktörü değiştirir ve ekranı açar. */
export function ScreenMenu({ id = 'ekranlar' }: { id?: string }) {
  const { persona, setPersona, all } = usePersona(); const nav = useNavigate(); const tx = useTx();
  const byId = (pid: string) => all.find(p => p.id === pid) as Persona;
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label caption">{tx('Ekranlar')}</span>
      <span className="select-wrap">
        <select id={id} className="field__input" value="" onChange={e => { const [pid, route] = e.target.value.split('|'); if (pid && route) { setPersona(pid); nav(route); } }}>
          <option value="">{tx('Bir ekrana git')} · {tx('şu an')}: {tx(persona.roleLabel)}</option>
          {GROUPS.map(([g, ids]) => (
            <optgroup key={g} label={tx(g)}>
              {ids.flatMap(pid => byId(pid).nav.filter(r => r !== '/').map(r => <option key={`${pid}|${r}`} value={`${pid}|${r}`}>{tx(byId(pid).roleLabel)} · {tx(ROUTE_LABEL[r])}</option>))}
            </optgroup>
          ))}
        </select>
      </span>
    </label>
  );
}
