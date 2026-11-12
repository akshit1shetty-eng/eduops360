import DateBadge from '../../components/DateBadge';
import GGUOverallOverviewDashboard from '../../components/GGUOverallOverviewDashboard';

/** Program Insights: status & cohorts, graduation & completion, term trends and academic quality for GGU. */
export default function LexAnalyticsPage() {
  return (
    <div className="max-w-7xl mx-auto py-2 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
        <div>
          <p className="text-[11px] font-semibold text-brand-600 uppercase tracking-[0.14em] mb-1.5">Golden Gate University</p>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Program <span className="text-brand-500">Insights</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Status, outcomes and term-on-term trends across Golden Gate University programs.</p>
        </div>
        <DateBadge />
      </div>
      <GGUOverallOverviewDashboard />
    </div>
  );
}
