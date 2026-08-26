import { useMemo } from 'react';
import { useGGUStudentList } from './useGGUStudentList';
import {
  STATUS_LEVEL_DETAILS as BASELINE_STATUS_DETAILS,
  STATUS_LEVEL_TOTALS as BASELINE_STATUS_TOTALS,
  RETENTION_ACTIVE_COHORT as BASELINE_RETENTION_ACTIVE,
  RETENTION_ACTIVE_TOTAL as BASELINE_RETENTION_ACTIVE_TOTAL,
  HISTORICAL_RETENTION as BASELINE_HISTORICAL_RETENTION,
  HISTORICAL_RETENTION_TOTAL as BASELINE_HISTORICAL_RETENTION_TOTAL,
  CLOSED_COHORT_GRADUATION as BASELINE_CLOSED_GRADUATION,
  CLOSED_COHORT_TOTAL as BASELINE_CLOSED_TOTAL,
  ACTIVE_COHORT_GRADUATION as BASELINE_ACTIVE_GRADUATION,
  ACTIVE_COHORT_GRADUATION_TOTAL as BASELINE_ACTIVE_GRADUATION_TOTAL,
  COHORT_COUNTS as BASELINE_COHORT_COUNTS,
  COHORT_COUNTS_TOTAL as BASELINE_COHORT_TOTAL,
  TERM_LEVEL_ACTIVE as BASELINE_TERM_LEVEL_ACTIVE,
  type ProgramStatusRow,
  type RetentionRow,
  type GraduationRow,
  type CohortCountRow,
  type TermActiveRow,
} from '../lib/gguOverviewData';
import { v, normalizeSecondaryStatus, isLearnerActive, isLearnerGraduated } from '../lib/logic';

const GGU_PROGRAMS = [
  'GGU DBA',
  'GGU MBA',
  'GGU DBA ET',
  'GGU MPsych',
  'GGU DBA DL',
  'GGU SJD',
  'GGU MBA SA',
  'GGU Bachelors SA',
];

/** Extract Program from Column T (or Program column) */
function getRowProgram(r: Record<string, string>): string {
  if (r['Program'] && r['Program'].trim()) return r['Program'].trim();
  
  for (const k of Object.keys(r)) {
    const lk = k.toLowerCase().trim();
    if (lk === 'program' || lk === 'program_name' || lk === 'program name' || lk === 'col_19') {
      if (r[k] && r[k].trim()) return r[k].trim();
    }
  }

  const keys = Object.keys(r);
  if (keys[19] && r[keys[19]] && r[keys[19]].trim()) return r[keys[19]].trim();

  return v(r, 'Program', 'program_name', 'programname', 'course') || '';
}

/** Extract Status (prefer Column U GGU Data Type, then Actual Status from Column R) */
function getRowStatus(r: Record<string, string>): string {
  const colU = v(r, 'GGU Data Type', 'ggu_data_type', 'col_20');
  if (colU && colU.trim()) {
    const normU = colU.trim().toLowerCase();
    if (normU === 'active') return 'Active';
  }
  if (r['Actual Status'] && r['Actual Status'].trim()) return r['Actual Status'].trim();
  if (r['Secondary Status'] && r['Secondary Status'].trim()) return r['Secondary Status'].trim();
  if (r['Status'] && r['Status'].trim()) return r['Status'].trim();

  for (const k of Object.keys(r)) {
    const lk = k.toLowerCase().trim();
    if (lk === 'actual status' || lk === 'actual_status' || lk === 'secondary status' || lk === 'status' || lk === 'student status' || lk === 'col_17' || lk === 'col_12') {
      if (r[k] && r[k].trim()) return r[k].trim();
    }
  }

  return v(r, 'Actual Status', 'actual_status', 'Secondary Status', 'secondary_status', 'Status', 'student_status', 'active_status') || '';
}

