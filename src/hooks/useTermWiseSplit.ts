/**
 * useTermWiseSplit — loads the "Term Wise Split" summary tab once per page load
 * (module-level cache shared by every caller) and parses it by label.
 */
import { useEffect, useState } from 'react';
import { GGU_STUDENT_LIST_SHEET_ID, GGU_TERM_WISE_SPLIT_TAB } from '../lib/config';
import { fetchSheetGrid } from '../lib/sheets';
import { parseTermWiseSplit, type TermWiseSplit } from '../lib/termWiseSplit';

type CacheState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: TermWiseSplit }
  | { status: 'error'; message: string };

let cache: CacheState = { status: 'idle' };
const subscribers = new Set<() => void>();

function ensureLoading() {
  if (cache.status !== 'idle') return;
  cache = { status: 'loading' };
  fetchSheetGrid({ spreadsheetId: GGU_STUDENT_LIST_SHEET_ID, sheetName: GGU_TERM_WISE_SPLIT_TAB })
    .then(grid => { cache = { status: 'done', data: parseTermWiseSplit(grid) }; })
    .catch(err => { cache = { status: 'error', message: err instanceof Error ? err.message : 'Failed to load Term Wise Split' }; })
    .finally(() => subscribers.forEach(fn => fn()));
}

export interface TermWiseSplitResult {
  data: TermWiseSplit | null;
  loading: boolean;
  error: string | null;
}

export function useTermWiseSplit(): TermWiseSplitResult {
  const [, force] = useState(0);
  useEffect(() => {
    const refresh = () => force(n => n + 1);
    subscribers.add(refresh);
    ensureLoading();
    return () => { subscribers.delete(refresh); };
  }, []);

  if (cache.status === 'done') return { data: cache.data, loading: false, error: null };
  if (cache.status === 'error') return { data: null, loading: false, error: cache.message };
  return { data: null, loading: true, error: null };
}
