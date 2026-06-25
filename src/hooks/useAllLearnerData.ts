import { useEffect, useState } from 'react';
import { PROGRAMS, SHEET_TABS } from '../lib/config';
import { fetchSheetTab } from '../lib/sheets';
import { UNIVERSITIES } from '../lib/universities';
import type { StudentListRow } from '../types';

export interface CrossProgramLearner extends StudentListRow {
  _programId: string;
  _programName: string;
}

export function useAllLearnerData(universityId?: string | null) {
  const [students, setStudents] = useState<CrossProgramLearner[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    
    async function load() {
      setLoading(true);
      setError(null);
      
      try {
        let programKeys = Object.keys(PROGRAMS);
        
        // If university filter is applied, only fetch for those programs
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
              _programName: config.name
            }));
          } catch (err) {
            console.warn(`Failed to fetch student list for program ${key}`, err);
            return [];
          }
        });
        
        const results = await Promise.all(promises);
        if (cancelled) return;
        
        const combined = results.flat() as CrossProgramLearner[];
        setStudents(combined);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Unknown error fetching all learners');
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

  return { loading, error, students: students ?? [] };
}
