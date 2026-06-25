import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllLearnerData } from '../../hooks/useAllLearnerData';
import { useLexFilter } from '../../hooks/useLexFilter';
import { UNIVERSITIES } from '../../lib/universities';
import { v, normalizeSecondaryStatus, isLearnerActive } from '../../lib/logic';

function StatSkeleton() {
  return <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />;
}

function SubStatSkeleton() {
  return <div className="h-5 w-16 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />;
}

export default function LexDashboardHome() {
  const navigate = useNavigate();
  const { selectedUniversityId, setSelectedUniversityId } = useLexFilter();
  const { students, loading } = useAllLearnerData(selectedUniversityId);

  // Helper to check if a university is available (has at least one available program)
  const isUniAvailable = (uniId: string) => {
    const uni = UNIVERSITIES.find(u => u.id === uniId);
    return uni?.programs.some(p => p.available) ?? false;
  };

  const stats = useMemo(() => {
    let total = 0;
    let active = 0;
    let international = 0;
    let domestic = 0;
    let activeInternational = 0;
    let activeDomestic = 0;
    let graduated = 0;
    let ipd = 0;
    let paymentDropout = 0;
    let otherStatus = 0;
    const programsMap: Record<string, number> = {};

    const filteredStudents = students.filter(s => {
      const rawStatus = v(s, 'Learner Status', 'Actual Status', 'Actual status', 'Status Details', 'Secondary Status', 'Status');
      const status = normalizeSecondaryStatus(rawStatus);
      return status !== 'deferred out' && status !== 'withdrawn';
    });

    const cohortsMap: Record<string, number> = {};
    const countriesMap: Record<string, number> = {};

    for (const s of filteredStudents) {
      total++;
      programsMap[s._programName] = (programsMap[s._programName] || 0) + 1;

      const cohort = v(s, 'Cohort #', 'Cohort ID', 'Cohort');
      if (cohort) cohortsMap[cohort] = (cohortsMap[cohort] || 0) + 1;

      const country = (s['Country Of Residence'] || s['Country of Residence'] || s['Country'] || s['Country of  Residence'] || '').trim();
      if (country) countriesMap[country] = (countriesMap[country] || 0) + 1;

      const rawStatus = v(s, 'Learner Status', 'Actual Status', 'Actual status', 'Status Details', 'Secondary Status', 'Status');
      const status = normalizeSecondaryStatus(rawStatus);

      const isActive = isLearnerActive(rawStatus) || !status;
      const isGraduated = status === 'completed' || status === 'graduated';

      const rawType = v(s, 'Learner Type', 'Type').toLowerCase();
      const isInt = rawType.includes('international') || rawType.includes('us');
      const isDom = rawType.includes('domestic');

      if (isInt) {
        international++;
      } else if (isDom) {
        domestic++;
      }

      if (isGraduated) {
        graduated++;
      } else if (isActive) {
        active++;
        if (isInt) activeInternational++;
        if (isDom) activeDomestic++;
      } else {
        if (status === 'ipd' || status.includes('ipd') || status.includes('deferral') || status.includes('defferal')) {
          ipd++;
        } else if (status === 'payment dropout' || status.includes('dropout') || status.includes('payment')) {
          paymentDropout++;
        } else {
          otherStatus++;
        }
      }
    }

    return {
      total,
      active,
      graduated,
      ipd,
      paymentDropout,
      otherStatus,
      international,
      domestic,
      activeInternational,
      activeDomestic,
      programs: Object.keys(programsMap).length,
      distribution: Object.entries(programsMap).map(([name, count]) => ({ name, count, pct: (count / (total || 1)) * 100 })),
      cohorts: Object.entries(cohortsMap)
        .map(([name, count]) => ({ name, count, pct: (count / (total || 1)) * 100 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      countries: Object.entries(countriesMap)
        .map(([name, count]) => ({ name, count, pct: (count / (total || 1)) * 100 }))
        .sort((a, b) => b.count - a.count)
    };
  }, [students]);

  return (
    <div className="max-w-6xl mx-auto py-2">
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">
            Overall <span className="text-indigo-700">Dashboard</span>
          </h1>
          <p className="text-slate-600 text-base font-medium opacity-80">Enterprise operational intelligence & analytics.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center">
            <i className="fas fa-calendar-alt text-indigo-700 mr-2 text-xs" />
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Status Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 mb-10">
        {/* Card 1: Total Volume */}
        <div
          onClick={() => navigate('/lex/learners')}
          className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-lg relative overflow-hidden group cursor-pointer hover:-translate-y-1"
        >
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-slate-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-users text-[9px]" />
              </div>
              <span className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider leading-none">Total Volume</span>
            </div>
            <div>
              <div className="text-xl font-black text-slate-900 tracking-tight mb-0.5">
                {loading ? <StatSkeleton /> : stats.total.toLocaleString()}
              </div>
              <div className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider opacity-70">Total Learners</div>
            </div>
          </div>
        </div>

        {/* Card 2: Active Learners */}
        <div
          onClick={() => navigate('/lex/learners?status=Active')}
          className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-lg relative overflow-hidden group cursor-pointer hover:-translate-y-1"
        >
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-indigo-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-user-check text-[9px]" />
              </div>
              <span className="text-[9.5px] font-black text-indigo-400 uppercase tracking-wider leading-none">Active Pool</span>
            </div>
            <div>
              <div className="text-xl font-black text-indigo-700 tracking-tight mb-0.5">
                {loading ? <StatSkeleton /> : stats.active.toLocaleString()}
              </div>
              <div className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider opacity-70">Active Learners</div>
            </div>
          </div>
        </div>

        {/* Card 3: Graduated Alumni */}
        <div
          onClick={() => navigate('/lex/learners?status=Graduated')}
          className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-lg relative overflow-hidden group cursor-pointer hover:-translate-y-1"
        >
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-award text-[9px]" />
              </div>
              <span className="text-[9.5px] font-black text-emerald-500 uppercase tracking-wider leading-none">Alumni Success</span>
            </div>
            <div>
              <div className="text-xl font-black text-emerald-700 tracking-tight mb-0.5">
                {loading ? <StatSkeleton /> : stats.graduated.toLocaleString()}
              </div>
              <div className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider opacity-70">Graduated</div>
            </div>
          </div>
        </div>

        {/* Card 4: IPD (In Process of Deferral) */}
        <div
          onClick={() => navigate('/lex/learners?status=IPD')}
          className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-lg relative overflow-hidden group cursor-pointer hover:-translate-y-1"
        >
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-yellow-50/50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-yellow-400 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-hourglass text-[9px]" />
              </div>
              <span className="text-[9.5px] font-black text-yellow-400 uppercase tracking-wider leading-none">IPD</span>
            </div>
            <div>
              <div className="text-xl font-black text-yellow-700 tracking-tight mb-0.5">
                {loading ? <StatSkeleton /> : stats.ipd.toLocaleString()}
              </div>
              <div className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider opacity-70">In Process of Deferral</div>
            </div>
          </div>
        </div>

        {/* Card 5: Payment-Dropout */}
        <div
          onClick={() => navigate('/lex/learners?status=Payment-Dropout')}
          className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-lg relative overflow-hidden group cursor-pointer hover:-translate-y-1"
        >
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-rose-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-rose-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-user-minus text-[9px]" />
              </div>
              <span className="text-[9.5px] font-black text-rose-500 uppercase tracking-wider leading-none">Payment-Dropout</span>
            </div>
            <div>
              <div className="text-xl font-black text-rose-600 tracking-tight mb-0.5">
                {loading ? <StatSkeleton /> : stats.paymentDropout.toLocaleString()}
              </div>
              <div className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider opacity-70">Payment Dropout</div>
            </div>
          </div>
        </div>

        {/* Card 6: All Other Inactive Statuses */}
        <div
          onClick={() => navigate('/lex/learners?status=Other%20Inactive')}
          className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-lg relative overflow-hidden group cursor-pointer hover:-translate-y-1"
        >
          <div className="absolute -right-4 -top-4 w-16 h-16 bg-slate-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-slate-700 rounded-xl flex items-center justify-center text-white shadow-lg">
                <i className="fas fa-tags text-[9px]" />
              </div>
              <span className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider leading-none">Others</span>
            </div>
            <div>
              <div className="text-xl font-black text-slate-900 tracking-tight mb-0.5">
                {loading ? <StatSkeleton /> : stats.otherStatus.toLocaleString()}
              </div>
              <div className="text-[7.5px] font-bold text-slate-600 uppercase tracking-wider opacity-70">Other Inactive</div>
            </div>
          </div>
        </div>
      </div>

      {/* Global Composition - Quick View */}
      <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-md mb-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-1 h-5 bg-indigo-600 rounded-full" />
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Global Composition</h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Total Learners Bifurcation */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Residency Split</span>
                <span className="text-xs font-black text-slate-900">Total Learners</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Dom: {loading ? '—' : `${((stats.domestic / (stats.total || 1)) * 100).toFixed(1)}%`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Intl: {loading ? '—' : `${((stats.international / (stats.total || 1)) * 100).toFixed(1)}%`}</span>
                </div>
              </div>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 shadow-inner">
              {loading ? (
                <div className="w-full h-full bg-slate-200 animate-pulse rounded-full" />
              ) : (
                <>
                  {stats.domestic > 0 && (
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-1000 shadow-sm mr-0.5"
                      style={{ width: `${(stats.domestic / stats.total) * 100}%`, minWidth: '4px' }}
                    />
                  )}
                  {stats.international > 0 && (
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-1000 shadow-sm"
                      style={{ width: `${(stats.international / stats.total) * 100}%`, minWidth: '4px' }}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Active Learners Bifurcation */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Residency Split</span>
                <span className="text-xs font-black text-slate-900">Active Learners</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Dom: {loading ? '—' : `${((stats.activeDomestic / (stats.active || 1)) * 100).toFixed(1)}%`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Intl: {loading ? '—' : `${((stats.activeInternational / (stats.active || 1)) * 100).toFixed(1)}%`}</span>
                </div>
              </div>
            </div>
            <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex p-0.5 shadow-inner">
              {loading ? (
                <div className="w-full h-full bg-slate-200 animate-pulse rounded-full" />
              ) : (
                <>
                  {stats.activeDomestic > 0 && (
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-1000 shadow-sm mr-0.5"
                      style={{ width: `${(stats.activeDomestic / (stats.active || 1)) * 100}%`, minWidth: '4px' }}
                    />
                  )}
                  {stats.activeInternational > 0 && (
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-1000 shadow-sm"
                      style={{ width: `${(stats.activeInternational / (stats.active || 1)) * 100}%`, minWidth: '4px' }}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Program Distribution */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-md p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Program Distribution</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Learner Volume by Program</p>
            </div>
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-700">
              <i className="fas fa-chart-pie" />
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />)}
              </div>
            ) : (
              stats.distribution.sort((a, b) => b.count - a.count).map((item, i) => (
                <div key={i} className="group">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-tight">{item.name}</span>
                    <span className="text-xs font-black text-indigo-700">{item.count.toLocaleString()} <span className="text-indigo-400 font-bold ml-1">({item.pct.toFixed(2)}%)</span></span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100 p-[2px]">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(79,70,229,0.2)]"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Global Footprint Intelligence */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-md p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none text-indigo-900">
            <i className="fas fa-globe-africa text-8xl transform -rotate-12" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black tracking-tight text-slate-900">Regional <span className="text-indigo-700">Spread</span></h3>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                <i className="fas fa-map-marker-alt text-xs" />
              </div>
            </div>

            <div className="space-y-4 max-h-[240px] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-slate-50 rounded-xl animate-pulse" />)
              ) : stats.countries.length > 0 ? (
                stats.countries.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                      <i className={`fas ${item.name.includes('Others') ? 'fa-globe' : 'fa-flag'} text-[10px] text-slate-400 group-hover:text-indigo-600`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[10px] font-black text-slate-700 uppercase truncate pr-2 tracking-tight">{item.name}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${item.name.includes('Others')
                          ? 'text-slate-700 bg-slate-100'
                          : 'text-indigo-700 bg-indigo-50'
                          }`}>
                          {item.count.toLocaleString()} <span className={`${item.name.includes('Others') ? 'text-slate-400' : 'text-indigo-400'} font-bold ml-1`}>({item.pct.toFixed(2)}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${item.name.includes('Others')
                            ? 'bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.3)]'
                            : 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.3)]'
                            }`}
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400 italic text-xs font-medium">No regional data identified</div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
