import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { useCohortBudgetData } from '../../hooks/useBudgetData';
import { PROGRAMS } from '../../lib/config';
import { getActualsCardConfig } from './LexProgramBudgetDetail';

function StatSkeleton() {
  return <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />;
}

interface DropdownOption {
  value: string;
  label: string;
}

function CustomDropdown({
  value,
  onChange,
  options
}: {
  value: string;
  onChange: (val: string) => void;
  options: DropdownOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];
  const effectiveValue = selectedOption?.value ?? value;

  return (
    <div className="relative inline-block text-left select-none z-30">
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex justify-between items-center w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black text-slate-700 uppercase tracking-wider hover:bg-slate-50 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all duration-300 shadow-sm gap-2 min-w-[160px]"
        >
          <span>{selectedOption?.label}</span>
          <i className={`fas fa-chevron-down text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-2xl shadow-xl bg-white border border-slate-100 ring-1 ring-black ring-opacity-5 z-40 focus:outline-none overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="py-1.5 divide-y divide-slate-50">
              {options.map((opt) => {
                const isSelected = opt.value === effectiveValue;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`flex items-center justify-between w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-wider transition-all duration-200 ${isSelected
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <i className="fas fa-check text-indigo-600 text-[8px]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function LexCohortBudgetDetail() {
  const { programId, cohortId } = useParams<{ programId: string; cohortId: string }>();
  const [searchParams] = useSearchParams();
  const fy = searchParams.get('fy');
  const fyStartYear = fy ? parseInt(fy) : undefined;
  const navigate = useNavigate();
  const { stats, programActuals, programBudget, loading, error } = useCohortBudgetData(programId || '', cohortId || '', fyStartYear);

  const [actualsSplitFilter, setActualsSplitFilter] = useState<string>('');
  const [monthFilter, setMonthFilter] = useState<string>('');

  const calculationCutoff = useMemo(() => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return today.getDate() === lastDay ? today : new Date(today.getFullYear(), today.getMonth(), 0);
  }, []);

  const selectedFYStartYear = useMemo(() => {
    const now = calculationCutoff;
    const actualCurrentFYStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return fyStartYear || actualCurrentFYStartYear;
  }, [fyStartYear, calculationCutoff]);

  const currentFYStartFormatted = useMemo(() => {
    const d = new Date(selectedFYStartYear, 3, 1);
    const mmm = d.toLocaleDateString('en-US', { month: 'short' });
    const yy = d.toLocaleDateString('en-US', { year: '2-digit' });
    return `${mmm}-${yy}`;
  }, [selectedFYStartYear]);

  const currentFYEndFormatted = useMemo(() => {
    const d = new Date(selectedFYStartYear + 1, 2, 31);
    const mmm = d.toLocaleDateString('en-US', { month: 'short' });
    const yy = d.toLocaleDateString('en-US', { year: '2-digit' });
    return `${mmm}-${yy}`;
  }, [selectedFYStartYear]);

  const tillDateFormatted = useMemo(() => {
    const now = calculationCutoff;
    const actualCurrentFYStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const isActualFY = selectedFYStartYear === actualCurrentFYStartYear;
    const d = isActualFY ? now : new Date(selectedFYStartYear + 1, 2, 31);
    const mmm = d.toLocaleDateString('en-US', { month: 'short' });
    const yy = d.toLocaleDateString('en-US', { year: '2-digit' });
    return `${mmm}-${yy}`;
  }, [selectedFYStartYear, calculationCutoff]);

  const prevFYStartFormatted = useMemo(() => {
    const d = new Date(selectedFYStartYear - 1, 3, 1);
    const mmm = d.toLocaleDateString('en-US', { month: 'short' });
    const yy = d.toLocaleDateString('en-US', { year: '2-digit' });
    return `${mmm}-${yy}`;
  }, [selectedFYStartYear]);

  const prevFYEndFormatted = useMemo(() => {
    const d = new Date(selectedFYStartYear, 2, 31);
    const mmm = d.toLocaleDateString('en-US', { month: 'short' });
    const yy = d.toLocaleDateString('en-US', { year: '2-digit' });
    return `${mmm}-${yy}`;
  }, [selectedFYStartYear]);

  const [chartFYFilter, setChartFYFilter] = useState<string>('');
  const [chartFYInitialized, setChartFYInitialized] = useState(false);

  useEffect(() => {
    const fyYears = programActuals?.fyYears || programBudget?.fyYears || [];
    if (fyYears.length > 0 && !chartFYInitialized) {
      const prevFYStartYear = selectedFYStartYear - 1;
      if (fyYears.includes(prevFYStartYear)) {
        setChartFYFilter(String(prevFYStartYear));
      } else {
        setChartFYFilter(String(fyYears[fyYears.length - 1]));
      }
      setChartFYInitialized(true);
    }
  }, [programActuals, programBudget, selectedFYStartYear, chartFYInitialized]);

  const chartData = useMemo(() => {
    if (!chartFYFilter || (!programBudget && !programActuals)) return [];

    const selectedYear = Number(chartFYFilter);
    const monthLabels = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

    const budgetMonthMap = (programBudget as any)?.fyMonthBudgetMap?.[selectedYear] || {};
    const actualsMonthMap = (programActuals as any)?.fyMonthActualsMap?.[selectedYear] || {};

    const data = monthLabels.map(m => {
      const budgetKey = Object.keys(budgetMonthMap).find(k => k.toLowerCase().startsWith(m.toLowerCase() + '-'));
      const actualsKey = Object.keys(actualsMonthMap).find(k => k.toLowerCase().startsWith(m.toLowerCase() + '-'));

      const budgetVal = budgetKey ? budgetMonthMap[budgetKey]?.total || 0 : 0;
      const actualsVal = actualsKey ? actualsMonthMap[actualsKey]?.total || 0 : 0;

      return {
        month: m,
        budget: budgetVal,
        actuals: actualsVal
      };
    });

    const now = calculationCutoff;
    const actualCurrentFYStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const isCurrentFY = selectedYear === actualCurrentFYStartYear;

    if (isCurrentFY) {
      return data.filter((_, relativeMonthIdx) => {
        const monthIdx = (relativeMonthIdx + 3) % 12;
        const year = relativeMonthIdx >= 9 ? selectedYear + 1 : selectedYear;

        const nowYear = now.getFullYear();
        const nowMonth = now.getMonth();

        if (year < nowYear) return true;
        if (year === nowYear && monthIdx <= nowMonth) return true;
        return false;
      });
    }

    return data;
  }, [programBudget, programActuals, chartFYFilter, calculationCutoff]);

  // Reset month when FY changes
  useEffect(() => { setMonthFilter(''); }, [actualsSplitFilter]);

  // Resolve the effective FY year (number) — fallback to last available year
  const effectiveFY = useMemo(() => {
    const fyYears = programActuals?.fyYears || programBudget?.fyYears || [];
    const raw = actualsSplitFilter || (fyYears.length > 0 ? String(fyYears[fyYears.length - 1]) : '');
    return raw ? Number(raw) : null;
  }, [programActuals, programBudget, actualsSplitFilter]);

  // Available months for the selected FY, sorted Apr → Mar (from actuals data)
  const availableMonths = useMemo(() => {
    if (!effectiveFY || !programActuals) return [];
    const monthMap = (programActuals as any).fyMonthActualsMap?.[effectiveFY] || {};
    const monthOrder = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    return Object.keys(monthMap).sort((a, b) => {
      const aM = a.split('-')[0]; const bM = b.split('-')[0];
      return monthOrder.indexOf(aM) - monthOrder.indexOf(bM);
    });
  }, [effectiveFY, programActuals]);

  const activeActuals = useMemo(() => {
    if (!programActuals || !effectiveFY) return 0;
    if (monthFilter) {
      return (programActuals as any).fyMonthActualsMap?.[effectiveFY]?.[monthFilter]?.total || 0;
    }
    return programActuals.fyActualsMap?.[effectiveFY]?.total || 0;
  }, [programActuals, effectiveFY, monthFilter]);

  const activeIntl = useMemo(() => {
    if (!programActuals || !effectiveFY) return 0;
    if (monthFilter) {
      return (programActuals as any).fyMonthActualsMap?.[effectiveFY]?.[monthFilter]?.intl || 0;
    }
    return programActuals.fyActualsMap?.[effectiveFY]?.intl || 0;
  }, [programActuals, effectiveFY, monthFilter]);

  const activeDom = useMemo(() => {
    if (!programActuals || !effectiveFY) return 0;
    if (monthFilter) {
      return (programActuals as any).fyMonthActualsMap?.[effectiveFY]?.[monthFilter]?.dom || 0;
    }
    return programActuals.fyActualsMap?.[effectiveFY]?.dom || 0;
  }, [programActuals, effectiveFY, monthFilter]);

  const activeBudget = useMemo(() => {
    if (!programBudget || !effectiveFY) return 0;
    if (monthFilter) {
      return (programBudget as any).fyMonthBudgetMap?.[effectiveFY]?.[monthFilter]?.total || 0;
    }
    return programBudget.fyBudgetMap?.[effectiveFY]?.total || 0;
  }, [programBudget, effectiveFY, monthFilter]);

  const activeIntlBudget = useMemo(() => {
    if (!programBudget || !effectiveFY) return 0;
    if (monthFilter) {
      return (programBudget as any).fyMonthBudgetMap?.[effectiveFY]?.[monthFilter]?.intl || 0;
    }
    return programBudget.fyBudgetMap?.[effectiveFY]?.intl || 0;
  }, [programBudget, effectiveFY, monthFilter]);

  const activeDomBudget = useMemo(() => {
    if (!programBudget || !effectiveFY) return 0;
    if (monthFilter) {
      return (programBudget as any).fyMonthBudgetMap?.[effectiveFY]?.[monthFilter]?.dom || 0;
    }
    return programBudget.fyBudgetMap?.[effectiveFY]?.dom || 0;
  }, [programBudget, effectiveFY, monthFilter]);

  const activeStudyAbroadBudget = useMemo(() => {
    if (!programBudget || !effectiveFY) return 0;
    if (monthFilter) {
      return (programBudget as any).fyMonthBudgetMap?.[effectiveFY]?.[monthFilter]?.studyAbroad || 0;
    }
    return (programBudget as any).fyBudgetMap?.[effectiveFY]?.studyAbroad || 0;
  }, [programBudget, effectiveFY, monthFilter]);

  const activeStudyAbroad = useMemo(() => {
    if (!programActuals || !effectiveFY) return 0;
    if (monthFilter) {
      return (programActuals as any).fyMonthActualsMap?.[effectiveFY]?.[monthFilter]?.studyAbroad || 0;
    }
    return (programActuals as any).fyActualsMap?.[effectiveFY]?.studyAbroad || 0;
  }, [programActuals, effectiveFY, monthFilter]);

  const isMBA = programId === 'mba';

  // Active budget bifurcation filtered by FY + optional month
  const activeBudgetBifurcation = useMemo(() => {
    if (!programBudget || !effectiveFY) return [];
    if (monthFilter) {
      const map = (programBudget as any).fyMonthBudgetBifurcationMap?.[effectiveFY]?.[monthFilter] || {};
      return Object.entries(map).map(([name, value]) => ({ name, value: value as number }));
    }
    const map = programBudget.fyBudgetBifurcationMap?.[effectiveFY] || {};
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [programBudget, effectiveFY, monthFilter]);

  // Active actuals bifurcation filtered by FY + optional month
  const activeActualsBifurcation = useMemo(() => {
    if (!programActuals || !effectiveFY) return [];
    if (monthFilter) {
      const bif = (programActuals as any).fyMonthActualsMap?.[effectiveFY]?.[monthFilter]?.bifurcation || {};
      return Object.entries(bif).map(([name, value]) => ({ name, value: value as number }));
    }
    const map = (programActuals as any).fyActualsBifurcationMap?.[effectiveFY] || {};
    return Object.entries(map).map(([name, value]) => ({ name, value: value as number }));
  }, [programActuals, effectiveFY, monthFilter]);

  const programName = programId ? PROGRAMS[programId]?.name || programId : 'Unknown Program';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const formatCompact = (val: number) => {
    if (val === 0) return '$0';
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return formatCurrency(val);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <i className="fas fa-exclamation-triangle text-4xl mb-4 text-red-400" />
        <p className="text-lg font-bold">Error loading cohort budget</p>
        <p className="text-sm">{error}</p>
        <button onClick={() => navigate(`/lex/budget/${programId}`)} className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">
          Back to Program
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[90rem] mx-auto py-2">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
        <Link to="/lex/home" className="hover:text-indigo-600 transition-colors">Dashboard</Link>
        <i className="fas fa-chevron-right text-[8px] opacity-50" />
        <Link to="/lex/budget" className="hover:text-indigo-600 transition-colors">Budget</Link>
        <i className="fas fa-chevron-right text-[8px] opacity-50" />
        <Link to={`/lex/budget/${programId}`} className="hover:text-indigo-600 transition-colors">{programName}</Link>
        <i className="fas fa-chevron-right text-[8px] opacity-50" />
        <span className="text-indigo-600">{cohortId}</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/lex/budget/${programId}`)}
            className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:bg-indigo-50 transition-all duration-300 shadow-sm"
          >
            <i className="fas fa-arrow-left text-xs" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">
              Cohort <span className="text-indigo-600">{cohortId}</span> <span className="text-indigo-700">Budget Detail</span>
            </h1>
            <p className="text-slate-600 text-base font-medium opacity-80 flex items-center gap-2">
              <i className="fas fa-university text-indigo-400 text-xs" /> {programName} cohort-level financial breakdown.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center">
            <i className="fas fa-calendar-alt text-indigo-700 mr-2 text-xs" />
            <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {/* Card 1: Current FY (Budgeted) */}
        <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <i className="fas fa-wallet text-xs" />
              </div>
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">Current FY (Budgeted)</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 tracking-tighter mb-0">
                {loading ? <StatSkeleton /> : formatCompact(stats?.currentFYBudgeted || 0)}
              </div>
              {!loading && (
                <div className="text-[11px] font-bold text-slate-400 tracking-wide mb-1">
                  ({formatCurrency(stats?.currentFYBudgeted || 0)})
                </div>
              )}
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-80 mt-1">{currentFYStartFormatted} to {currentFYEndFormatted}</div>
            </div>
          </div>
        </div>

        {/* Card 2: Current FY (Utilized) */}
        <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                <i className="fas fa-receipt text-xs" />
              </div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Current FY (Utilized)</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 tracking-tighter mb-0">
                {loading ? <StatSkeleton /> : formatCompact(stats?.currentFYUtilized || 0)}
              </div>
              {!loading && (
                <div className="text-[11px] font-bold text-slate-400 tracking-wide mb-1">
                  ({formatCurrency(stats?.currentFYUtilized || 0)})
                </div>
              )}
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-80 mt-1">{currentFYStartFormatted} to {tillDateFormatted}</div>
            </div>
          </div>
        </div>

        {/* Card 3: Previous FY (Budgeted) */}
        <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-orange-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-200">
                <i className="fas fa-history text-xs" />
              </div>
              <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest leading-none">Previous FY (Budgeted)</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 tracking-tighter mb-0">
                {loading ? <StatSkeleton /> : formatCompact(stats?.previousFYBudgeted || 0)}
              </div>
              {!loading && (
                <div className="text-[11px] font-bold text-slate-400 tracking-wide mb-1">
                  ({formatCurrency(stats?.previousFYBudgeted || 0)})
                </div>
              )}
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-80 mt-1">{prevFYStartFormatted} to {prevFYEndFormatted}</div>
            </div>
          </div>
        </div>

        {/* Card 4: Previous FY (Utilized) */}
        <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-lg relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-20 h-20 bg-violet-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-200">
                <i className="fas fa-chart-line text-xs" />
              </div>
              <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest leading-none">Previous FY (Utilized)</span>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 tracking-tighter mb-0">
                {loading ? <StatSkeleton /> : formatCompact(stats?.previousFYUtilized || 0)}
              </div>
              {!loading && (
                <div className="text-[11px] font-bold text-slate-400 tracking-wide mb-1">
                  ({formatCurrency(stats?.previousFYUtilized || 0)})
                </div>
              )}
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-80 mt-1">{prevFYStartFormatted} to {prevFYEndFormatted}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Shared FY Filter + Budget Bifurcation + Actuals KPI + Actuals Split */}
      {!loading && ((programBudget && (programBudget.bifurcation || []).length > 0) || (programActuals && programActuals.totalActuals > 0)) && (
        <div className="mb-10">
          {/* Shared FY + Month Dropdowns */}
          <div className="flex items-center justify-end mb-6 px-1 gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* FY Dropdown */}
              <CustomDropdown
                value={actualsSplitFilter}
                onChange={setActualsSplitFilter}
                options={[
                  ...((programActuals?.fyYears && programActuals.fyYears.length > 0)
                    ? programActuals.fyYears
                    : (programBudget?.fyYears || [])
                  ).map((year: number) => ({
                    value: String(year),
                    label: `FY (Apr-${String(year).slice(-2)} to Mar-${String(year + 1).slice(-2)})`
                  }))
                ]}
              />

              {/* Month Dropdown — only shown when there are months available */}
              {availableMonths.length > 0 && (
                <CustomDropdown
                  value={monthFilter}
                  onChange={setMonthFilter}
                  options={[
                    { value: '', label: 'All Months' },
                    ...availableMonths.map(m => ({ value: m, label: m }))
                  ]}
                />
              )}

              {/* Active month pill */}
              {monthFilter && (
                <button
                  onClick={() => setMonthFilter('')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-[9px] font-black text-indigo-700 uppercase tracking-wider hover:bg-indigo-100 transition-colors"
                >
                  <i className="fas fa-calendar-day text-[8px]" />
                  {monthFilter}
                  <i className="fas fa-times text-[8px] opacity-60" />
                </button>
              )}
            </div>
          </div>

          {/* Budget Bifurcation Section */}
          {programBudget && activeBudgetBifurcation.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="w-1.5 h-4 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Budget Bifurcation
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Budget main card */}
                <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm relative overflow-hidden group col-span-1">
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                        <i className="fas fa-wallet text-xs" />
                      </div>
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest leading-none">Budget</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 tracking-tighter">
                      {formatCompact(activeBudget)}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 tracking-wide mt-1">
                      {formatCurrency(activeBudget)}
                    </div>
                    <div className="text-[9px] font-bold text-indigo-600/60 uppercase tracking-widest mt-1">
                      {monthFilter
                        ? monthFilter
                        : effectiveFY ? `FY (Apr-${String(effectiveFY).slice(-2)} to Mar-${String(effectiveFY + 1).slice(-2)})` : ''}
                    </div>
                  </div>
                </div>

                {/* Budget bifurcation mini cards — only show categories with value > 0 */}
                <div className="col-span-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {activeBudgetBifurcation.filter(item => item.value > 0).map((item: { name: string; value: number }) => {
                    const config = getActualsCardConfig(item.name);
                    const val = item.value;
                    return (
                      <div key={item.name} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px]" style={{ backgroundColor: config.color }}>
                            <i className={`fas ${config.icon}`} />
                          </div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">{config.label}</span>
                        </div>
                        <div className="text-[13px] font-black text-slate-900">{formatCompact(val)}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5">{formatCurrency(val)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Budget Split — Intl / Dom / Study Abroad (MBA only) */}
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-1.5 h-4 rounded-full bg-indigo-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    Budget Split
                  </span>
                </div>
                <div className={`grid grid-cols-1 gap-4 ${isMBA && activeStudyAbroadBudget > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  {/* International Budget */}
                  <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                          <i className="fas fa-globe text-xs" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">International Budget</span>
                          <div className="text-xl font-black text-slate-900 tracking-tighter mt-1">
                            {formatCompact(activeIntlBudget)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-slate-400 tracking-wide">
                          {formatCurrency(activeIntlBudget)}
                        </div>
                        <div className="text-[9px] font-bold text-indigo-600/70 uppercase tracking-widest mt-0.5">
                          {((activeIntlBudget / (activeBudget || 1)) * 100).toFixed(1)}% Share
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Domestic Budget */}
                  <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                          <i className="fas fa-home text-xs" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Domestic Budget</span>
                          <div className="text-xl font-black text-slate-900 tracking-tighter mt-1">
                            {formatCompact(activeDomBudget)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-slate-400 tracking-wide">
                          {formatCurrency(activeDomBudget)}
                        </div>
                        <div className="text-[9px] font-bold text-emerald-600/70 uppercase tracking-widest mt-0.5">
                          {((activeDomBudget / (activeBudget || 1)) * 100).toFixed(1)}% Share
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Study Abroad Budget — MBA only */}
                  {isMBA && activeStudyAbroadBudget > 0 && (
                    <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                            <i className="fas fa-plane-departure text-xs" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">Study Abroad Budget</span>
                            <div className="text-xl font-black text-slate-900 tracking-tighter mt-1">
                              {formatCompact(activeStudyAbroadBudget)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-bold text-slate-400 tracking-wide">
                            {formatCurrency(activeStudyAbroadBudget)}
                          </div>
                          <div className="text-[9px] font-bold text-amber-600/70 uppercase tracking-widest mt-0.5">
                            {((activeStudyAbroadBudget / (activeBudget || 1)) * 100).toFixed(1)}% Share
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Actuals KPI Card + Actuals Bifurcation */}
          {programActuals && programActuals.totalActuals > 0 && (
            <>
              <div className="flex items-center gap-2 mb-3 px-1 mt-8">
                <div className="w-1.5 h-4 rounded-full bg-violet-500" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Actual Bifurcation
                </span>
              </div>
              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm relative overflow-hidden group col-span-1">
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-violet-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
                  <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-violet-200">
                        <i className="fas fa-receipt text-xs" />
                      </div>
                      <span className="text-[10px] font-black text-violet-600 uppercase tracking-widest leading-none">Actuals</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 tracking-tighter">
                      {loading ? <StatSkeleton /> : formatCompact(activeActuals)}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 tracking-wide mt-1">
                      {formatCurrency(activeActuals)}
                    </div>
                    <div className="text-[9px] font-bold text-violet-600/60 uppercase tracking-widest mt-1">
                      {monthFilter
                        ? monthFilter
                        : effectiveFY ? `FY (Apr-${String(effectiveFY).slice(-2)} to Mar-${String(effectiveFY + 1).slice(-2)})` : ''}
                    </div>
                  </div>
                </div>

                {/* Actuals Bifurcation mini cards — filtered by FY, only show categories with value > 0 */}
                <div className="col-span-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {activeActualsBifurcation.filter(item => item.value > 0).map((item: { name: string; value: number }) => {
                    const config = getActualsCardConfig(item.name);
                    const val = item.value;
                    return (
                      <div key={item.name} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 hover:border-slate-200 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px]" style={{ backgroundColor: config.color }}>
                            <i className={`fas ${config.icon}`} />
                          </div>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight">{config.label}</span>
                        </div>
                        <div className="text-[13px] font-black text-slate-900">{formatCompact(val)}</div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5">{formatCurrency(val)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actuals Split — Intl / Dom / Study Abroad (MBA only) */}
              <div>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="w-1.5 h-4 rounded-full bg-violet-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    Actuals Split
                  </span>
                </div>
                <div className={`grid grid-cols-1 gap-4 ${isMBA && activeStudyAbroad > 0 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  {/* International Actuals */}
                  <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                          <i className="fas fa-globe text-xs" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">International Actuals</span>
                          <div className="text-xl font-black text-slate-900 tracking-tighter mt-1">
                            {formatCompact(activeIntl)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-slate-400 tracking-wide">
                          {formatCurrency(activeIntl)}
                        </div>
                        <div className="text-[9px] font-bold text-indigo-600/70 uppercase tracking-widest mt-0.5">
                          {((activeIntl / (activeActuals || 1)) * 100).toFixed(1)}% Share
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Domestic Actuals */}
                  <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                          <i className="fas fa-home text-xs" />
                        </div>
                        <div>
                          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none">Domestic Actuals</span>
                          <div className="text-xl font-black text-slate-900 tracking-tighter mt-1">
                            {formatCompact(activeDom)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold text-slate-400 tracking-wide">
                          {formatCurrency(activeDom)}
                        </div>
                        <div className="text-[9px] font-bold text-emerald-600/70 uppercase tracking-widest mt-0.5">
                          {((activeDom / (activeActuals || 1)) * 100).toFixed(1)}% Share
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Study Abroad Actuals — MBA only */}
                  {isMBA && activeStudyAbroad > 0 && (
                    <div className="bg-white rounded-[2rem] p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-700" />
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-amber-200">
                            <i className="fas fa-plane-departure text-xs" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">Study Abroad Actuals</span>
                            <div className="text-xl font-black text-slate-900 tracking-tighter mt-1">
                              {formatCompact(activeStudyAbroad)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-bold text-slate-400 tracking-wide">
                            {formatCurrency(activeStudyAbroad)}
                          </div>
                          <div className="text-[9px] font-bold text-amber-600/70 uppercase tracking-widest mt-0.5">
                            {((activeStudyAbroad / (activeActuals || 1)) * 100).toFixed(1)}% Share
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Trend Analysis Section */}
          {((programBudget && (programBudget.fyYears || []).length > 0) || (programActuals && (programActuals.fyYears || []).length > 0)) && (
            <div className="mt-10">
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                  Trend Analysis
                </span>
                <div>
                  <CustomDropdown
                    value={chartFYFilter}
                    onChange={setChartFYFilter}
                    options={[
                      ...((programActuals?.fyYears && programActuals.fyYears.length > 0)
                        ? programActuals.fyYears
                        : (programBudget?.fyYears || [])
                      ).map((year: number) => {
                        const startFormatted = `Apr-${String(year).slice(-2)}`;
                        const endFormatted = `Mar-${String(year + 1).slice(-2)}`;
                        return {
                          value: String(year),
                          label: `FY (${startFormatted} to ${endFormatted})`
                        };
                      })
                    ]}
                  />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-md p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                      <i className="fas fa-chart-line text-xs" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                        {chartFYFilter ? `FY ${chartFYFilter}` : 'FY'} Budget vs Actuals
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                        {chartFYFilter
                          ? `Comparing FY (Apr-${chartFYFilter.slice(-2)} to Mar-${String(Number(chartFYFilter) + 1).slice(-2)}) Budget and Actuals`
                          : 'Comparing Budget and Actuals trend'
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-600" />
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Budget</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-600" />
                      <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Actuals</span>
                    </div>
                  </div>
                </div>

                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorBudgetCohort" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorActualsCohort" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                        tickFormatter={(value) => `$${value >= 1000 ? (value / 1000) + 'K' : value}`}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '16px',
                          border: 'none',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          padding: '12px'
                        }}
                        labelStyle={{ fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', marginBottom: '8px', color: '#1e293b' }}
                        itemStyle={{ fontSize: '11px', fontWeight: 700, padding: '2px 0' }}
                        formatter={(value: any, name: any) => [formatCurrency(value || 0), name]}
                        itemSorter={(item: any) => (item.name === 'Budget' ? 0 : 1)}
                      />
                      <Area
                        type="monotone"
                        dataKey="budget"
                        name="Budget"
                        stroke="#4f46e5"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorBudgetCohort)"
                        animationDuration={1500}
                      />
                      <Area
                        type="monotone"
                        dataKey="actuals"
                        name="Actuals"
                        stroke="#10b981"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorActualsCohort)"
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
