import { useEffect, useMemo, useState } from 'react';
import AnimatedNumber from '../components/AnimatedNumber';
import FilterDropdown from '../components/FilterDropdown';
import { SHEET_TABS } from '../lib/config';
import { fetchSheetTab } from '../lib/sheets';
import { useProgramConfig } from '../hooks/useProgramConfig';
import type { SheetRecord } from '../lib/sheets';

/* ─── Types ─────────────────────────────────────────────────── */
type ImmersionRow = {
  email: string;
  userId: string;
  firstName: string;
  lastName: string;
  cohort: string;
  cohortId: string;
  slot: string;
  batch: string;
  status: string;
  contact: string;
  country: string;
  // Singapore
  singaporeDate: string;
  singaporeRsvp: string;
  singaporeAttendance: string;
  // Mumbai
  mumbaiDate: string;
  mumbaiRsvp: string;
  mumbaiAttendance: string;
};

/* ─── Helpers ────────────────────────────────────────────────── */
function nk(v: string) {
  return v.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function coerceRow(r: SheetRecord): ImmersionRow {
  return {
    email: (r['Email'] ?? '').trim().toLowerCase(),
    userId: (r['User ID'] ?? '').trim(),
    firstName: (r['First Name'] ?? '').trim(),
    lastName: (r['Last Name'] ?? '').trim(),
    cohort: (r['Cohort #'] ?? '').trim(),
    cohortId: (r['Cohort ID'] ?? '').trim(),
    slot: (r['Slot'] ?? '').trim(),
    batch: (r['Batch'] ?? '').trim(),
    status: (r['Status'] ?? '').trim(),
    contact: (r['Contact'] ?? '').trim(),
    country: (r['Country'] ?? '').trim(),
    singaporeDate: (r['Singapore Date'] ?? '').trim(),
    singaporeRsvp: (r['Singapore RSVP Form'] ?? '').trim(),
    singaporeAttendance: (r['Singapore Final Attendance'] ?? '').trim(),
    mumbaiDate: (r['Mumbai Date'] ?? '').trim(),
    mumbaiRsvp: (r['Mumbai RSVP Form'] ?? '').trim(),
    mumbaiAttendance: (r['Mumbai Final Attendance'] ?? '').trim(),
  };
}

function isRsvpFilled(v: string) { return nk(v).includes('filled') && !nk(v).includes('not'); }
function isAttended(v: string) { return nk(v).includes('attended') && !nk(v).includes('not'); }

function parseImmersionDate(s: string): Date | null {
  if (!s) return null;

  // Google Sheets API returns dates as: Date(2024,10,26)
  // where month is 0-indexed (10 = November)
  const sheetsMatch = s.match(/^Date\((\d+),(\d+),(\d+)\)$/);
  if (sheetsMatch) {
    const year = parseInt(sheetsMatch[1], 10);
    const month = parseInt(sheetsMatch[2], 10); // 0-indexed
    const day = parseInt(sheetsMatch[3], 10);
    return new Date(year, month, day);
  }

  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function isPast(dateStr: string): boolean {
  const d = parseImmersionDate(dateStr);
  if (!d) return false;
  return d < new Date();
}

/** Format as "26 Nov 2024" */
function formatDate(dateStr: string): string {
  const d = parseImmersionDate(dateStr);
  if (!d) return dateStr || 'TBD';
  const day = d.getDate().toString().padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Venue phase logic:
 * - No date at all           → 'not-started'
 * - Date is past             → 'completed'
 * - Date is future, any RSVP data exists → 'in-progress'
 * - Date is future, NO RSVP data at all  → 'scheduled'
 */
type VenuePhase = 'completed' | 'in-progress' | 'scheduled' | 'not-started';

function getVenuePhase(dateStr: string, hasAnyRsvpData: boolean): VenuePhase {
  if (!dateStr) return 'not-started';
  if (isPast(dateStr)) return 'completed';
  if (hasAnyRsvpData) return 'in-progress';
  return 'scheduled';
}

const PHASE_LABELS: Record<VenuePhase, string> = {
  'completed': '✓ Completed',
  'in-progress': '● RSVP Open',
  'scheduled': '◌ Scheduled',
  'not-started': '— Not Started',
};

const PHASE_COLORS: Record<VenuePhase, { badge: string; text: string; border: string; bottom: string }> = {
  'completed': { badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', text: 'text-emerald-500', border: 'border-t-emerald-500', bottom: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30' },
  'in-progress': { badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400', text: 'text-indigo-500', border: 'border-t-indigo-500', bottom: 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/30' },
  'scheduled': { badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', text: 'text-slate-500', border: 'border-t-slate-400', bottom: 'bg-slate-50 dark:bg-slate-900/10 border-slate-200 dark:border-slate-700/30' },
  'not-started': { badge: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500', text: 'text-slate-400', border: 'border-t-slate-300', bottom: 'bg-slate-50 dark:bg-slate-900/10 border-slate-200 dark:border-slate-700/30' },
};

function uniq(arr: string[]): string[] {
  return Array.from(new Set(arr.filter(Boolean))).sort();
}

type VenueKey = 'singapore' | 'mumbai';

const STATUS_COLORS: Record<string, string> = {
  'Active': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Graduated': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Deferred Out': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Payment-Dropout': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'IPD': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'Disqualified': 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

function statusPill(s: string) {
  const cls = STATUS_COLORS[s] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${cls}`}>{s || '—'}</span>;
}

/* ─── Sub-components ────────────────────────────────────────── */
function KpiCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number | null; sub?: string; color: string;
}) {
  return (
    <div className="kpi-card group relative overflow-hidden">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${color} rounded-[--radius-lg]`} style={{ opacity: 0.03 }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md ${color.replace('bg-gradient', 'bg-gradient')}`}
            style={{ background: `var(--accent-blue)` }}>
            <i className={`${icon} text-base`} />
          </div>
        </div>
        <div className="kpi-value">
          {value === null ? '—' : <AnimatedNumber value={typeof value === 'string' ? parseFloat(value) || 0 : value} formatter={typeof value === 'string' && value.includes('%') ? (v) => `${v.toFixed(1)}%` : undefined} />}
        </div>
        <div className="kpi-label">{label}</div>
        {sub && <div className="text-[10px] font-semibold text-[var(--text-muted)] mt-1 uppercase tracking-wide">{sub}</div>}
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-[--radius-lg] bg-gradient-to-r from-[var(--accent-blue)] to-[var(--accent-indigo)] opacity-40" />
    </div>
  );
}

function MiniProgressBar({ pct, color = 'var(--accent-blue)' }: { pct: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--bg-surface-2)] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

function VenueBadge({ venue, phase }: { venue: VenueKey; phase: VenuePhase }) {
  const sg = venue === 'singapore';
  const c = PHASE_COLORS[phase];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${c.badge}`}>
      <i className={sg ? 'fas fa-globe-asia' : 'fas fa-city'} />
      {sg ? 'Singapore' : 'Mumbai'} · {PHASE_LABELS[phase]}
    </span>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function ImmersionPage() {
  const { config } = useProgramConfig();
  const [rows, setRows] = useState<ImmersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<'cohort' | 'batch' | 'status' | null>(null);
  const [searchQ, setSearchQ] = useState('');
  const [activeVenue, setActiveVenue] = useState<VenueKey>('singapore');

  // Table pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSheetTab({ spreadsheetId: config.sheetId, sheetName: SHEET_TABS.immersion })
      .then((data) => {
        if (!cancelled) setRows((Array.isArray(data) ? data : []).map(coerceRow));
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [config.sheetId]);


  // Singapore metadata
  const sgDate = useMemo(() => {
    const dates = rows.map(r => r.singaporeDate).filter(Boolean);
    return dates[0] ?? '';
  }, [rows]);
  const mumbaiDate = useMemo(() => {
    const dates = rows.map(r => r.mumbaiDate).filter(Boolean);
    return dates[0] ?? '';
  }, [rows]);



  // Check whether RSVP data has been collected for each venue
  const sgHasRsvp = useMemo(() => rows.some(r => r.singaporeRsvp.trim() !== ''), [rows]);
  const mbHasRsvp = useMemo(() => rows.some(r => r.mumbaiRsvp.trim() !== ''), [rows]);

  const sgPhase = getVenuePhase(sgDate, sgHasRsvp);
  const mbPhase = getVenuePhase(mumbaiDate, mbHasRsvp);
  const currentPhase = activeVenue === 'singapore' ? sgPhase : mbPhase;

  // ── Base filter: only cohorts where Singapore RSVP data exists ──
  // Identify which cohorts have at least one non-blank Singapore RSVP entry
  const eligibleCohorts = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => {
      if (r.singaporeRsvp.trim() !== '') set.add(r.cohort);
    });
    return set;
  }, [rows]);

  // Active-only statuses allowed on this page
  const ACTIVE_STATUSES = new Set(['Active', 'Active / Deferred In']);

  // Base dataset: eligible cohorts (SG RSVP not blank) + Active/Active-Deferred-In only
  const baseRows = useMemo(
    () => rows.filter(r => eligibleCohorts.has(r.cohort) && ACTIVE_STATUSES.has(r.status)),
    [rows, eligibleCohorts]
  );

  /* ── Derived filter options (from baseRows) ── */
  const allStatuses = useMemo(() => uniq(baseRows.map(r => r.status)), [baseRows]);
  const allCohorts = useMemo(() => uniq(baseRows.map(r => r.cohort)), [baseRows]);
  const allBatches = useMemo(() => uniq(baseRows.map(r => r.batch)), [baseRows]);

  // User-applied filters on top of baseRows
  const filteredRows = useMemo(() => {
    return baseRows.filter(r => {
      if (selectedCohorts.length > 0 && !selectedCohorts.includes(r.cohort)) return false;
      if (selectedBatches.length > 0 && !selectedBatches.includes(r.batch)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(r.status)) return false;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        const name = `${r.firstName} ${r.lastName}`.toLowerCase();
        if (!name.includes(q) && !r.email.includes(q) && !r.country.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [baseRows, selectedCohorts, selectedBatches, selectedStatuses, searchQ]);

  // analyticsRows === filteredRows (status already restricted at baseRows level)
  const analyticsRows = filteredRows;

  /* ── Venue-specific analytics (only completed immersions per row) ── */
  function venueStats(v: VenueKey) {
    const dateField = v === 'singapore' ? 'singaporeDate' : 'mumbaiDate';
    const rsvpField = v === 'singapore' ? 'singaporeRsvp' : 'mumbaiRsvp';
    const attField = v === 'singapore' ? 'singaporeAttendance' : 'mumbaiAttendance';
    let total = 0, rsvpFilled = 0, attended = 0, notRsvp = 0, notAttended = 0;
    for (const r of analyticsRows) {
      if (!r.email) continue;
      // Only count this row if this venue's immersion date has already passed
      if (!isPast(r[dateField])) continue;
      total++;
      if (isRsvpFilled(r[rsvpField])) rsvpFilled++; else notRsvp++;
      if (isAttended(r[attField])) attended++; else notAttended++;
    }
    const rsvpRate = total > 0 ? (rsvpFilled / total) * 100 : 0;
    const attendRate = total > 0 ? (attended / total) * 100 : 0;
    const dropOff = rsvpFilled - attended;
    return { total, rsvpFilled, notRsvp, attended, notAttended, rsvpRate, attendRate, dropOff };
  }

  const sgStats = useMemo(() => venueStats('singapore'), [analyticsRows]);
  const mbStats = useMemo(() => venueStats('mumbai'), [analyticsRows]);
  const currentStats = activeVenue === 'singapore' ? sgStats : mbStats;

  /* ── Country breakdown ── */
  const countryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of analyticsRows) {
      if (!r.country) continue;
      map.set(r.country, (map.get(r.country) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [analyticsRows]);
  const maxCountry = countryMap[0]?.[1] ?? 1;

  /* ── Cohort breakdown ── */
  const cohortBreakdown = useMemo(() => {
    const map = new Map<string, { rsvpSg: number; attSg: number; rsvpMb: number; attMb: number; total: number }>();
    for (const r of analyticsRows) {
      if (!r.cohort || !r.email) continue;
      if (!map.has(r.cohort)) map.set(r.cohort, { rsvpSg: 0, attSg: 0, rsvpMb: 0, attMb: 0, total: 0 });
      const c = map.get(r.cohort)!;
      c.total++;
      if (isRsvpFilled(r.singaporeRsvp)) c.rsvpSg++;
      if (isAttended(r.singaporeAttendance)) c.attSg++;
      if (isRsvpFilled(r.mumbaiRsvp)) c.rsvpMb++;
      if (isAttended(r.mumbaiAttendance)) c.attMb++;
    }
    return Array.from(map.entries())
      .sort((a, b) => {
        const na = parseInt(a[0].replace(/\D/g, ''), 10) || 0;
        const nb = parseInt(b[0].replace(/\D/g, ''), 10) || 0;
        return na - nb;
      })
      .map(([cohort, v]) => ({ cohort, ...v }));
  }, [analyticsRows]);

  /* ── Upcoming Immersions (Bypasses RSVP-existence filter) ── */
  const upcomingImmersions = useMemo(() => {
    const upcomingMap = new Map<string, { venue: string; cohort: string; date: string; hasRsvp: boolean; total: number; rsvpCount: number }>();

    for (const r of rows) {
      if (!ACTIVE_STATUSES.has(r.status)) continue;
      // Obey user's UI filters (cohort, batch, etc.)
      if (selectedCohorts.length > 0 && !selectedCohorts.includes(r.cohort)) continue;
      if (selectedBatches.length > 0 && !selectedBatches.includes(r.batch)) continue;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(r.status)) continue;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        const name = `${r.firstName} ${r.lastName}`.toLowerCase();
        if (!name.includes(q) && !r.email.includes(q) && !r.country.toLowerCase().includes(q)) continue;
      }

      // Singapore check
      if (r.singaporeDate && !isPast(r.singaporeDate)) {
        const key = `sg-${r.cohort}`;
        if (!upcomingMap.has(key)) upcomingMap.set(key, { venue: 'Singapore', cohort: r.cohort, date: r.singaporeDate, hasRsvp: false, total: 0, rsvpCount: 0 });
        const entry = upcomingMap.get(key)!;
        entry.total++;
        if (r.singaporeRsvp.trim() !== '') {
          entry.hasRsvp = true;
          if (isRsvpFilled(r.singaporeRsvp)) entry.rsvpCount++;
        }
      }
      // Mumbai check
      if (r.mumbaiDate && !isPast(r.mumbaiDate)) {
        const key = `mb-${r.cohort}`;
        if (!upcomingMap.has(key)) upcomingMap.set(key, { venue: 'Mumbai', cohort: r.cohort, date: r.mumbaiDate, hasRsvp: false, total: 0, rsvpCount: 0 });
        const entry = upcomingMap.get(key)!;
        entry.total++;
        if (r.mumbaiRsvp.trim() !== '') {
          entry.hasRsvp = true;
          if (isRsvpFilled(r.mumbaiRsvp)) entry.rsvpCount++;
        }
      }
    }

    return Array.from(upcomingMap.values()).sort((a, b) => {
      const da = parseImmersionDate(a.date)?.getTime() || 0;
      const db = parseImmersionDate(b.date)?.getTime() || 0;
      return da - db;
    });
  }, [rows, selectedCohorts, selectedBatches, selectedStatuses, searchQ]);

  /* ── Paginated learner table ── */
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  /* ── Clear filters ── */
  const clearFilters = () => {
    setSelectedCohorts([]);
    setSelectedBatches([]);
    setSelectedStatuses([]);
    setSearchQ('');
    setPage(1);
  };

  function toggleInList(value: string, list: string[], setList: (v: string[]) => void) {
    setPage(1);
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }


  /* ─── Render ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen pb-12" onClick={() => setOpenDropdown(null)}>

      {/* ── Page Header ── */}
      <div className="mb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Immersion <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">Analytics</span></h1>
            <p className="text-gray-600 dark:text-gray-400">Dual-venue insights — Singapore & Mumbai</p>
          </div>
        </div>
      </div>



      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-[var(--accent-blue)] border-t-transparent animate-spin" />
          <p className="text-[var(--text-muted)] text-sm font-medium">Loading immersion data…</p>
        </div>
      ) : error ? (
        <div className="card p-8 text-center">
          <i className="fas fa-exclamation-triangle text-3xl text-[var(--accent-rose)] mb-3" />
          <p className="text-[var(--text-primary)] font-semibold mb-1">Failed to load immersion data</p>
          <p className="text-[var(--text-muted)] text-sm">{error}</p>
        </div>
      ) : (
        <>

          {/* ─── Venue Selector Tabs ─── */}
          <div className="flex items-center gap-1 mb-6 p-1 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border-color)] w-fit">
            {(['singapore', 'mumbai'] as VenueKey[]).map(v => {
              const isActive = v === activeVenue;
              return (
                <button
                  key={v}
                  onClick={() => setActiveVenue(v)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${isActive
                    ? 'bg-[var(--bg-surface)] text-[var(--accent-blue)] shadow-[var(--shadow-sm)] border border-[var(--border-color)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                >
                  <i className={v === 'singapore' ? 'fas fa-globe-asia' : 'fas fa-city'} />
                  <span className="capitalize">{v}</span>
                </button>
              );
            })}
          </div>

          {/* ─── Venue Banner ─── */}
          <div className="relative rounded-2xl overflow-hidden mb-8 border border-[var(--border-color)]"
            style={{ background: 'linear-gradient(135deg, var(--accent-blue)11, var(--accent-indigo)22)' }}>
            <div className="absolute inset-0 opacity-5"
              style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, var(--accent-blue) 0%, transparent 50%), radial-gradient(circle at 80% 50%, var(--accent-purple) 0%, transparent 50%)' }} />
            <div className="relative px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg"
                  style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))' }}>
                  <i className={activeVenue === 'singapore' ? 'fas fa-globe-asia' : 'fas fa-city'} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-[var(--text-primary)] capitalize">
                    {activeVenue} Immersion
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-black text-[var(--text-primary)]">{currentStats.total}</div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Total</div>
                </div>
                <div className="h-10 w-px bg-[var(--border-color)]" />
                <div className="text-center">
                  <div className="text-2xl font-black text-emerald-500">{currentStats.attended}</div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Attended</div>
                </div>
                <div className="h-10 w-px bg-[var(--border-color)]" />
                <div className="text-center">
                  <div className="text-2xl font-black text-[var(--accent-blue)]">{currentStats.attendRate.toFixed(1)}%</div>
                  <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Att. Rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── KPI Cards ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <KpiCard icon="fas fa-users" label="Total Learners" value={currentStats.total} sub="Count" color="bg-gradient-to-br from-blue-400 to-indigo-500" />
            <KpiCard icon="fas fa-clipboard-check" label="RSVP Filled" value={currentStats.rsvpFilled}
              sub={`${currentStats.rsvpRate.toFixed(1)}% fill rate`} color="bg-gradient-to-br from-purple-400 to-fuchsia-500" />
            <KpiCard icon="fas fa-calendar-check" label="Final Attended" value={currentStats.attended}
              sub={`${currentStats.attendRate.toFixed(1)}% attendance`} color="bg-gradient-to-br from-emerald-400 to-teal-500" />
            <KpiCard icon="fas fa-user-times" label="Did Not Attend" value={currentStats.notAttended}
              sub={`${(100 - currentStats.attendRate).toFixed(1)}% no-show`} color="bg-gradient-to-br from-rose-400 to-orange-500" />
          </div>

          {/* ─── Upcoming Immersions ─── */}
          {upcomingImmersions.length > 0 && upcomingImmersions.filter(i => i.venue.toLowerCase() === activeVenue).length > 0 && (
            <div className="card p-6 mb-8">
              <div className="section-header mb-6">
                <div>
                  <div className="section-title">Upcoming {activeVenue === 'singapore' ? 'Singapore' : 'Mumbai'} Immersions</div>
                  <div className="section-subtitle">Future immersions for the selected venue</div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {upcomingImmersions
                  .filter(i => i.venue.toLowerCase() === activeVenue)
                  .map((item, idx) => (
                    <div key={`${item.venue.toLowerCase()}-${item.cohort}-${idx}`} className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-2)] flex flex-col gap-2 relative overflow-hidden group">
                      <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full bg-gradient-to-bl opacity-10 transition-opacity group-hover:opacity-20 ${item.venue === 'Singapore' ? 'from-indigo-500' : 'from-rose-500'}`} />
                      <div className="flex items-center justify-between z-10">
                        <span className="text-xs font-black px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-sm">
                          {item.cohort}
                        </span>
                      </div>
                      <div className="font-black text-lg text-[var(--text-primary)] z-10 mt-1">
                        {formatDate(item.date)}
                      </div>
                      <div className="z-10 mt-auto pt-2 border-t border-[var(--border-color)]">
                        {item.hasRsvp ? (
                          <div className="flex flex-col gap-2 pt-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800/30 inline-flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> RSVP
                              </span>
                              <span className="text-[10px] font-black text-[var(--text-secondary)]">
                                {item.total} Learners
                              </span>
                            </div>
                            <div className="flex justify-between items-end border-t border-[var(--border-color)] pt-1.5 mt-0.5">
                              <div>
                                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Filled</div>
                                <div className="font-black text-[var(--text-primary)]">{item.rsvpCount}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Rate</div>
                                <div className="font-black text-indigo-600 dark:text-indigo-400">{(item.total > 0 ? (item.rsvpCount / item.total) * 100 : 0).toFixed(1)}%</div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-[var(--border-color)] inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Scheduled
                            </span>
                            <span className="text-[10px] font-black text-[var(--text-secondary)]">
                              {item.total} Learners
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ─── Funnel + Country Map Row ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">

            {/* Conversion Funnel */}
            <div className="lg:col-span-3 card p-6">
              <div className="section-header mb-6">
                <div>
                  <div className="section-title">Engagement Funnel</div>
                  <div className="section-subtitle">Learner → RSVP → Attendance pipeline</div>
                </div>
                <VenueBadge venue={activeVenue} phase={currentPhase} />
              </div>

              <div className="space-y-5">
                {/* Stage 1 */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)] mb-2">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black">1</span>
                      Total Learners
                    </span>
                    <span className="font-black text-[var(--text-primary)]">{currentStats.total}</span>
                  </div>
                  <MiniProgressBar pct={100} color="var(--accent-blue)" />
                </div>

                {/* Arrow */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--border-color)]" />
                  <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    {currentStats.rsvpRate.toFixed(1)}% conversion
                  </span>
                  <div className="h-px flex-1 bg-[var(--border-color)]" />
                </div>

                {/* Stage 2 */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)] mb-2">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center text-[10px] font-black">2</span>
                      RSVP Filled
                    </span>
                    <span className="flex items-center gap-2">
                      {currentStats.notRsvp > 0 && (
                        <span className="text-rose-500 font-bold text-[10px]">↓ {currentStats.notRsvp} skipped</span>
                      )}
                      <span className="font-black text-[var(--text-primary)]">{currentStats.rsvpFilled}</span>
                    </span>
                  </div>
                  <MiniProgressBar pct={currentStats.rsvpRate} color="#8b5cf6" />
                </div>

                {/* Arrow */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-[var(--border-color)]" />
                  <span className="text-[9px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                    {currentStats.rsvpFilled > 0
                      ? ((currentStats.attended / currentStats.rsvpFilled) * 100).toFixed(1)
                      : '0.0'}% of RSVP attended
                  </span>
                  <div className="h-px flex-1 bg-[var(--border-color)]" />
                </div>

                {/* Stage 3 */}
                <div>
                  <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)] mb-2">
                    <span className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-black">3</span>
                      Final Attended
                    </span>
                    <span className="flex items-center gap-2">
                      {currentStats.dropOff > 0 && (
                        <span className="text-rose-500 font-bold text-[10px]">↓ {currentStats.dropOff} no-show</span>
                      )}
                      <span className="font-black text-[var(--text-primary)]">{currentStats.attended}</span>
                    </span>
                  </div>
                  <MiniProgressBar pct={currentStats.attendRate} color="#10b981" />
                </div>

                {/* Overall rate badge */}
                <div className="mt-4 flex items-center justify-between p-4 rounded-xl bg-[var(--bg-surface-2)] border border-[var(--border-color)]">
                  <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">Overall Attendance Rate</span>
                  <span className="text-xl font-black text-[var(--accent-blue)]">{currentStats.attendRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>

            {/* Country Heatmap */}
            <div className="lg:col-span-2 card p-6">
              <div className="section-header mb-6">
                <div>
                  <div className="section-title">Global Reach</div>
                  <div className="section-subtitle">Learner countries</div>
                </div>
                <span className="badge-neutral">{countryMap.length} Nations</span>
              </div>
              <div className="space-y-3">
                {countryMap.map(([country, count]) => (
                  <div key={country}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-semibold text-[var(--text-secondary)] truncate max-w-[60%]">{country}</span>
                      <span className="font-black text-[var(--text-primary)]">{count}</span>
                    </div>
                    <MiniProgressBar pct={(count / maxCountry) * 100} color="var(--accent-indigo)" />
                  </div>
                ))}
                {countryMap.length === 0 && (
                  <p className="text-center text-sm text-[var(--text-muted)] py-4">No data</p>
                )}
              </div>
            </div>
          </div>

          {/* ─── Cohort Comparison Table ─── */}
          <div className="card p-6 mb-8">
            <div className="section-header mb-6">
              <div>
                <div className="section-title">Cohort-by-Cohort Breakdown</div>
                <div className="section-subtitle">{activeVenue === 'singapore' ? 'Singapore' : 'Mumbai'} RSVP and attendance per cohort</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="border-b border-[var(--border-color)]">
                    {(activeVenue === 'singapore' 
                      ? ['Cohort', 'Total', 'SG RSVP', 'SG Attended', 'SG Rate'] 
                      : ['Cohort', 'Total', 'MUM RSVP', 'MUM Attended', 'MUM Rate']
                    ).map(h => (
                      <th key={h} className="py-3 px-3 w-1/5 text-left text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] truncate">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohortBreakdown
                    .filter(c => activeVenue === 'singapore' ? c.attSg > 0 : c.attMb > 0)
                    .map((c) => {
                    const sgRate = c.total > 0 ? (c.attSg / c.total) * 100 : 0;
                    const mbRate = c.total > 0 ? (c.attMb / c.total) * 100 : 0;
                    return (
                      <tr key={c.cohort} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-surface-2)] transition-colors">
                        <td className="py-3 px-3 font-black text-[var(--text-primary)]">{c.cohort}</td>
                        <td className="py-3 px-3">
                          <span className="badge-neutral">{c.total}</span>
                        </td>
                        {activeVenue === 'singapore' ? (
                          <>
                            <td className="py-3 px-3 text-[var(--text-secondary)] font-semibold">{c.rsvpSg}</td>
                            <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{c.attSg}</td>
                            <td className="py-3 px-3">
                              <span className={`text-xs font-black px-2 py-0.5 rounded-md ${sgRate >= 60 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                                {sgRate.toFixed(0)}%
                              </span>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-3 text-[var(--text-secondary)] font-semibold">{c.rsvpMb}</td>
                            <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">{c.attMb}</td>
                            <td className="py-3 px-3">
                              {c.attMb > 0 ? (
                                <span className={`text-xs font-black px-2 py-0.5 rounded-md ${mbRate >= 60 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'}`}>
                                  {mbRate.toFixed(0)}%
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)] text-xs">—</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {cohortBreakdown.filter(c => activeVenue === 'singapore' ? c.attSg > 0 : c.attMb > 0).length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-[var(--text-muted)] text-sm">No data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Filter Console ── */}
          <div className="max-w-6xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-[2rem] shadow-2xl p-6 mb-8 border border-white/60 dark:border-white/10 relative z-30" onClick={(e) => e.stopPropagation()}>
            {/* Background Graphic Layer */}
            <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
              <div className="absolute top-0 right-0 p-8 opacity-5 transition-opacity">
                <i className="fas fa-sliders-h text-[140px] dark:text-white" />
              </div>
            </div>

            <div className="relative mb-10 z-10">
              <div className="flex flex-col items-center max-w-3xl mx-auto">
                <div className="relative w-full flex justify-center items-center mb-6">
                  <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 flex items-center gap-3">
                    <i className="fas fa-filter text-indigo-600 dark:text-indigo-400" />
                    Filter Console
                  </h3>
                </div>

                <div className="w-full relative group">
                  <input
                    value={searchQ}
                    onChange={(e) => {
                      setSearchQ(e.target.value);
                      setPage(1);
                    }}
                    placeholder="Find learners by name, email, or country..."
                    className="w-full pl-12 pr-12 py-3.5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-indigo-500 focus:bg-white dark:bg-gray-800 dark:focus:bg-gray-800 rounded-2xl transition-all shadow-inner text-base font-medium outline-none placeholder:text-gray-400 text-gray-800 dark:text-gray-100"
                  />
                  <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-xl group-focus-within:text-indigo-500 transition-colors" />
                  {searchQ.trim() && (
                    <button
                      type="button"
                      onClick={() => { setSearchQ(''); setPage(1); }}
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <i className="fas fa-times-circle text-xl" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-2 relative z-20">
              <FilterDropdown
                label="Active Cohort"
                iconClass="fas fa-users-cog"
                placeholder="All Cohorts"
                values={allCohorts}
                selected={selectedCohorts}
                onToggle={(v) => toggleInList(v, selectedCohorts, setSelectedCohorts)}
                isOpen={openDropdown === 'cohort'}
                setIsOpen={(open) => setOpenDropdown(open ? 'cohort' : null)}
                formatValue={(v) => `Cohort ${v}`}
              />

              <FilterDropdown
                label="Batch"
                iconClass="fas fa-users"
                placeholder="All Batches"
                values={allBatches}
                selected={selectedBatches}
                onToggle={(v) => toggleInList(v, selectedBatches, setSelectedBatches)}
                isOpen={openDropdown === 'batch'}
                setIsOpen={(open) => setOpenDropdown(open ? 'batch' : null)}
              />

              <FilterDropdown
                label="Status"
                iconClass="fas fa-tag"
                placeholder="All Statuses"
                values={allStatuses}
                selected={selectedStatuses}
                onToggle={(v) => toggleInList(v, selectedStatuses, setSelectedStatuses)}
                isOpen={openDropdown === 'status'}
                setIsOpen={(open) => setOpenDropdown(open ? 'status' : null)}
              />
            </div>

            <div className="flex border-t border-[var(--border-color)] border-opacity-50 pt-6 mt-4 items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2 items-center min-w-0">
                <span className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mr-2">Active Tuning:</span>
                {(searchQ.trim() || selectedCohorts.length > 0 || selectedBatches.length > 0 || selectedStatuses.length > 0) ? (
                  <>
                    {searchQ.trim() && (
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-full px-3 py-1 flex items-center gap-2 group/tag hover:bg-white dark:hover:bg-gray-800 transition-colors">
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">"{searchQ}"</span>
                      </div>
                    )}
                    {selectedCohorts.map(c => (
                      <div key={`c-${c}`} className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-full px-3 py-1 flex items-center gap-2 group/tag hover:bg-white dark:hover:bg-gray-800 transition-colors">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[100px]">{c}</span>
                        <button onClick={() => toggleInList(c, selectedCohorts, setSelectedCohorts)} className="text-emerald-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-[10px]" /></button>
                      </div>
                    ))}
                    {selectedBatches.map(b => (
                      <div key={`b-${b}`} className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-full px-3 py-1 flex items-center gap-2 group/tag hover:bg-white dark:hover:bg-gray-800 transition-colors">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[100px]">{b}</span>
                        <button onClick={() => toggleInList(b, selectedBatches, setSelectedBatches)} className="text-emerald-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-[10px]" /></button>
                      </div>
                    ))}
                    {selectedStatuses.map(s => (
                      <div key={`s-${s}`} className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-full px-3 py-1 flex items-center gap-2 group/tag hover:bg-white dark:hover:bg-gray-800 transition-colors">
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[100px]">{s}</span>
                        <button onClick={() => toggleInList(s, selectedStatuses, setSelectedStatuses)} className="text-emerald-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-[10px]" /></button>
                      </div>
                    ))}
                  </>
                ) : (
                  <span className="text-xs italic text-[var(--text-muted)] opacity-70">No active filters applied</span>
                )}
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"
              >
                <i className="fas fa-sync-alt" />
                Reset
              </button>
            </div>
          </div>

          {/* ─── Learner Table ─── */}
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-[var(--border-color)]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <div className="section-title">Learner Directory</div>
                  <div className="section-subtitle">{filteredRows.length} learners · showing {paginatedRows.length}</div>
                </div>

              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-color)] bg-[var(--bg-surface-2)]">
                    {['Learner', 'Cohort', 'Batch', 'Country', 'Status', 'SG RSVP', 'SG Att.', 'MUM RSVP', 'MUM Att.'].map(h => (
                      <th key={h} className="py-3 px-4 text-left text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((r, i) => {
                    const sgRsvpFilled = isRsvpFilled(r.singaporeRsvp);
                    const sgAtt = isAttended(r.singaporeAttendance);
                    const mbRsvpFilled = isRsvpFilled(r.mumbaiRsvp);
                    const mbAtt = isAttended(r.mumbaiAttendance);
                    return (
                      <tr key={`${r.userId}-${i}`} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-surface-2)] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-indigo))' }}>
                              {(r.firstName?.[0] ?? '?').toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-[var(--text-primary)] leading-tight">{`${r.firstName} ${r.lastName}`.trim() || '—'}</div>
                              <div className="text-[10px] text-[var(--text-muted)]">{r.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-[var(--text-secondary)]">{r.cohort}</td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[var(--bg-surface-2)] text-[var(--text-muted)] border border-[var(--border-color)]">
                            {r.batch || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[var(--text-secondary)] font-medium">{r.country || '—'}</td>
                        <td className="py-3 px-4">{statusPill(r.status)}</td>
                        {/* Singapore */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${sgRsvpFilled ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' : 'bg-[var(--bg-surface-2)] text-[var(--text-muted)]'}`}>
                            <i className={sgRsvpFilled ? 'fas fa-check' : 'fas fa-minus'} />
                            {sgRsvpFilled ? 'Filled' : 'Not Filled'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${sgAtt ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                            <i className={sgAtt ? 'fas fa-check-circle' : 'fas fa-times-circle'} />
                            {sgAtt ? 'Attended' : 'Absent'}
                          </span>
                        </td>
                        {/* Mumbai */}
                        <td className="py-3 px-4">
                          {r.mumbaiDate ? (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${mbRsvpFilled ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400' : 'bg-[var(--bg-surface-2)] text-[var(--text-muted)]'}`}>
                              <i className={mbRsvpFilled ? 'fas fa-check' : 'fas fa-minus'} />
                              {mbRsvpFilled ? 'Filled' : 'Not Filled'}
                            </span>
                          ) : <span className="text-[var(--text-muted)] text-[10px]">—</span>}
                        </td>
                        <td className="py-3 px-4">
                          {r.mumbaiDate ? (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${mbAtt ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                              <i className={mbAtt ? 'fas fa-check-circle' : 'fas fa-times-circle'} />
                              {mbAtt ? 'Attended' : 'Absent'}
                            </span>
                          ) : <span className="text-[var(--text-muted)] text-[10px]">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {paginatedRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-16 text-center text-[var(--text-muted)] text-sm">
                        <i className="fas fa-search text-2xl mb-3 block opacity-30" />
                        No learners match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-color)] bg-[var(--bg-surface-2)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">
                Page {page} of {totalPages} · {filteredRows.length} total
              </span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                  <i className="fas fa-chevron-left mr-1" /> Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pg = i + 1;
                  if (totalPages > 5 && page > 3) pg = page - 2 + i;
                  if (pg > totalPages) return null;
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${pg === page ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'}`}>
                      {pg}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="btn-ghost text-xs disabled:opacity-40 disabled:cursor-not-allowed">
                  Next <i className="fas fa-chevron-right ml-1" />
                </button>
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
