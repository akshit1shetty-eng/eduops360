/**
 * useTermWiseSplit — loads the "Term Wise Split" summary tab and parses it by label.
 *
 * Fast path: the last good copy is kept in localStorage and shown immediately,
 * while a fresh copy loads in the background (stale-while-revalidate). One
 * module-level cache is shared by every caller, and loading starts as soon as
 * the portal layout mounts (see prefetchTermWiseSplit).
 */
import { useEffect, useState } from 'react';
import { GGU_STUDENT_LIST_SHEET_ID, GGU_TERM_WISE_SPLIT_TAB } from '../lib/config';
import { fetchSheetGrid } from '../lib/sheets';
import { parseTermWiseSplit, type TermWiseSplit } from '../lib/termWiseSplit';

const STORAGE_KEY = 'eduops360.termWiseSplit.v2';

type CacheState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: TermWiseSplit }
  | { status: 'error'; message: string };

let cache: CacheState = { status: 'idle' };
let refreshing = false;
let fetchedThisLoad = false;
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach(fn => fn());

function readStoredGrid(): string[][] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const grid = JSON.parse(raw)?.grid;
    return Array.isArray(grid) ? grid : null;
  } catch {
    return null;
  }
}

function store(grid: string[][]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), grid }));
  } catch {
    // storage full / blocked — the in-memory copy still works
  }
}

/** Start loading (once per page load). Safe to call from anywhere, any number of times. */
export function prefetchTermWiseSplit() {
  if (refreshing || fetchedThisLoad || cache.status === 'error') return;
  if (cache.status === 'idle') {
    const stored = readStoredGrid();
    cache = stored ? { status: 'done', data: parseTermWiseSplit(stored) } : { status: 'loading' };
  }
  refreshing = true;
  fetchSheetGrid({ spreadsheetId: GGU_STUDENT_LIST_SHEET_ID, sheetName: GGU_TERM_WISE_SPLIT_TAB, expectedRows: readStoredGrid()?.length })
    .then(grid => {
      const data = parseTermWiseSplit(grid);
      cache = { status: 'done', data };
      fetchedThisLoad = true;
      if (data.learnerTypes.length > 0 || data.active.programs.length > 0) store(grid);
    })
    .catch(err => {
      // Keep showing the stored copy if we have one; only surface the error otherwise.
      if (cache.status !== 'done') {
        cache = { status: 'error', message: err instanceof Error ? err.message : 'Failed to load Term Wise Split' };
      }
    })
    .finally(() => { refreshing = false; notify(); });
  notify();
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
    prefetchTermWiseSplit();
    return () => { subscribers.delete(refresh); };
  }, []);

  if (cache.status === 'idle') {
    // First render before the effect runs: show a stored copy straight away if there is one.
    const stored = readStoredGrid();
    if (stored) cache = { status: 'done', data: parseTermWiseSplit(stored) };
  }
  if (cache.status === 'done') return { data: cache.data, loading: false, error: null };
  if (cache.status === 'error') return { data: null, loading: false, error: cache.message };
  return { data: null, loading: true, error: null };
}