/** Extract Country from Column N ("Country Of Residence") */
function getRowCountry(r: Record<string, string>): string {
  // 1. Check exact key 'Country Of Residence' (Column N in GGU Sheet)
  if (r['Country Of Residence'] && r['Country Of Residence'].trim()) {
    return r['Country Of Residence'].trim();
  }

  // 2. Check 14th column (index 13 = Column N)
  const keys = Object.keys(r);
  if (keys[13] && r[keys[13]] && r[keys[13]].trim()) {
    return r[keys[13]].trim();
  }

  // 3. Search all keys for any key containing "country" or "residence"
  for (const k of keys) {
    const lk = k.toLowerCase().trim();
    if (lk.includes('country') || lk.includes('residence') || lk === 'col_13') {
      if (r[k] && r[k].trim()) return r[k].trim();
    }
  }

  return v(r, 'Country Of Residence', 'Country', 'country_name', 'current_country', 'nationality') || '';
}

/** Extract Term from raw sheet record */
function getRowTerm(r: Record<string, string>): string {
  if (r['Term'] && r['Term'].trim()) return r['Term'].trim();
  if (r['Intake Term'] && r['Intake Term'].trim()) return r['Intake Term'].trim();
  if (r['Term Code'] && r['Term Code'].trim()) return r['Term Code'].trim();

  for (const k of Object.keys(r)) {
    const lk = k.toLowerCase().trim();
    if (lk.includes('term') || lk.includes('cohort')) {
      if (r[k] && r[k].trim()) return r[k].trim();
    }
  }

  return v(r, 'Term', 'intake_term', 'term_code', 'cohort') || '';
}

export interface GGUOverviewAnalyticsResult {
  loading: boolean;
  totalRawRows: number;
  isCalculatedLive: boolean;
  allCountries: string[];
  statusDetails: ProgramStatusRow[];
  statusTotals: typeof BASELINE_STATUS_TOTALS;
  retentionActiveCohort: RetentionRow[];
  retentionActiveTotal: typeof BASELINE_RETENTION_ACTIVE_TOTAL;
  historicalRetention: RetentionRow[];
  historicalRetentionTotal: typeof BASELINE_HISTORICAL_RETENTION_TOTAL;
  closedCohortGraduation: GraduationRow[];
  closedCohortTotal: typeof BASELINE_CLOSED_TOTAL;
  activeCohortGraduation: GraduationRow[];
  activeCohortTotal: typeof BASELINE_ACTIVE_GRADUATION_TOTAL;
  cohortCounts: CohortCountRow[];
  cohortTotals: typeof BASELINE_COHORT_TOTAL;
  termLevelActive: TermActiveRow[];
  getFilteredTermActive: (selectedCountries: string[]) => TermActiveRow[];
}

