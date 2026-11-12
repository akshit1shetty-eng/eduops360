import { useEffect, useState } from 'react';

export interface BreakdownItem {
  label: string;
  count: number;
}

interface Props {
  title: string;
  icon: string;
  /** Base colour (hex) for the ramp; the largest group gets the full colour. */
  color: string;
  /** Soft tint used behind the icon and on hover. */
  tint: string;
  total: number;
  /** Share of all learners this group represents (0–100). */
  shareOfAll: number;
  items: BreakdownItem[];
  loading: boolean;
  emptyText: string;
  onViewAll: () => void;
  onSelect: (label: string) => void;
  onClose: () => void;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Ranked ramp: same hue, fading toward white as the rank drops. */
function rampColor(base: string, idx: number, n: number): string {
  const [r, g, b] = hexToRgb(base);
  const t = n <= 1 ? 0 : (idx / (n - 1)) * 0.7;
  const mix = (c: number) => Math.round(c + (255 - c) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

const fmtPct = (p: number) => (p > 0 && p < 0.1 ? '<0.1%' : `${p.toFixed(1)}%`);

export default function StatusBreakdownPanel({
  title, icon, color, tint, total, shareOfAll, items, loading, emptyText, onViewAll, onSelect, onClose,
}: Props) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Grow bars in on open / when switching between panels.
  useEffect(() => {
    setMounted(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    return () => cancelAnimationFrame(id);
  }, [title]);

  const n = items.length;

  return (
    <section
      className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_30px_-22px_rgba(0,0,0,0.3)] -mt-3 px-4 py-3.5 transition-all duration-300"
      style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'translateY(0)' : 'translateY(-4px)' }}
    >
      <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: color }} />

      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center" style={{ background: tint, color }}>
            <i className={`fas ${icon} text-[11px]`} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[13.5px] font-bold text-slate-900 leading-tight">{title}</h3>
            <p className="text-[11px] text-slate-500 truncate">
              {loading ? 'Loading…' : (
                <>
                  <span className="font-semibold text-slate-700 tabular-nums">{total.toLocaleString()}</span> learners
                  {' · '}{shareOfAll.toFixed(1)}% of all · click a reason to see who
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11.5px] font-semibold text-slate-700 hover:text-white hover:bg-slate-900 transition-colors"
          >
            View all <i className="fas fa-arrow-right text-[9px]" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <i className="fas fa-xmark text-[11px]" />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="mt-3 h-14 rounded-xl bg-slate-50 animate-pulse" />
      ) : n === 0 ? (
        <p className="mt-3 text-[12px] text-slate-500">{emptyText}</p>
      ) : (
        <>
          {/* Split bar */}
          <div className="mt-3 flex h-2 w-full rounded-full overflow-hidden bg-slate-100 gap-[2px]" onMouseLeave={() => setHovered(null)}>
            {items.map((it, i) => {
              const pct = (it.count / (total || 1)) * 100;
              return (
                <button
                  key={it.label}
                  type="button"
                  title={`${it.label}: ${it.count.toLocaleString()} (${fmtPct(pct)})`}
                  onMouseEnter={() => setHovered(it.label)}
                  onClick={() => onSelect(it.label)}
                  className="h-full transition-all duration-700 ease-out"
                  style={{
                    width: mounted ? `${pct}%` : '0%',
                    minWidth: pct > 0 ? 3 : 0,
                    background: rampColor(color, i, n),
                    opacity: hovered !== null && hovered !== it.label ? 0.3 : 1,
                  }}
                />
              );
            })}
          </div>

          {/* Reasons */}
          <ul className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-0.5">
            {items.map((it, i) => {
              const pct = (it.count / (total || 1)) * 100;
              const isHover = hovered === it.label;
              const dim = hovered !== null && !isHover;
              return (
                <li key={it.label}>
                  <button
                    type="button"
                    onMouseEnter={() => setHovered(it.label)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onSelect(it.label)}
                    className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all duration-150"
                    style={{ background: isHover ? tint : 'transparent', opacity: dim ? 0.5 : 1 }}
                  >
                    <span className="w-2 h-2 shrink-0 rounded-full" style={{ background: rampColor(color, i, n) }} />
                    <span className="flex-1 min-w-0 text-[12.5px] text-slate-700 truncate" title={it.label}>{it.label}</span>
                    <span className="text-[12.5px] font-bold text-slate-900 tabular-nums">{it.count.toLocaleString()}</span>
                    <span className="w-11 text-right text-[11px] text-slate-400 tabular-nums">{fmtPct(pct)}</span>
                    <i
                      className={`fas fa-chevron-right text-[8px] transition-opacity ${isHover ? 'opacity-100' : 'opacity-0'}`}
                      style={{ color }}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
