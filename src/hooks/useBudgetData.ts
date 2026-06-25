import { useEffect, useState, useMemo } from 'react';
import { PROGRAMS, SHEET_TABS } from '../lib/config';
import { fetchSheetTab } from '../lib/sheets';
import { UNIVERSITIES } from '../lib/universities';

export interface BudgetRow {
  _programId: string;
  _programName: string;
  _universityId: string;
  Cohort: string;
  Month: string;
  'Month Number': string;
  'Total Learners'?: string | number;
  '# Learners'?: string | number;
  'Total Budget ($)': string | number;
  [key: string]: any;
}

export function useBudgetData(universityId?: string | null) {
  const [budgetData, setBudgetData] = useState<BudgetRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        let programKeys = Object.keys(PROGRAMS);

        if (universityId) {
          const university = UNIVERSITIES.find(u => u.id === universityId);
          if (university) {
            const uniProgramIds = university.programs.map(p => p.id);
            programKeys = programKeys.filter(k => uniProgramIds.includes(k));
          }
        }

        const promises = programKeys.map(async (key) => {
          const config = PROGRAMS[key];
          if (!config.sheetId) return [];

          // Find university id for this program
          const uni = UNIVERSITIES.find(u => u.programs.some(p => p.id === key));
          const _universityId = uni ? uni.id : '';

          try {
            const rows = await fetchSheetTab({ spreadsheetId: config.sheetId, sheetName: SHEET_TABS.budget });
            return rows.map(r => ({
              ...r,
              _programId: key,
              _programName: config.name,
              _universityId
            }));
          } catch (err) {
            console.warn(`Failed to fetch budget for program ${key}`, err);
            return [];
          }
        });

        const results = await Promise.all(promises);
        if (cancelled) return;

        const combined = results.flat() as BudgetRow[];
        setBudgetData(combined);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Unknown error fetching budget data');
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [universityId]);

  return { loading, error, budgetData: budgetData ?? [] };
}