export function useGGUOverviewAnalytics(): GGUOverviewAnalyticsResult {
  const { rows, loading } = useGGUStudentList();

  // Extract all unique country names from "Country Of Residence" (Column N)
  const allCountries = useMemo(() => {
    const set = new Set<string>();
    if (rows && rows.length > 0) {
      rows.forEach(r => {
        const c = getRowCountry(r);
        if (c && c.trim()) {
          set.add(c.trim());
        }
      });
    }
    const list = Array.from(set);
    if (list.length === 0) {
      return ['India', 'United States', 'Vietnam', 'Nepal', 'Nigeria', 'Ghana', 'UAE', 'Singapore', 'Canada', 'Saudi Arabia', 'Kenya'];
    }
    return list.sort();
  }, [rows]);

  const analytics = useMemo(() => {
    if (loading || !rows || rows.length === 0) {
      return {
        loading: true,
        totalRawRows: rows.length,
        isCalculatedLive: false,
        allCountries,
        statusDetails: BASELINE_STATUS_DETAILS,
        statusTotals: BASELINE_STATUS_TOTALS,
        retentionActiveCohort: BASELINE_RETENTION_ACTIVE,
        retentionActiveTotal: BASELINE_RETENTION_ACTIVE_TOTAL,
        historicalRetention: BASELINE_HISTORICAL_RETENTION,
        historicalRetentionTotal: BASELINE_HISTORICAL_RETENTION_TOTAL,
        closedCohortGraduation: BASELINE_CLOSED_GRADUATION,
        closedCohortTotal: BASELINE_CLOSED_TOTAL,
        activeCohortGraduation: BASELINE_ACTIVE_GRADUATION,
        activeCohortTotal: BASELINE_ACTIVE_GRADUATION_TOTAL,
        cohortCounts: BASELINE_COHORT_COUNTS,
        cohortTotals: BASELINE_COHORT_TOTAL,
        termLevelActive: BASELINE_TERM_LEVEL_ACTIVE,
        getFilteredTermActive: () => BASELINE_TERM_LEVEL_ACTIVE,
      };
    }

    // Status Map per program
    const statusMap: Record<string, { active: number; exit: number; inactive: number }> = {};
    GGU_PROGRAMS.forEach(p => {
      statusMap[p] = { active: 0, exit: 0, inactive: 0 };
    });

    let totalActive = 0;
    let totalExit = 0;
    let totalInactive = 0;
    let countedRows = 0;

    // Filter rows for non-blank Column U (GGU Data Type)
    const validRows = rows.filter(r => (v(r, 'GGU Data Type', 'ggu_data_type', 'col_20') || '').trim() !== '');

    validRows.forEach(r => {
      const rawProgram = getRowProgram(r);
      const colU = (v(r, 'GGU Data Type', 'ggu_data_type', 'col_20') || '').trim().toLowerCase();

      if (!rawProgram || !colU) return;

      const programMatch = GGU_PROGRAMS.find(p => p.toLowerCase() === rawProgram.toLowerCase()) ||
        GGU_PROGRAMS.find(p => rawProgram.toLowerCase().includes(p.toLowerCase().replace('ggu ', '')));

      if (programMatch && statusMap[programMatch]) {
        if (colU === 'active') {
          statusMap[programMatch].active += 1;
          totalActive += 1;
          countedRows += 1;
        } else if (colU === 'exit') {
          statusMap[programMatch].exit += 1;
          totalExit += 1;
          countedRows += 1;
        } else if (colU === 'inactive') {
          statusMap[programMatch].inactive += 1;
          totalInactive += 1;
          countedRows += 1;
        }
      }
    });

    const isCalculatedLive = countedRows > 0 && (totalExit > 0 || totalInactive > 0);

    const statusDetails: ProgramStatusRow[] = GGU_PROGRAMS.map(program => {
      const active = statusMap[program]?.active || 0;
      const exit = statusMap[program]?.exit || 0;
      const inactive = statusMap[program]?.inactive || 0;
      return {
        program,
        active,
        exit,
        inactive,
        total: active + exit + inactive,
      };
    });

    // Helper function to pivot termLevelActive dynamically by selected countries
    const getFilteredTermActive = (selectedCountries: string[]): TermActiveRow[] => {
      if (selectedCountries.length === 0) {
        return BASELINE_TERM_LEVEL_ACTIVE;
      }

      const normSelected = selectedCountries.map(c => c.toLowerCase().trim());

      const filteredRows = rows.filter(r => {
        const country = getRowCountry(r).toLowerCase().trim();
        return normSelected.some(sc => country === sc || country.includes(sc) || sc.includes(country));
      });

      if (filteredRows.length === 0) {
        return [];
      }

      // Group filtered rows by term
      const termMap: Record<string, Record<string, number>> = {};

      filteredRows.forEach(r => {
        const term = getRowTerm(r) || 'Other';
        const rawProgram = getRowProgram(r);

        const programMatch = GGU_PROGRAMS.find(p => p.toLowerCase() === rawProgram.toLowerCase()) ||
          GGU_PROGRAMS.find(p => rawProgram.toLowerCase().includes(p.toLowerCase().replace('ggu ', '')));

        if (!termMap[term]) {
          termMap[term] = {
            'GGU DBA': 0,
            'GGU MBA': 0,
            'GGU DBA ET': 0,
            'GGU MPsych': 0,
            'GGU DBA DL': 0,
            'GGU SJD': 0,
            'GGU MBA SA': 0,
            'GGU Bachelors SA': 0,
          };
        }

        if (programMatch && termMap[term][programMatch] !== undefined) {
          termMap[term][programMatch] += 1;
        }
      });

      const terms = Object.keys(termMap).sort();
      return terms.map(term => {
        const pCounts = termMap[term];
        const dba = pCounts['GGU DBA'] || 0;
        const mba = pCounts['GGU MBA'] || 0;
        const dbaEt = pCounts['GGU DBA ET'] || 0;
        const mPsych = pCounts['GGU MPsych'] || 0;
        const dbaDl = pCounts['GGU DBA DL'] || 0;
        const sjd = pCounts['GGU SJD'] || 0;
        const mbaSa = pCounts['GGU MBA SA'] || 0;
        const bachelorsSa = pCounts['GGU Bachelors SA'] || 0;
        const grandTotal = dba + mba + dbaEt + mPsych + dbaDl + sjd + mbaSa + bachelorsSa;

        return {
          term,
          dba,
          mba,
          dbaEt,
          mPsych,
          dbaDl,
          sjd,
          mbaSa,
          bachelorsSa,
          grandTotal,
        };
      });
    };

    // Live Cohort Graduation calculation based on exact Excel formulas
    const closedGradMap: Record<string, { totalEnrolment: number; graduatedLearners: number }> = {};
    const activeGradMap: Record<string, { totalEnrolment: number; graduatedLearners: number }> = {};
    GGU_PROGRAMS.forEach(p => {
      closedGradMap[p] = { totalEnrolment: 0, graduatedLearners: 0 };
      activeGradMap[p] = { totalEnrolment: 0, graduatedLearners: 0 };
    });

    rows.forEach(r => {
      const rawProgram = getRowProgram(r);
      const rawStatus = getRowStatus(r);
      const programMatch = GGU_PROGRAMS.find(p => p.toLowerCase() === rawProgram.toLowerCase()) ||
        GGU_PROGRAMS.find(p => rawProgram.toLowerCase().includes(p.toLowerCase().replace('ggu ', '')));

      if (!programMatch || !closedGradMap[programMatch]) return;

      const colU = (v(r, 'GGU Data Type', 'ggu_data_type', 'col_20') || '').trim().toLowerCase();
      const isUActiveOrExit = colU === 'active' || colU === 'exit';

      const isGrad = isLearnerGraduated(rawStatus);
      const cohortStatus = normalizeSecondaryStatus(r['Cohort Status'] || '');
      const isClosed = cohortStatus.includes('closed') || cohortStatus.includes('close');

      if (isClosed) {
        if (isUActiveOrExit) {
          closedGradMap[programMatch].totalEnrolment += 1;
        }
        if (isGrad) {
          closedGradMap[programMatch].graduatedLearners += 1;
        }
      } else {
        if (isUActiveOrExit) {
          activeGradMap[programMatch].totalEnrolment += 1;
        }
        if (isGrad) {
          activeGradMap[programMatch].graduatedLearners += 1;
        }
      }
    });

    let closedTotalEnrolment = 0;
    let closedTotalGraduated = 0;
    const closedCohortGraduation: GraduationRow[] = GGU_PROGRAMS.map(program => {
      const { totalEnrolment, graduatedLearners } = closedGradMap[program] || { totalEnrolment: 0, graduatedLearners: 0 };
      closedTotalEnrolment += totalEnrolment;
      closedTotalGraduated += graduatedLearners;
      return {
        program,
        totalEnrolment,
        graduatedLearners,
        graduationPct: totalEnrolment > 0 ? Number(((graduatedLearners / totalEnrolment) * 100).toFixed(2)) : null,
      };
    });

    const closedCohortTotal = {
      totalEnrolment: closedTotalEnrolment,
      graduatedLearners: closedTotalGraduated,
      graduationPct: closedTotalEnrolment > 0 ? Number(((closedTotalGraduated / closedTotalEnrolment) * 100).toFixed(2)) : 0,
    };

    let activeTotalEnrolment = 0;
    let activeTotalGraduated = 0;
    const activeCohortGraduation: GraduationRow[] = GGU_PROGRAMS.map(program => {
      const { totalEnrolment, graduatedLearners } = activeGradMap[program] || { totalEnrolment: 0, graduatedLearners: 0 };
      activeTotalEnrolment += totalEnrolment;
      activeTotalGraduated += graduatedLearners;
      return {
        program,
        totalEnrolment,
        graduatedLearners,
        graduationPct: totalEnrolment > 0 ? Number(((graduatedLearners / totalEnrolment) * 100).toFixed(2)) : null,
      };
    });

    const activeCohortTotal = {
      totalEnrolment: activeTotalEnrolment,
      graduatedLearners: activeTotalGraduated,
      graduationPct: activeTotalEnrolment > 0 ? Number(((activeTotalGraduated / activeTotalEnrolment) * 100).toFixed(2)) : 0,
    };

    // Live Retention & Cohort Counts calculation based on exact Excel formulas
    const activeRetentionMap: Record<string, { enrolment: number; dropout: number }> = {};
    const historicalRetentionMap: Record<string, { enrolment: number; dropout: number }> = {};
    const cohortsMap: Record<string, Set<string>> = {};
    const liveCohortsMap: Record<string, Set<string>> = {};

    GGU_PROGRAMS.forEach(p => {
      activeRetentionMap[p] = { enrolment: 0, dropout: 0 };
      historicalRetentionMap[p] = { enrolment: 0, dropout: 0 };
      cohortsMap[p] = new Set<string>();
      liveCohortsMap[p] = new Set<string>();
    });

    const DROPOUT_STATUSES_SET = new Set([
      'disqualified',
      'payment-dropout',
      'payment dropout',
      'refunded',
      'withdrawn',
      'dropped'
    ]);

    rows.forEach(r => {
      const rawProgram = getRowProgram(r);
      const programMatch = GGU_PROGRAMS.find(p => p.toLowerCase() === rawProgram.toLowerCase()) ||
        GGU_PROGRAMS.find(p => rawProgram.toLowerCase().includes(p.toLowerCase().replace('ggu ', '')));

      if (!programMatch) return;

      const colU = (v(r, 'GGU Data Type', 'ggu_data_type', 'col_20') || '').trim().toLowerCase();
      const isUValid = colU === 'active' || colU === 'exit' || colU === 'inactive';

      const actualStatus = (v(r, 'Actual Status', 'Secondary Status', 'Status') || '').trim();
      const normR = normalizeSecondaryStatus(actualStatus);
      // Exclude 'Disqualified / IPD' explicitly from Dropout count
      const isDropout = !normR.includes('ipd') && (
        DROPOUT_STATUSES_SET.has(normR) ||
        normR === 'disqualified' ||
        normR.includes('payment-dropout') || normR.includes('payment dropout') ||
        normR.includes('refunded') || normR.includes('withdrawn') || normR.includes('dropped')
      );

      const cohortStatus = normalizeSecondaryStatus(r['Cohort Status'] || '');
      const isActiveCohort = cohortStatus.includes('active');

      const cohort = v(r, 'Cohort #', 'Cohort ID', 'Cohort', 'Batch Launch Month', 'GGU Term Id');
      if (cohort) {
        cohortsMap[programMatch].add(cohort);
        if (isActiveCohort) {
          liveCohortsMap[programMatch].add(cohort);
        }
      }

      // 1. Retention Active Cohort (Cohort Status S:S = "Active")
      if (isActiveCohort) {
        if (isUValid) {
          activeRetentionMap[programMatch].enrolment += 1;
        }
        if (isDropout) {
          activeRetentionMap[programMatch].dropout += 1;
        }
      }

      // 2. Historical Retention (All Cohorts)
      if (isUValid) {
        historicalRetentionMap[programMatch].enrolment += 1;
      }
      if (isDropout) {
        historicalRetentionMap[programMatch].dropout += 1;
      }
    });

    const retentionActiveCohort: RetentionRow[] = GGU_PROGRAMS.map(program => {
      const { enrolment, dropout } = activeRetentionMap[program] || { enrolment: 0, dropout: 0 };
      const total = enrolment + dropout;
      const pct = total > 0 ? Number(((enrolment / total) * 100).toFixed(2)) : 0;
      return { program, totalEnrolment: enrolment, disqualifiedDropout: dropout, total, retentionPct: pct };
    });

    const retentionActiveTotal = (() => {
      const totalEnrolment = retentionActiveCohort.reduce((a, c) => a + c.totalEnrolment, 0);
      const disqualifiedDropout = retentionActiveCohort.reduce((a, c) => a + c.disqualifiedDropout, 0);
      const total = totalEnrolment + disqualifiedDropout;
      const pct = total > 0 ? Number(((totalEnrolment / total) * 100).toFixed(2)) : 0;
      return { totalEnrolment, disqualifiedDropout, total, retentionPct: pct };
    })();

    const historicalRetention: RetentionRow[] = GGU_PROGRAMS.map(program => {
      const { enrolment, dropout } = historicalRetentionMap[program] || { enrolment: 0, dropout: 0 };
      const total = enrolment + dropout;
      const pct = total > 0 ? Number(((enrolment / total) * 100).toFixed(2)) : 0;
      return { program, totalEnrolment: enrolment, disqualifiedDropout: dropout, total, retentionPct: pct };
    });

    const historicalRetentionTotal = (() => {
      const totalEnrolment = historicalRetention.reduce((a, c) => a + c.totalEnrolment, 0);
      const disqualifiedDropout = historicalRetention.reduce((a, c) => a + c.disqualifiedDropout, 0);
      const total = totalEnrolment + disqualifiedDropout;
      const pct = total > 0 ? Number(((totalEnrolment / total) * 100).toFixed(2)) : 0;
      return { totalEnrolment, disqualifiedDropout, total, retentionPct: pct };
    })();

    const cohortCounts: CohortCountRow[] = GGU_PROGRAMS.map(program => {
      const allTimeCohorts = cohortsMap[program]?.size || 0;
      const liveCohorts = liveCohortsMap[program]?.size || 0;
      const closedCohorts = Math.max(0, allTimeCohorts - liveCohorts);
      return {
        program,
        allTimeCohorts,
        liveCohorts,
        closedCohorts,
      };
    });

    const cohortTotals = {
      allTimeCohorts: cohortCounts.reduce((a, c) => a + c.allTimeCohorts, 0),
      liveCohorts: cohortCounts.reduce((a, c) => a + c.liveCohorts, 0),
      closedCohorts: cohortCounts.reduce((a, c) => a + c.closedCohorts, 0),
    };

    return {
      loading: false,
      totalRawRows: rows.length,
      isCalculatedLive,
      allCountries,
      statusDetails: isCalculatedLive ? statusDetails : BASELINE_STATUS_DETAILS,
      statusTotals: isCalculatedLive
        ? { active: totalActive, exit: totalExit, inactive: totalInactive, grandTotal: totalActive + totalExit + totalInactive }
        : BASELINE_STATUS_TOTALS,
      retentionActiveCohort: isCalculatedLive ? retentionActiveCohort : BASELINE_RETENTION_ACTIVE,
      retentionActiveTotal: isCalculatedLive ? retentionActiveTotal : BASELINE_RETENTION_ACTIVE_TOTAL,
      historicalRetention: isCalculatedLive ? historicalRetention : BASELINE_HISTORICAL_RETENTION,
      historicalRetentionTotal: isCalculatedLive ? historicalRetentionTotal : BASELINE_HISTORICAL_RETENTION_TOTAL,
      closedCohortGraduation: isCalculatedLive ? closedCohortGraduation : BASELINE_CLOSED_GRADUATION,
      closedCohortTotal: isCalculatedLive ? closedCohortTotal : BASELINE_CLOSED_TOTAL,
      activeCohortGraduation: isCalculatedLive ? activeCohortGraduation : BASELINE_ACTIVE_GRADUATION,
      activeCohortTotal: isCalculatedLive ? activeCohortTotal : BASELINE_ACTIVE_GRADUATION_TOTAL,
      cohortCounts: isCalculatedLive ? cohortCounts : BASELINE_COHORT_COUNTS,
      cohortTotals: isCalculatedLive ? cohortTotals : BASELINE_COHORT_TOTAL,
      termLevelActive: isCalculatedLive ? getFilteredTermActive([]) : BASELINE_TERM_LEVEL_ACTIVE,
      getFilteredTermActive,
    };
  }, [rows, loading, allCountries]);

  return analytics;
}
