import React, { useMemo, useState } from 'react';
import type { TermActiveRow } from '../lib/gguOverviewData';
import { useGGUOverviewAnalytics } from '../hooks/useGGUOverviewAnalytics';
import FilterDropdown from './FilterDropdown';

interface Props {
  onClose?: () => void;
}

type TabId = 'status' | 'retention' | 'graduation' | 'cohorts' | 'terms';
type ViewMode = 'chart' | 'table';

/* ── Encoding (kept identical on every tab so the page reads as one system) ── */
const C = {
  active: '#E50913',   // live / active cohorts — upGrad red
  past: '#404041',     // historical / closed cohorts — upGrad dark grey
  loa: '#d9a21b',      // leave of absence
  exit: '#B5B7BA',     // exited
  track: '#EEEEF0',
};
const HEAT_RAMP = ['#FDECEE', '#F9C0C7', '#F4949C', '#EC5C67', '#C8101A'];

const TERM_COLS: Array<{ key: keyof Omit<TermActiveRow, 'term' | 'grandTotal'>; label: string }> = [
  { key: 'dba', label: 'DBA' },
  { key: 'mba', label: 'MBA' },
  { key: 'dbaEt', label: 'DBA ET' },
  { key: 'mPsych', label: 'MPsych' },
  { key: 'dbaDl', label: 'DBA DL' },
  { key: 'sjd', label: 'SJD' },
  { key: 'mbaSa', label: 'MBA SA' },
  { key: 'bachelorsSa', label: 'Bachelors SA' },
];

const TABS: Array<{ id: TabId; label: string; icon: string; hint: string }> = [
  { id: 'status', label: 'Status', icon: 'fa-chart-bar', hint: 'Active, leave of absence and exited learners by program' },
  { id: 'retention', label: 'Retention', icon: 'fa-shield-alt', hint: 'Live cohorts compared with all-time retention' },
  { id: 'graduation', label: 'Graduation', icon: 'fa-graduation-cap', hint: 'Completion in closed versus in-progress cohorts' },
  { id: 'cohorts', label: 'Cohorts', icon: 'fa-layer-group', hint: 'Live and closed cohorts per program' },
  { id: 'terms', label: 'Intake terms', icon: 'fa-calendar-alt', hint: 'Active learners per intake term and program' },
];

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

/* ── Main ──────────────────────────────────────────────────────────────── */