export function useProgramBudgetData(programId: string, fyStartYear?: number) {
  const { budgetData, loading, error } = useBudgetData();

  const parsedData = useMemo(() => {
    if (!budgetData || budgetData.length === 0) return { cohorts: [], programStats: null, programActuals: null, detailsConsumption: [] };

    const programRows = budgetData.filter(r => r._programId === programId);
    if (programRows.length === 0) return { cohorts: [], programStats: null, programActuals: null, detailsConsumption: [] };

    const parseBudget = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      const s = val.toString().replace(/[\$,]/g, '').trim();
      const num = parseFloat(s);
      return isNaN(num) ? 0 : num;
    };

    const parseMonthString = (monthStr: string) => {
      if (!monthStr) return new Date(NaN);
      const s = monthStr.toString().trim();
      if (s.includes('-')) {
        const parts = s.split('-');
        if (parts.length === 2) {
          const [mon, yr] = parts;
          let year = parseInt(yr);
          if (!isNaN(year) && year < 100) year += 2000;
          return new Date(`${mon} 1, ${year}`);
        }
      }
      return new Date(s);
    };

    const now = (() => {
      const today = new Date();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      return today.getDate() === lastDay ? today : new Date(today.getFullYear(), today.getMonth(), 0);
    })();
    const actualCurrentFYStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const selectedFYStartYear = fyStartYear || actualCurrentFYStartYear;

    const currFYStart = new Date(selectedFYStartYear, 3, 1);
    const currFYEnd = new Date(selectedFYStartYear + 1, 2, 31);
    const prevFYStart = new Date(selectedFYStartYear - 1, 3, 1);
    const prevFYEnd = new Date(selectedFYStartYear, 2, 31);

    const isActualFY = selectedFYStartYear === actualCurrentFYStartYear;
    const tillDate = isActualFY ? now : currFYEnd;

    const cohortMap: Record<string, any> = {};
    let totalProgramBudget = 0;
    let currentFYProgramBudget = 0;
    let previousFYProgramBudget = 0;
    let projectedProgramBudget = 0;

    let currentFYBudgeted = 0;
    let currentFYUtilized = 0;
    let previousFYBudgeted = 0;
    let previousFYUtilized = 0;

    const excludeKeys = [
      '_programId', '_programName', '_universityId', 'Cohort', 'Month',
      'Month Number', '# Learners', 'Total Learners', 'International Learners', 'Domestic Learners',
      'Study Abroad Learners', 'Cohort ID',
      'Total Budget ($)', 'Total Budget', 'International Budget', 'Domestic Budget', 'Study Abroad Budget',
      'Fixed Cost ($)', 'Fixed Cost', 'Fixed',
      'Variable Cost ($)', 'Variable Cost', 'Variable',
      'rowNumber'
    ];
    const programDynamicTotals: Record<string, number> = {};

    // Program-level actuals totals
    let programTotalActuals = 0;
    let programActualsInternational = 0;
    let programActualsDomestic = 0;
    let programActualsLiveSession = 0;
    let programActualsAssignmentGrading = 0;
    let programActualsThesisSupervision = 0;
    let programActualsDoubtResolution = 0;
    let programActualsTA = 0;
    let programActualsOthers = 0;
    let programActualsEventsImmersion = 0;
    let minActualsDate = Infinity;
    let maxActualsDate = -Infinity;
    const programActualsBifurcation: Record<string, number> = {};
    const programFyActualsMap: Record<number, { total: number; intl: number; dom: number; studyAbroad: number }> = {};

    // Per-FY budget bifurcation map (cost columns by FY)
    const programBudgetBifurcation: Record<string, number> = {};
    const fyBudgetBifurcationMap: Record<number, Record<string, number>> = {};
    // Per-FY actuals bifurcation map
    const fyActualsBifurcationMap: Record<number, Record<string, number>> = {};

    // Per-FY per-Month actuals map: fyYear → monthStr → { total, intl, dom, studyAbroad, bifurcation }
    const fyMonthActualsMap: Record<number, Record<string, { total: number; intl: number; dom: number; studyAbroad: number; bifurcation: Record<string, number> }>> = {};
    // Per-FY per-Month budget bifurcation map: fyYear → monthStr → { costKey: value }
    const fyMonthBudgetBifurcationMap: Record<number, Record<string, Record<string, number>>> = {};
    // Per-FY budget totals map
    const fyBudgetMap: Record<number, { total: number; intl: number; dom: number; studyAbroad: number }> = {};
    // Per-FY per-Month budget totals map
    const fyMonthBudgetMap: Record<number, Record<string, { total: number; intl: number; dom: number; studyAbroad: number }>> = {};

    programRows.forEach(row => {
      const d = parseMonthString(row.Month);
      if (isNaN(d.getTime())) return;

      const amt = parseBudget(row['Total Budget ($)']);
      const actualsAmt = parseBudget(row['Total Actuals']);
      const cohort = row.Cohort || 'Unknown Cohort';

      if (!cohortMap[cohort]) {
        cohortMap[cohort] = {
          name: cohort,
          utilized: 0,
          fullTotal: 0,
          currentFY: 0,
          previousFY: 0,
          projected: 0,
          months: [],
          earliestDate: d.getTime(),
          launchMonth: row.Month,
          totalActuals: 0,
          actualsInternational: 0,
          actualsDomestic: 0,
          currentFYBudgeted: 0,
          currentFYUtilized: 0,
          currentFYBudgetedTill: 0,
          previousFYBudgeted: 0,
          previousFYUtilized: 0
        };
      } else {
        if (d.getTime() < cohortMap[cohort].earliestDate) {
          cohortMap[cohort].earliestDate = d.getTime();
          cohortMap[cohort].launchMonth = row.Month;
        }
      }

      cohortMap[cohort].fullTotal += amt;

      if (d <= now) {
        cohortMap[cohort].utilized += amt;
        totalProgramBudget += amt;

        // Accumulate actuals
        const rowActuals = actualsAmt;
        const rowIntl = parseBudget(row['International']);
        const rowDom = parseBudget(row['Domestic']);
        const rowStudyAbroad = parseBudget(row['Study Abroad']);
        cohortMap[cohort].totalActuals += rowActuals;
        cohortMap[cohort].actualsInternational += rowIntl;
        cohortMap[cohort].actualsDomestic += rowDom;

        programTotalActuals += rowActuals;
        programActualsInternational += rowIntl;
        programActualsDomestic += rowDom;
        programActualsLiveSession += parseBudget(row['Live Session Cost Actuals']);
        programActualsAssignmentGrading += parseBudget(row['Assignment Grading Cost Actuals']);
        programActualsThesisSupervision += parseBudget(row['Thesis Supervision Cost Actuals']);
        programActualsDoubtResolution += parseBudget(row['Doubt Resolution Call Actuals']);
        programActualsTA += parseBudget(row['TA Actuals']);
        programActualsOthers += parseBudget(row['Others Actuals']);
        programActualsEventsImmersion += parseBudget(row['Events/Immersion Actuals']);

        // Collect dynamic actuals columns with "actual" in the name (except total/intl/dom)
        const fyStart2 = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
        if (!fyActualsBifurcationMap[fyStart2]) fyActualsBifurcationMap[fyStart2] = {};
        Object.keys(row).forEach(key => {
          const trimmedKey = key.trim();
          if (!trimmedKey) return;
          const lowerKey = trimmedKey.toLowerCase();
          if (lowerKey.includes('actual') &&
            !lowerKey.includes('total') &&
            !lowerKey.includes('intl') &&
            !lowerKey.includes('international') &&
            !lowerKey.includes('domestic') &&
            !lowerKey.includes('dom')) {
            const val = parseBudget(row[key]);
            programActualsBifurcation[trimmedKey] = (programActualsBifurcation[trimmedKey] || 0) + val;
            fyActualsBifurcationMap[fyStart2][trimmedKey] = (fyActualsBifurcationMap[fyStart2][trimmedKey] || 0) + val;
          }
        });

        if (rowActuals > 0) {
          const time = d.getTime();
          if (time < minActualsDate) minActualsDate = time;
          if (time > maxActualsDate) maxActualsDate = time;
        }

        const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
        if (!programFyActualsMap[fyStart]) {
          programFyActualsMap[fyStart] = { total: 0, intl: 0, dom: 0, studyAbroad: 0 };
        }
        programFyActualsMap[fyStart].total += rowActuals;
        programFyActualsMap[fyStart].intl += rowIntl;
        programFyActualsMap[fyStart].dom += rowDom;
        programFyActualsMap[fyStart].studyAbroad += rowStudyAbroad;

        // Per-month actuals tracking
        const monthStr = String(row.Month || '').trim();
        if (monthStr) {
          if (!fyMonthActualsMap[fyStart]) fyMonthActualsMap[fyStart] = {};
          if (!fyMonthActualsMap[fyStart][monthStr]) {
            fyMonthActualsMap[fyStart][monthStr] = { total: 0, intl: 0, dom: 0, studyAbroad: 0, bifurcation: {} };
          }
          fyMonthActualsMap[fyStart][monthStr].total += rowActuals;
          fyMonthActualsMap[fyStart][monthStr].intl += rowIntl;
          fyMonthActualsMap[fyStart][monthStr].dom += rowDom;
          fyMonthActualsMap[fyStart][monthStr].studyAbroad += rowStudyAbroad;
          // Actuals bifurcation per month
          Object.keys(row).forEach(key => {
            const tk = key.trim();
            if (!tk) return;
            const lk = tk.toLowerCase();
            if (lk.includes('actual') && !lk.includes('total') && !lk.includes('intl') && !lk.includes('international') && !lk.includes('domestic') && !lk.includes('dom')) {
              const val = parseBudget(row[key]);
              fyMonthActualsMap[fyStart][monthStr].bifurcation[tk] = (fyMonthActualsMap[fyStart][monthStr].bifurcation[tk] || 0) + val;
            }
          });
        }
      }

      // Current FY (from start of FY to either now or end of FY)
      if (d >= currFYStart && d <= tillDate) {
        cohortMap[cohort].currentFY += amt;
        currentFYProgramBudget += amt;
      }

      // Previous FY (full year)
      if (d >= prevFYStart && d <= prevFYEnd) {
        cohortMap[cohort].previousFY += amt;
        previousFYProgramBudget += amt;
      }

      // Projected (from tillDate to end of FY)
      if (d > tillDate && d <= currFYEnd) {
        cohortMap[cohort].projected += amt;
        projectedProgramBudget += amt;
      }

      const inCurrentFY = d >= currFYStart && d <= currFYEnd;
      const inPreviousFY = d >= prevFYStart && d <= prevFYEnd;

      if (inCurrentFY) {
        currentFYBudgeted += amt;
        cohortMap[cohort].currentFYBudgeted += amt;
        if (d <= now) {
          currentFYUtilized += actualsAmt;
          cohortMap[cohort].currentFYUtilized += actualsAmt;
          cohortMap[cohort].currentFYBudgetedTill += amt;
        }
      }
      if (inPreviousFY) {
        previousFYBudgeted += amt;
        previousFYUtilized += actualsAmt;
        cohortMap[cohort].previousFYBudgeted += amt;
        cohortMap[cohort].previousFYUtilized += actualsAmt;
      }

      // Collect per-FY budget cost bifurcation
      const fyStartBud = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      if (!fyBudgetBifurcationMap[fyStartBud]) fyBudgetBifurcationMap[fyStartBud] = {};
      const monthStrBud = String(row.Month || '').trim();
      if (monthStrBud) {
        if (!fyMonthBudgetBifurcationMap[fyStartBud]) fyMonthBudgetBifurcationMap[fyStartBud] = {};
        if (!fyMonthBudgetBifurcationMap[fyStartBud][monthStrBud]) fyMonthBudgetBifurcationMap[fyStartBud][monthStrBud] = {};
      }

      // Populate fyBudgetMap and fyMonthBudgetMap
      const intlBudget = parseBudget(row['International Budget']);
      const domBudget = parseBudget(row['Domestic Budget']);
      const studyAbroadBudget = parseBudget(row['Study Abroad Budget']);
      if (!fyBudgetMap[fyStartBud]) {
        fyBudgetMap[fyStartBud] = { total: 0, intl: 0, dom: 0, studyAbroad: 0 };
      }
      fyBudgetMap[fyStartBud].total += amt;
      fyBudgetMap[fyStartBud].intl += intlBudget;
      fyBudgetMap[fyStartBud].dom += domBudget;
      fyBudgetMap[fyStartBud].studyAbroad += studyAbroadBudget;

      if (monthStrBud) {
        if (!fyMonthBudgetMap[fyStartBud]) fyMonthBudgetMap[fyStartBud] = {};
        if (!fyMonthBudgetMap[fyStartBud][monthStrBud]) {
          fyMonthBudgetMap[fyStartBud][monthStrBud] = { total: 0, intl: 0, dom: 0, studyAbroad: 0 };
        }
        fyMonthBudgetMap[fyStartBud][monthStrBud].total += amt;
        fyMonthBudgetMap[fyStartBud][monthStrBud].intl += intlBudget;
        fyMonthBudgetMap[fyStartBud][monthStrBud].dom += domBudget;
        fyMonthBudgetMap[fyStartBud][monthStrBud].studyAbroad += studyAbroadBudget;
      }
      Object.keys(row).forEach(key => {
        const trimmedKey = key.trim();
        if (!trimmedKey) return;
        if (!trimmedKey.toLowerCase().includes('cost')) return;

        const isExcluded = excludeKeys.some(k => k.toLowerCase() === trimmedKey.toLowerCase()) || trimmedKey.toLowerCase().includes('actual');
        if (!isExcluded) {
          const val = parseBudget(row[key]);
          if (d <= now) {
            programDynamicTotals[trimmedKey] = (programDynamicTotals[trimmedKey] || 0) + val;
            programBudgetBifurcation[trimmedKey] = (programBudgetBifurcation[trimmedKey] || 0) + val;
          }
          fyBudgetBifurcationMap[fyStartBud][trimmedKey] = (fyBudgetBifurcationMap[fyStartBud][trimmedKey] || 0) + val;
          if (monthStrBud) {
            fyMonthBudgetBifurcationMap[fyStartBud][monthStrBud][trimmedKey] = (fyMonthBudgetBifurcationMap[fyStartBud][monthStrBud][trimmedKey] || 0) + val;
          }
        }
      });

      cohortMap[cohort].months.push({
        month: d,
        amount: amt,
        actuals: actualsAmt
      });
    });

    // Sort months for each cohort
    Object.values(cohortMap).forEach((c: any) => {
      c.months.sort((a: any, b: any) => a.month.getTime() - b.month.getTime());

      // Calculate cumulative for each month
      let cum = 0;
      c.months = c.months.map((m: any) => {
        cum += m.amount;
        return { ...m, cumulative: cum };
      });
    });

    return {
      cohorts: Object.values(cohortMap),
      programStats: {
        total: totalProgramBudget,
        currentFY: currentFYProgramBudget,
        previousFY: previousFYProgramBudget,
        projected: projectedProgramBudget,
        currentFYBudgeted,
        currentFYUtilized,
        previousFYBudgeted,
        previousFYUtilized
      },
      programActuals: {
        totalActuals: programTotalActuals,
        international: programActualsInternational,
        domestic: programActualsDomestic,
        liveSessionActuals: programActualsLiveSession,
        assignmentGradingActuals: programActualsAssignmentGrading,
        thesisSupervisionActuals: programActualsThesisSupervision,
        doubtResolutionActuals: programActualsDoubtResolution,
        taActuals: programActualsTA,
        othersActuals: programActualsOthers,
        eventsImmersionActuals: programActualsEventsImmersion,
        bifurcation: Object.entries(programActualsBifurcation).map(([name, value]) => ({ name, value })),
        minActualsDate: minActualsDate !== Infinity ? minActualsDate : null,
        maxActualsDate: maxActualsDate !== -Infinity ? maxActualsDate : null,
        fyYears: Object.keys(programFyActualsMap)
          .map(Number)
          .filter(year => programFyActualsMap[year].total > 0)
          .sort((a, b) => a - b),
        fyActualsMap: programFyActualsMap,
        fyActualsBifurcationMap,
        fyMonthActualsMap
      },
      programBudget: {
        bifurcation: Object.entries(programBudgetBifurcation).map(([name, value]) => ({ name, value })),
        fyBudgetBifurcationMap,
        fyMonthBudgetBifurcationMap,
        fyBudgetMap,
        fyMonthBudgetMap,
        fyYears: Object.keys(fyBudgetBifurcationMap)
          .map(Number)
          .sort((a, b) => a - b)
      },
      detailsConsumption: Object.entries(programDynamicTotals)
        .filter(([_, value]) => value > 0)
        .map(([name, value], index) => {
          const colors = [
            '#ec4899', '#8b5cf6', '#eab308', '#06b6d4', '#f97316', '#14b8a6',
            '#ef4444', '#3b82f6', '#84cc16', '#a855f7', '#f43f5e', '#0ea5e9'
          ];
          return {
            name,
            value,
            color: colors[index % colors.length]
          };
        })
        .sort((a, b) => b.value - a.value)
    };
  }, [budgetData, programId, fyStartYear]);

  return { loading, error, ...parsedData };
}
// All Actuals column names as they appear in the sheet
const ACTUALS_COLUMNS = [
  'Total Actuals',
  'International',
  'Domestic',
  'Live Session Cost Actuals',
  'Assignment Grading Cost Actuals',
  'Thesis Supervision Cost Actuals',
  'Doubt Resolution Call Actuals',
  'TA Actuals',
  'Others Actuals',
  'Events/Immersion Actuals'
] as const;

