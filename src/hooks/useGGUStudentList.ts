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
import { standardCountryName } from '../lib/countries';

const COUNTRY_KEYS = ['Country Of Residence', 'Country of Residence', 'Country of  Residence', 'Country'];

/**
 * The sheet holds free-text countries ("IN", "INDIA", "India", "Ho Chi Minh City" …).
 * Standardise them once, as the data arrives, so every page — filters, tables, map,
 * residency — sees one name per country. The value as entered is kept alongside.
 */
function standardiseCountries(rows: SheetRecord[]): SheetRecord[] {
  return rows.map(row => {
    let out: SheetRecord | null = null;
    for (const key of COUNTRY_KEYS) {
      const raw = row[key];
      if (raw === undefined) continue;
      const std = standardCountryName(raw);
      if (std !== raw) {
        out = out ?? { ...row };
        out[key] = std;
        out[`${key} (as entered)`] = raw;
      }
    }
    return out ?? row;
  });
}

// ─── Module-level singleton ───────────────────────────────────────────────────
type CacheState =
  | { status: 'idle' }
  | { status: 'loading'; promise: Promise<SheetRecord[]> }
  | { status: 'done'; rows: SheetRecord[]; fetchedAt: Date }
  | { status: 'error'; message: string };

let cache: CacheState = { status: 'idle' };
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach(fn => fn());
}

/** A request that hasn't answered by then is treated as failed, so users see a message, not an endless spinner. */
const LOAD_TIMEOUT_MS = 60_000;

/** When the current load started (for "taking longer than usual" messaging). */
export let loadStartedAt: number | null = null;

function ensureLoading() {
  if (cache.status !== 'idle') return;
  loadStartedAt = Date.now();
  const promise = Promise.race([
    fetchSheetTab({ spreadsheetId: GGU_STUDENT_LIST_SHEET_ID, sheetName: GGU_STUDENT_LIST_TAB }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('The data source took too long to respond')), LOAD_TIMEOUT_MS)),
  ]);
  cache = { status: 'loading', promise };
  promise
    .then(rows => {
      const safeRows = standardiseCountries(Array.isArray(rows) ? rows : []);
      cache = { status: 'done', rows: safeRows, fetchedAt: new Date() };
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

/** Try again after a failed load (used by the data-status banner's Retry button). */
export function retryGGUStudentList() {
  if (cache.status !== 'error') return;
  cache = { status: 'idle' };
  ensureLoading();
  notify();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export interface GGUStudentListResult {
  rows: SheetRecord[];
  loading: boolean;
  error: string | null;
  /** When the learner list was last pulled from the sheet (null until loaded). */
  fetchedAt: Date | null;
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
    return { rows: cache.rows, loading: false, error: null, fetchedAt: cache.fetchedAt };
  }
  if (cache.status === 'error') {
    return { rows: [], loading: false, error: cache.message, fetchedAt: null };
  }
  // idle or loading
  ensureLoading();
  return { rows: [], loading: true, error: null, fetchedAt: null };
}
