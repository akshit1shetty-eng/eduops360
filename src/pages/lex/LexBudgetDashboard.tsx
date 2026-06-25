import { useState, useMemo, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { useBudgetData } from '../../hooks/useBudgetData';
import { useLexFilter } from '../../hooks/useLexFilter';
import { UNIVERSITIES } from '../../lib/universities';

const PROGRAM_THEMES: Record<string, { bg: string; text: string; icon: string; border: string; bar: string }> = {
  'dba-et': { bg: 'bg-blue-50/80', text: 'text-blue-700', icon: 'fa-graduation-cap', border: 'border-blue-100', bar: 'bg-blue-600' },
  'dba': { bg: 'bg-rose-50/80', text: 'text-rose-700', icon: 'fa-user-graduate', border: 'border-rose-100', bar: 'bg-rose-600' },
  'dba-dl': { bg: 'bg-violet-50/80', text: 'text-violet-700', icon: 'fa-rocket', border: 'border-violet-100', bar: 'bg-violet-600' },
  'mba': { bg: 'bg-emerald-50/80', text: 'text-emerald-700', icon: 'fa-briefcase', border: 'border-emerald-100', bar: 'bg-emerald-600' },
  'mpsych': { bg: 'bg-purple-50/80', text: 'text-purple-700', icon: 'fa-brain', border: 'border-purple-100', bar: 'bg-purple-600' },
  'm-psych': { bg: 'bg-purple-50/80', text: 'text-purple-700', icon: 'fa-brain', border: 'border-purple-100', bar: 'bg-purple-600' }
};
const defaultTheme = { bg: 'bg-slate-50/80', text: 'text-slate-700', icon: 'fa-book-open', border: 'border-slate-100', bar: 'bg-indigo-600' };

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
                const isSelected = opt.value === value;
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

export default function LexBudgetDashboard() {
  const { selectedUniversityId } = useLexFilter();
  const { budgetData, loading } = useBudgetData(selectedUniversityId);
  const navigate = useNavigate();

  const selectedProgram = '';

  const now = (() => {
    const today = new Date();
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return today.getDate() === lastDay ? today : new Date(today.getFullYear(), today.getMonth(), 0);
  })();
  const actualCurrentFYStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const selectedFYStartYear = actualCurrentFYStartYear;
  const [expandedUnis, setExpandedUnis] = useState<Record<string, boolean>>({});
  const [actualsSplitFilter, setActualsSplitFilter] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const toggleUni = (id: string) => {
    setExpandedUnis(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const parseMonthString = (monthStr: string) => {
    if (!monthStr) return new Date(NaN);
    const s = monthStr.toString().trim();

    // Handle standard "MMM-YY" or "MMM-YYYY" (e.g., "Apr-26", "April-2026")
    if (s.includes('-')) {
      const parts = s.split('-');
      if (parts.length === 2) {
        const [mon, yr] = parts;
        let year = parseInt(yr);
        if (!isNaN(year) && year < 100) year += 2000;
        return new Date(`${mon} 1, ${year}`);
      }
      // Handle "YYYY-MM-DD" or similar
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }

    // Handle "MM/DD/YYYY" or "M/D/YY"
    if (s.includes('/')) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }

    // Fallback
    const d = new Date(s);
    return d;
  };


  const parseBudget = (val: any) => {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const s = val.toString().replace(/[\$,]/g, '').trim();
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  };



  // Derived filtered data for calculation
  const calculations = useMemo(() => {
    let lifetimeBudget = 0;
    let totalBudget = 0;
    let currentFYBudget = 0;
    let previousFYBudget = 0;
    let projectionBudget = 0;
    let lifetimeActuals = 0;
    let actualsInternational = 0;
    let actualsDomestic = 0;
    let minActualsDate = Infinity;
    let maxActualsDate = -Infinity;

    let currentFYBudgeted = 0;
    let currentFYUtilized = 0;
    let previousFYBudgeted = 0;
    let previousFYUtilized = 0;
    let currentFYActuals = 0;
    let currentFYInternational = 0;
    let currentFYDomestic = 0;

    const fyActualsMap: Record<number, { total: number; intl: number; dom: number }> = {};
    const uniMap: Record<string, any> = {};
    // Monthly maps: fyYear → 'MMM' → { budgeted, actuals }
    const fyMonthBudgetMap: Record<number, Record<string, number>> = {};
    const fyMonthActualsMap: Record<number, Record<string, number>> = {};
    // Program breakdown per month: fyYear → 'MMM' → programId → { name, budgeted, actuals }
    const fyMonthProgramMap: Record<number, Record<string, Record<string, { name: string; budgeted: number; actuals: number }>>> = {};

    // Reference dates based on selected FY
    const isActualFY = selectedFYStartYear === actualCurrentFYStartYear;
    const tillDate = isActualFY ? now : new Date(selectedFYStartYear + 1, 2, 31);

    const currFYStart = new Date(selectedFYStartYear, 3, 1); // April 1
    const currFYEnd = new Date(selectedFYStartYear + 1, 2, 31); // March 31
    const prevFYStart = new Date(selectedFYStartYear - 1, 3, 1);
    const prevFYEnd = new Date(selectedFYStartYear, 2, 31);

    budgetData.forEach(row => {
      // Apply program filter if selected
      if (selectedProgram && row._programId !== selectedProgram) return;

      if (!row.Month) return;
      const d = parseMonthString(row.Month);
      if (isNaN(d.getTime())) return;

      const amt = parseBudget(row['Total Budget ($)']);
      const actualsAmt = parseBudget(row['Total Actuals']);
      const intlAmt = parseBudget(row['International']);
      const domAmt = parseBudget(row['Domestic']);

      if (amt === 0 && actualsAmt === 0) return;

      // 0. Lifetime budget: From beginning of time to NOW
      if (d <= now) {
        lifetimeBudget += amt;
      }

      let isTotal = false;
      let isCurr = false;
      let isPrev = false;
      let isProj = false;

      // 1. Total budget: From start to till date (selected FY context)
      if (d <= tillDate) {
        totalBudget += amt;
        isTotal = true;
      }

      // 2. Current FY budget: From Apr to till date
      if (d >= currFYStart && d <= tillDate) {
        currentFYBudget += amt;
        isCurr = true;
      }

      // 3. Previous FY budget: full previous FY
      if (d >= prevFYStart && d <= prevFYEnd) {
        previousFYBudget += amt;
        isPrev = true;
      }

      // 4. Projection budget: from till date to Apr
      if (d > tillDate && d <= currFYEnd) {
        projectionBudget += amt;
        isProj = true;
      }

      // Check if in Current FY (from currFYStart to currFYEnd)
      if (d >= currFYStart && d <= currFYEnd) {
        currentFYBudgeted += amt;
        if (d <= now) {
          currentFYUtilized += actualsAmt;
          currentFYActuals += actualsAmt;
          currentFYInternational += intlAmt;
          currentFYDomestic += domAmt;
        }
      }

      // Check if in Previous FY (from prevFYStart to prevFYEnd)
      if (d >= prevFYStart && d <= prevFYEnd) {
        previousFYBudgeted += amt;
        previousFYUtilized += actualsAmt;
      }

      // Per-month maps
      const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      const monthOrder = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
      const monthPrefix = monthOrder[(d.getMonth() + 9) % 12]; // Apr=0 index
      if (!fyMonthBudgetMap[fyStart]) fyMonthBudgetMap[fyStart] = {};
      fyMonthBudgetMap[fyStart][monthPrefix] = (fyMonthBudgetMap[fyStart][monthPrefix] || 0) + amt;
      if (d <= now) {
        if (!fyMonthActualsMap[fyStart]) fyMonthActualsMap[fyStart] = {};
        fyMonthActualsMap[fyStart][monthPrefix] = (fyMonthActualsMap[fyStart][monthPrefix] || 0) + actualsAmt;
        // Program breakdown per month
        const pId2 = row._programId;
        if (!fyMonthProgramMap[fyStart]) fyMonthProgramMap[fyStart] = {};
        if (!fyMonthProgramMap[fyStart][monthPrefix]) fyMonthProgramMap[fyStart][monthPrefix] = {};
        if (!fyMonthProgramMap[fyStart][monthPrefix][pId2]) {
          fyMonthProgramMap[fyStart][monthPrefix][pId2] = { name: row._programName, budgeted: 0, actuals: 0 };
        }
        fyMonthProgramMap[fyStart][monthPrefix][pId2].actuals += actualsAmt;
      }
      // Also accumulate program budget per month (regardless of now)
      {
        const pId2 = row._programId;
        if (!fyMonthProgramMap[fyStart]) fyMonthProgramMap[fyStart] = {};
        if (!fyMonthProgramMap[fyStart][monthPrefix]) fyMonthProgramMap[fyStart][monthPrefix] = {};
        if (!fyMonthProgramMap[fyStart][monthPrefix][pId2]) {
          fyMonthProgramMap[fyStart][monthPrefix][pId2] = { name: row._programName, budgeted: 0, actuals: 0 };
        }
        fyMonthProgramMap[fyStart][monthPrefix][pId2].budgeted += amt;
      }
      if (!fyActualsMap[fyStart]) {
        fyActualsMap[fyStart] = { total: 0, intl: 0, dom: 0 };
      }

      // Group for table
      const uId = row._universityId;
      if (!uniMap[uId]) {
        const u = UNIVERSITIES.find(x => x.id === uId);
        uniMap[uId] = {
          id: uId,
          name: u?.name || 'Unknown University',
          currBudgeted: 0,
          currUtilized: 0,
          prevBudgeted: 0,
          prevUtilized: 0,
          programs: {}
        };
      }

      const pId = row._programId;
      if (!uniMap[uId].programs[pId]) {
        uniMap[uId].programs[pId] = {
          id: pId,
          name: row._programName,
          currBudgeted: 0,
          currUtilized: 0,
          prevBudgeted: 0,
          prevUtilized: 0
        };
      }

      const inCurrentFY = d >= currFYStart && d <= currFYEnd;
      const inPreviousFY = d >= prevFYStart && d <= prevFYEnd;

      if (inCurrentFY) {
        uniMap[uId].currBudgeted += amt;
        uniMap[uId].programs[pId].currBudgeted += amt;
        if (d <= now) {
          uniMap[uId].currUtilized += actualsAmt;
          uniMap[uId].programs[pId].currUtilized += actualsAmt;
        }
      }
      if (inPreviousFY) {
        uniMap[uId].prevBudgeted += amt;
        uniMap[uId].programs[pId].prevBudgeted += amt;
        uniMap[uId].prevUtilized += actualsAmt;
        uniMap[uId].programs[pId].prevUtilized += actualsAmt;
      }

      if (d <= now) {
        lifetimeActuals += actualsAmt;
        actualsInternational += intlAmt;
        actualsDomestic += domAmt;

        fyActualsMap[fyStart].total += actualsAmt;
        fyActualsMap[fyStart].intl += intlAmt;
        fyActualsMap[fyStart].dom += domAmt;

        if (actualsAmt > 0) {
          const time = d.getTime();
          if (time < minActualsDate) minActualsDate = time;
          if (time > maxActualsDate) maxActualsDate = time;
        }
      }
    });

    const fyYears = Object.keys(fyActualsMap)
      .map(Number)
      .filter(year => fyActualsMap[year].total > 0)
      .sort((a, b) => a - b);

    // Also collect all FY years that have any budget data
    const allFyYears = Array.from(new Set([
      ...Object.keys(fyActualsMap).map(Number),
      ...Object.keys(fyMonthBudgetMap).map(Number)
    ])).sort((a, b) => a - b);

    return {
      lifetimeBudget,
      totalBudget,
      currentFYBudget,
      previousFYBudget,
      projectionBudget,
      lifetimeActuals,
      actualsInternational,
      actualsDomestic,
      currentFYBudgeted,
      currentFYUtilized,
      previousFYBudgeted,
      previousFYUtilized,
      currentFYActuals,
      currentFYInternational,
      currentFYDomestic,
      fyYears,
      allFyYears,
      fyActualsMap,
      fyMonthBudgetMap,
      fyMonthActualsMap,
      fyMonthProgramMap,
      minActualsDate: minActualsDate !== Infinity ? minActualsDate : null,
      maxActualsDate: maxActualsDate !== -Infinity ? maxActualsDate : null,
      tableData: Object.values(uniMap).map((u: any) => ({
        ...u,
        programs: Object.values(u.programs)
      }))
    };
  }, [budgetData, selectedProgram, selectedFYStartYear, actualCurrentFYStartYear]);

  const [chartFYFilter, setChartFYFilter] = useState<string>('');
  const [chartFYInitialized, setChartFYInitialized] = useState(false);

  useEffect(() => {
    if (calculations.fyYears && calculations.fyYears.length > 0 && !chartFYInitialized) {
      const prevFYStartYear = selectedFYStartYear - 1;
      if (calculations.fyYears.includes(prevFYStartYear)) {
        setChartFYFilter(String(prevFYStartYear));
      } else {
        setChartFYFilter(String(calculations.fyYears[0]));
      }
      setChartFYInitialized(true);
    }
  }, [calculations.fyYears, selectedFYStartYear, chartFYInitialized]);

  const chartData = useMemo(() => {
    if (!chartFYFilter) return [];

    const selectedYear = Number(chartFYFilter);
    const monthLabels = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    let data = monthLabels.map(m => ({ month: m, budget: 0, actuals: 0 }));

    const isCurrentFY = selectedYear === actualCurrentFYStartYear;

    budgetData.forEach(row => {
      if (selectedProgram && row._programId !== selectedProgram) return;
      if (!row.Month) return;
      const d = parseMonthString(row.Month);
      if (isNaN(d.getTime())) return;

      const fyYear = d.getFullYear();
      const monthIdx = d.getMonth();
      const amt = parseBudget(row['Total Budget ($)']);
      const actualsAmt = parseBudget(row['Total Actuals']);

      const recordFYStart = monthIdx >= 3 ? fyYear : fyYear - 1;
      const relativeMonthIdx = (monthIdx + 9) % 12;

      if (recordFYStart === selectedYear) {
        data[relativeMonthIdx].budget += amt;
        data[relativeMonthIdx].actuals += actualsAmt;
      }
    });

    if (isCurrentFY) {
      data = data.filter((_, relativeMonthIdx) => {
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
  }, [budgetData, selectedProgram, chartFYFilter, actualCurrentFYStartYear, now]);



  const [tableSearch, setTableSearch] = useState('');

  const MONTH_NAMES: Record<string, string> = {
    Apr: 'April', May: 'May', Jun: 'June', Jul: 'July',
    Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November',
    Dec: 'December', Jan: 'January', Feb: 'February', Mar: 'March'
  };
  const MONTH_ORDER = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

  // Resolve the active year string for calculations
  const activeYearStr = useMemo(() => {
    const fyYears = calculations.allFyYears || calculations.fyYears || [];
    return actualsSplitFilter || (fyYears.length > 0 ? String(fyYears[fyYears.length - 1]) : '');
  }, [calculations.allFyYears, calculations.fyYears, actualsSplitFilter]);

  // Monthly breakdown rows for selected FY
  const monthlyRows = useMemo(() => {
    const fyNum = activeYearStr ? Number(activeYearStr) : null;
    if (!fyNum) return [];
    const budgetMap = calculations.fyMonthBudgetMap?.[fyNum] || {};
    const actualsMap = calculations.fyMonthActualsMap?.[fyNum] || {};
    const allKeys = Array.from(new Set([...Object.keys(budgetMap), ...Object.keys(actualsMap)]));
    return allKeys
      .map(prefix => {
        const budgeted = budgetMap[prefix] || 0;
        const actuals = actualsMap[prefix] || 0;
        const deviation = budgeted - actuals; // Budget - Actual
        const deviationPct = budgeted !== 0 ? (deviation / budgeted) * 100 : actuals !== 0 ? -100 : 0;
        return { prefix, budgeted, actuals, deviation, deviationPct };
      })
      .sort((a, b) => MONTH_ORDER.indexOf(a.prefix) - MONTH_ORDER.indexOf(b.prefix));
  }, [activeYearStr, calculations]);

  // Program breakdown rows for selected month are calculated inline directly within monthlyRows mapping

  const filteredTableData = useMemo(() => {
    if (!calculations.tableData) return [];
    if (!tableSearch) return calculations.tableData;
    const term = tableSearch.toLowerCase();
    return calculations.tableData.map((uni: any) => {
      const filteredProgs = uni.programs.filter((p: any) =>
        p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term)
      );
      const uniMatches = uni.name.toLowerCase().includes(term);
      if (filteredProgs.length === 0 && !uniMatches) {
        return null;
      }
      return {
        ...uni,
        programs: uniMatches ? uni.programs : filteredProgs
      };
    }).filter(Boolean);
  }, [calculations.tableData, tableSearch]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const formatCompact = (val: number) => {
    if (val === 0) return '$0';
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    let result = '';
    if (absVal >= 1000000) {
      result = `$${(absVal / 1000000).toFixed(1)}M`;
    } else if (absVal >= 1000) {
      result = `$${(absVal / 1000).toFixed(1)}K`;
    } else {
      result = formatCurrency(absVal);
    }
    return isNegative ? `-${result}` : result;
  };

  const tillDateFormatted = useMemo(() => {
    const isActualFY = selectedFYStartYear === actualCurrentFYStartYear;
    const d = isActualFY ? now : new Date(selectedFYStartYear + 1, 2, 31);
    const mmm = d.toLocaleDateString('en-US', { month: 'short' });
    const yy = d.toLocaleDateString('en-US', { year: '2-digit' });
    return `${mmm}-${yy}`;
  }, [selectedFYStartYear, actualCurrentFYStartYear, now]);

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


  const activeActuals = (() => {
    const yearNum = Number(activeYearStr);
    return calculations.fyActualsMap[yearNum]?.total || 0;
  })();
  const activeIntl = (() => {
    const yearNum = Number(activeYearStr);
    return calculations.fyActualsMap[yearNum]?.intl || 0;
  })();
  const activeDom = (() => {
    const yearNum = Number(activeYearStr);
    return calculations.fyActualsMap[yearNum]?.dom || 0;
  })();

  return (
    <div className="max-w-6xl mx-auto py-2">
      {/* Header & Global Date */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">
            Budget <span className="text-indigo-700">Dashboard</span>
          </h1>
          <p className="text-slate-600 text-base font-medium opacity-80">Financial tracking and projections.</p>
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
                {loading ? <StatSkeleton /> : formatCompact(calculations.currentFYBudgeted)}
              </div>
              {!loading && (
                <div className="text-[11px] font-bold text-slate-400 tracking-wide mb-1">
                  ({formatCurrency(calculations.currentFYBudgeted)})
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
                {loading ? <StatSkeleton /> : formatCompact(calculations.currentFYUtilized)}
              </div>
              {!loading && (
                <div className="text-[11px] font-bold text-slate-400 tracking-wide mb-1">
                  ({formatCurrency(calculations.currentFYUtilized)})
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
                {loading ? <StatSkeleton /> : formatCompact(calculations.previousFYBudgeted)}
              </div>
              {!loading && (
                <div className="text-[11px] font-bold text-slate-400 tracking-wide mb-1">
                  ({formatCurrency(calculations.previousFYBudgeted)})
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
                {loading ? <StatSkeleton /> : formatCompact(calculations.previousFYUtilized)}
              </div>
              {!loading && (
                <div className="text-[11px] font-bold text-slate-400 tracking-wide mb-1">
                  ({formatCurrency(calculations.previousFYUtilized)})
                </div>
              )}
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest opacity-80 mt-1">{prevFYStartFormatted} to {prevFYEndFormatted}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actuals Split Section */}
      {!loading && calculations.lifetimeActuals > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
              Actuals Split
            </span>
            <div>
              <CustomDropdown
                value={actualsSplitFilter || activeYearStr}
                onChange={(val) => { setActualsSplitFilter(val); setSelectedMonth(null); }}
                options={[
                  ...(calculations.allFyYears || calculations.fyYears).map(year => {
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Card for International Actuals */}
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
                    {((activeIntl / ((activeIntl + activeDom) || 1)) * 100).toFixed(1)}% Share
                  </div>
                </div>
              </div>
            </div>

            {/* Card for Domestic Actuals */}
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
                    {((activeDom / ((activeIntl + activeDom) || 1)) * 100).toFixed(1)}% Share
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── Monthly Breakdown Table ── */}
      <div className="flex flex-col gap-6 mb-4">
        {/* Monthly Breakdown */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
          <div className="p-6 border-b border-slate-100 bg-slate-50/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
              <i className="fas fa-calendar-alt text-sm" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">Monthly Breakdown</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {activeYearStr
                  ? `FY (Apr-${String(activeYearStr).slice(-2)} to Mar-${String(Number(activeYearStr) + 1).slice(-2)}) · Click a month to see program breakdown`
                  : 'Select an FY from dropdown above to see monthly breakdown'}
              </p>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[800px] custom-scrollbar">
            <table className="w-full text-left border-collapse table-fixed">
              <thead className="sticky top-0 z-20">
                <tr className="border-b border-slate-200">
                  <th className="py-2.5 px-4 text-[9px] font-black text-slate-500 uppercase tracking-[0.12em] bg-slate-50 w-[20%]">Month</th>
                  <th className="py-2.5 px-4 text-[9px] font-black text-indigo-600 uppercase tracking-[0.12em] text-right bg-slate-50 w-[20%]">Budgeted</th>
                  <th className="py-2.5 px-4 text-[9px] font-black text-emerald-600 uppercase tracking-[0.12em] text-right bg-slate-50 w-[20%]">Actuals</th>
                  <th className="py-2.5 px-4 text-[9px] font-black text-orange-600 uppercase tracking-[0.12em] text-right bg-slate-50 w-[20%]">Deviation ($)</th>
                  <th className="py-2.5 px-4 text-[9px] font-black text-violet-600 uppercase tracking-[0.12em] text-right bg-slate-50 w-[20%]">Deviation %</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center">
                      <div className="inline-flex items-center gap-3 text-slate-400">
                        <i className="fas fa-circle-notch fa-spin text-lg text-indigo-500" />
                        <span className="text-xs font-bold uppercase tracking-wider">Loading Monthly Data...</span>
                      </div>
                    </td>
                  </tr>
                ) : monthlyRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic bg-slate-50/20">
                      No monthly data available for this FY
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Grand Totals row — pinned at top, below headers */}
                    {(() => {
                      const tb = monthlyRows.reduce((s, r) => s + r.budgeted, 0);
                      const ta = monthlyRows.reduce((s, r) => s + r.actuals, 0);
                      const tillDateRows = monthlyRows.filter(r => r.actuals > 0);
                      const tillDateBudget = tillDateRows.reduce((s, r) => s + r.budgeted, 0);
                      const tillDateActuals = tillDateRows.reduce((s, r) => s + r.actuals, 0);
                      const td2 = tillDateBudget - tillDateActuals; // Budget - Actual
                      const tdp = tillDateBudget !== 0 ? (td2 / tillDateBudget) * 100 : 0;
                      const isOverBudget = td2 < 0;
                      const isUnderBudget = td2 > 0;
                      const hasAny = ta > 0;
                      return (
                        <tr className="border-b-2 border-slate-200 bg-slate-50/90 hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-4">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Total</span>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="text-[12px] font-black text-indigo-600" title={formatCurrency(tb)}>{formatCompact(tb)}</div>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {hasAny ? (
                              <div className="text-[12px] font-black text-emerald-600" title={formatCurrency(ta)}>{formatCompact(ta)}</div>
                            ) : <span className="text-[11px] font-bold text-slate-300">—</span>}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {hasAny ? (
                              <div className="text-[12px] font-black text-orange-600" title={formatCurrency(td2)}>
                                {td2 > 0 ? '+' : ''}{formatCompact(td2)}
                              </div>
                            ) : <span className="text-[11px] font-bold text-slate-300">—</span>}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            {hasAny ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black text-violet-600 bg-violet-50">
                                {isOverBudget ? <i className="fas fa-arrow-up text-[8px]" /> : isUnderBudget ? <i className="fas fa-arrow-down text-[8px]" /> : null}
                                {Math.abs(tdp).toFixed(1)}%
                              </span>
                            ) : <span className="text-[11px] font-bold text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    })()}

                    {monthlyRows.map(row => {
                      const isSelected = selectedMonth === row.prefix;
                      const hasActuals = row.actuals > 0;
                      const isOverBudget = row.deviation < 0;
                      const isUnderBudget = row.deviation > 0;

                      // Build inline program rows for this month
                      const fyNum = activeYearStr ? Number(activeYearStr) : null;
                      const progMap = fyNum ? (calculations.fyMonthProgramMap?.[fyNum]?.[row.prefix] || {}) : {};
                      const inlineProgRows = Object.entries(progMap)
                        .map(([id, data]: [string, any]) => {
                          const dev = data.budgeted - data.actuals; // Budget - Actual
                          const devPct = data.budgeted !== 0 ? (dev / data.budgeted) * 100 : data.actuals !== 0 ? -100 : 0;
                          return { id, name: data.name, budgeted: data.budgeted, actuals: data.actuals, deviation: dev, deviationPct: devPct };
                        })
                        .filter(r => r.budgeted !== 0 || r.actuals !== 0)
                        .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

                      return (
                        <Fragment key={row.prefix}>
                          {/* ── Month Row ── */}
                          <tr
                            onClick={() => setSelectedMonth(isSelected ? null : row.prefix)}
                            className={`border-b border-slate-100 transition-all border-l-4 cursor-pointer group ${
                              isSelected
                                ? 'bg-indigo-50/60 border-indigo-500'
                                : 'border-transparent hover:bg-slate-50/80 hover:border-indigo-400/40'
                            }`}
                          >
                            <td className="py-2.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-white text-[8px] shadow-sm transition-all duration-200 ${
                                  isSelected ? 'bg-indigo-900' : 'bg-slate-800 group-hover:bg-slate-900'
                                }`}>
                                  <i className={`fas ${isSelected ? 'fa-chevron-down' : 'fa-calendar-day'}`} />
                                </div>
                                <span className={`text-[12px] font-bold uppercase tracking-wide transition-colors ${
                                  isSelected ? 'text-indigo-900 font-extrabold' : 'text-slate-900 group-hover:text-indigo-900'
                                }`}>
                                  {MONTH_NAMES[row.prefix] || row.prefix}
                                </span>
                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200/60 ml-2 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100" title={`${inlineProgRows.length} active programs`}>
                                  {inlineProgRows.length} {inlineProgRows.length === 1 ? 'Prog' : 'Progs'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="text-[12px] font-black text-indigo-600" title={formatCurrency(row.budgeted)}>{formatCompact(row.budgeted)}</div>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {hasActuals ? (
                                <div className="text-[12px] font-black text-emerald-600" title={formatCurrency(row.actuals)}>{formatCompact(row.actuals)}</div>
                              ) : <span className="text-[11px] font-bold text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {hasActuals ? (
                                <div className="text-[12px] font-black text-orange-600" title={formatCurrency(row.deviation)}>
                                  {row.deviation > 0 ? '+' : ''}{formatCompact(row.deviation)}
                                </div>
                              ) : <span className="text-[11px] font-bold text-slate-300">—</span>}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {hasActuals ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black text-violet-600 bg-violet-50">
                                  {isOverBudget ? <i className="fas fa-arrow-up text-[8px]" /> : isUnderBudget ? <i className="fas fa-arrow-down text-[8px]" /> : null}
                                  {Math.abs(row.deviationPct).toFixed(1)}%
                                </span>
                              ) : <span className="text-[11px] font-bold text-slate-300">—</span>}
                            </td>
                          </tr>

                          {/* ── Inline Program Breakdown (accordion) ── */}
                          {isSelected && (
                            <tr key={`prog-details-${row.prefix}`} className="bg-slate-50/40 border-l-4 border-indigo-500 border-b border-slate-100">
                              <td colSpan={5} className="p-5 pl-12 pr-6">
                                <div className="flex flex-col gap-4">
                                  {/* Expanded Header & Subtotal Overview */}
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-slate-100/80 shadow-sm">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                                        <i className="fas fa-cubes text-xs" />
                                      </div>
                                      <div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Monthly Program Breakdown</span>
                                        <div className="text-sm font-black text-slate-800 tracking-tight mt-0.5">
                                          {MONTH_NAMES[row.prefix] || row.prefix} Allocation
                                        </div>
                                      </div>
                                    </div>

                                    {(() => {
                                      const ptb = inlineProgRows.reduce((s, r) => s + r.budgeted, 0);
                                      const pta = inlineProgRows.reduce((s, r) => s + r.actuals, 0);
                                      const ptd = ptb - pta;
                                      const ptdp = ptb !== 0 ? (ptd / ptb) * 100 : 0;
                                      const ptOverBudget = ptd < 0;
                                      const ptUnderBudget = ptd > 0;
                                      const ptHas = pta > 0;

                                      return (
                                        <div className="flex items-center gap-6 divide-x divide-slate-100">
                                          <div className="text-right">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Budgeted</span>
                                            <div className="text-xs font-black text-indigo-600 mt-1" title={formatCurrency(ptb)}>{formatCompact(ptb)}</div>
                                          </div>
                                          <div className="pl-6 text-right">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Actuals</span>
                                            <div className="text-xs font-black text-slate-700 mt-1" title={formatCurrency(pta)}>{ptHas ? formatCompact(pta) : '—'}</div>
                                          </div>
                                          <div className="pl-6 text-right">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Deviation</span>
                                            <div className={`text-xs font-black mt-1 ${ptHas ? (ptd >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-300'}`} title={formatCurrency(ptd)}>
                                              {ptHas ? `${ptd > 0 ? '+' : ''}${formatCompact(ptd)}` : '—'}
                                            </div>
                                          </div>
                                          <div className="pl-6 text-right">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Dev %</span>
                                            <div className="mt-1">
                                              {ptHas ? (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black ${ptd >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'}`}>
                                                  {ptOverBudget ? <i className="fas fa-arrow-up text-[7px]" /> : ptUnderBudget ? <i className="fas fa-arrow-down text-[7px]" /> : null}
                                                  {Math.abs(ptdp).toFixed(1)}%
                                                </span>
                                              ) : <span className="text-xs font-bold text-slate-300">—</span>}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  {/* Program Cards Grid */}
                                  {inlineProgRows.length === 0 ? (
                                    <div className="py-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest italic bg-white/40 rounded-2xl border border-dashed border-slate-200">
                                      No program data for this month
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                      {inlineProgRows.map(prog => {
                                        const theme = PROGRAM_THEMES[prog.id] || defaultTheme;
                                        const pOverBudget = prog.deviation < 0;
                                        const pUnderBudget = prog.deviation > 0;
                                        const pHas = prog.actuals > 0;
                                        const devColorClass = prog.deviation >= 0 ? 'text-emerald-600' : 'text-rose-600';
                                        const devBgClass = prog.deviation >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';

                                        return (
                                          <div
                                            key={`prog-card-${prog.id}-${row.prefix}`}
                                            className="group relative bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-indigo-100 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigate(`/lex/budget/${prog.id}?fy=${activeYearStr}`);
                                            }}
                                          >
                                            <div className="flex items-start justify-between gap-2 mb-3">
                                              <div className="flex items-center gap-2">
                                                <div className={`w-7 h-7 rounded-xl ${theme.bg} ${theme.border} border flex items-center justify-center shrink-0 shadow-sm`}>
                                                  <i className={`fas ${theme.icon} ${theme.text} text-xs`} />
                                                </div>
                                                <div>
                                                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wide group-hover:text-indigo-600 transition-colors line-clamp-1 leading-snug">
                                                    {prog.name}
                                                  </h4>
                                                </div>
                                              </div>
                                              <div className="w-5 h-5 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                                                <i className="fas fa-arrow-right text-[8px]" />
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-50">
                                              <div>
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none">Budgeted</span>
                                                <span className="text-[11px] font-bold text-indigo-600 block mt-1" title={formatCurrency(prog.budgeted)}>
                                                  {formatCompact(prog.budgeted)}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none">Actuals</span>
                                                <span className="text-[11px] font-bold text-slate-700 block mt-1" title={formatCurrency(prog.actuals)}>
                                                  {pHas ? formatCompact(prog.actuals) : '—'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none">Deviation</span>
                                                <span className={`text-[11px] font-bold block mt-1 ${pHas ? devColorClass : 'text-slate-300'}`} title={formatCurrency(prog.deviation)}>
                                                  {pHas ? `${prog.deviation > 0 ? '+' : ''}${formatCompact(prog.deviation)}` : '—'}
                                                </span>
                                              </div>
                                              <div>
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none">Dev %</span>
                                                <div className="mt-1">
                                                  {pHas ? (
                                                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black ${devBgClass}`}>
                                                      {pOverBudget ? <i className="fas fa-arrow-up text-[6px]" /> : pUnderBudget ? <i className="fas fa-arrow-down text-[6px]" /> : null}
                                                      {Math.abs(prog.deviationPct).toFixed(1)}%
                                                    </span>
                                                  ) : (
                                                    <span className="text-[11px] font-medium text-slate-300 block">—</span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Trend Analysis Section */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
            Trend Analysis
          </span>
          <div>
            <CustomDropdown
              value={chartFYFilter}
              onChange={setChartFYFilter}
              options={calculations.fyYears.map(year => {
                const startFormatted = `Apr-${String(year).slice(-2)}`;
                const endFormatted = `Mar-${String(year + 1).slice(-2)}`;
                return {
                  value: String(year),
                  label: `FY (${startFormatted} to ${endFormatted})`
                };
              })}
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
                  <linearGradient id="colorBudget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorActuals" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#colorBudget)"
                  animationDuration={1500}
                />
                <Area
                  type="monotone"
                  dataKey="actuals"
                  name="Actual"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorActuals)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
