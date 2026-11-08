import type { ReactNode } from 'react';
/** Kicker / meta: Caption ölçüsü, tamamı büyük harf (lang=tr ile İ/I doğru), geniş aralık. */
export function Kicker({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`caption ${className}`}>{children}</p>;
}
