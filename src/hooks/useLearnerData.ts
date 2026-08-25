import { useEffect, useMemo, useState } from 'react';
import { GGU_PROGRAM_IDS, SHEET_TABS } from '../lib/config';
import { getLearnersNeedingAttentionFromGrades, mergeLearners } from '../lib/logic';
import { fetchSheetTab } from '../lib/sheets';
import { useGGUStudentList } from './useGGUStudentList';
import { useProgramConfig } from './useProgramConfig';
import type { GradesheetRow, StudentListRow } from '../types';

const BACKGROUND_REFRESH_MS = 60 * 1000;

export function useLearnerData() {
  const { programId, config } = useProgramConfig();
  const isGgu = GGU_PROGRAM_IDS.has(programId as any);

  // ── GGU path: use singleton sheet ────────────────────────────────────────────
  const { rows: allGguRows, loading: gguLoading } = useGGUStudentList();

  // Filter GGU rows by the Program column so each program page only sees its own students.
  // If a row has no Program value, include it rather than silently dropping it.
  const gguStudents = useMemo<StudentListRow[]>(() => {
    if (!isGgu) return [];
    return allGguRows;
    // Uncomment the lines below once you know the exact Program column values:
    // const programName = config.name; // e.g. "DBA", "DBA ET", "MBA" …
    // return allGguRows.filter(r => {
    //   const prog = (r['Program'] || '').trim();
    //   return !prog || prog.toLowerCase().includes(programName.toLowerCase());
    // });
  }, [isGgu, allGguRows]);

  // ── Non-GGU path: individual sheet per program ────────────────────────────────
  const [nonGguStudents, setNonGguStudents] = useState<StudentListRow[] | null>(null);
  const [grades, setGrades] = useState<GradesheetRow[] | null>(null);
  const [nonGguError, setNonGguError] = useState<string | null>(null);
  const [nonGguLoading, setNonGguLoading] = useState<boolean>(!isGgu);

  useEffect(() => {
    if (isGgu) return; // GGU handled by singleton

    let cancelled = false;
    let inFlight = false;

    async function load(options?: { background?: boolean }) {
      const background = options?.background ?? false;
      if (inFlight) return;
      inFlight = true;

      if (!background) setNonGguLoading(true);
      if (!background) setNonGguError(null);

      try {
        const [studentRows, gradeRows] = await Promise.all([
          fetchSheetTab({ spreadsheetId: config.sheetId, sheetName: SHEET_TABS.studentList }),
          fetchSheetTab({ spreadsheetId: config.sheetId, sheetName: SHEET_TABS.gradesheet }).catch(() => [] as GradesheetRow[]),
        ]);

        if (cancelled) return;
        setNonGguStudents(studentRows);
        setGrades(gradeRows);
      } catch (e) {
        if (cancelled) return;
        if (!background) setNonGguError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (cancelled) return;
        if (!background) setNonGguLoading(false);
        inFlight = false;
      }
    }

    load();

    const interval = window.setInterval(() => {
      void load({ background: true });
    }, BACKGROUND_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [programId, config.sheetId, isGgu]);

  // Resolve the active students array depending on GGU vs non-GGU
  const students = isGgu ? gguStudents : (nonGguStudents ?? []);
  const resolvedGrades = isGgu ? [] : (grades ?? []);
  const loading = isGgu ? gguLoading : nonGguLoading;
  const error = isGgu ? null : nonGguError;

  const merged = useMemo(() => {
    return mergeLearners({ programId, students, grades: resolvedGrades });
  }, [programId, students, resolvedGrades]);

  const needsAttention = useMemo(
    () => getLearnersNeedingAttentionFromGrades(programId, resolvedGrades),
    [programId, resolvedGrades]
  );

  return {
    loading,
    error,
    students,
    grades: resolvedGrades,
    merged,
    needsAttention,
  };
}
