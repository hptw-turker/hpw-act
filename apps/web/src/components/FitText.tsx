import { useLayoutEffect, useRef, useState, type ReactNode, type ElementType } from 'react';
/**
 * Dev ifade: sarmaz, kelime bölünmez. Ölçü, kabın içerik genişliğinin en fazla (1 + overflow) katı olacak şekilde düşürülür.
 * overflow varsayılan 0 (çerçeve içinde). Kasıtlı crop yalnız tek kelimelik ifadede ve en fazla 0.12 (son %10–15); cümleler kırpılmaz.
 * Ekran okuyucu tam metni okur (DOM'da tam durur).
 */
export function FitText({ children, as: Tag = 'p', className = '', maxPx, minPx = 40, overflow = 0, ...rest }: { children: ReactNode; as?: ElementType; className?: string; maxPx: number; minPx?: number; overflow?: number; [k: string]: unknown }) {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState<number>(maxPx);
  const [wrap, setWrap] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const fit = () => {
      const parent = el.parentElement; if (!parent) return;
      el.style.fontSize = `${maxPx}px`; el.style.whiteSpace = 'nowrap';
      const ps = getComputedStyle(parent);
      const cw = parent.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight);
      const w = el.scrollWidth;
      const allowed = cw * (1 + Math.min(overflow, 0.12));
      const ideal = w > allowed ? Math.floor(maxPx * allowed / w) : maxPx;
      let next = Math.max(minPx, ideal);
      // Asgari ölçüde bile sığmıyorsa satır sarar; kelime asla bölünmez. En uzun kelime de sığmıyorsa ölçü onun kadar düşer.
      const mustWrap = ideal < minPx;
      el.style.fontSize = `${next}px`; el.style.whiteSpace = mustWrap ? 'normal' : 'nowrap';
      if (mustWrap && el.scrollWidth > cw) next = Math.max(16, Math.floor(next * cw / el.scrollWidth));
      el.style.fontSize = `${next}px`;
      setSize(next); setWrap(mustWrap);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el.parentElement!);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [maxPx, minPx, overflow, children]);
  const T = Tag as ElementType;
  return <T ref={ref} className={className} style={{ fontSize: `${size}px`, whiteSpace: wrap ? 'normal' : 'nowrap', overflowWrap: 'normal', hyphens: 'none' }} {...rest}>{children}</T>;
}
