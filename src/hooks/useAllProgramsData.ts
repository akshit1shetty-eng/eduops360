import { useEffect, useState, useMemo } from 'react';
import { fetchSheetTab } from '../lib/sheets';
import { PROGRAMS, SHEET_TABS } from '../lib/config';
import { v, normalizeSecondaryStatus } from '../lib/logic';
import type { SheetRecord } from '../lib/sheets';

export interface ProgramLearner {
  email: string;
  firstName: string;
  lastName: string;
  programId: string;
  programName: string;
  secondaryStatus: string;
  learnerType: string; // raw value from sheet
  country: string;
  region: string;
  cohort: string;
  batch: string;
}

export interface ProgramLoadStatus {
  programId: string;
  programName: string;
  loading: boolean;
  error: boolean;
  learnerCount: number;
}

const EMAIL_COLS = ['Email ID', 'GGU Email ID', 'Email', 'GGU Student Email ID', 'GGU Email'];
const STATUS_COLS = ['upGrad Learner Status', 'GGU Learner Status', 'Actual Status', 'Actual status', 'Status Details', 'Secondary Status', 'Status'];
const LEARNER_TYPE_COLS = ['Learner Type'];
const COUNTRY_COLS = ['Country Of Residence', 'Country of  Residence', 'Country of Residence', 'Country'];
const REGION_COLS = ['Region'];
const COHORT_COLS = ['Cohort #', 'Cohort'];
const BATCH_COLS = ['Batch'];
const FIRST_NAME_COLS = ['First Name'];
const LAST_NAME_COLS = ['Last Name'];

function pick(row: SheetRecord, cols: string[]): string {
  for (const c of cols) {
    const v = row[c];
    if (v && v.trim()) return v.trim();
  }
  return '';
}

// Programs that have live data
const ACTIVE_PROGRAMS = Object.entries(PROGRAMS).filter(([, cfg]) => cfg.sheetId);

export function useAllProgramsData() {
  const [allLearners, setAllLearners] = useState<ProgramLearner[]>([]);
  const [programStatuses, setProgramStatuses] = useState<ProgramLoadStatus[]>(
    ACTIVE_PROGRAMS.map(([id, cfg]) => ({
      programId: id,
      programName: cfg.name,
      loading: true,
      error: false,
      learnerCount: 0,
    }))
  );

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const promises = ACTIVE_PROGRAMS.map(async ([programId, cfg]) => {
        try {
          const rows = await fetchSheetTab({
            spreadsheetId: cfg.sheetId,
            sheetName: SHEET_TABS.studentList,
          });

          if (cancelled) return null;

          const learners: ProgramLearner[] = [];
          const seen = new Set<string>();

          for (const row of Array.isArray(rows) ? rows : []) {
            const email = v(row, 'Email ID', 'GGU Email ID', 'Email', 'GGU Student Email ID', 'GGU Email').toLowerCase();
            if (!email) continue;

            const cohort = v(row, 'Cohort #', 'Cohort');
            const key = `${email}__${cohort}`;
            if (seen.has(key)) continue;
            seen.add(key);

            const learnerType = v(row, 'Learner Type', 'Type');

            // Status resolution
            const statusFromStudentList = v(row, 'Actual Status', 'Actual status', 'Status Details', 'Secondary Status', 'Status');
            const secondaryStatus = programId === 'dba'
              ? statusFromStudentList
              : (v(row, 'upGrad Learner Status', 'GGU Learner Status') || statusFromStudentList);

            learners.push({
              email,
              firstName: v(row, 'First Name'),
              lastName: v(row, 'Last Name'),
              programId,
              programName: cfg.name,
              secondaryStatus,
              learnerType,
              country: v(row, 'Country Of Residence', 'Country of  Residence', 'Country of Residence', 'Country'),
              region: v(row, 'Region'),
              cohort,
              batch: v(row, 'Batch'),
            });
          }

          return { programId, programName: cfg.name, learners, error: false };
        } catch {
          return { programId, programName: cfg.name, learners: [] as ProgramLearner[], error: true };
        }
      });

      const results = await Promise.all(promises);
      if (cancelled) return;

      const combined: ProgramLearner[] = [];
      const newStatuses: ProgramLoadStatus[] = [];

      for (const result of results) {
        if (!result) continue;
        combined.push(...result.learners);
        newStatuses.push({
          programId: result.programId,
          programName: result.programName,
          loading: false,
          error: result.error,
          learnerCount: result.learners.length,
        });
      }

      setAllLearners(combined);
      setProgramStatuses(newStatuses);
    }

    loadAll();
    return () => { cancelled = true; };
  }, []);

  const loading = useMemo(() => programStatuses.some(p => p.loading), [programStatuses]);

  return { allLearners, programStatuses, loading };
}
