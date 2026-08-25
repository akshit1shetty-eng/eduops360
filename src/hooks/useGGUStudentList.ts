/**
 * useGGUStudentList
 *
 * Fetches the consolidated GGU "upGrad Active Learner List" sheet exactly ONCE
 * using a module-level cache. Every component that calls this hook shares the
 * same in-flight request and the same cached result, so the 6,933-row sheet is
 * never fetched more than once per page load.
 */
import { useEffect, useState } from 'react';
import { GGU_STUDENT_LIST_SHEET_ID, GGU_STUDENT_LIST_TAB } from '../lib/config';
import { fetchSheetTab, type SheetRecord } from '../lib/sheets';

// ─── Module-level singleton ───────────────────────────────────────────────────
type CacheState =
  | { status: 'idle' }
  | { status: 'loading'; promise: Promise<SheetRecord[]> }
  | { status: 'done'; rows: SheetRecord[] }
  | { status: 'error'; message: string };

let cache: CacheState = { status: 'idle' };
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach(fn => fn());
}

function ensureLoading() {
  if (cache.status !== 'idle') return;
  const promise = fetchSheetTab({
    spreadsheetId: GGU_STUDENT_LIST_SHEET_ID,
    sheetName: GGU_STUDENT_LIST_TAB,
  });
  cache = { status: 'loading', promise };
  promise
    .then(rows => {
      cache = { status: 'done', rows };
      notify();
    })
    .catch(err => {
      cache = {
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to load GGU student list',
      };
      notify();
    });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export interface GGUStudentListResult {
  rows: SheetRecord[];
  loading: boolean;
  error: string | null;
}

export function useGGUStudentList(): GGUStudentListResult {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const refresh = () => forceUpdate(n => n + 1);
    subscribers.add(refresh);
    ensureLoading();
    return () => {
      subscribers.delete(refresh);
    };
  }, []);

  if (cache.status === 'done') {
    return { rows: cache.rows, loading: false, error: null };
  }
  if (cache.status === 'error') {
    return { rows: [], loading: false, error: cache.message };
  }
  // idle or loading
  ensureLoading();
  return { rows: [], loading: true, error: null };
}
