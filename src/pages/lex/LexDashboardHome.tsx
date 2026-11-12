import { useMemo } from 'react';
import { useAllLearnerData } from '../../hooks/useAllLearnerData';
import { useLexFilter } from '../../hooks/useLexFilter';
import { v, getLearnerResidency } from '../../lib/logic';
import { resolveCountry, type CountryRef } from '../../lib/countries';
import DateBadge from '../../components/DateBadge';
import WorldFootprintMap, { type CountryCount } from '../../components/WorldFootprintMap';
import ProgramDistribution from '../../components/ProgramDistribution';
import StatusKpis from '../../components/StatusKpis';
import HomeProgramHealth from '../../components/HomeProgramHealth';

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

export default function LexDashboardHome() {
  const { selectedUniversityId } = useLexFilter();
  const { students, loading } = useAllLearnerData(selectedUniversityId);

  const stats = useMemo(() => {
    let total = 0, active = 0, international = 0, domestic = 0;
    let activeInternational = 0, activeDomestic = 0, loa = 0, exit = 0;
    const programsMap: Record<string, number> = {};
    const countryMap = new Map<string, { ref: CountryRef; count: number; active: number; loa: number; exit: number }>();
    const unplaced: Record<string, number> = {};
    let unplacedCount = 0;

    for (const s of students) {
      total++;
      if (s._programName) programsMap[s._programName] = (programsMap[s._programName] || 0) + 1;

      // Country of residence → one canonical country (folds "USA"/"United States", "Viet Nam"/"Vietnam", …)
      const rawCountry = v(s, 'Country Of Residence', 'Country of Residence', 'Country', 'Country of  Residence') || '';
      const loc = resolveCountry(rawCountry);
      let countryEntry: { ref: CountryRef; count: number; active: number; loa: number; exit: number } | undefined;
      if (loc?.kind === 'country') {
        countryEntry = countryMap.get(loc.country.iso);
        if (countryEntry) countryEntry.count++;
        else {
          countryEntry = { ref: loc.country, count: 1, active: 0, loa: 0, exit: 0 };
          countryMap.set(loc.country.iso, countryEntry);
        }
      } else if (loc) {
        unplacedCount++;
        const label = loc.label.toUpperCase();
        unplaced[label] = (unplaced[label] || 0) + 1;
      }

      const residency = getLearnerResidency(s);
      const isInt = residency === 'International';
      const isDom = residency === 'India';

      if (isInt) international++;
      else if (isDom) domestic++;

      // KPI statuses come strictly from Column U (GGU Data Type).
      const dataType = (v(s, 'GGU Data Type', 'ggu_data_type', 'col_20') || '').trim().toLowerCase();
      if (dataType === 'active') {
        active++;
        if (countryEntry) countryEntry.active++;
        if (isInt) activeInternational++;
        if (isDom) activeDomestic++;
      } else if (dataType === 'loa' || dataType === 'inactive') {
        loa++;
        if (countryEntry) countryEntry.loa++;
      }
      else if (dataType === 'exit') {
        exit++;
        if (countryEntry) countryEntry.exit++;
      }
    }

    const pctOf = (n: number) => (n / (total || 1)) * 100;
    const countries: CountryCount[] = [...countryMap.values()]
      .map(c => ({ ...c, pct: pctOf(c.count) }))
      .sort((a, b) => b.count - a.count);

    return {
      total, active, loa, exit,
      international, domestic, activeInternational, activeDomestic,
      distribution: Object.entries(programsMap).map(([name, count]) => ({ name, count, pct: pctOf(count) })),
      countries,
      unplacedCount,
      unplacedLabels: Object.entries(unplaced).sort((a, b) => b[1] - a[1]).map(([l]) => l),
    };
  }, [students]);

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

      {/* Status cards — shared with Program Insights; LOA / Exited expand into their reasons */}
      <StatusKpis />

      {/* Program health: fresh vs continuing, live cohorts, retention, graduation */}
      <HomeProgramHealth />

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
