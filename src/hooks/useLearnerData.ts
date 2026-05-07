import { useEffect, useMemo, useState } from 'react';
import { SHEET_TABS } from '../lib/config';
import { getLearnersNeedingAttentionFromGrades, mergeLearners } from '../lib/logic';
import { fetchSheetTab } from '../lib/sheets';
import { useProgramConfig } from './useProgramConfig';
import type { GradesheetRow, StudentListRow } from '../types';

const BACKGROUND_REFRESH_MS = 60 * 1000;

export function useLearnerData() {
  const { programId, config } = useProgramConfig();
  const [students, setStudents] = useState<StudentListRow[] | null>(null);
  const [grades, setGrades] = useState<GradesheetRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function load(options?: { background?: boolean }) {
      const background = options?.background ?? false;
      if (inFlight) return;
      inFlight = true;

      if (!background) setLoading(true);
      if (!background) setError(null);

      try {
        const [studentRows, gradeRows] = await Promise.all([
          fetchSheetTab({ spreadsheetId: config.sheetId, sheetName: SHEET_TABS.studentList }),
          fetchSheetTab({ spreadsheetId: config.sheetId, sheetName: SHEET_TABS.gradesheet }).catch(() => [] as GradesheetRow[]),
        ]);

        if (cancelled) return;
        setStudents(studentRows);
        setGrades(gradeRows);
      } catch (e) {
        if (cancelled) return;
        if (!background) setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (cancelled) return;
        if (!background) setLoading(false);
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
  }, [programId, config.sheetId]);

  const merged = useMemo(() => {
    if (!students || !grades) return [];
    return mergeLearners({ programId, students, grades });
  }, [programId, students, grades]);

  const needsAttention = useMemo(() => getLearnersNeedingAttentionFromGrades(programId, grades ?? []), [programId, grades]);

  return {
    loading,
    error,
    students: students ?? [],
    grades: grades ?? [],
    merged,
    needsAttention,
  };
}
