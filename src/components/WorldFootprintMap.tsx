import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import {
  binColor, MAP_BINS, MAP_NO_DATA, REGIONS, regionOfIso,
  type CountryRef, type RegionDef, type RegionId,
} from '../lib/countries';

/** Same status colours as the dashboard KPI cards (Active red, LOA amber, Exited slate). */
const STATUS_DOT = { active: '#E50913', loa: '#d9a21b', exit: '#64748B' } as const;

export interface CountryCount {
  ref: CountryRef;
  count: number;
  active: number;
  loa: number;
  exit: number;
  /** share of all learners, 0–100 */
  pct: number;
}

interface Props {
  countries: CountryCount[]; // sorted, largest first
  loading: boolean;
  totalLearners: number;
  /** learners whose location is a region ("APAC", "Africa") or unrecognised text */
  unplacedCount: number;
  unplacedLabels: string[];
}

const W = 820;
const H = 420;
const ANTARCTICA = '010';
const OUTSIDE_FILL = '#F1F1F2';
const IN_REGION_EMPTY = '#E3E4E5';

type CountryFeature = Feature<Geometry, { name: string }>;

interface RegionStat {
  def: RegionDef;
  count: number;
  active: number;
  loa: number;
  exit: number;
  pct: number;
  countries: CountryCount[];
}

interface Hover { iso: string; x: number; y: number }

const fmt = (n: number) => n.toLocaleString();