export default function GGUOverallOverviewDashboard({ onClose }: Props) {
  const {
    loading,
    totalRawRows,
    isCalculatedLive,
    allCountries,
    statusDetails,
    statusTotals,
    retentionActiveCohort,
    retentionActiveTotal,
    historicalRetention,
    historicalRetentionTotal,
    closedCohortGraduation,
    closedCohortTotal,
    activeCohortGraduation,
    activeCohortTotal,
    cohortCounts,
    cohortTotals,
    getFilteredTermActive,
  } = useGGUOverviewAnalytics();

  const [activeTab, setActiveTab] = useState<TabId>('status');
  const [view, setView] = useState<ViewMode>('chart');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleInList = (item: string, list: string[], setList: (n: string[]) => void) =>
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);

  const share = (n: number) => (statusTotals.grandTotal > 0 ? (n / statusTotals.grandTotal) * 100 : 0);
  const retentionDelta = retentionActiveTotal.retentionPct - historicalRetentionTotal.retentionPct;
  const tab = TABS.find(t => t.id === activeTab)!;

  /* Status rows, largest program first */
  const statusRows = useMemo(() => [...statusDetails].sort((a, b) => b.total - a.total), [statusDetails]);
  const statusMax = statusRows[0]?.total || 1;

  /* Retention: pair live vs historical per program */
  const retentionRows = useMemo(() => retentionActiveCohort.map(r => {
    const h = historicalRetention.find(x => x.program === r.program);
    return { program: r.program, live: r, hist: h };
  }).sort((a, b) => (b.hist?.total ?? 0) - (a.hist?.total ?? 0)), [retentionActiveCohort, historicalRetention]);
  const retentionDomainMin = useMemo(() => {
    const vals = retentionRows.flatMap(r => [r.live.total > 0 ? r.live.retentionPct : null, r.hist && r.hist.total > 0 ? r.hist.retentionPct : null])
      .filter((v): v is number => v !== null);
    const min = vals.length ? Math.min(...vals) : 50;
    return Math.max(0, Math.floor((min - 5) / 10) * 10);
  }, [retentionRows]);
  const retentionTicks = useMemo(() => {
    const t: number[] = [];
    for (let v = retentionDomainMin; v <= 100; v += retentionDomainMin <= 40 ? 20 : 10) t.push(v);
    return t;
  }, [retentionDomainMin]);
  const retX = (v: number) => ((v - retentionDomainMin) / (100 - retentionDomainMin)) * 100;

  /* Graduation: pair closed vs active per program */
  const graduationRows = useMemo(() => closedCohortGraduation.map(r => ({
    program: r.program,
    closed: r,
    active: activeCohortGraduation.find(x => x.program === r.program),
  })).sort((a, b) => (b.closed.graduationPct ?? -1) - (a.closed.graduationPct ?? -1)), [closedCohortGraduation, activeCohortGraduation]);

  /* Cohorts */
  const cohortRows = useMemo(() => [...cohortCounts].sort((a, b) => b.allTimeCohorts - a.allTimeCohorts), [cohortCounts]);
  const cohortMax = cohortRows[0]?.allTimeCohorts || 1;

  /* Terms */
  const getYearFromTerm = (term: string): string => {
    const match = term.match(/^(\d{2})\//);
    if (match) return `20${match[1]}`;
    const digits = term.substring(0, 2);
    return /^\d{2}$/.test(digits) ? `20${digits}` : 'Other';
  };
  const termMatrix = activeTab === 'terms' ? getFilteredTermActive(selectedCountries) : [];
  const availableYears = Array.from(new Set(termMatrix.map(t => getYearFromTerm(t.term)))).filter(y => y !== 'Other').sort();
  const termRows = termMatrix.filter(t => selectedYears.length === 0 || selectedYears.includes(getYearFromTerm(t.term)));
  const termTotals = TERM_COLS.reduce<Record<string, number>>((acc, c) => {
    acc[c.key] = termRows.reduce((s, t) => s + (t[c.key] || 0), 0);
    return acc;
  }, {});
  const termGrand = termRows.reduce((s, t) => s + (t.grandTotal || 0), 0);
  // Quantile bins over the non-empty cells, so a few very large intakes don't wash the rest out
  const heatVals = termRows.flatMap(t => TERM_COLS.map(c => t[c.key] || 0)).filter(v => v > 0).sort((a, b) => a - b);
  const heatCuts = heatVals.length ? [1, 2, 3, 4].map(i => heatVals[Math.floor((heatVals.length * i) / HEAT_RAMP.length)]) : [];
  const heatStep = (v: number) => heatCuts.filter(c => v >= c).length;
  const filtersOn = selectedYears.length > 0 || selectedCountries.length > 0;

  return (
    <div className="space-y-6">
      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <Kpi
          label="Total enrolled" icon="fa-users" chip="bg-slate-900 text-white" loading={loading}
          value={fmt(statusTotals.grandTotal)}
          meter={
            <div className="flex h-1 gap-[2px] rounded-full overflow-hidden" style={{ background: C.track }}>
              <div style={{ width: `${share(statusTotals.active)}%`, background: C.active }} />
              <div style={{ width: `${share(statusTotals.inactive)}%`, background: C.loa }} />
              <div style={{ width: `${share(statusTotals.exit)}%`, background: C.exit }} />
            </div>
          }
          caption={<>across {statusDetails.length} programs</>}
        />
        <Kpi
          label="Active learners" icon="fa-user-check" chip="bg-brand-50 text-brand-600" loading={loading}
          value={fmt(statusTotals.active)}
          meter={<Meter value={share(statusTotals.active)} color={C.active} />}
          caption={<><span className="font-semibold text-slate-700">{pctStr(share(statusTotals.active))}</span> of enrolled</>}
        />
        <Kpi
          label="Retention · live cohorts" icon="fa-shield-alt" chip="bg-brand-50 text-brand-600" loading={loading}
          value={pctStr(retentionActiveTotal.retentionPct)}
          meter={<Meter value={retentionActiveTotal.retentionPct} color={C.active} />}
          caption={<>
            <span className={`font-semibold ${retentionDelta >= 0 ? 'text-emerald-700' : 'text-brand-700'}`}>
              <i className={`fas fa-arrow-${retentionDelta >= 0 ? 'up' : 'down'} text-[9px] mr-0.5`} />
              {Math.abs(retentionDelta).toFixed(1)} pts
            </span> vs all-time {pctStr(historicalRetentionTotal.retentionPct)}
          </>}
        />
        <Kpi
          label="Graduation · closed cohorts" icon="fa-award" chip="bg-emerald-50 text-emerald-600" loading={loading}
          value={pctStr(closedCohortTotal.graduationPct)}
          meter={<Meter value={closedCohortTotal.graduationPct ?? 0} color={C.past} />}
          caption={<><span className="font-semibold text-slate-700">{fmt(closedCohortTotal.graduatedLearners)}</span> learners graduated</>}
        />
        <Kpi
          label="Live cohorts" icon="fa-layer-group" chip="bg-slate-100 text-slate-600" loading={loading}
          value={fmt(cohortTotals.liveCohorts)}
          meter={<Meter value={cohortTotals.liveCohorts} max={cohortTotals.allTimeCohorts} color={C.active} />}
          caption={<>of {fmt(cohortTotals.allTimeCohorts)} cohorts all-time</>}
        />
      </div>

      {/* ── Analysis panel ── */}
      <section className="bg-white rounded-3xl border border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
        {/* Toolbar: tabs + view toggle */}
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
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-slate-500" title={isCalculatedLive ? `${fmt(totalRawRows)} learner records` : 'Baseline snapshot'}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: isCalculatedLive ? '#1f9e89' : '#A7A9AC' }} />
              {isCalculatedLive ? 'Live from learner sheet' : 'Baseline snapshot'}
            </span>
            {activeTab !== 'terms' && (
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

        <div className="px-5 lg:px-6 pt-4 pb-1">
          <h2 className="text-lg font-bold text-slate-900 leading-tight">{tab.label === 'Intake terms' ? 'Intake term matrix' : `${tab.label} overview`}</h2>
          <p className="text-[13px] text-slate-500 mt-0.5">{tab.hint}</p>
        </div>

        <div className="p-5 lg:p-6 pt-5" key={activeTab + view}>
          <div style={{ animation: 'anaRise .35s ease-out both' }}>
            {/* ── STATUS ── */}
            {activeTab === 'status' && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-x-10 gap-y-4 pb-5 border-b border-slate-100">
                  <Stat label="Active" color={C.active} value={fmt(statusTotals.active)} sub={`${pctStr(share(statusTotals.active))} of enrolled`} />
                  <Stat label="Leave of absence" color={C.loa} value={fmt(statusTotals.inactive)} sub={`${pctStr(share(statusTotals.inactive))} of enrolled`} />
                  <Stat label="Exited" color={C.exit} value={fmt(statusTotals.exit)} sub={`${pctStr(share(statusTotals.exit))} of enrolled`} />
                  <Stat label="Total enrolled" value={fmt(statusTotals.grandTotal)} sub={`${statusDetails.length} programs`} />
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
                            trailing={<>
                              <div className="text-[13px] font-bold text-slate-900">{fmt(r.total)}</div>
                              <div className="text-[11px] text-slate-500">{r.total ? pctStr((r.active / r.total) * 100, 0) : '—'} active</div>
                            </>}
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
                    ]}
                    footer={['Total', fmt(statusTotals.active), fmt(statusTotals.inactive), fmt(statusTotals.exit), fmt(statusTotals.grandTotal), pctStr(share(statusTotals.active))]}
                  />
                )}
              </div>
            )}

            {/* ── RETENTION ── */}
            {activeTab === 'retention' && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-x-10 gap-y-4 pb-5 border-b border-slate-100">
                  <Stat label="Live cohorts" color={C.active} value={pctStr(retentionActiveTotal.retentionPct)} sub={`${fmt(retentionActiveTotal.disqualifiedDropout)} dropouts of ${fmt(retentionActiveTotal.total)}`} />
                  <Stat label="All-time" color={C.past} value={pctStr(historicalRetentionTotal.retentionPct)} sub={`${fmt(historicalRetentionTotal.disqualifiedDropout)} dropouts of ${fmt(historicalRetentionTotal.total)}`} />
                  <Stat label="Difference" value={`${retentionDelta >= 0 ? '+' : '−'}${Math.abs(retentionDelta).toFixed(1)} pts`} sub={retentionDelta >= 0 ? 'Live cohorts retain better' : 'Live cohorts retain worse'} />
                </div>

                {view === 'chart' ? (
                  <div>
                    <div className="flex items-center justify-between mb-3 px-3">
                      <Legend items={[{ label: 'Live cohorts', color: C.active }, { label: 'All-time', color: C.past }]} />
                      <span className="text-[11px] text-slate-400">Retention rate, {retentionDomainMin}–100%</span>
                    </div>
                    <div className="-mx-3">
                      {retentionRows.map(({ program, live, hist }) => {
                        const lv = live.total > 0 ? live.retentionPct : null;
                        const hv = hist && hist.total > 0 ? hist.retentionPct : null;
                        return (
                          <ChartRow
                            key={program}
                            label={shortName(program)}
                            trailing={<div className="w-[110px] flex justify-end gap-3 text-[12px]">
                              <span className="font-bold text-slate-900">{pctStr(lv)}</span>
                              <span className="text-slate-500">{pctStr(hv)}</span>
                            </div>}
                          >
                            <div className="relative h-6">
                              {retentionTicks.map(t => (
                                <span key={t} className="absolute top-0 bottom-0 w-px" style={{ left: `${retX(t)}%`, background: '#EEEEF0' }} />
                              ))}
                              {lv !== null && hv !== null && (
                                <span className="absolute top-1/2 h-[2px] -translate-y-1/2 rounded-full" style={{ left: `${retX(Math.min(lv, hv))}%`, width: `${Math.abs(retX(lv) - retX(hv))}%`, background: '#D0D2D3' }} />
                              )}
                              {hv !== null && (
                                <span className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: `${retX(hv)}%`, background: C.past }} title={`${shortName(program)} · all-time: ${pctStr(hv)}`} />
                              )}
                              {lv !== null && (
                                <span className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white" style={{ left: `${retX(lv)}%`, background: C.active }} title={`${shortName(program)} · live cohorts: ${pctStr(lv)}`} />
                              )}
                            </div>
                          </ChartRow>
                        );
                      })}
                      <div className="grid grid-cols-[110px_1fr_auto] sm:grid-cols-[140px_1fr_auto] gap-4 px-3 pt-1">
                        <span />
                        <div className="relative h-4 text-[10px] text-slate-400 tabular-nums">
                          {retentionTicks.map(t => (
                            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${retX(t)}%` }}>{t}%</span>
                          ))}
                        </div>
                        <div className="w-[110px] flex justify-end gap-3 text-[10px] uppercase tracking-wider text-slate-400"><span>Live</span><span>All-time</span></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <DataTable
                    rows={retentionRows}
                    rowKey={r => r.program}
                    columns={[
                      { label: 'Program', render: r => <span className="font-semibold text-slate-900">{shortName(r.program)}</span> },
                      { label: 'Live · enrolled', align: 'right', render: r => fmt(r.live.totalEnrolment) },
                      { label: 'Live · dropouts', align: 'right', render: r => fmt(r.live.disqualifiedDropout) },
                      { label: 'Live retention', align: 'right', render: r => <span className="font-semibold text-slate-900">{r.live.total > 0 ? pctStr(r.live.retentionPct) : '—'}</span> },
                      { label: 'All-time · enrolled', align: 'right', render: r => fmt(r.hist?.totalEnrolment ?? 0) },
                      { label: 'All-time · dropouts', align: 'right', render: r => fmt(r.hist?.disqualifiedDropout ?? 0) },
                      { label: 'All-time retention', align: 'right', render: r => <span className="font-semibold text-slate-900">{r.hist && r.hist.total > 0 ? pctStr(r.hist.retentionPct) : '—'}</span> },
                    ]}
                    footer={['Total', fmt(retentionActiveTotal.totalEnrolment), fmt(retentionActiveTotal.disqualifiedDropout), pctStr(retentionActiveTotal.retentionPct), fmt(historicalRetentionTotal.totalEnrolment), fmt(historicalRetentionTotal.disqualifiedDropout), pctStr(historicalRetentionTotal.retentionPct)]}
                  />
                )}
              </div>
            )}

            {/* ── GRADUATION ── */}
            {activeTab === 'graduation' && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-x-10 gap-y-4 pb-5 border-b border-slate-100">
                  <Stat label="Closed cohorts" color={C.past} value={pctStr(closedCohortTotal.graduationPct)} sub={`${fmt(closedCohortTotal.graduatedLearners)} of ${fmt(closedCohortTotal.totalEnrolment)} graduated`} />
                  <Stat label="In-progress cohorts" color={C.active} value={pctStr(activeCohortTotal.graduationPct)} sub={`${fmt(activeCohortTotal.graduatedLearners)} of ${fmt(activeCohortTotal.totalEnrolment)} graduated so far`} />
                  <Stat label="Total graduates" value={fmt(closedCohortTotal.graduatedLearners + activeCohortTotal.graduatedLearners)} sub="Closed and in-progress cohorts" />
                </div>

                {view === 'chart' ? (
                  <div>
                    <div className="flex items-center justify-between mb-3 px-3">
                      <Legend items={[{ label: 'Closed cohorts', color: C.past }, { label: 'In-progress cohorts', color: C.active }]} />
                      <span className="text-[11px] text-slate-400">Graduation rate, 0–100%</span>
                    </div>
                    <div className="-mx-3">
                      {graduationRows.map(({ program, closed, active }) => (
                        <ChartRow
                          key={program}
                          label={shortName(program)}
                          trailing={<div className="w-[110px] flex justify-end gap-3 text-[12px]">
                            <span className="font-bold text-slate-900">{pctStr(closed.graduationPct)}</span>
                            <span className="text-slate-500">{pctStr(active?.graduationPct ?? null)}</span>
                          </div>}
                        >
                          <div className="space-y-[3px]">
                            {[{ v: closed.graduationPct, color: C.past, label: 'Closed cohorts', row: closed }, { v: active?.graduationPct ?? null, color: C.active, label: 'In-progress cohorts', row: active }].map(b => (
                              <div key={b.label} className="h-2 rounded-r-[4px]" style={{ background: C.track }}>
                                {b.v !== null && (
                                  <div
                                    className="h-full rounded-r-[4px] transition-all duration-700"
                                    style={{ width: `${Math.max(0.8, b.v)}%`, background: b.color }}
                                    title={`${shortName(program)} · ${b.label}: ${pctStr(b.v)} (${fmt(b.row?.graduatedLearners ?? 0)} of ${fmt(b.row?.totalEnrolment ?? 0)})`}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </ChartRow>
                      ))}
                      <div className="grid grid-cols-[110px_1fr_auto] sm:grid-cols-[140px_1fr_auto] gap-4 px-3 pt-1">
                        <span />
                        <div className="text-[10px] text-slate-400">— no closed cohorts yet</div>
                        <div className="w-[110px] flex justify-end gap-3 text-[10px] uppercase tracking-wider text-slate-400"><span>Closed</span><span>Active</span></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <DataTable
                    rows={graduationRows}
                    rowKey={r => r.program}
                    columns={[
                      { label: 'Program', render: r => <span className="font-semibold text-slate-900">{shortName(r.program)}</span> },
                      { label: 'Closed · enrolled', align: 'right', render: r => fmt(r.closed.totalEnrolment) },
                      { label: 'Closed · graduated', align: 'right', render: r => fmt(r.closed.graduatedLearners) },
                      { label: 'Closed rate', align: 'right', render: r => <span className="font-semibold text-slate-900">{pctStr(r.closed.graduationPct)}</span> },
                      { label: 'Active · enrolled', align: 'right', render: r => fmt(r.active?.totalEnrolment ?? 0) },
                      { label: 'Active · graduated', align: 'right', render: r => fmt(r.active?.graduatedLearners ?? 0) },
                      { label: 'Active rate', align: 'right', render: r => <span className="font-semibold text-slate-900">{pctStr(r.active?.graduationPct ?? null)}</span> },
                    ]}
                    footer={['Total', fmt(closedCohortTotal.totalEnrolment), fmt(closedCohortTotal.graduatedLearners), pctStr(closedCohortTotal.graduationPct), fmt(activeCohortTotal.totalEnrolment), fmt(activeCohortTotal.graduatedLearners), pctStr(activeCohortTotal.graduationPct)]}
                  />
                )}
              </div>
            )}

            {/* ── COHORTS ── */}
            {activeTab === 'cohorts' && (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-x-10 gap-y-4 pb-5 border-b border-slate-100">
                  <Stat label="Live" color={C.active} value={fmt(cohortTotals.liveCohorts)} sub={`${pctStr((cohortTotals.liveCohorts / (cohortTotals.allTimeCohorts || 1)) * 100, 0)} of all cohorts`} />
                  <Stat label="Closed" color={C.past} value={fmt(cohortTotals.closedCohorts)} sub="Completed cohorts" />
                  <Stat label="All-time" value={fmt(cohortTotals.allTimeCohorts)} sub={`${cohortCounts.length} programs`} />
                </div>

                {view === 'chart' ? (
                  <div>
                    <div className="flex items-center justify-between mb-3 px-3">
                      <Legend items={[{ label: 'Live', color: C.active }, { label: 'Closed', color: C.past }]} />
                      <span className="text-[11px] text-slate-400">Bar length = all-time cohorts</span>
                    </div>
                    <div className="-mx-3">
                      {cohortRows.map(r => (
                        <ChartRow
                          key={r.program}
                          label={shortName(r.program)}
                          trailing={<div className="w-[110px] flex justify-end gap-3 text-[12px]">
                            <span className="font-bold text-slate-900">{r.liveCohorts} live</span>
                            <span className="text-slate-500">{r.allTimeCohorts} total</span>
                          </div>}
                        >
                          <div className="flex h-3 gap-[2px]" style={{ width: `${Math.max(2, (r.allTimeCohorts / cohortMax) * 100)}%` }}>
                            {[{ v: r.liveCohorts, color: C.active, label: 'Live' }, { v: r.closedCohorts, color: C.past, label: 'Closed' }].filter(s => s.v > 0).map(s => (
                              <div
                                key={s.label}
                                className="h-full first:rounded-l-[4px] last:rounded-r-[4px] transition-all duration-700"
                                style={{ width: `${(s.v / (r.allTimeCohorts || 1)) * 100}%`, background: s.color, minWidth: 2 }}
                                title={`${shortName(r.program)} · ${s.label}: ${s.v} cohorts`}
                              />
                            ))}
                          </div>
                        </ChartRow>
                      ))}
                    </div>
                  </div>
                ) : (
                  <DataTable
                    rows={cohortRows}
                    rowKey={r => r.program}
                    columns={[
                      { label: 'Program', render: r => <span className="font-semibold text-slate-900">{shortName(r.program)}</span> },
                      { label: 'Live', align: 'right', render: r => fmt(r.liveCohorts) },
                      { label: 'Closed', align: 'right', render: r => fmt(r.closedCohorts) },
                      { label: 'All-time', align: 'right', render: r => <span className="font-semibold text-slate-900">{fmt(r.allTimeCohorts)}</span> },
                    ]}
                    footer={['Total', fmt(cohortTotals.liveCohorts), fmt(cohortTotals.closedCohorts), fmt(cohortTotals.allTimeCohorts)]}
                  />
                )}
              </div>
            )}

            {/* ── INTAKE TERMS ── */}
            {activeTab === 'terms' && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-48">
                      <FilterDropdown
                        label="Country"
                        iconClass="fas fa-globe"
                        placeholder="All countries"
                        values={allCountries}
                        selected={selectedCountries}
                        onToggle={(v) => toggleInList(v, selectedCountries, setSelectedCountries)}
                        isOpen={openDropdown === 'country'}
                        setIsOpen={(open) => setOpenDropdown(open ? 'country' : null)}
                      />
                    </div>
                    <div className="w-44">
                      <FilterDropdown
                        label="Intake year"
                        iconClass="fas fa-calendar-alt"
                        placeholder="All years"
                        values={availableYears}
                        selected={selectedYears}
                        onToggle={(v) => toggleInList(v, selectedYears, setSelectedYears)}
                        isOpen={openDropdown === 'year'}
                        setIsOpen={(open) => setOpenDropdown(open ? 'year' : null)}
                      />
                    </div>
                    {filtersOn && (
                      <button
                        onClick={() => { setSelectedYears([]); setSelectedCountries([]); }}
                        className="h-[38px] px-3 rounded-[10px] border border-slate-200 text-[12px] font-semibold text-slate-600 hover:text-brand-600 transition-colors"
                      >
                        <i className="fas fa-undo-alt text-[10px] mr-1.5" />Reset
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <span>Fewer</span>
                    <div className="flex gap-[2px]">
                      {HEAT_RAMP.map(c => <span key={c} className="w-5 h-2.5 first:rounded-l-[3px] last:rounded-r-[3px]" style={{ background: c }} />)}
                    </div>
                    <span>More active learners</span>
                  </div>
                </div>

                <div className="overflow-auto max-h-[560px] rounded-[16px] border border-slate-200/80">
                  <table className="w-full text-[12px] border-separate border-spacing-0">
                    <thead className="sticky top-0 z-10">
                      <tr className="text-[11px] uppercase tracking-[0.06em] text-slate-500">
                        <th className="px-4 py-3 text-left font-semibold border-b border-slate-200" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>Term</th>
                        {TERM_COLS.map(c => (
                          <th key={c.key} className="px-2 py-3 text-center font-semibold whitespace-nowrap border-b border-slate-200" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>{c.label}</th>
                        ))}
                        <th className="px-4 py-3 text-right font-semibold border-b border-slate-200" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {termRows.length > 0 ? termRows.map(t => (
                        <tr key={t.term} className="group">
                          <td className="px-4 py-1.5 border-b border-slate-100 whitespace-nowrap">
                            <span className="font-semibold text-slate-900">{t.term}</span>
                            <span className="ml-2 text-[10px] text-slate-400">{getYearFromTerm(t.term)}</span>
                          </td>
                          {TERM_COLS.map(c => {
                            const v = t[c.key] || 0;
                            const step = v > 0 ? heatStep(v) : -1;
                            return (
                              <td key={c.key} className="px-1 py-1 border-b border-slate-100">
                                <div
                                  className="h-8 rounded-[6px] flex items-center justify-center tabular-nums font-semibold"
                                  style={v > 0
                                    ? { background: HEAT_RAMP[step], color: step >= 3 ? '#FFFFFF' : '#404041' }
                                    : { color: '#C4C6C8' }}
                                  title={`${t.term} · ${c.label}: ${v} active`}
                                >
                                  {v > 0 ? v : '·'}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-4 py-1.5 border-b border-slate-100 text-right font-bold text-slate-900 tabular-nums">{fmt(t.grandTotal)}</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={TERM_COLS.length + 2} className="p-10 text-center text-slate-400">No intake terms match the selected filters.</td>
                        </tr>
                      )}
                    </tbody>
                    {termRows.length > 0 && (
                      <tfoot className="sticky bottom-0 z-10">
                        <tr className="font-bold text-slate-900">
                          <td className="px-4 py-3 border-t-2 border-slate-200 whitespace-nowrap" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>Total · {termRows.length} terms</td>
                          {TERM_COLS.map(c => (
                            <td key={c.key} className="px-2 py-3 text-center tabular-nums border-t-2 border-slate-200" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>{termTotals[c.key] ? fmt(termTotals[c.key]) : '—'}</td>
                          ))}
                          <td className="px-4 py-3 text-right tabular-nums border-t-2 border-slate-200 text-brand-600" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>{fmt(termGrand)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
