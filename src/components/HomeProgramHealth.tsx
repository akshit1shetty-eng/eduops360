import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTermWiseSplit } from '../hooks/useTermWiseSplit';
import { useGGUOverviewAnalytics } from '../hooks/useGGUOverviewAnalytics';
import { freshContinuingByTerm } from '../lib/termWiseSplit';
import FilterSelect from './FilterSelect';
import { GGU_DEFAULT_TERM } from '../lib/config';

const FRESH = '#E50913';
const CONTINUING = '#7A7C7F';
const TRACK = '#EEEEF0';

const fmt = (n: number) => n.toLocaleString();

/**
 * Homepage strip: fresh vs continuing learners for a term, from the
 * Term Wise Split tab. Links through to Program Insights → Term trends.
 */
export default function HomeProgramHealth() {
  const navigate = useNavigate();
  const { data: split, loading } = useTermWiseSplit();
  const { loading: cohortsLoading, cohortTotals } = useGGUOverviewAnalytics();

  // Fresh vs continuing per term (all learner types), oldest first; new terms appear automatically.
  const terms = useMemo(() => (split ? freshContinuingByTerm(split) : [])
    .filter(t => t.fresh + t.continuing > 0)
    .map(t => ({ label: t.term, fresh: t.fresh, continuing: t.continuing })), [split]);

  const [picked, setPicked] = useState<string | null>(null);
  const term = terms.find(t => t.label === picked)
    ?? terms.find(t => t.label === GGU_DEFAULT_TERM)
    ?? terms[terms.length - 1];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
    <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/70 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-md flex items-center justify-center bg-brand-50 text-brand-600">
            <i className="fas fa-user-plus text-[9px]" />
          </span>
          <span className="text-[12px] font-semibold text-slate-700">Fresh vs continuing learners</span>
        </div>
        <div className="flex items-center gap-3">
          {terms.length > 1 && (
            <FilterSelect size="sm" value={term?.label} options={terms.map(t => ({ value: t.label, label: t.label }))} onChange={setPicked} />
          )}
          <button type="button" onClick={() => navigate('/lex/insights')} className="text-[11px] font-semibold text-brand-600 hover:text-brand-700">
            Term trends →
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-3 h-6 w-full rounded bg-slate-100 animate-pulse" />
      ) : !term ? (
        <div className="mt-2 text-[12px] text-slate-400">No term split available</div>
      ) : (
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-8 gap-y-2">
          {[
            { label: 'fresh enrolments', v: term.fresh, color: FRESH },
            { label: 'continuing learners', v: term.continuing, color: CONTINUING },
          ].map(x => (
            <span key={x.label} className="inline-flex items-baseline gap-1.5">
              <span className="w-2 h-2 rounded-sm self-center" style={{ background: x.color }} />
              <span className="text-[21px] leading-none font-extrabold text-slate-900 font-display tabular-nums">{fmt(x.v)}</span>
              <span className="text-[12px] text-slate-500">{x.label}</span>
            </span>
          ))}
          <span className="text-[11px] text-slate-400">{term.label}</span>
        </div>
      )}
    </div>

      {/* Live cohorts */}
      <button
        type="button"
        onClick={() => navigate('/lex/insights')}
        className="group text-left bg-white rounded-2xl border border-slate-200/70 px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)] hover:border-slate-300 transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-md flex items-center justify-center bg-slate-100 text-slate-600">
              <i className="fas fa-layer-group text-[9px]" />
            </span>
            <span className="text-[12px] font-semibold text-slate-700">Live cohorts</span>
          </div>
          <i className="fas fa-arrow-right text-[10px] text-slate-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
        </div>
        {/* Same height as the fresh vs continuing card: value and caption share one line */}
        <div className="mt-2.5 flex items-baseline gap-1.5">
          <span className="text-[21px] leading-none font-extrabold text-slate-900 font-display tabular-nums">
            {cohortsLoading ? <span className="inline-block h-5 w-12 rounded bg-slate-200 animate-pulse" /> : fmt(cohortTotals.liveCohorts)}
          </span>
          <span className="text-[11px] text-slate-500">of {fmt(cohortTotals.allTimeCohorts)} all-time</span>
        </div>
        <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: TRACK }}>
          <div className="h-full rounded-full" style={{ width: `${(cohortTotals.liveCohorts / (cohortTotals.allTimeCohorts || 1)) * 100}%`, background: FRESH }} />
        </div>
      </button>
    </div>
  );
}
