/**
 * useAllLearnerData
 *
 * Returns a flat list of learners across programs.
 *
 * For GGU programs the data comes from the single consolidated sheet
 * (via useGGUStudentList which is fetched only ONCE globally).
 * The `Program` column in the sheet is used to set _programName.
 *
 * Non-GGU programs continue to use their own per-program sheets.
 */
import { useEffect, useMemo, useState } from 'react';
import { GGU_PROGRAM_IDS, PROGRAMS, SHEET_TABS } from '../lib/config';
import { fetchSheetTab } from '../lib/sheets';
import { useGGUStudentList } from './useGGUStudentList';
import { UNIVERSITIES } from '../lib/universities';
import type { StudentListRow } from '../types';

export interface CrossProgramLearner extends StudentListRow {
  _programId: string;
  _programName: string;
}

export function useAllLearnerData(universityId?: string | null) {
  const { rows: gguRows, loading: gguLoading } = useGGUStudentList();

  const [nonGguStudents, setNonGguStudents] = useState<CrossProgramLearner[]>([]);
  const [nonGguLoading, setNonGguLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setNonGguLoading(true);
      setError(null);

      try {
        // Only non-GGU programs need individual fetches
        let programKeys = Object.keys(PROGRAMS).filter(k => !GGU_PROGRAM_IDS.has(k as any));

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
          try {
            const rows = await fetchSheetTab({ spreadsheetId: config.sheetId, sheetName: SHEET_TABS.studentList });
            return rows.map(r => ({
              ...r,
              _programId: key,
              _programName: config.name,
            }));
          } catch (err) {
            console.warn(`Failed to fetch student list for program ${key}`, err);
            return [];
          }
        });

        const results = await Promise.all(promises);
        if (cancelled) return;
        setNonGguStudents(results.flat() as CrossProgramLearner[]);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Unknown error fetching learners');
      } finally {
        if (cancelled) return;
        setNonGguLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [universityId]);

  // Convert GGU rows (tagged with Program column) into CrossProgramLearner.
  // Filter for rows where Column U (GGU Data Type) is non-blank.
  const gguStudents = useMemo<CrossProgramLearner[]>(() => {
    // Filter by university if needed
    if (universityId && universityId !== 'ggu') return [];

    return gguRows
      .filter(r => {
        const colU = (r['GGU Data Type'] || r['col_20'] || '').trim();
        return colU !== '';
      })
      .map(r => ({
        ...r,
        _programId: 'ggu',
        // Use the Program column as the display name; fall back to 'GGU'
        _programName: (r['Program'] || 'GGU').trim(),
      }));
  }, [gguRows, universityId]);

  const students = useMemo<CrossProgramLearner[]>(() => {
    // If university filter is only GGU, skip non-GGU
    if (universityId === 'ggu') return gguStudents;
    return [...gguStudents, ...nonGguStudents];
  }, [gguStudents, nonGguStudents, universityId]);

  const loading = gguLoading || nonGguLoading;

  return { loading, error, students };
}
