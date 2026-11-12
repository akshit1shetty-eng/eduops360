import React, { useMemo, useState } from 'react';
import { useGGUOverviewAnalytics } from '../hooks/useGGUOverviewAnalytics';
import { useTermWiseSplit } from '../hooks/useTermWiseSplit';
import FilterSelect from './FilterSelect';
import { GGU_DEFAULT_TERM } from '../lib/config';
import { parseTermCode, totalsByTerm, freshContinuingByTerm, splitYears, learnerTypeSeries, type TermSeries } from '../lib/termWiseSplit';

/** Academic quality is designed but parked until its data sources exist — flip to bring the tab back. */
const SHOW_ACADEMIC_QUALITY = false;

interface Props {
  onClose?: () => void;
}

type TabId = 'status' | 'outcomes' | 'trends' | 'quality';
type ViewMode = 'chart' | 'table';

/* ── Encoding (kept identical on every tab so the page reads as one system) ── */
const C = {
  active: '#E50913',   // live / active — upGrad red
  past: '#404041',     // historical / closed — upGrad dark grey
  loa: '#d9a21b',      // leave of absence
  exit: '#B5B7BA',     // exited
  fresh: '#E50913',    // new (fresh) enrolments
  continuing: '#7A7C7F', // continuing learners
  enrol: '#404041',    // new enrolments column chart
  track: '#EEEEF0',
};

const ALL_TABS: Array<{ id: TabId; label: string; icon: string; title: string; hint: string }> = [
  { id: 'status', label: 'Status & cohorts', icon: 'fa-chart-bar', title: 'Status & cohorts', hint: 'Active, leave of absence and exited learners, with live and closed cohorts per program' },
  { id: 'outcomes', label: 'Graduation', icon: 'fa-graduation-cap', title: 'Graduation', hint: 'Number of learners who have graduated, by program' },
  { id: 'trends', label: 'Term trends', icon: 'fa-chart-line', title: 'Term trends', hint: 'Active learners, new enrolments and fresh vs continuing learners, term by term' },
  { id: 'quality', label: 'Academic quality', icon: 'fa-chalkboard-teacher', title: 'Academic quality', hint: 'Live sessions, assignments and course-level performance' },
];
const TABS = ALL_TABS.filter(t => t.id !== 'quality' || SHOW_ACADEMIC_QUALITY);

const fmt = (n: number) => n.toLocaleString();
const pctStr = (n: number | null | undefined, digits = 1) => (n === null || n === undefined || Number.isNaN(n) ? '—' : `${n.toFixed(digits)}%`);
/** Program names are all GGU — drop the prefix so labels stay scannable. */
const shortName = (p: string) => p.replace(/^GGU\s+/i, '');

/* ── Small building blocks ─────────────────────────────────────────────── */