export default function WorldFootprintMap({ countries, loading, totalLearners, unplacedCount, unplacedLabels }: Props) {
  const [world, setWorld] = useState<CountryFeature[] | null>(null);
  const [regionId, setRegionId] = useState<RegionId | 'all'>('all');
  const [hover, setHover] = useState<Hover | null>(null);
  const [focusIso, setFocusIso] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [frameW, setFrameW] = useState(0);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setFrameW(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Country shapes are loaded on demand so they don't weigh down the main bundle
  useEffect(() => {
    let alive = true;
    import('world-atlas/countries-110m.json').then(mod => {
      if (!alive) return;
      const topo = mod.default as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
      const fc = feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>;
      setWorld(fc.features.filter(f => String(f.id) !== ANTARCTICA));
    });
    return () => { alive = false; };
  }, []);

  // Esc returns to the global view
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setRegionId('all'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const byIso = useMemo(() => new Map(countries.map(c => [c.ref.iso, c])), [countries]);

  const regionStats = useMemo<RegionStat[]>(() => REGIONS.map(def => {
    const members = countries.filter(c => regionOfIso(c.ref.iso).id === def.id);
    const count = members.reduce((s, c) => s + c.count, 0);
    return {
      def,
      count,
      active: members.reduce((s, c) => s + c.active, 0),
      loa: members.reduce((s, c) => s + c.loa, 0),
      exit: members.reduce((s, c) => s + c.exit, 0),
      pct: (count / (totalLearners || 1)) * 100,
      countries: members,
    };
  })
    // Largest region first; "Rest of World" is a catch-all, so it always sits last
    .sort((a, b) => (a.def.id === 'row' ? 1 : b.def.id === 'row' ? -1 : b.count - a.count)),
  [countries, totalLearners]);

  const selected = regionId === 'all' ? null : regionStats.find(r => r.def.id === regionId) ?? null;

  const projection = useMemo(() => {
    if (!world) return null;
    return geoEqualEarth().fitExtent([[6, 6], [W - 6, H - 6]], { type: 'FeatureCollection', features: world });
  }, [world]);
  const path = useMemo(() => (projection ? geoPath(projection) : null), [projection]);
  const project = useCallback((p: [number, number]) => projection?.(p) ?? null, [projection]);

  // Zoom: fit the selected region's window into the frame (CSS-animated transform)
  const zoom = useMemo(() => {
    const view = selected?.def.view;
    if (!projection || !view) return { k: 1, tx: 0, ty: 0 };
    const [[w, s], [e, n]] = view;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
      const lon = w + ((e - w) * i) / 16;
      const lat = s + ((n - s) * i) / 16;
      pts.push([lon, s], [lon, n], [w, lat], [e, lat]);
    }
    const xy = pts.map(p => projection(p)).filter((p): p is [number, number] => !!p);
    const xs = xy.map(p => p[0]); const ys = xy.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const k = Math.min(8, 0.92 * Math.min(W / (x1 - x0), H / (y1 - y0)));
    return { k, tx: W / 2 - k * (x0 + x1) / 2, ty: H / 2 - k * (y0 + y1) / 2 };
  }, [projection, selected]);

  const shapeIsos = useMemo(() => new Set((world ?? []).map(f => String(f.id))), [world]);
  const dots = countries.filter(c => !shapeIsos.has(c.ref.iso));

  const inSelected = (iso: string) => !selected || regionOfIso(iso).id === selected.def.id;

  const fillFor = (iso: string): { fill: string; opacity: number } => {
    const c = byIso.get(iso);
    const region = regionOfIso(iso);
    // Global view: one red scale by learner count (no per-region hues)
    if (!selected) return { fill: c ? binColor(c.count) : MAP_NO_DATA, opacity: 1 };
    if (region.id !== selected.def.id) return { fill: OUTSIDE_FILL, opacity: 1 };
    return { fill: c ? binColor(c.count) : IN_REGION_EMPTY, opacity: 1 };
  };

  const activeIso = hover?.iso ?? focusIso;
  const active = activeIso ? byIso.get(activeIso) : undefined;
  const activeFeature = activeIso && world ? world.find(f => String(f.id) === activeIso) : undefined;

  const onMove = (iso: string) => (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHover({ iso, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const selectRegion = (id: RegionId | 'all') => {
    setHover(null);
    setFocusIso(null);
    setRegionId(prev => (prev === id ? 'all' : id));
  };

  // Map coords → % of the frame, after zoom (for HTML labels layered over the SVG)
  const toPct = (p: [number, number] | null) => p
    ? { left: `${((zoom.k * p[0] + zoom.tx) / W) * 100}%`, top: `${((zoom.k * p[1] + zoom.ty) / H) * 100}%` }
    : null;

  const top5 = countries.slice(0, 5);

  // Drill-down labels: biggest countries first; nudge up/down to avoid overlaps, skip if no room
  const placedLabels = useMemo(() => {
    if (!selected || !projection || !frameW) return [];
    const scale = frameW / W;
    const frameH = H * scale;
    const boxes: Array<[number, number, number, number]> = [[0, 0, 130, 50]]; // "All regions" button
    const out: Array<{ c: CountryCount; x: number; y: number }> = [];
    for (const c of selected.countries.slice(0, 10)) {
      const p = projection(c.ref.at);
      if (!p) continue;
      const w = c.ref.name.length * 6.4 + String(c.count).length * 6 + 30;
      const h = 22;
      const baseX = (zoom.k * p[0] + zoom.tx) * scale;
      const baseY = (zoom.k * p[1] + zoom.ty) * scale;
      const offsets = shapeIsos.has(c.ref.iso)
        ? [[0, 0], [0, -24], [0, 24], [w / 2 + 10, 0], [-w / 2 - 10, 0]]
        : [[0, -18], [0, 18], [w / 2 + 10, 0], [-w / 2 - 10, 0]];
      for (const [dx, dy] of offsets) {
        const x = Math.min(Math.max(baseX + dx, w / 2 + 6), frameW - w / 2 - 6);
        const y = Math.min(Math.max(baseY + dy, h / 2 + 6), frameH - h / 2 - 6);
        const box: [number, number, number, number] = [x - w / 2, y - h / 2, x + w / 2, y + h / 2];
        if (boxes.every(b => box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3])) {
          boxes.push(box);
          out.push({ c, x, y });
          break;
        }
      }
    }
    return out;
  }, [selected, projection, frameW, zoom, shapeIsos]);
  const ready = !!(world && path && projection) && !loading;

  return (
    <div>
      <style>{`
        @keyframes fpFade { from { opacity: 0; transform: translate(-50%, -40%); } to { opacity: 1; transform: translate(-50%, -50%); } }
        @keyframes fpRise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .fp-zoom { transition: transform 750ms cubic-bezier(0.22, 1, 0.36, 1); transform-origin: 0 0; }
      `}</style>

      {/* Region tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 mb-4" role="tablist" aria-label="Regions">
        <RegionTab
          active={!selected}
          onClick={() => selectRegion('all')}
          swatch={<i className="fas fa-earth-americas text-[11px] text-slate-500" />}
          name="All regions"
          value={loading ? '—' : fmt(totalLearners)}
          sub="learners"
        />
        {regionStats.map(r => (
          <RegionTab
            key={r.def.id}
            active={selected?.def.id === r.def.id}
            onClick={() => selectRegion(r.def.id)}
            swatch={<i className="fas fa-location-dot text-[10px] text-slate-400" />}
            name={r.def.name}
            title={`${r.def.name} · ${r.def.description}`}
            value={loading ? '—' : `${r.pct.toFixed(1)}%`}
            sub={loading ? '' : `${fmt(r.count)} learners`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-6">
        {/* ── Map ── */}
        <div>
          <div ref={wrapRef} className="relative rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden select-none" onMouseLeave={() => setHover(null)}>
            {!ready ? (
              <div className="aspect-[820/420] w-full animate-pulse bg-slate-100" />
            ) : (
              <svg viewBox={`0 0 ${W} ${H}`} className="block w-full h-auto" role="img" aria-label={selected ? `Map of ${selected.def.name} learners by country` : 'World map of learners by region'}>
                {/* In a drill-down, any click outside the selected region (ocean, background, other countries) goes back */}
                <rect
                  width={W}
                  height={H}
                  fill="#FFFFFF"
                  className={selected ? 'cursor-zoom-out' : undefined}
                  onClick={selected ? () => selectRegion('all') : undefined}
                />
                <g className="fp-zoom" style={{ transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.k})` }}>
                  <path
                    d={path!({ type: 'Sphere' }) ?? undefined}
                    fill={selected ? '#FBFBFB' : '#FFFFFF'}
                    className={selected ? 'cursor-zoom-out' : undefined}
                    onClick={selected ? () => selectRegion('all') : undefined}
                  />
                  {world!.map(f => {
                    const iso = String(f.id);
                    const c = byIso.get(iso);
                    const { fill, opacity } = fillFor(iso);
                    const interactive = inSelected(iso);
                    const region = regionOfIso(iso);
                    return (
                      <path
                        key={iso}
                        d={path!(f) ?? undefined}
                        fill={fill}
                        fillOpacity={opacity}
                        stroke="#FFFFFF"
                        strokeWidth={0.6}
                        vectorEffect="non-scaling-stroke"
                        className={`transition-[fill,fill-opacity] duration-500 ${interactive || !selected ? 'cursor-pointer' : 'cursor-zoom-out'}`}
                        onMouseMove={interactive && c ? onMove(iso) : undefined}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => {
                          if (!selected) {
                            if (region.id !== 'row' || c) selectRegion(region.id);
                          } else if (!interactive) {
                            selectRegion('all');
                          }
                        }}
                      >
                        <title>{f.properties.name} · {region.name}{c ? ` — ${fmt(c.count)} learners` : ''}</title>
                      </path>
                    );
                  })}

                  {/* region outline in drill-down, hovered country outline on top */}
                  {activeFeature && (
                    <path d={path!(activeFeature) ?? undefined} fill="none" stroke="#1A1A1B" strokeWidth={1.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                  )}

                  {/* small countries (no shape at this scale) as dots */}
                  {dots.filter(c => inSelected(c.ref.iso)).map(c => {
                    const pt = project(c.ref.at);
                    if (!pt) return null;
                    const isActive = activeIso === c.ref.iso;
                    const color = binColor(c.count);
                    return (
                      <g key={c.ref.iso} className="cursor-pointer" onMouseMove={onMove(c.ref.iso)} onMouseLeave={() => setHover(null)}
                        onClick={() => { if (!selected) selectRegion(regionOfIso(c.ref.iso).id); }}>
                        <circle cx={pt[0]} cy={pt[1]} r={9 / zoom.k} fill="transparent" />
                        <circle cx={pt[0]} cy={pt[1]} r={(isActive ? 5.5 : 3.8) / zoom.k} fill={color}
                          stroke={isActive ? '#1A1A1B' : '#FFFFFF'} strokeWidth={isActive ? 1.5 : 1.2} vectorEffect="non-scaling-stroke" />
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}

            {/* Global view: region labels */}
            {ready && !selected && regionStats.filter(r => r.count > 0).map(r => {
              const pos = toPct(project(r.def.label));
              if (!pos) return null;
              return (
                <button
                  key={`lbl-${r.def.id}`}
                  type="button"
                  onClick={() => selectRegion(r.def.id)}
                  className="absolute z-10 flex items-center rounded-lg bg-white/95 backdrop-blur px-2.5 py-1 shadow-[0_2px_10px_rgba(0,0,0,0.12)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.2)] transition-shadow"
                  style={{ ...pos, transform: 'translate(-50%, -50%)', animation: 'fpFade .35s ease both' }}
                  title={`${r.def.description} — click to explore`}
                >
                  <span className="text-left leading-tight">
                    <span className="block text-[11px] font-bold text-slate-900 whitespace-nowrap">{r.def.name}</span>
                    <span className="block text-[10px] text-slate-500 tabular-nums whitespace-nowrap">{r.pct.toFixed(1)}% · {fmt(r.count)}</span>
                  </span>
                </button>
              );
            })}

            {/* Drill-down: country labels (appear once the zoom settles) */}
            {ready && selected && placedLabels.map(({ c, x, y }) => {
              return (
                <div
                  key={`${selected.def.id}-${c.ref.iso}`}
                  className="pointer-events-none absolute z-10 rounded-md bg-white/95 px-2 py-0.5 shadow-[0_1px_6px_rgba(0,0,0,0.15)] whitespace-nowrap"
                  style={{ left: x, top: y, transform: 'translate(-50%, -50%)', animation: 'fpFade .35s ease .6s both' }}
                >
                  <span className="text-[11px] font-semibold text-slate-900">{c.ref.name}</span>
                  <span className="ml-1.5 text-[10px] text-slate-500 tabular-nums">{fmt(c.count)}</span>
                </div>
              );
            })}

            {/* Back control */}
            {ready && selected && (
              <button
                type="button"
                onClick={() => selectRegion('all')}
                className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-[10px] bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 shadow-[0_2px_10px_rgba(0,0,0,0.12)] hover:text-brand-600"
              >
                <i className="fas fa-arrow-left text-[10px]" />All regions
              </button>
            )}

            {/* Tooltip */}
            {hover && active && (
              <div
                className="pointer-events-none absolute z-30 min-w-[170px] rounded-xl bg-white/95 backdrop-blur border border-slate-200 shadow-lg px-3 py-2"
                style={{ left: Math.min(hover.x + 14, (wrapRef.current?.clientWidth ?? 0) - 190), top: Math.max(hover.y - 76, 8) }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: binColor(active.count) }} />
                  <span className="text-xs font-bold text-slate-900">{active.ref.name}</span>
                  <span className="text-[10px] text-slate-500">{regionOfIso(active.ref.iso).name}</span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-base font-extrabold text-slate-900 font-display">{fmt(active.count)}</span>
                  <span className="text-[11px] text-slate-500">learners · {active.pct.toFixed(1)}%</span>
                </div>
                <div className="flex items-center gap-2.5 text-[11px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT.active }} />{fmt(active.active)} active</span>
                  <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT.loa }} />{fmt(active.loa)} LOA</span>
                  <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_DOT.exit }} />{fmt(active.exit)} exited</span>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 min-h-[20px]">
            <>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Learners</span>
                {MAP_BINS.map(b => (
                  <span key={b.label} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span className="w-3.5 h-2.5 rounded-sm" style={{ background: b.color }} />{b.label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span className="w-3.5 h-2.5 rounded-sm" style={{ background: IN_REGION_EMPTY }} />None
                </span>
                <span className="text-[11px] text-slate-400">
                  {selected ? 'Click anywhere outside the region (or press Esc) to go back' : 'Click a region to explore its countries'}
                </span>
              </>
          </div>
        </div>

        {/* ── Side panel ── */}
        <div className={`flex flex-col ${selected ? 'justify-start' : 'justify-end'}`}>
          {selected
            ? <RegionDetail stat={selected} totalLearners={totalLearners} activeIso={activeIso} onFocus={setFocusIso} />
            : (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-slate-900">Top 5 countries</h4>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Share of learners</span>
                </div>
                <ol className="space-y-2">
                  {loading
                    ? [0, 1, 2, 3, 4].map(i => <li key={i} className="h-8 rounded-lg bg-slate-100 animate-pulse" />)
                    : top5.map((c, i) => (
                      <li
                        key={c.ref.iso}
                        className={`rounded-lg px-1.5 py-1 -mx-1.5 transition-colors cursor-default ${activeIso === c.ref.iso ? 'bg-brand-50' : ''}`}
                        onMouseEnter={() => setFocusIso(c.ref.iso)}
                        onMouseLeave={() => setFocusIso(null)}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 shrink-0 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center font-display">{i + 1}</span>
                          <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-slate-800">{c.ref.name}</span>
                          <span className="text-[13px] font-bold text-slate-900 tabular-nums">{c.pct.toFixed(1)}%</span>
                        </div>
                        <div className="mt-1.5 ml-[30px] flex items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(c.pct / (top5[0]?.pct || 1)) * 100}%`, background: '#E50913' }} />
                          </div>
                          <span className="w-12 text-right text-[11px] text-slate-500 tabular-nums">{fmt(c.count)}</span>
                        </div>
                      </li>
                    ))}
                </ol>
                {!loading && (
                  <p className="mt-3 pt-3 border-t border-slate-100 text-[11px] leading-relaxed text-slate-500">
                    {fmt(countries.reduce((s, c) => s + c.count, 0))} of {fmt(totalLearners)} learners placed on the map.
                    {unplacedCount > 0 && (
                      <> {fmt(unplacedCount)} list a region or unrecognised value
                        {unplacedLabels.length > 0 && <> ({unplacedLabels.slice(0, 3).join(', ')}{unplacedLabels.length > 3 ? ', …' : ''})</>}.</>
                    )}
                  </p>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function RegionTab({ active, onClick, swatch, name, value, sub, title }: {
  active: boolean; onClick: () => void; swatch: React.ReactNode; name: string; value: string; sub: string; title?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      title={title}
      className={`min-w-0 text-left rounded-[14px] border px-2.5 py-2 transition-all ${active
        ? 'bg-slate-900 border-slate-900 text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,0.5)]'
        : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'}`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`w-4 h-4 shrink-0 flex items-center justify-center ${active ? '[&_i]:text-white' : ''}`}>{swatch}</span>
        <span className={`text-[12px] font-semibold truncate ${active ? 'text-white' : 'text-slate-800'}`}>{name}</span>
      </div>
      <div className={`mt-1 text-[17px] leading-tight font-extrabold font-display tabular-nums ${active ? 'text-white' : 'text-slate-900'}`}>{value}</div>
      <div className={`text-[10px] truncate ${active ? 'text-white/70' : 'text-slate-500'}`}>{sub}</div>
    </button>
  );
}

function RegionDetail({ stat, totalLearners, activeIso, onFocus }: {
  stat: RegionStat; totalLearners: number; activeIso: string | null; onFocus: (iso: string | null) => void;
}) {
  const top = stat.countries[0]?.count || 1;
  return (
    <div key={stat.def.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" style={{ animation: 'fpRise .3s ease both' }}>
      <div className="flex items-center gap-2">
        <i className="fas fa-location-dot text-[10px] text-brand-500" />
        <h4 className="text-[13px] font-bold text-slate-900">{stat.def.name}</h4>
      </div>
      <p className="mt-0.5 text-[10.5px] text-slate-500 leading-snug">{stat.def.description}</p>

      <div className="mt-2 grid grid-cols-2 gap-1">
        {[
          { label: 'Learners', value: fmt(stat.count) },
          { label: 'Share of total', value: `${stat.pct.toFixed(1)}%` },
        ].map(m => (
          <div key={m.label} className="rounded-lg bg-[#F7F7F8] px-2 py-1.5">
            <div className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">{m.label}</div>
            <div className="mt-0.5 text-[15px] font-extrabold text-slate-900 font-display tabular-nums leading-none">{m.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1">
        {[
          { label: 'Active', value: stat.active, dot: STATUS_DOT.active },
          { label: 'LOA', value: stat.loa, dot: STATUS_DOT.loa },
          { label: 'Exited', value: stat.exit, dot: STATUS_DOT.exit },
        ].map(m => (
          <div key={m.label} className="rounded-lg bg-[#F7F7F8] px-2 py-1.5 min-w-0">
            <div className="flex items-center gap-1 text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: m.dot }} />{m.label}
            </div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span className="text-[13px] font-extrabold text-slate-900 font-display tabular-nums leading-none">{fmt(m.value)}</span>
              <span className="text-[9.5px] text-slate-500 tabular-nums">{((m.value / (stat.count || 1)) * 100).toFixed(0)}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">{stat.countries.length} countries</span>
        <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Share of region</span>
      </div>
      <ol className="mt-1 max-h-[150px] overflow-y-auto pr-1 space-y-0.5 custom-scrollbar">
        {stat.countries.length === 0 && <li className="py-6 text-center text-[12px] text-slate-400">No learners in this region yet</li>}
        {stat.countries.map((c, i) => (
          <li
            key={c.ref.iso}
            className={`rounded-md px-1.5 py-0.5 transition-colors ${activeIso === c.ref.iso ? 'bg-brand-50' : ''}`}
            onMouseEnter={() => onFocus(c.ref.iso)}
            onMouseLeave={() => onFocus(null)}
          >
            <div className="flex items-center gap-2">
              <span className="w-3.5 text-[9.5px] text-slate-400 tabular-nums">{i + 1}</span>
              <span className="flex-1 min-w-0 truncate text-[11.5px] font-medium text-slate-800">{c.ref.name}</span>
              <span className="text-[11.5px] font-bold text-slate-900 tabular-nums">{fmt(c.count)}</span>
              <span className="w-10 text-right text-[10px] text-slate-500 tabular-nums">{((c.count / (stat.count || 1)) * 100).toFixed(1)}%</span>
            </div>
            <div className="mt-0.5 ml-5 h-[3px] rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(c.count / top) * 100}%`, background: binColor(c.count) }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-2 pt-2 border-t border-slate-100 text-[10.5px] text-slate-500">
        {stat.pct.toFixed(1)}% of all {fmt(totalLearners)} learners live in {stat.def.name}.
      </p>
    </div>
  );
}
