import { createContext, useContext, useState, type ReactNode } from 'react';
import { PERSONAS, byId, DEFAULT_PERSONA, type Persona } from '../personas';

interface Ctx { persona: Persona; setPersona: (id: string) => void; all: Persona[]; can: (route: string) => boolean; }
const C = createContext<Ctx | null>(null);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, set] = useState<Persona>(() => byId(new URLSearchParams(window.location.search).get('aktor') ?? DEFAULT_PERSONA));
  const value: Ctx = { persona, setPersona: (id) => set(byId(id)), all: PERSONAS, can: (route) => persona.nav.includes(route as Persona['nav'][number]) };
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function usePersona(): Ctx { const v = useContext(C); if (!v) throw new Error('PersonaProvider missing'); return v; }
