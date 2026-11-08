import { usePersona } from '../state/persona';
import { useTx } from '../i18n/tx';
/** Aktör seçici: brif gereği yerli ok gizli, tipografik ↓. Rol değişince giriş ekranı o rolün kuyruğuna döner. */
export function PersonaSelect({ id = 'aktor', onChange }: { id?: string; onChange?: (id: string) => void }) {
  const { persona, setPersona, all } = usePersona(); const tx = useTx();
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label caption">{tx('Aktör')}</span>
      <span className="select-wrap">
        <select id={id} className="field__input" value={persona.id} onChange={e => { setPersona(e.target.value); onChange?.(e.target.value); }}>
          <optgroup label={`Atlas Holding (${tx('müşteri')})`}>
            {all.filter(p => p.org === 'Atlas Holding').map(p => <option key={p.id} value={p.id}>{tx(p.roleLabel)} · {p.name}</option>)}
          </optgroup>
          <optgroup label={`Happy Place to Work (${tx('sistem')})`}>
            {all.filter(p => p.org === 'HPTW').map(p => <option key={p.id} value={p.id}>{tx(p.roleLabel)} · {p.name}</option>)}
          </optgroup>
        </select>
      </span>
    </label>
  );
}