function Meter({ value, color, max = 100 }: { value: number; color: string; max?: number }) {
  return (
    <div className="h-1 rounded-full overflow-hidden" style={{ background: C.track }}>
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(0, Math.min(100, (value / (max || 1)) * 100))}%`, background: color }} />
    </div>
  );
}

function Kpi({ label, icon, chip = 'bg-slate-100 text-slate-600', value, meter, caption, loading }: {
  label: string; icon: string; chip?: string; value: React.ReactNode; meter: React.ReactNode; caption: React.ReactNode; loading: boolean;
}) {
  // Same anatomy and size as the Overall Dashboard KPI cards
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <span className={`w-6 h-6 rounded-md flex items-center justify-center ${chip}`}>
        <i className={`fas ${icon} text-[9px]`} />
      </span>
      <div className="mt-2 text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-[21px] leading-none font-extrabold text-slate-900 font-display tabular-nums">
        {loading ? <span className="inline-block h-5 w-16 rounded bg-slate-200 animate-pulse" /> : value}
      </div>
      <div className="mt-2">{meter}</div>
      <div className="mt-1 text-[10.5px] text-slate-500">{caption}</div>
    </div>
  );
}

function Legend({ items }: { items: Array<{ label: string; color: string; value?: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {items.map(i => (
        <span key={i.label} className="inline-flex items-center gap-2 text-[12px] text-slate-600">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
          {i.value && <span className="font-semibold text-slate-900 tabular-nums">{i.value}</span>}
        </span>
      ))}
    </div>
  );
}

/** Headline figure used at the top of each tab. */
function Stat({ label, value, sub, color }: { label: string; value: string; sub?: React.ReactNode; color?: string }) {
  return (
    <div className="min-w-[140px]">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-slate-900 font-display tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

interface Column<T> { label: string; align?: 'left' | 'right'; render: (row: T) => React.ReactNode }

function DataTable<T>({ columns, rows, rowKey, footer }: {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; footer?: React.ReactNode[];
}) {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-slate-200/80">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.06em] text-slate-500" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>
            {columns.map(c => (
              <th key={c.label} className={`px-4 py-3 font-semibold whitespace-nowrap ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={rowKey(r)} className="border-t border-slate-100 hover:bg-[#FAFAFB] transition-colors">
              {columns.map(c => (
                <td key={c.label} className={`px-4 py-3 tabular-nums text-slate-700 ${c.align === 'right' ? 'text-right' : 'text-left'}`}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-bold text-slate-900" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>
              {footer.map((f, i) => (
                <td key={i} className={`px-4 py-3 tabular-nums ${i === 0 ? 'text-left' : 'text-right'}`}>{f}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** One labelled chart row: program name · visual · trailing figures. */
function ChartRow({ label, children, trailing }: { label: string; children: React.ReactNode; trailing: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr_auto] sm:grid-cols-[140px_1fr_auto] items-center gap-4 rounded-[12px] px-3 py-2.5 hover:bg-[#F7F7F8] transition-colors">
      <span className="text-[13px] font-semibold text-slate-800 truncate" title={label}>{label}</span>
      <div className="min-w-0">{children}</div>
      <div className="text-right tabular-nums">{trailing}</div>
    </div>
  );
}

function SectionTitle({ title, sub, aside }: { title: string; sub?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
      <div>
        <h3 className="text-[14px] font-bold text-slate-900 leading-tight">{title}</h3>
        {sub && <p className="text-[12px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {aside}
    </div>
  );
}

/**
 * Column chart for one measure over terms. Single series → no legend; the
 * section title names it. Hover shows the exact value; the latest and the
 * peak term are labelled directly.
 */
function TermColumns({ data, color, unit, loading }: {
  data: Array<{ term: string; value: number }>; color: string; unit: string; loading: boolean;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...data.map(d => d.value));
  // Leave ~15% headroom so the value labels above the tallest bars stay inside the chart.
  const target = max * 1.15;
  // Round up to a multiple of 2×step so the middle tick is a whole number too.
  const step = Math.max(1, Math.pow(10, Math.floor(Math.log10(target))) / 2);
  const niceMax = Math.ceil(target / (2 * step)) * 2 * step;
  const ticks = [0, niceMax / 2, niceMax];
  const peak = data.reduce((best, d) => (d.value > (best?.value ?? -1) ? d : best), data[0]);
  const latest = [...data].reverse().find(d => d.value > 0);

  if (loading) return <div className="h-[220px] rounded-xl bg-slate-50 animate-pulse" />;
  if (data.length === 0) return <div className="h-[220px] flex items-center justify-center text-[12px] text-slate-400">No terms in the sheet yet</div>;

  return (
    <div className="relative pt-5">
      <div className="relative h-[180px] ml-9">
        {ticks.map(t => (
          <div key={t} className="absolute left-0 right-0 border-t" style={{ bottom: `${(t / niceMax) * 100}%`, borderColor: t === 0 ? '#D0D2D3' : '#F0F0F1' }}>
            <span className="absolute -left-9 -translate-y-1/2 w-8 text-right text-[10px] text-slate-400 tabular-nums">{fmt(t)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-2 px-1" onMouseLeave={() => setHover(null)}>
          {data.map(d => {
            const h = (d.value / niceMax) * 100;
            const on = hover === d.term;
            const label = (d === peak || d === latest) && d.value > 0;
            return (
              <div
                key={d.term}
                className="relative flex-1 h-full flex items-end justify-center cursor-default"
                onMouseEnter={() => setHover(d.term)}
              >
                {d.value > 0 ? (
                  <div
                    className="w-full max-w-[44px] rounded-t-[4px] transition-all duration-500"
                    style={{ height: `${Math.max(h, 1.5)}%`, background: color, opacity: hover && !on ? 0.35 : 1 }}
                  />
                ) : (
                  <div className="w-full max-w-[44px] h-[2px] rounded-full" style={{ background: '#D0D2D3' }} />
                )}
                {(label || on) && (
                  <span
                    className="absolute text-[11px] font-bold text-slate-900 tabular-nums whitespace-nowrap"
                    style={{ bottom: `calc(${Math.max(h, 1.5)}% + 4px)` }}
                  >
                    {fmt(d.value)}
                  </span>
                )}
                {on && (
                  <div className="absolute z-20 bottom-full mb-6 left-1/2 -translate-x-1/2 rounded-lg bg-slate-900 text-white px-2.5 py-1.5 text-[11px] whitespace-nowrap shadow-lg pointer-events-none">
                    <div className="font-semibold">{parseTermCode(d.term).label} {parseTermCode(d.term).year || ''}</div>
                    <div className="text-white/80 tabular-nums">{fmt(d.value)} {unit}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="ml-9 mt-1.5 flex gap-2 px-1">
        {data.map(d => (
          <div key={d.term} className="flex-1 text-center min-w-0">
            <div className="text-[10.5px] font-semibold text-slate-700 truncate">{parseTermCode(d.term).label}</div>
            <div className="text-[9.5px] text-slate-400">{d.term}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Placeholder card for a metric that is designed but not yet fed by data. */
function AwaitingMetric({ label, icon, sample }: { label: string; icon: string; sample: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="w-6 h-6 rounded-md flex items-center justify-center bg-slate-100 text-slate-400">
          <i className={`fas ${icon} text-[9px]`} />
        </span>
        <span className="text-[9.5px] font-semibold uppercase tracking-wider text-slate-400">Awaiting data</span>
      </div>
      <div className="mt-2 text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-[21px] leading-none font-extrabold text-slate-300 font-display">—</div>
      <div className="mt-2 text-[10.5px] text-slate-400">{sample}</div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────────── */

export default function GGUOverallOverviewDashboard({ onClose }: Props) {
  const {
    loading,
    totalRawRows,
    isCalculatedLive,
    statusDetails,
    closedCohortGraduation,
    activeCohortGraduation,
    cohortCounts,
  } = useGGUOverviewAnalytics();
  const { data: termSplit, loading: termLoading, error: termError } = useTermWiseSplit();

  const [activeTab, setActiveTab] = useState<TabId>('status');
  const [view, setView] = useState<ViewMode>('chart');
  const [trendProgram, setTrendProgram] = useState<string>('all');
  const [yearPick, setYearPick] = useState<number | null>(null);
  const [termPick, setTermPick] = useState<string | null>(null);
  const [mixBy, setMixBy] = useState<'segment' | 'program'>('segment');

  const tab = TABS.find(t => t.id === activeTab) ?? TABS[0];

  /* ── Status & cohorts (one row per program) ── */
  const statusRows = useMemo(() => statusDetails
    .map(r => {
      const c = cohortCounts.find(x => x.program === r.program);
      return { ...r, liveCohorts: c?.liveCohorts ?? 0, closedCohorts: c?.closedCohorts ?? 0, allTimeCohorts: c?.allTimeCohorts ?? 0 };
    })
    .sort((a, b) => b.total - a.total),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [statusDetails, cohortCounts]);
  const statusMax = statusRows[0]?.total || 1;
  const st = statusRows.reduce((a, r) => ({
    active: a.active + r.active, inactive: a.inactive + r.inactive, exit: a.exit + r.exit, total: a.total + r.total,
    live: a.live + r.liveCohorts, closed: a.closed + r.closedCohorts, all: a.all + r.allTimeCohorts,
  }), { active: 0, inactive: 0, exit: 0, total: 0, live: 0, closed: 0, all: 0 });
  const share = (n: number) => (st.total > 0 ? (n / st.total) * 100 : 0);

  /* ── Graduation: graduated learners per program ── */
  const gradRows = useMemo(() => closedCohortGraduation
    .map(r => ({
      program: r.program,
      graduates: r.graduatedLearners + (activeCohortGraduation.find(x => x.program === r.program)?.graduatedLearners ?? 0),
    }))
    .filter(r => r.graduates > 0)
    .sort((a, b) => b.graduates - a.graduates),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [closedCohortGraduation, activeCohortGraduation]);
  const totalGraduates = gradRows.reduce((a, r) => a + r.graduates, 0);
  const maxGraduates = Math.max(1, ...gradRows.map(r => r.graduates));
  const gradShare = (n: number) => (totalGraduates ? (n / totalGraduates) * 100 : 0);

  /* ── Term trends: from the Learner Type blocks of the "Term Wise Split" tab
        (the two summary tables at the top of that tab are not used) ── */
  const ltSeries = useMemo(() => (termSplit ? learnerTypeSeries(termSplit) : null), [termSplit]);
  const trendPrograms = ltSeries?.active.programs ?? [];
  const selectedPrograms = trendProgram === 'all' || !trendPrograms.includes(trendProgram) ? trendPrograms : [trendProgram];
  const programLabel = trendProgram === 'all' || !trendPrograms.includes(trendProgram) ? 'All programs' : shortName(trendProgram);

  // Year filter: every year present in the tab, newest first; defaults to the latest.
  const years = useMemo(() => (termSplit ? splitYears(termSplit) : []), [termSplit]);
  // Default year = the year of the default term (Spring 2026), else the latest.
  const defaultYear = Number((GGU_DEFAULT_TERM.match(/\d{4}/) ?? [])[0]);
  const year = yearPick !== null && years.includes(yearPick) ? yearPick : years.includes(defaultYear) ? defaultYear : years[0];
  const inYear = (code: string) => parseTermCode(code).year === year;
  const pickSeries = (s: TermSeries | undefined) =>
    (s ? totalsByTerm(s, selectedPrograms.filter(p => s.programs.includes(p))).filter(d => inYear(d.term)) : []);
  const activeTrend = pickSeries(ltSeries?.active);
  const freshTrend = pickSeries(ltSeries?.fresh);
  const programInFresh = trendProgram === 'all' || (ltSeries?.fresh.programs.includes(trendProgram) ?? false);

  // Fresh vs continuing: terms of the chosen year that hold data; defaults to the latest.
  // Ascending (Spring → Summer → Fall), with the term's learner count alongside.
  const termChoices = useMemo(() => (termSplit ? freshContinuingByTerm(termSplit) : [])
    .filter(t => t.year === year && t.fresh + t.continuing > 0)
    .map(t => ({ value: t.term, label: t.term, meta: `${fmt(t.fresh + t.continuing)} learners` })), [termSplit, year]);
  const termOptions = termChoices.map(t => t.value);
  const fcTerm = termPick && termOptions.includes(termPick) ? termPick
    : termOptions.includes(GGU_DEFAULT_TERM) ? GGU_DEFAULT_TERM : termOptions[0];
  // Always all programs — the program chips only drive the two term charts above it.
  const mix = useMemo(() => (termSplit && fcTerm
    ? freshContinuingByTerm(termSplit).find(t => t.term === fcTerm) ?? null
    : null),
  [termSplit, fcTerm]);
  const mixTotal = mix ? mix.fresh + mix.continuing : 0;
  const mixSegments = (mix?.segments ?? []).filter(s => s.fresh + s.continuing > 0)
    .sort((a, b) => (b.fresh + b.continuing) - (a.fresh + a.continuing));
  const mixPrograms = (mix?.programs ?? []).filter(p => p.fresh + p.continuing > 0)
    .sort((a, b) => (b.fresh + b.continuing) - (a.fresh + a.continuing));
  const mixSegmentNames = mixSegments.map(s => s.segment);
  // Rows for the chosen breakdown; program rows also carry their learner-type split.
  const mixRows = mixBy === 'program'
    ? mixPrograms.map(p => ({
      key: p.program, label: shortName(p.program), fresh: p.fresh, continuing: p.continuing,
      detail: mixSegmentNames
        .map(seg => ({ seg, n: (p.bySegment[seg]?.fresh ?? 0) + (p.bySegment[seg]?.continuing ?? 0) }))
        .filter(d => d.n > 0),
    }))
    : mixSegments.map(s => ({ key: s.segment, label: s.segment, fresh: s.fresh, continuing: s.continuing, detail: [] as Array<{ seg: string; n: number }> }));
  const mixMax = Math.max(1, ...mixRows.map(s => s.fresh + s.continuing));
  const mixRowLabel = mixBy === 'program' ? 'Program' : 'Learner type';
  const mixSessions = (mix?.sessions ?? []).filter(s => s.fresh + s.continuing > 0);

  const showViewToggle = activeTab === 'status' || activeTab === 'outcomes' || activeTab === 'trends';

  return (
    <div className="space-y-6">
      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi
          label="Total enrolled" icon="fa-users" chip="bg-slate-900 text-white" loading={loading}
          value={fmt(st.total)}
          meter={
            <div className="flex h-1 gap-[2px] rounded-full overflow-hidden" style={{ background: C.track }}>
              <div style={{ width: `${share(st.active)}%`, background: C.active }} />
              <div style={{ width: `${share(st.inactive)}%`, background: C.loa }} />
              <div style={{ width: `${share(st.exit)}%`, background: C.exit }} />
            </div>
          }
          caption={<>across {statusRows.length} programs</>}
        />
        <Kpi
          label="Active learners" icon="fa-user-check" chip="bg-brand-50 text-brand-600" loading={loading}
          value={fmt(st.active)}
          meter={<Meter value={share(st.active)} color={C.active} />}
          caption={<><span className="font-semibold text-slate-700">{pctStr(share(st.active))}</span> of enrolled</>}
        />
        <Kpi
          label="Graduated learners" icon="fa-graduation-cap" chip="bg-slate-100 text-slate-600" loading={loading}
          value={fmt(totalGraduates)}
          meter={<Meter value={totalGraduates} max={st.total} color={C.past} />}
          caption={<><span className="font-semibold text-slate-700">{pctStr(share(totalGraduates))}</span> of all enrolled</>}
        />
        <Kpi
          label="Live cohorts" icon="fa-layer-group" chip="bg-slate-100 text-slate-600" loading={loading}
          value={fmt(st.live)}
          meter={<Meter value={st.live} max={st.all} color={C.active} />}
          caption={<>of {fmt(st.all)} cohorts all-time</>}
        />
      </div>

      {/* ── Analysis panel ── */}
      <section className="bg-white rounded-3xl border border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Toolbar: tabs + controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 lg:px-6 pt-5">
          <div role="tablist" aria-label="Analytics views" className="inline-flex flex-wrap gap-1 p-1 rounded-[14px]" style={{ background: 'var(--bg-surface-2, #F3F3F4)' }}>
            {TABS.map(t => {
              const on = t.id === activeTab;
              return (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[12px] font-semibold transition-all ${on ? 'text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-slate-500 hover:text-slate-900'}`}
                  style={on ? { background: 'var(--bg-surface, #fff)' } : undefined}
                >
                  <i className={`fas ${t.icon} text-[11px] ${on ? 'text-brand-500' : ''}`} />
                  {t.label}
                  {t.id === 'quality' && <span className="ml-0.5 px-1.5 py-px rounded-full bg-slate-200 text-[9px] font-bold uppercase tracking-wider text-slate-500">Soon</span>}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {showViewToggle && (
              <div className="inline-flex p-0.5 rounded-[10px]" style={{ background: 'var(--bg-surface-2, #F3F3F4)' }} role="group" aria-label="Display as">
                {(['chart', 'table'] as ViewMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setView(m)}
                    aria-pressed={view === m}
                    title={m === 'chart' ? 'Chart view' : 'Table view'}
                    className={`w-8 h-7 rounded-[8px] text-[11px] transition-all ${view === m ? 'text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-slate-400 hover:text-slate-700'}`}
                    style={view === m ? { background: 'var(--bg-surface, #fff)' } : undefined}
                  >
                    <i className={`fas ${m === 'chart' ? 'fa-chart-bar' : 'fa-table'}`} />
                  </button>
                ))}
              </div>
            )}
            {onClose && (
              <button onClick={onClose} className="px-3 py-1.5 rounded-[10px] border border-slate-200 text-[12px] font-semibold text-slate-600 hover:text-slate-900">
                <i className="fas fa-times mr-1.5 text-[10px]" />Close
              </button>
            )}
          </div>
        </div>

        <div className="px-5 lg:px-6 pt-4 pb-1 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{tab.title}</h2>
            <p className="text-[13px] text-slate-500 mt-0.5">{tab.hint}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
            {activeTab === 'trends' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: termSplit ? '#1f9e89' : '#A7A9AC' }} />
                {termSplit ? 'From Term Wise Split' : termError ? 'Term Wise Split unavailable' : 'Loading Term Wise Split…'}
              </>
            ) : activeTab !== 'quality' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: isCalculatedLive ? '#1f9e89' : '#A7A9AC' }} />
                {isCalculatedLive ? `Live from learner sheet · ${fmt(totalRawRows)} records` : 'Baseline snapshot'}
              </>
            ) : null}
          </span>
        </div>

        <div className="p-5 lg:p-6 pt-5" key={activeTab + view}>
          <div style={{ animation: 'anaRise .35s ease-out both' }}>
            {/* ── STATUS & COHORTS ── */}
            {activeTab === 'status' && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-x-10 gap-y-4 pb-5 border-b border-slate-100">
                  <Stat label="Active" color={C.active} value={fmt(st.active)} sub={`${pctStr(share(st.active))} of enrolled`} />
                  <Stat label="Leave of absence" color={C.loa} value={fmt(st.inactive)} sub={`${pctStr(share(st.inactive))} of enrolled`} />
                  <Stat label="Exited" color={C.exit} value={fmt(st.exit)} sub={`${pctStr(share(st.exit))} of enrolled`} />
                  <Stat label="Cohorts" value={`${fmt(st.live)} live`} sub={`${fmt(st.closed)} closed · ${fmt(st.all)} all-time`} />
                </div>

                {view === 'chart' ? (
                  <div>
                    <div className="flex items-center justify-between mb-3 px-3">
                      <Legend items={[{ label: 'Active', color: C.active }, { label: 'Leave of absence', color: C.loa }, { label: 'Exited', color: C.exit }]} />
                      <span className="text-[11px] text-slate-400">Bar length = program size</span>
                    </div>
                    <div className="-mx-3">
                      {statusRows.map(r => {
                        const segs = [
                          { label: 'Active', v: r.active, color: C.active },
                          { label: 'Leave of absence', v: r.inactive, color: C.loa },
                          { label: 'Exited', v: r.exit, color: C.exit },
                        ];
                        return (
                          <ChartRow
                            key={r.program}
                            label={shortName(r.program)}
                            trailing={<div className="flex items-center justify-end gap-5">
                              <div className="text-right">
                                <div className="text-[13px] font-bold text-slate-900">{fmt(r.total)}</div>
                                <div className="text-[11px] text-slate-500">{r.total ? pctStr((r.active / r.total) * 100, 0) : '—'} active</div>
                              </div>
                              <div className="w-[86px] text-right">
                                <div className="text-[12px] font-semibold text-slate-800">{r.liveCohorts} live</div>
                                <div className="text-[11px] text-slate-500">{r.allTimeCohorts} cohorts</div>
                              </div>
                            </div>}
                          >
                            <div className="flex h-3 gap-[2px]" style={{ width: `${Math.max(2, (r.total / statusMax) * 100)}%` }}>
                              {segs.filter(s => s.v > 0).map(s => (
                                <div
                                  key={s.label}
                                  className="h-full first:rounded-l-[4px] last:rounded-r-[4px] transition-all duration-700"
                                  style={{ width: `${(s.v / (r.total || 1)) * 100}%`, background: s.color, minWidth: 2 }}
                                  title={`${shortName(r.program)} · ${s.label}: ${fmt(s.v)} (${pctStr((s.v / (r.total || 1)) * 100)})`}
                                />
                              ))}
                            </div>
                          </ChartRow>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <DataTable
                    rows={statusRows}
                    rowKey={r => r.program}
                    columns={[
                      { label: 'Program', render: r => <span className="font-semibold text-slate-900">{shortName(r.program)}</span> },
                      { label: 'Active', align: 'right', render: r => fmt(r.active) },
                      { label: 'Leave of absence', align: 'right', render: r => fmt(r.inactive) },
                      { label: 'Exited', align: 'right', render: r => fmt(r.exit) },
                      { label: 'Total', align: 'right', render: r => <span className="font-semibold text-slate-900">{fmt(r.total)}</span> },
                      { label: 'Active %', align: 'right', render: r => (r.total ? pctStr((r.active / r.total) * 100) : '—') },
                      { label: 'Live cohorts', align: 'right', render: r => fmt(r.liveCohorts) },
                      { label: 'Closed cohorts', align: 'right', render: r => fmt(r.closedCohorts) },
                    ]}
                    footer={['Total', fmt(st.active), fmt(st.inactive), fmt(st.exit), fmt(st.total), pctStr(share(st.active)), fmt(st.live), fmt(st.closed)]}
                  />
                )}
              </div>
            )}

            {/* ── GRADUATION ── */}
            {activeTab === 'outcomes' && (
              <div className="space-y-6">
                <div className="pb-5 border-b border-slate-100">
                  <Stat
                    label="Graduated learners"
                    value={fmt(totalGraduates)}
                    sub={`across ${gradRows.length} program${gradRows.length === 1 ? '' : 's'}, to date`}
                  />
                </div>

                {view === 'chart' ? (
                  <div>
                    <SectionTitle title="Graduated learners by program" />
                    <div className="-mx-3">
                      {gradRows.map(r => (
                        <ChartRow
                          key={r.program}
                          label={shortName(r.program)}
                          trailing={<div className="w-[110px] text-right whitespace-nowrap">
                            <span className="text-[14px] font-bold text-slate-900 tabular-nums">{fmt(r.graduates)}</span>
                            <span className="ml-2 text-[11px] text-slate-500 tabular-nums">{pctStr(gradShare(r.graduates), 0)}</span>
                          </div>}
                        >
                          <div
                            className="h-3 rounded-r-[4px] transition-all duration-700"
                            style={{ width: `${Math.max(1.5, (r.graduates / maxGraduates) * 100)}%`, background: C.past }}
                            title={`${shortName(r.program)}: ${fmt(r.graduates)} graduated learners`}
                          />
                        </ChartRow>
                      ))}
                    </div>
                  </div>
                ) : (
                  <DataTable
                    rows={gradRows}
                    rowKey={r => r.program}
                    columns={[
                      { label: 'Program', render: r => <span className="font-semibold text-slate-900">{shortName(r.program)}</span> },
                      { label: 'Graduated learners', align: 'right', render: r => <span className="font-semibold text-slate-900">{fmt(r.graduates)}</span> },
                      { label: 'Share of all graduates', align: 'right', render: r => pctStr(gradShare(r.graduates)) },
                    ]}
                    footer={['Total', fmt(totalGraduates), '100%']}
                  />
                )}
              </div>
            )}

            {/* ── TERM TRENDS ── */}
            {activeTab === 'trends' && (
              <div className="space-y-7">
                {/* Filters: program + year (years appear as the sheet adds terms) */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mr-1">Program</span>
                    {['all', ...trendPrograms].map(p => {
                      const on = (p === 'all' && (trendProgram === 'all' || !trendPrograms.includes(trendProgram))) || p === trendProgram;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTrendProgram(p)}
                          aria-pressed={on}
                          className={`h-7 px-3 rounded-full text-[12px] font-semibold border transition-colors ${on ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900'}`}
                        >
                          {p === 'all' ? 'Overall' : shortName(p)}
                        </button>
                      );
                    })}
                  </div>
                  <FilterSelect
                    label="Year"
                    icon="fa-calendar"
                    value={year}
                    options={[...years].sort((a, b) => a - b).map(y => ({ value: y, label: String(y) }))}
                    onChange={y => { setYearPick(y); setTermPick(null); }}
                  />
                </div>

                {termError && !termSplit ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-[13px] text-slate-500">
                    Couldn't load the Term Wise Split tab. Check that the tab exists and the sheet is shared for viewing.
                  </div>
                ) : (
                  <>
                    {view === 'chart' ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                          <SectionTitle
                            title="Active learners by term"
                            sub={`${programLabel} · ${year ?? ''}`}
                            aside={<span className="text-[11px] text-slate-400">Hover a bar for the exact figure</span>}
                          />
                          <TermColumns data={activeTrend} color={C.active} unit="active learners" loading={termLoading} />
                        </div>
                        <div>
                          <SectionTitle title="New enrolments by term" sub={`${programLabel} · ${year ?? ''}`} />
                          {programInFresh
                            ? <TermColumns data={freshTrend} color={C.enrol} unit="new enrolments" loading={termLoading} />
                            : <div className="h-[220px] flex items-center justify-center rounded-xl border border-dashed border-slate-200 text-[12px] text-slate-400">No new-enrolment split for {shortName(trendProgram)} in the sheet</div>}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {[{ title: 'Active learners by term', s: ltSeries?.active, sum: false }, { title: 'New enrolments by term', s: ltSeries?.fresh, sum: true }].map(({ title, s, sum }) => {
                          const progs = (s?.programs ?? []).filter(p => selectedPrograms.includes(p));
                          const terms = (s?.terms ?? []).filter(inYear);
                          return (
                            <div key={title}>
                              <SectionTitle title={title} sub={`${programLabel} · ${year ?? ''}`} />
                              {s && progs.length > 0 && terms.length > 0 ? (
                                <div className="overflow-x-auto rounded-[16px] border border-slate-200/80">
                                  <table className="w-full text-[13px] border-collapse">
                                    <thead>
                                      <tr className="text-[11px] uppercase tracking-[0.06em] text-slate-500" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>
                                        <th className="px-4 py-3 text-left font-semibold">Program</th>
                                        {terms.map(t => <th key={t} className="px-3 py-3 text-right font-semibold whitespace-nowrap" title={t}>{parseTermCode(t).label}</th>)}
                                        {sum && <th className="px-4 py-3 text-right font-semibold">Total</th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {progs.map(p => (
                                        <tr key={p} className="border-t border-slate-100 hover:bg-[#FAFAFB]">
                                          <td className="px-4 py-2.5 font-semibold text-slate-900">{shortName(p)}</td>
                                          {terms.map(t => <td key={t} className="px-3 py-2.5 text-right tabular-nums text-slate-700">{fmt(s.values[p]?.[t] ?? 0)}</td>)}
                                          {sum && <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900">{fmt(terms.reduce((a, t) => a + (s.values[p]?.[t] ?? 0), 0))}</td>}
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot>
                                      <tr className="border-t-2 border-slate-200 font-bold text-slate-900" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>
                                        <td className="px-4 py-2.5">Total</td>
                                        {terms.map(t => <td key={t} className="px-3 py-2.5 text-right tabular-nums">{fmt(progs.reduce((a, p) => a + (s.values[p]?.[t] ?? 0), 0))}</td>)}
                                        {sum && <td className="px-4 py-2.5 text-right tabular-nums">{fmt(progs.reduce((a, p) => a + terms.reduce((b, t) => b + (s.values[p]?.[t] ?? 0), 0), 0))}</td>}
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              ) : <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-500">{termLoading ? 'Loading…' : 'No data for this selection.'}</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Fresh vs continuing learners ── */}
                    <div className="pt-6 border-t border-slate-100">
                      <SectionTitle
                        title="Fresh vs continuing learners"
                        sub="Learners who started this term, against learners carrying on from earlier terms"
                        aside={
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="inline-flex p-0.5 rounded-[10px]" style={{ background: 'var(--bg-surface-2, #F3F3F4)' }} role="group" aria-label="Break down by">
                              {([['segment', 'Learner type'], ['program', 'Program']] as const).map(([k, l]) => (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => setMixBy(k)}
                                  aria-pressed={mixBy === k}
                                  className={`h-7 px-3 rounded-[8px] text-[11.5px] font-semibold transition-all ${mixBy === k ? 'text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]' : 'text-slate-500 hover:text-slate-800'}`}
                                  style={mixBy === k ? { background: 'var(--bg-surface, #fff)' } : undefined}
                                >
                                  By {l.toLowerCase()}
                                </button>
                              ))}
                            </div>
                            <FilterSelect
                              label="Term"
                              icon="fa-calendar-alt"
                              value={fcTerm}
                              options={termChoices}
                              onChange={setTermPick}
                            />
                          </div>
                        }
                      />
                      {termLoading ? (
                        <div className="h-48 rounded-xl bg-slate-50 animate-pulse" />
                      ) : !mix || mixTotal === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-500">
                          No fresh / continuing split for this term yet.
                        </div>
                      ) : view === 'table' ? (
                        mixBy === 'program' ? (
                          <DataTable
                            rows={mixPrograms}
                            rowKey={r => r.program}
                            columns={[
                              { label: 'Program', render: r => <span className="font-semibold text-slate-900">{shortName(r.program)}</span> },
                              { label: 'Fresh', align: 'right', render: r => fmt(r.fresh) },
                              { label: 'Continuing', align: 'right', render: r => fmt(r.continuing) },
                              { label: 'Total', align: 'right', render: r => <span className="font-semibold text-slate-900">{fmt(r.fresh + r.continuing)}</span> },
                              { label: 'Fresh share', align: 'right', render: r => pctStr((r.fresh / ((r.fresh + r.continuing) || 1)) * 100) },
                              ...mixSegmentNames.map(seg => ({
                                label: `${seg} (fresh / cont.)`,
                                align: 'right' as const,
                                render: (r: typeof mixPrograms[number]) => {
                                  const v = r.bySegment[seg];
                                  return v && v.fresh + v.continuing > 0
                                    ? <span><span className="font-semibold text-slate-900">{fmt(v.fresh)}</span><span className="text-slate-400"> / </span>{fmt(v.continuing)}</span>
                                    : <span className="text-slate-300">—</span>;
                                },
                              })),
                            ]}
                            footer={['All programs', fmt(mix.fresh), fmt(mix.continuing), fmt(mixTotal), pctStr((mix.fresh / mixTotal) * 100),
                              ...mixSegments.map(sg => `${fmt(sg.fresh)} / ${fmt(sg.continuing)}`)]}
                          />
                        ) : (
                          <DataTable
                            rows={mixSegments}
                            rowKey={r => r.segment}
                            columns={[
                              { label: 'Learner type', render: r => <span className="font-semibold text-slate-900">{r.segment}</span> },
                              { label: 'Fresh', align: 'right', render: r => fmt(r.fresh) },
                              { label: 'Continuing', align: 'right', render: r => fmt(r.continuing) },
                              { label: 'Total', align: 'right', render: r => <span className="font-semibold text-slate-900">{fmt(r.fresh + r.continuing)}</span> },
                              { label: 'Fresh share', align: 'right', render: r => pctStr((r.fresh / ((r.fresh + r.continuing) || 1)) * 100) },
                            ]}
                            footer={['All learners', fmt(mix.fresh), fmt(mix.continuing), fmt(mixTotal), pctStr((mix.fresh / mixTotal) * 100)]}
                          />
                        )
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6 lg:gap-8">
                          {/* Headline for the term */}
                          <div className="rounded-2xl border border-slate-200/80 p-4" style={{ background: 'var(--bg-surface-2, #FAFAFB)' }}>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{mix.term} · All programs</div>
                            <div className="mt-2 text-[28px] leading-none font-extrabold text-slate-900 font-display tabular-nums">{fmt(mixTotal)}</div>
                            <div className="mt-1 text-[12px] text-slate-500">learners in the term</div>
                            <div className="mt-4 flex h-2.5 gap-[2px] rounded-full overflow-hidden" style={{ background: C.track }}>
                              {mix.fresh > 0 && <div style={{ width: `${(mix.fresh / mixTotal) * 100}%`, background: C.fresh }} />}
                              {mix.continuing > 0 && <div style={{ width: `${(mix.continuing / mixTotal) * 100}%`, background: C.continuing }} />}
                            </div>
                            <div className="mt-3 space-y-1.5">
                              {[{ label: 'Fresh', hint: 'new this term', v: mix.fresh, color: C.fresh }, { label: 'Continuing', hint: 'from earlier terms', v: mix.continuing, color: C.continuing }].map(x => (
                                <div key={x.label} className="flex items-center justify-between gap-2 text-[12.5px]">
                                  <span className="inline-flex items-center gap-2 text-slate-600 min-w-0">
                                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: x.color }} />
                                    <span className="font-semibold text-slate-800">{x.label}</span>
                                    <span className="text-[11px] text-slate-400 truncate">{x.hint}</span>
                                  </span>
                                  <span className="tabular-nums whitespace-nowrap">
                                    <span className="font-bold text-slate-900">{fmt(x.v)}</span>
                                    <span className="ml-1.5 text-[11px] text-slate-500">{pctStr((x.v / mixTotal) * 100, 0)}</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* By learner type or program, then by session */}
                          <div className="min-w-0">
                            <Legend items={[{ label: 'Fresh', color: C.fresh }, { label: 'Continuing', color: C.continuing }]} />
                            <div className="mt-2 grid grid-cols-[96px_1fr_52px_72px_52px] sm:grid-cols-[120px_1fr_64px_84px_64px] gap-3 px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                              <span>{mixRowLabel}</span><span /><span className="text-right">Fresh</span><span className="text-right">Continuing</span><span className="text-right">Total</span>
                            </div>
                            {mixRows.map(s => {
                              const tot = s.fresh + s.continuing;
                              return (
                                <div key={s.key} className={`grid grid-cols-[96px_1fr_52px_72px_52px] sm:grid-cols-[120px_1fr_64px_84px_64px] items-center gap-3 px-3 rounded-[12px] hover:bg-[#F7F7F8] transition-colors text-[13px] ${s.detail.length ? 'py-2' : 'py-2.5'}`}>
                                  <span className="font-semibold text-slate-800 truncate" title={s.key}>{s.label}</span>
                                  <div className="min-w-0">
                                    <div className="flex h-2.5 gap-[2px]" style={{ width: `${Math.max(2, (tot / mixMax) * 100)}%` }}>
                                      {[{ v: s.fresh, color: C.fresh, label: 'Fresh' }, { v: s.continuing, color: C.continuing, label: 'Continuing' }].filter(x => x.v > 0).map(x => (
                                        <div
                                          key={x.label}
                                          className="h-full first:rounded-l-[4px] last:rounded-r-[4px] transition-all duration-700"
                                          style={{ width: `${(x.v / tot) * 100}%`, background: x.color, minWidth: 2 }}
                                          title={`${s.label} · ${x.label}: ${fmt(x.v)} (${pctStr((x.v / tot) * 100)})`}
                                        />
                                      ))}
                                    </div>
                                    {s.detail.length > 0 && (
                                      <div className="mt-1 text-[10.5px] text-slate-400 truncate tabular-nums">
                                        {s.detail.map((d, i) => (
                                          <span key={d.seg}>{i > 0 && <span className="mx-1.5 text-slate-300">·</span>}{d.seg} <span className="text-slate-600 font-medium">{fmt(d.n)}</span></span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-right tabular-nums text-slate-700">{fmt(s.fresh)}</span>
                                  <span className="text-right tabular-nums text-slate-700">{fmt(s.continuing)}</span>
                                  <span className="text-right tabular-nums font-bold text-slate-900">{fmt(tot)}</span>
                                </div>
                              );
                            })}

                            {mixSessions.length > 1 && (
                              <div className="mt-4 pt-4 border-t border-slate-100">
                                <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">Sessions in {mix.term}</div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-3">
                                  {mixSessions.map(s => {
                                    const tot = s.fresh + s.continuing;
                                    return (
                                      <div key={s.label} className="rounded-xl border border-slate-200/80 px-3 py-2">
                                        <div className="flex items-baseline justify-between">
                                          <span className="text-[12px] font-semibold text-slate-800">{s.label}</span>
                                          <span className="text-[12px] font-bold text-slate-900 tabular-nums">{fmt(tot)}</span>
                                        </div>
                                        <div className="mt-1.5 flex h-1.5 gap-[2px] rounded-full overflow-hidden" style={{ background: C.track }}>
                                          {s.fresh > 0 && <div style={{ width: `${(s.fresh / tot) * 100}%`, background: C.fresh }} />}
                                          {s.continuing > 0 && <div style={{ width: `${(s.continuing / tot) * 100}%`, background: C.continuing }} />}
                                        </div>
                                        <div className="mt-1 text-[11px] text-slate-500 tabular-nums">{fmt(s.fresh)} fresh · {fmt(s.continuing)} continuing</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── ACADEMIC QUALITY (designed now, fed later) ── */}
            {SHOW_ACADEMIC_QUALITY && activeTab === 'quality' && (
              <div className="space-y-7">
                <div className="flex items-start gap-3 rounded-2xl px-4 py-3" style={{ background: '#FBF3E0' }}>
                  <i className="fas fa-hourglass-half text-[12px] mt-0.5" style={{ color: '#7A5A0E' }} />
                  <p className="text-[12.5px] leading-snug" style={{ color: '#7A5A0E' }}>
                    This view is ready for live session, assignment and course-level data. The figures will fill in once those sources are connected.
                  </p>
                </div>

                <div>
                  <SectionTitle title="Live session quality" sub="Attendance and learner feedback across live classes" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <AwaitingMetric label="Sessions held" icon="fa-video" sample="This term, all programs" />
                    <AwaitingMetric label="Average attendance" icon="fa-user-clock" sample="% of enrolled learners" />
                    <AwaitingMetric label="Session rating" icon="fa-star" sample="Average learner rating, out of 5" />
                    <AwaitingMetric label="Faculty NPS" icon="fa-chalkboard-teacher" sample="Promoters minus detractors" />
                  </div>
                </div>

                <div>
                  <SectionTitle title="Assignment quality" sub="Submission, grading and integrity" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <AwaitingMetric label="Submission rate" icon="fa-file-upload" sample="% submitted on time" />
                    <AwaitingMetric label="Average score" icon="fa-percent" sample="Across graded assignments" />
                    <AwaitingMetric label="Grading turnaround" icon="fa-stopwatch" sample="Days from submission to grade" />
                    <AwaitingMetric label="Resubmissions" icon="fa-redo" sample="% needing a re-sit or resubmission" />
                  </div>
                </div>

                <div>
                  <SectionTitle title="Course-level performance" sub="One row per course once data is connected" />
                  <div className="overflow-x-auto rounded-[16px] border border-dashed border-slate-200">
                    <table className="w-full text-[13px] border-collapse">
                      <thead>
                        <tr className="text-[11px] uppercase tracking-[0.06em] text-slate-400" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>
                          {['Course', 'Program', 'Enrolled', 'Attendance', 'Avg score', 'Pass rate', 'Rating'].map((h, i) => (
                            <th key={h} className={`px-4 py-3 font-semibold whitespace-nowrap ${i < 2 ? 'text-left' : 'text-right'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[0, 1, 2].map(i => (
                          <tr key={i} className="border-t border-slate-100">
                            {Array.from({ length: 7 }).map((_, j) => (
                              <td key={j} className={`px-4 py-3 ${j < 2 ? '' : 'text-right'}`}>
                                <span className="inline-block h-2.5 rounded bg-slate-100" style={{ width: j === 0 ? 140 - i * 20 : j === 1 ? 60 : 36 }} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
