import { useEffect, useMemo, useState } from 'react';
import { fetchSheetTab } from '../lib/sheets';
import { GGU_PROGRAM_IDS, GGU_STUDENT_LIST_SHEET_ID, GGU_STUDENT_LIST_TAB, SHEET_TABS } from '../lib/config';
import { useGGUStudentList } from './useGGUStudentList';

export interface ProgramStats {
  learnerCount: number | null;
  cohortCount: number | null;
  loading: boolean;
  error: boolean;
}

// Possible column names for cohort identifier across all programs
const COHORT_COLS = ['Cohort #', 'Cohort', 'Cohort ID', 'uG Cohort ID', 'Cohort Name'];
// Possible email column names across all programs
const EMAIL_COLS = ['Email ID', 'GGU Email ID', 'Email', 'GGU Student Email ID'];

function pickValue(row: Record<string, string>, candidates: string[]): string {
  for (const key of candidates) {
    const v = row[key];
    if (v && v.trim()) return v.trim();
  }
  return '';
}

// ── GGU variant: reads from the singleton ────────────────────────────────────
function useGguProgramStats(programId: string): ProgramStats {
  const { rows: allRows, loading } = useGGUStudentList();

  return useMemo(() => {
    if (loading) return { learnerCount: null, cohortCount: null, loading: true, error: false };

    const validRows = allRows.filter(r => Object.values(r).some(v => v && v.trim()));

    const emails = new Set<string>();
    const cohorts = new Set<string>();

    for (const row of validRows) {
      const email = pickValue(row, EMAIL_COLS).toLowerCase();
      if (email) emails.add(email);
      const cohort = pickValue(row, COHORT_COLS);
      if (cohort) cohorts.add(cohort);
    }

    return {
      learnerCount: emails.size || validRows.length,
      cohortCount: cohorts.size,
      loading: false,
      error: false,
    };
  }, [allRows, loading]);
}

// ── Non-GGU variant: fetches the old per-program sheet ───────────────────────
function useNonGguProgramStats(sheetId: string): ProgramStats {
  const [learnerCount, setLearnerCount] = useState<number | null>(null);
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

        const validRows = rows.filter(r =>
          Object.values(r).some(v => v && v.trim())
        );

        const emails = new Set<string>();
        const cohorts = new Set<string>();

        for (const row of validRows) {
          const email = pickValue(row, EMAIL_COLS).toLowerCase();
          if (email) emails.add(email);
          const cohort = pickValue(row, COHORT_COLS);
          if (cohort) cohorts.add(cohort);
        }

        setLearnerCount(emails.size || validRows.length);
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

  return { learnerCount, cohortCount, loading, error };
}

// ── Public export: automatically routes GGU vs non-GGU ───────────────────────
export function useProgramStats(sheetId: string, programId?: string): ProgramStats {
  const isGgu = !!programId && GGU_PROGRAM_IDS.has(programId as any);
  const gguStats = useGguProgramStats(programId || '');
  const nonGguStats = useNonGguProgramStats(isGgu ? '' : sheetId);
  return isGgu ? gguStats : nonGguStats;
}
