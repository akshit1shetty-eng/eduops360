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
import { v, normalizeSecondaryStatus, isLearnerActive } from '../lib/logic';

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

/** Extract Status from Column M (or Secondary Status column) */
function getRowStatus(r: Record<string, string>): string {
  if (r['Secondary Status'] && r['Secondary Status'].trim()) return r['Secondary Status'].trim();
  if (r['Status'] && r['Status'].trim()) return r['Status'].trim();

  for (const k of Object.keys(r)) {
    const lk = k.toLowerCase().trim();
    if (lk === 'secondary status' || lk === 'status' || lk === 'student status' || lk === 'col_12') {
      if (r[k] && r[k].trim()) return r[k].trim();
    }
  }

  const keys = Object.keys(r);
  if (keys[12] && r[keys[12]] && r[keys[12]].trim()) return r[keys[12]].trim();

  return v(r, 'Secondary Status', 'secondary_status', 'Status', 'student_status', 'active_status') || '';
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

    rows.forEach(r => {
      const rawProgram = getRowProgram(r);
      const rawStatus = getRowStatus(r);

      if (!rawProgram && !rawStatus) return;

      const programMatch = GGU_PROGRAMS.find(p => p.toLowerCase() === rawProgram.toLowerCase()) ||
        GGU_PROGRAMS.find(p => rawProgram.toLowerCase().includes(p.toLowerCase().replace('ggu ', '')));

      if (programMatch && statusMap[programMatch]) {
        const norm = normalizeSecondaryStatus(rawStatus);

        if (isLearnerActive(rawStatus) || norm.includes('active') || norm.includes('registered') || norm.includes('coursework')) {
          statusMap[programMatch].active += 1;
          totalActive += 1;
          countedRows += 1;
        } else if (norm.includes('exit') || norm.includes('dropout') || norm.includes('disqualified') || norm.includes('graduat') || norm.includes('alumni') || norm.includes('cancel') || norm.includes('terminate') || norm.includes('withdraw')) {
          statusMap[programMatch].exit += 1;
          totalExit += 1;
          countedRows += 1;
        } else if (norm.includes('inactive') || norm.includes('break') || norm.includes('defer') || norm.includes('suspend')) {
          statusMap[programMatch].inactive += 1;
          totalInactive += 1;
          countedRows += 1;
        } else if (norm) {
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

    return {
      loading: false,
      totalRawRows: rows.length,
      isCalculatedLive,
      allCountries,
      statusDetails: isCalculatedLive ? statusDetails : BASELINE_STATUS_DETAILS,
      statusTotals: isCalculatedLive
        ? { active: totalActive, exit: totalExit, inactive: totalInactive, grandTotal: totalActive + totalExit + totalInactive }
        : BASELINE_STATUS_TOTALS,
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
      getFilteredTermActive,
    };
  }, [rows, loading, allCountries]);

  return analytics;
}
