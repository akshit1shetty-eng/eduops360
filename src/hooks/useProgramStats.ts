import { useEffect, useMemo, useState } from 'react';
import { fetchSheetTab } from '../lib/sheets';
import { GGU_PROGRAM_IDS, GGU_STUDENT_LIST_SHEET_ID, GGU_STUDENT_LIST_TAB, SHEET_TABS } from '../lib/config';
import { useGGUStudentList } from './useGGUStudentList';
import { v, isLearnerGraduated } from '../lib/logic';

export interface ProgramStats {
  learnerCount: number | null;
  activeCount: number | null;
  exitCount: number | null;
  loaCount: number | null;
  graduatedCount: number | null;
  cohortCount: number | null;
  loading: boolean;
  error: boolean;
}

// Possible column names for cohort identifier across all programs
const COHORT_COLS = ['uG Cohort ID', 'Cohort #', 'Cohort', 'Cohort ID', 'Cohort Name', 'cohort'];
// Possible email column names across all programs
const EMAIL_COLS = ['Email ID', 'GGU Email ID', 'Email', 'GGU Student Email ID'];

const GGU_PROGRAM_EXACT_MAP: Record<string, string> = {
  'ggu-dba': 'ggu dba',
  'ggu-mba': 'ggu mba',
  'ggu-dba-et': 'ggu dba et',
  'ggu-mpsych': 'ggu mpsych',
  'ggu-dba-dl': 'ggu dba dl',
  'ggu-sjd': 'ggu sjd',
  'ggu-mba-sa': 'ggu mba sa',
  'ggu-bachelors-sa': 'ggu bachelors sa',
};

function pickValue(row: Record<string, string>, candidates: string[]): string {
  for (const key of candidates) {
    const val = row[key];
    if (val && val.trim()) return val.trim();
  }
  return '';
}

function isRowForGguProgram(row: Record<string, string>, programId: string): boolean {
  // Column U must be non-blank
  const colU = (v(row, 'GGU Data Type', 'ggu_data_type', 'col_20') || '').trim();
  if (!colU) return false;

  const rowProg = (v(row, 'Program', 'program_name', 'col_19') || '').trim().toLowerCase();
  const normId = programId.toLowerCase().trim();

  // Combined DBA Doctoral Container
  if (normId === 'dba-combined' || normId === 'dba-doctoral' || normId === 'dba-all' || normId === 'dba-dissertation') {
    return rowProg === 'ggu dba' || rowProg === 'ggu dba et' || rowProg === 'ggu dba dl';
  }

  // Regular DBA
  if (normId === 'dba' || normId === 'dba-taught' || normId === 'ggu-dba') {
    return rowProg === 'ggu dba';
  }

  // DBA Executive Track
  if (normId === 'dba-et' || normId === 'dba-et-taught' || normId === 'ggu-dba-et') {
    return rowProg === 'ggu dba et';
  }

  // DBA Digital Leadership
  if (normId === 'dba-dl' || normId === 'ggu-dba-dl') {
    return rowProg === 'ggu dba dl';
  }

  const target = GGU_PROGRAM_EXACT_MAP[normId];
  if (target) {
    return rowProg === target;
  }

  const normPId = normId.replace(/^ggu-?/, '').replace(/-/g, ' ').trim();
  const normRow = rowProg.replace(/^ggu\s*/, '').replace(/-/g, ' ').trim();
  return normRow === normPId;
}

// ── GGU variant: reads from the singleton ────────────────────────────────────
function useGguProgramStats(programId: string): ProgramStats {
  const { rows: allRows, loading } = useGGUStudentList();

  return useMemo(() => {
    if (loading) {
      return { learnerCount: null, activeCount: null, exitCount: null, loaCount: null, graduatedCount: null, cohortCount: null, loading: true, error: false };
    }

    const safeAllRows = Array.isArray(allRows) ? allRows : [];
    const programRows = safeAllRows.filter(r => isRowForGguProgram(r, programId));

    let activeCount = 0;
    let exitCount = 0;
    let loaCount = 0;
    let graduatedCount = 0;
    const cohorts = new Set<string>();

    programRows.forEach(r => {
      const colU = (v(r, 'GGU Data Type', 'ggu_data_type', 'col_20') || '').trim().toLowerCase();
      if (colU === 'active') activeCount += 1;
      else if (colU === 'exit') exitCount += 1;
      else if (colU === 'inactive' || colU === 'loa') loaCount += 1;

      const cohort = pickValue(r, COHORT_COLS);
      if (cohort) cohorts.add(cohort);

      const rawColR = (
        r['Actual Status'] ||
        r['Actual status'] ||
        r['actual_status'] ||
        v(r, 'Actual Status', 'actual_status', 'Learner Status', 'Secondary Status', 'Status') ||
        ''
      ).replace(/\u00a0/g, ' ').trim().toLowerCase();

      if (isLearnerGraduated(rawColR, r)) {
        graduatedCount += 1;
      }
    });

    return {
      learnerCount: programRows.length,
      activeCount,
      exitCount,
      loaCount,
      graduatedCount,
      cohortCount: cohorts.size,
      loading: false,
      error: false,
    };
  }, [allRows, loading, programId]);
}

// ── Non-GGU variant: fetches the old per-program sheet ───────────────────────
function useNonGguProgramStats(sheetId: string): ProgramStats {
  const [learnerCount, setLearnerCount] = useState<number | null>(null);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [exitCount, setExitCount] = useState<number | null>(null);
  const [loaCount, setLoaCount] = useState<number | null>(null);
  const [graduatedCount, setGraduatedCount] = useState<number | null>(null);
  const [cohortCount, setCohortCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!sheetId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(false);
      try {
        const rows = await fetchSheetTab({
          spreadsheetId: sheetId,
          sheetName: SHEET_TABS.studentList,
        });

        if (cancelled) return;

        const safeRows = Array.isArray(rows) ? rows : [];
        const validRows = safeRows.filter(r =>
          Object.values(r).some(v => v && v.trim())
        );

        const emails = new Set<string>();
        const cohorts = new Set<string>();
        let active = 0;
        let exit = 0;
        let graduated = 0;

        for (const row of validRows) {
          const email = pickValue(row, EMAIL_COLS).toLowerCase();
          if (email) emails.add(email);
          const cohort = pickValue(row, COHORT_COLS);
          if (cohort) cohorts.add(cohort);

          const status = (v(row, 'Learner Status', 'Actual Status', 'Status') || '').toLowerCase();
          if (status.includes('active')) active += 1;
          if (status.includes('exit')) exit += 1;
          if (status.includes('graduat') || status.includes('complet')) graduated += 1;
        }

        setLearnerCount(emails.size || validRows.length);
        setActiveCount(active);
        setExitCount(exit);
        setLoaCount(0);
        setGraduatedCount(graduated);
        setCohortCount(cohorts.size);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [sheetId]);

  return { learnerCount, activeCount, exitCount, loaCount, graduatedCount, cohortCount, loading, error };
}

// ── Public export: automatically routes GGU vs non-GGU ───────────────────────
export function useProgramStats(sheetId: string, programId?: string): ProgramStats {
  const isGgu = !!programId && GGU_PROGRAM_IDS.has(programId as any);
  const gguStats = useGguProgramStats(programId || '');
  const nonGguStats = useNonGguProgramStats(isGgu ? '' : sheetId);
  return isGgu ? gguStats : nonGguStats;
}