export type ActualsKey = typeof ACTUALS_COLUMNS[number];

export interface ActualsBreakdown {
  totalActuals: number;
  international: number;
  domestic: number;
  liveSessionActuals: number;
  assignmentGradingActuals: number;
  thesisSupervisionActuals: number;
  doubtResolutionActuals: number;
  taActuals: number;
  othersActuals: number;
  eventsImmersionActuals: number;
}

export function useCohortBudgetData(programId: string, cohortId: string, fyStartYear?: number) {
  const { budgetData, loading, error } = useBudgetData();

  const parsedData = useMemo(() => {
    if (!budgetData || budgetData.length === 0) return { months: [], stats: null, programActuals: null, programBudget: null, detailsConsumption: [] };

    const cohortRows = budgetData.filter(r => r._programId === programId && r.Cohort === cohortId);
    if (cohortRows.length === 0) return { months: [], stats: null, programActuals: null, programBudget: null, detailsConsumption: [] };

    const parseBudget = (val: any) => {
      if (!val) return 0;
      if (typeof val === 'number') return val;
      const s = val.toString().replace(/[\$,]/g, '').trim();
      const num = parseFloat(s);
      return isNaN(num) ? 0 : num;
    };

    const parseMonthString = (s: string) => {
      if (!s) return new Date(NaN);
      if (s.includes('-')) {
        const parts = s.split('-');
        if (parts.length === 2) {
          const [mon, yr] = parts;
          let year = parseInt(yr);
          if (!isNaN(year) && year < 100) year += 2000;
          return new Date(`${mon} 1, ${year}`);
        }
      }
      return new Date(s);
    };

    const now = (() => {
      const today = new Date();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      return today.getDate() === lastDay ? today : new Date(today.getFullYear(), today.getMonth(), 0);
    })();
    const actualCurrentFYStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const selectedFYStartYear = fyStartYear || actualCurrentFYStartYear;

    const currFYStart = new Date(selectedFYStartYear, 3, 1);
    const currFYEnd = new Date(selectedFYStartYear + 1, 2, 31);
    const prevFYStart = new Date(selectedFYStartYear - 1, 3, 1);
    const prevFYEnd = new Date(selectedFYStartYear, 2, 31);

    let totalUtilized = 0;
    let totalProjected = 0;

    let currentFYBudgeted = 0;
    let currentFYUtilized = 0;
    let previousFYBudgeted = 0;
    let previousFYUtilized = 0;

    // Cohort actuals totals and maps
    let programTotalActuals = 0;
    let programActualsInternational = 0;
    let programActualsDomestic = 0;
    let programActualsLiveSession = 0;
    let programActualsAssignmentGrading = 0;
    let programActualsThesisSupervision = 0;
    let programActualsDoubtResolution = 0;
    let programActualsTA = 0;
    let programActualsOthers = 0;
    let programActualsEventsImmersion = 0;
    let minActualsDate = Infinity;
    let maxActualsDate = -Infinity;
    const programActualsBifurcation: Record<string, number> = {};
    const programFyActualsMap: Record<number, { total: number; intl: number; dom: number; studyAbroad: number }> = {};

    // Per-FY budget bifurcation map (cost columns by FY)
    const programBudgetBifurcation: Record<string, number> = {};
    const fyBudgetBifurcationMap: Record<number, Record<string, number>> = {};
    // Per-FY actuals bifurcation map
    const fyActualsBifurcationMap: Record<number, Record<string, number>> = {};

    // Per-FY per-Month actuals map: fyYear → monthStr → { total, intl, dom, bifurcation }
    const fyMonthActualsMap: Record<number, Record<string, { total: number; intl: number; dom: number; studyAbroad: number; bifurcation: Record<string, number> }>> = {};
    // Per-FY per-Month budget bifurcation map: fyYear → monthStr → { costKey: value }
    const fyMonthBudgetBifurcationMap: Record<number, Record<string, Record<string, number>>> = {};
    // Per-FY budget totals map
    const fyBudgetMap: Record<number, { total: number; intl: number; dom: number; studyAbroad: number }> = {};
    // Per-FY per-Month budget totals map
    const fyMonthBudgetMap: Record<number, Record<string, { total: number; intl: number; dom: number; studyAbroad: number }>> = {};

    const dynamicTotals: Record<string, number> = {};
    const excludeKeys = [
      '_programId', '_programName', '_universityId', 'Cohort', 'Month',
      'Month Number', '# Learners', 'Total Learners', 'International Learners', 'Domestic Learners',
      'Study Abroad Learners', 'Cohort ID',
      'Total Budget ($)', 'Total Budget', 'International Budget', 'Domestic Budget', 'Study Abroad Budget',
      'Fixed Cost ($)', 'Fixed Cost', 'Fixed',
      'Variable Cost ($)', 'Variable Cost', 'Variable',
      'rowNumber'
    ];

    const months = cohortRows
      .filter(row => !isNaN(parseMonthString(row.Month).getTime()))
      .map(row => {
        const d = parseMonthString(row.Month);
        const amt = parseBudget(row['Total Budget ($)']);
        const actualsAmt = parseBudget(row['Total Actuals']);

      const inCurrentFY = d >= currFYStart && d <= currFYEnd;
      const inPreviousFY = d >= prevFYStart && d <= prevFYEnd;

      if (inCurrentFY) {
        currentFYBudgeted += amt;
        if (d <= now) {
          currentFYUtilized += actualsAmt;
        }
      }
      if (inPreviousFY) {
        previousFYBudgeted += amt;
        previousFYUtilized += actualsAmt;
      }

      if (d <= now) {
        totalUtilized += amt;

        // Accumulate actuals
        const rowActuals = actualsAmt;
        const rowIntl = parseBudget(row['International']);
        const rowDom = parseBudget(row['Domestic']);
        const rowStudyAbroad = parseBudget(row['Study Abroad']);

        programTotalActuals += rowActuals;
        programActualsInternational += rowIntl;
        programActualsDomestic += rowDom;
        programActualsLiveSession += parseBudget(row['Live Session Cost Actuals']);
        programActualsAssignmentGrading += parseBudget(row['Assignment Grading Cost Actuals']);
        programActualsThesisSupervision += parseBudget(row['Thesis Supervision Cost Actuals']);
        programActualsDoubtResolution += parseBudget(row['Doubt Resolution Call Actuals']);
        programActualsTA += parseBudget(row['TA Actuals']);
        programActualsOthers += parseBudget(row['Others Actuals']);
        programActualsEventsImmersion += parseBudget(row['Events/Immersion Actuals']);

        // Collect dynamic actuals columns with "actual" in the name
        const fyStart2 = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
        if (!fyActualsBifurcationMap[fyStart2]) fyActualsBifurcationMap[fyStart2] = {};
        Object.keys(row).forEach(key => {
          const trimmedKey = key.trim();
          if (!trimmedKey) return;
          const lowerKey = trimmedKey.toLowerCase();
          if (lowerKey.includes('actual') &&
            !lowerKey.includes('total') &&
            !lowerKey.includes('intl') &&
            !lowerKey.includes('international') &&
            !lowerKey.includes('domestic') &&
            !lowerKey.includes('dom')) {
            const val = parseBudget(row[key]);
            programActualsBifurcation[trimmedKey] = (programActualsBifurcation[trimmedKey] || 0) + val;
            fyActualsBifurcationMap[fyStart2][trimmedKey] = (fyActualsBifurcationMap[fyStart2][trimmedKey] || 0) + val;
          }
        });

        if (rowActuals > 0) {
          const time = d.getTime();
          if (time < minActualsDate) minActualsDate = time;
          if (time > maxActualsDate) maxActualsDate = time;
        }

        const fyStart = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
        if (!programFyActualsMap[fyStart]) {
          programFyActualsMap[fyStart] = { total: 0, intl: 0, dom: 0, studyAbroad: 0 };
        }
        programFyActualsMap[fyStart].total += rowActuals;
        programFyActualsMap[fyStart].intl += rowIntl;
        programFyActualsMap[fyStart].dom += rowDom;
        programFyActualsMap[fyStart].studyAbroad += rowStudyAbroad;

        // Per-month actuals tracking
        const monthStr = String(row.Month || '').trim();
        if (monthStr) {
          if (!fyMonthActualsMap[fyStart]) fyMonthActualsMap[fyStart] = {};
          if (!fyMonthActualsMap[fyStart][monthStr]) {
            fyMonthActualsMap[fyStart][monthStr] = { total: 0, intl: 0, dom: 0, studyAbroad: 0, bifurcation: {} };
          }
          fyMonthActualsMap[fyStart][monthStr].total += rowActuals;
          fyMonthActualsMap[fyStart][monthStr].intl += rowIntl;
          fyMonthActualsMap[fyStart][monthStr].dom += rowDom;
          fyMonthActualsMap[fyStart][monthStr].studyAbroad += rowStudyAbroad;
          // Actuals bifurcation per month
          Object.keys(row).forEach(key => {
            const tk = key.trim();
            if (!tk) return;
            const lk = tk.toLowerCase();
            if (lk.includes('actual') && !lk.includes('total') && !lk.includes('intl') && !lk.includes('international') && !lk.includes('domestic') && !lk.includes('dom')) {
              const val = parseBudget(row[key]);
              fyMonthActualsMap[fyStart][monthStr].bifurcation[tk] = (fyMonthActualsMap[fyStart][monthStr].bifurcation[tk] || 0) + val;
            }
          });
        }
      } else {
        totalProjected += amt;
      }

      // Collect per-FY budget cost bifurcation
      const fyStartBud = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
      if (!fyBudgetBifurcationMap[fyStartBud]) fyBudgetBifurcationMap[fyStartBud] = {};
      const monthStrBud = String(row.Month || '').trim();
      if (monthStrBud) {
        if (!fyMonthBudgetBifurcationMap[fyStartBud]) fyMonthBudgetBifurcationMap[fyStartBud] = {};
        if (!fyMonthBudgetBifurcationMap[fyStartBud][monthStrBud]) fyMonthBudgetBifurcationMap[fyStartBud][monthStrBud] = {};
      }

      // Populate fyBudgetMap and fyMonthBudgetMap
      const intlBudget = parseBudget(row['International Budget']);
      const domBudget = parseBudget(row['Domestic Budget']);
      const studyAbroadBudget = parseBudget(row['Study Abroad Budget']);
      if (!fyBudgetMap[fyStartBud]) {
        fyBudgetMap[fyStartBud] = { total: 0, intl: 0, dom: 0, studyAbroad: 0 };
      }
      fyBudgetMap[fyStartBud].total += amt;
      fyBudgetMap[fyStartBud].intl += intlBudget;
      fyBudgetMap[fyStartBud].dom += domBudget;
      fyBudgetMap[fyStartBud].studyAbroad += studyAbroadBudget;

      if (monthStrBud) {
        if (!fyMonthBudgetMap[fyStartBud]) fyMonthBudgetMap[fyStartBud] = {};
        if (!fyMonthBudgetMap[fyStartBud][monthStrBud]) {
          fyMonthBudgetMap[fyStartBud][monthStrBud] = { total: 0, intl: 0, dom: 0, studyAbroad: 0 };
        }
        fyMonthBudgetMap[fyStartBud][monthStrBud].total += amt;
        fyMonthBudgetMap[fyStartBud][monthStrBud].intl += intlBudget;
        fyMonthBudgetMap[fyStartBud][monthStrBud].dom += domBudget;
        fyMonthBudgetMap[fyStartBud][monthStrBud].studyAbroad += studyAbroadBudget;
      }

      Object.keys(row).forEach(key => {
        const trimmedKey = key.trim();
        if (!trimmedKey) return;
        if (!trimmedKey.toLowerCase().includes('cost')) return;

        const isExcluded = excludeKeys.some(k => k.toLowerCase() === trimmedKey.toLowerCase()) || trimmedKey.toLowerCase().includes('actual');
        if (!isExcluded) {
          const val = parseBudget(row[key]);
          if (d <= now) {
            dynamicTotals[trimmedKey] = (dynamicTotals[trimmedKey] || 0) + val;
            programBudgetBifurcation[trimmedKey] = (programBudgetBifurcation[trimmedKey] || 0) + val;
          }
          fyBudgetBifurcationMap[fyStartBud][trimmedKey] = (fyBudgetBifurcationMap[fyStartBud][trimmedKey] || 0) + val;
          if (monthStrBud) {
            fyMonthBudgetBifurcationMap[fyStartBud][monthStrBud][trimmedKey] = (fyMonthBudgetBifurcationMap[fyStartBud][monthStrBud][trimmedKey] || 0) + val;
          }
        }
      });

      return {
        month: d,
        amount: amt,
        actuals: actualsAmt,
        learners: parseBudget(row['Total Learners'] !== undefined ? row['Total Learners'] : row['# Learners'])
      };
    }).sort((a, b) => a.month.getTime() - b.month.getTime());

    let cum = 0;
    const processedMonths = months.map(m => {
      cum += m.amount;
      return { ...m, cumulative: cum };
    });

    const totalBudget = totalUtilized + totalProjected;

    return {
      months: processedMonths,
      stats: {
        totalBudget,
        totalUtilized,
        totalProjected,
        utilizationRate: totalBudget > 0 ? (totalUtilized / totalBudget) * 100 : 0,
        currentFYBudgeted,
        currentFYUtilized,
        previousFYBudgeted,
        previousFYUtilized
      },
      programActuals: {
        totalActuals: programTotalActuals,
        international: programActualsInternational,
        domestic: programActualsDomestic,
        liveSessionActuals: programActualsLiveSession,
        assignmentGradingActuals: programActualsAssignmentGrading,
        thesisSupervisionActuals: programActualsThesisSupervision,
        doubtResolutionActuals: programActualsDoubtResolution,
        taActuals: programActualsTA,
        othersActuals: programActualsOthers,
        eventsImmersionActuals: programActualsEventsImmersion,
        bifurcation: Object.entries(programActualsBifurcation).map(([name, value]) => ({ name, value })),
        minActualsDate: minActualsDate !== Infinity ? minActualsDate : null,
        maxActualsDate: maxActualsDate !== -Infinity ? maxActualsDate : null,
        fyYears: Object.keys(programFyActualsMap)
          .map(Number)
          .filter(year => programFyActualsMap[year].total > 0)
          .sort((a, b) => a - b),
        fyActualsMap: programFyActualsMap,
        fyActualsBifurcationMap,
        fyMonthActualsMap
      },
      programBudget: {
        bifurcation: Object.entries(programBudgetBifurcation).map(([name, value]) => ({ name, value })),
        fyBudgetBifurcationMap,
        fyMonthBudgetBifurcationMap,
        fyBudgetMap,
        fyMonthBudgetMap,
        fyYears: Object.keys(fyBudgetBifurcationMap)
          .map(Number)
          .sort((a, b) => a - b)
      },
      detailsConsumption: Object.entries(dynamicTotals)
        .filter(([_, value]) => value > 0)
        .map(([name, value], index) => {
          const colors = [
            '#ec4899', '#8b5cf6', '#eab308', '#06b6d4', '#f97316', '#14b8a6',
            '#ef4444', '#3b82f6', '#84cc16', '#a855f7', '#f43f5e', '#0ea5e9'
          ];
          return {
            name,
            value,
            color: colors[index % colors.length]
          };
        })
        .sort((a, b) => b.value - a.value)
    };
  }, [budgetData, programId, cohortId, fyStartYear]);

  return { loading, error, ...parsedData };
}
