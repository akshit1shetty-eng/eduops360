import { useMemo, useState } from 'react';
import { CHART_COLORS, CHART_OTHER } from '../lib/brand';

export interface ProgramShare {
  name: string;
  count: number;
  /** share of all learners, 0–100 */
  pct: number;
}

interface Props {
  items: ProgramShare[];
  total: number;
  loading: boolean;
  onSelect?: (programName: string) => void;
}

/** Programs past this rank share the neutral "Other" colour in the share bar. */
const MAX_COLORED = CHART_COLORS.length; // 8 validated slots

/**
 * Part-to-whole view: a thin segmented share bar on top (identity by colour, swatch on each
 * row instead of a legend) and ranked bars below, each in its program colour.
 */
export default function ProgramDistribution({ items, total, loading, onSelect }: Props) {
  const [hovered, setHovered] = useState<string | null>(null);

  const ranked = useMemo(() => [...items].sort((a, b) => b.count - a.count), [items]);
  const colorOf = (i: number) => (i < MAX_COLORED ? CHART_COLORS[i] : CHART_OTHER);
  const max = ranked[0]?.count ?? 1;

  // Segments for the share bar: top programs + one folded "Other" block
  const segments = useMemo(() => {
    const head: Array<{ key: string; label: string; count: number; pct: number; color: string }> = ranked
      .slice(0, MAX_COLORED)
      .map((p, i) => ({ key: p.name, label: p.name, count: p.count, pct: p.pct, color: CHART_COLORS[i] }));
    const tail = ranked.slice(MAX_COLORED);
    if (tail.length) {
      const count = tail.reduce((s, p) => s + p.count, 0);
      head.push({ key: '__other', label: `Other (${tail.length})`, count, pct: tail.reduce((s, p) => s + p.pct, 0), color: CHART_OTHER });
    }
    return head;
  }, [ranked]);

  const hoveredSeg = segments.find(s => s.key === hovered) ?? (hovered && ranked.slice(MAX_COLORED).some(p => p.name === hovered) ? segments.find(s => s.key === '__other') : undefined);

  return (
    <div>
      {/* Share bar */}
      <div className="mb-2 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Share of learners</div>
          <div className="text-sm text-slate-700 min-h-[20px]">
            {hoveredSeg ? (
              <><span className="font-semibold text-slate-900">{hoveredSeg.label}</span> · {hoveredSeg.count.toLocaleString()} learners · {hoveredSeg.pct.toFixed(1)}%</>
            ) : (
              <span className="text-slate-500">Hover a segment or row for detail</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex h-3.5 w-full gap-[2px] rounded-full overflow-hidden bg-slate-100" role="img" aria-label="Learner share by program">
        {loading
          ? <div className="w-full h-full animate-pulse bg-slate-200" />
          : segments.map(s => (
            <div
              key={s.key}
              className="h-full transition-[opacity,width] duration-700 first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${(s.count / (total || 1)) * 100}%`,
                minWidth: 3,
                background: s.color,
                opacity: hoveredSeg && hoveredSeg.key !== s.key ? 0.35 : 1,
              }}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
              title={`${s.label}: ${s.count.toLocaleString()} (${s.pct.toFixed(1)}%)`}
            />
          ))}
      </div>

      {/* Ranked rows */}
      <div className="mt-7 grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-0.5 -mx-3">
        {loading
          ? [0, 1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 my-1 rounded-xl bg-slate-50 animate-pulse" />)
          : ranked.map((p, i) => {
            const dim = hovered && hovered !== p.name && !(hovered === '__other' && i >= MAX_COLORED);
            return (
              <div
                key={p.name}
                role={onSelect ? 'button' : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onClick={onSelect ? () => onSelect(p.name) : undefined}
                onMouseEnter={() => setHovered(p.name)}
                onMouseLeave={() => setHovered(null)}
                className={`w-full rounded-[12px] px-3 py-2.5 transition-all ${dim ? 'opacity-50' : ''} hover:bg-[#F7F7F8] ${onSelect ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-5 text-[11px] font-semibold text-slate-400 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorOf(i) }} />
                  <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-slate-800">{p.name}</span>
                  <span className="text-[13px] font-bold text-slate-900 tabular-nums">{p.count.toLocaleString()}</span>
                  <span className="w-14 text-right text-[12px] text-slate-500 tabular-nums">{p.pct.toFixed(1)}%</span>
                </div>
                <div className="mt-2 ml-[52px] h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(p.count / max) * 100}%`, background: colorOf(i) }} />
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
