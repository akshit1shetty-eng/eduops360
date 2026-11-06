import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllLearnerData } from '../../hooks/useAllLearnerData';
import { useLexFilter } from '../../hooks/useLexFilter';
import { v, getLearnerCategory, getLearnerResidency } from '../../lib/logic';
import { resolveCountry, type CountryRef } from '../../lib/countries';
import DateBadge from '../../components/DateBadge';
import WorldFootprintMap, { type CountryCount } from '../../components/WorldFootprintMap';
import ProgramDistribution from '../../components/ProgramDistribution';

function Skeleton({ className }: { className: string }) {
  return <span className={`inline-block rounded bg-slate-200 animate-pulse ${className}`} />;
}

/** Card shell shared by every section so the page reads as one system. */
function Panel({ title, subtitle, icon, aside, children, className = '' }: {
  title: string;
  subtitle?: string;
  icon: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-white rounded-3xl border border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] p-6 lg:p-7 ${className}`}>
      <header className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
            <i className={`fas ${icon} text-sm`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{title}</h2>
            {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

interface KpiDef {
  key: string;
  label: string;
  caption: string;
  icon: string;
  value: number;
  /** tint for the icon chip + meter (never the number itself) */
  tone: { chip: string; bar: string };
  to: string;
  showShare: boolean;
}

export default function LexDashboardHome() {
  const navigate = useNavigate();
  const { selectedUniversityId } = useLexFilter();
  const { students, loading } = useAllLearnerData(selectedUniversityId);

  const stats = useMemo(() => {
    let total = 0, active = 0, international = 0, domestic = 0;
    let activeInternational = 0, activeDomestic = 0, graduated = 0, loa = 0, exit = 0;
    const programsMap: Record<string, number> = {};
    const countryMap = new Map<string, { ref: CountryRef; count: number; active: number; graduated: number }>();
    const unplaced: Record<string, number> = {};
    let unplacedCount = 0;

    for (const s of students) {
      total++;
      if (s._programName) programsMap[s._programName] = (programsMap[s._programName] || 0) + 1;

      // Country of residence → one canonical country (folds "USA"/"United States", "Viet Nam"/"Vietnam", …)
      const rawCountry = v(s, 'Country Of Residence', 'Country of Residence', 'Country', 'Country of  Residence') || '';
      const loc = resolveCountry(rawCountry);
      let countryEntry: { ref: CountryRef; count: number; active: number; graduated: number } | undefined;
      if (loc?.kind === 'country') {
        countryEntry = countryMap.get(loc.country.iso);
        if (countryEntry) countryEntry.count++;
        else {
          countryEntry = { ref: loc.country, count: 1, active: 0, graduated: 0 };
          countryMap.set(loc.country.iso, countryEntry);
        }
      } else if (loc) {
        unplacedCount++;
        const label = loc.label.toUpperCase();
        unplaced[label] = (unplaced[label] || 0) + 1;
      }

      const rawStatus = v(s, 'Actual Status', 'Secondary Status', 'Learner Status', 'Status Details', 'Status');
      const category = getLearnerCategory(rawStatus, s);
      const residency = getLearnerResidency(s);
      const isInt = residency === 'International';
      const isDom = residency === 'India';

      if (isInt) international++;
      else if (isDom) domestic++;

      if (category === 'Graduated') {
        graduated++;
        if (countryEntry) countryEntry.graduated++;
      } else if (category === 'Active') {
        active++;
        if (countryEntry) countryEntry.active++;
        if (isInt) activeInternational++;
        if (isDom) activeDomestic++;
      } else if (category === 'IPD') loa++;
      else if (category === 'Other Inactive' || category === 'Payment-Dropout') exit++;
    }

    const pctOf = (n: number) => (n / (total || 1)) * 100;
    const countries: CountryCount[] = [...countryMap.values()]
      .map(c => ({ ...c, pct: pctOf(c.count) }))
      .sort((a, b) => b.count - a.count);

    return {
      total, active, graduated, loa, exit,
      international, domestic, activeInternational, activeDomestic,
      distribution: Object.entries(programsMap).map(([name, count]) => ({ name, count, pct: pctOf(count) })),
      countries,
      unplacedCount,
      unplacedLabels: Object.entries(unplaced).sort((a, b) => b[1] - a[1]).map(([l]) => l),
    };
  }, [students]);

  const kpis: KpiDef[] = [
    { key: 'total', label: 'Total learners', caption: 'All enrolments', icon: 'fa-users', value: stats.total, tone: { chip: 'bg-slate-900 text-white', bar: 'bg-slate-900' }, to: '/lex/learners', showShare: false },
    { key: 'active', label: 'Active', caption: 'Currently studying', icon: 'fa-user-check', value: stats.active, tone: { chip: 'bg-brand-50 text-brand-600', bar: 'bg-brand-500' }, to: '/lex/learners?status=Active', showShare: true },
    { key: 'grad', label: 'Graduated', caption: 'Alumni', icon: 'fa-award', value: stats.graduated, tone: { chip: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' }, to: '/lex/learners?status=Graduated', showShare: true },
    { key: 'loa', label: 'Leave of absence', caption: 'In process of deferral', icon: 'fa-clock', value: stats.loa, tone: { chip: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500' }, to: '/lex/learners?status=IPD', showShare: true },
    { key: 'exit', label: 'Exited', caption: 'Inactive or dropped', icon: 'fa-user-minus', value: stats.exit, tone: { chip: 'bg-slate-100 text-slate-600', bar: 'bg-slate-500' }, to: '/lex/learners?status=Other%20Inactive', showShare: true },
  ];

  const residency = [
    { label: 'All learners', base: stats.total, dom: stats.domestic, intl: stats.international },
    { label: 'Active learners', base: stats.active, dom: stats.activeDomestic, intl: stats.activeInternational },
  ];

  return (
    <div className="max-w-7xl mx-auto py-2 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
        <div>
          <p className="text-[11px] font-semibold text-brand-600 uppercase tracking-[0.14em] mb-1.5">Golden Gate University</p>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Overall <span className="text-brand-500">Dashboard</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Enrolment, outcomes and global reach across all Golden Gate University programs.</p>
        </div>
        <DateBadge />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {kpis.map(k => {
          const share = (k.value / (stats.total || 1)) * 100;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => navigate(k.to)}
              className="group text-left bg-white rounded-2xl border border-slate-200/70 px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)] hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <span className={`w-6 h-6 rounded-md flex items-center justify-center ${k.tone.chip}`}>
                  <i className={`fas ${k.icon} text-[9px]`} />
                </span>
                <i className="fas fa-arrow-right text-[10px] text-slate-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
              </div>
              <div className="mt-2 text-[11px] font-medium text-slate-500">{k.label}</div>
              <div className="mt-0.5 text-[21px] leading-none font-extrabold text-slate-900 font-display tabular-nums">
                {loading ? <Skeleton className="h-5 w-16" /> : k.value.toLocaleString()}
              </div>
              <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${k.tone.bar} transition-all duration-700`} style={{ width: loading ? '0%' : `${k.showShare ? share : 100}%` }} />
              </div>
              <div className="mt-1 text-[10.5px] text-slate-500">
                {k.showShare
                  ? (loading ? '—' : <><span className="font-semibold text-slate-700">{share.toFixed(1)}%</span> of total</>)
                  : k.caption}
              </div>
            </button>
          );
        })}
      </div>

      {/* Global footprint */}
      <Panel
        title="Global Footprint"
        subtitle="Where our learners live. Pick a region to drill into its countries."
        icon="fa-earth-asia"
        aside={
          <div className="flex items-stretch gap-3 shrink-0">
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2 text-right">
              <div className="text-xl font-extrabold text-slate-900 font-display leading-none tabular-nums">
                {loading ? <Skeleton className="h-5 w-8" /> : stats.countries.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">countries reached</div>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2 text-right">
              <div className="text-xl font-extrabold text-slate-900 font-display leading-none tabular-nums">
                {loading ? <Skeleton className="h-5 w-12" /> : `${(100 - (stats.countries[0]?.pct ?? 0)).toFixed(1)}%`}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {loading || !stats.countries[0] ? 'outside top market' : `outside ${stats.countries[0].ref.name}`}
              </div>
            </div>
          </div>
        }
      >
        <WorldFootprintMap
          countries={stats.countries}
          loading={loading}
          totalLearners={stats.total}
          unplacedCount={stats.unplacedCount}
          unplacedLabels={stats.unplacedLabels}
        />
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Program distribution */}
        <Panel
          className="xl:col-span-8"
          title="Program Distribution"
          subtitle="Learner volume by program, largest first."
          icon="fa-layer-group"
          aside={
            <div className="text-right shrink-0">
              <div className="text-2xl font-extrabold text-slate-900 font-display leading-none tabular-nums">
                {loading ? <Skeleton className="h-6 w-8" /> : stats.distribution.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">programs</div>
            </div>
          }
        >
          <ProgramDistribution items={stats.distribution} total={stats.total} loading={loading} />
        </Panel>

        {/* Residency split */}
        <Panel className="xl:col-span-4" title="Residency Split" subtitle="India-based vs international learners." icon="fa-passport">
          <div className="flex items-center gap-4 mb-6 text-[12px] text-slate-600">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-700" />India</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-500" />International</span>
          </div>
          <div className="space-y-7">
            {residency.map(r => {
              const domPct = (r.dom / (r.base || 1)) * 100;
              const intlPct = (r.intl / (r.base || 1)) * 100;
              return (
                <div key={r.label}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-[13px] font-semibold text-slate-800">{r.label}</span>
                    <span className="text-[11px] text-slate-500 tabular-nums">{loading ? '—' : r.base.toLocaleString()}</span>
                  </div>
                  <div className="flex h-3 w-full gap-[2px] rounded-full overflow-hidden bg-slate-100">
                    {loading ? <div className="w-full animate-pulse bg-slate-200" /> : (
                      <>
                        {r.dom > 0 && <div className="h-full bg-slate-700 transition-all duration-700" style={{ width: `${domPct}%` }} title={`India: ${r.dom.toLocaleString()}`} />}
                        {r.intl > 0 && <div className="h-full bg-brand-500 transition-all duration-700" style={{ width: `${intlPct}%` }} title={`International: ${r.intl.toLocaleString()}`} />}
                      </>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-xl font-extrabold text-slate-900 font-display tabular-nums">{loading ? '—' : `${domPct.toFixed(1)}%`}</div>
                      <div className="text-[11px] text-slate-500">{loading ? '' : `${r.dom.toLocaleString()} in India`}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-slate-900 font-display tabular-nums">{loading ? '—' : `${intlPct.toFixed(1)}%`}</div>
                      <div className="text-[11px] text-slate-500">{loading ? '' : `${r.intl.toLocaleString()} international`}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
