import { useMemo, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import AnimatedNumber from '../components/AnimatedNumber';
import { useProgramConfig } from '../hooks/useProgramConfig';
import type { LiveSessionsRow } from '../types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  Cell,
  LabelList,
} from 'recharts';

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumber(value: string | undefined): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDateLoose(value: string): Date | null {
  const t = String(value ?? '').trim();
  if (!t) return null;

  const numeric = t.match(/^\d+(?:\.\d+)?$/);
  if (numeric) {
    const n = Number(t);
    if (Number.isFinite(n) && n > 20000) {
      const ms = Math.round(n * 86400000);
      const epoch = Date.UTC(1899, 11, 30);
      const d = new Date(epoch + ms);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }

  const tDateOnly = t.split(/[ T]/)[0];

  const iso = tDateOnly.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const yyyy = Number(iso[1]);
    const mm = Number(iso[2]);
    const dd = Number(iso[3]);
    if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const d = new Date(yyyy, mm - 1, dd);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const dmY = tDateOnly.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (dmY) {
    const dd = Number(dmY[1]);
    const mm = Number(dmY[2]);
    let yyyy = Number(dmY[3]);
    if (yyyy < 100) yyyy += 2000;
    if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const d = new Date(yyyy, mm - 1, dd);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const dMonY = tDateOnly.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$/);
  if (dMonY) {
    const dd = Number(dMonY[1]);
    const mon = dMonY[2].trim().slice(0, 3).toLowerCase();
    let yyyy = Number(dMonY[3]);
    if (yyyy < 100) yyyy += 2000;
    const months: Record<string, number> = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };
    const mm = months[mon] ?? null;
    if (!Number.isFinite(dd) || mm === null || !Number.isFinite(yyyy)) return null;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const d = new Date(yyyy, mm - 1, dd);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const jsDate = t.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
  if (jsDate) {
    const yyyy = Number(jsDate[1]);
    const mm = Number(jsDate[2]);
    const dd = Number(jsDate[3]);
    if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
    if (mm < 0 || mm > 11 || dd < 1 || dd > 31) return null;
    const d = new Date(yyyy, mm, dd);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const d1 = new Date(t);
  if (!Number.isNaN(d1.getTime())) return d1;

  return null;
}

function withinDateRange(dateText: string, start: string, end: string): boolean {
  const t = String(dateText ?? '').trim();
  if (!t) return false;

  const s = start ? parseDateLoose(start) : null;
  const e = end ? parseDateLoose(end) : null;
  if (start && !s) return true;
  if (end && !e) return true;
  const startFloor = s ? new Date(s.getFullYear(), s.getMonth(), s.getDate()) : null;
  const endExclusive = e ? new Date(e.getFullYear(), e.getMonth(), e.getDate() + 1) : null;
  if (startFloor && endExclusive && startFloor >= endExclusive) return true;

  const tDateOnly = t.split(/[ T]/)[0];
  const amb = tDateOnly.match(/^([0-9]{1,2})[\/-]([0-9]{1,2})[\/-]([0-9]{2,4})$/);

  let d = parseDateLoose(t);
  if (amb) {
    const a = Number(amb[1]);
    const b = Number(amb[2]);
    let yyyy = Number(amb[3]);
    if (yyyy < 100) yyyy += 2000;

    const ddMm = new Date(yyyy, b - 1, a);
    const mmDd = new Date(yyyy, a - 1, b);
    const ddMmOk = !Number.isNaN(ddMm.getTime()) && ddMm.getFullYear() === yyyy && ddMm.getMonth() === b - 1 && ddMm.getDate() === a;
    const mmDdOk = !Number.isNaN(mmDd.getTime()) && mmDd.getFullYear() === yyyy && mmDd.getMonth() === a - 1 && mmDd.getDate() === b;

    const inRange = (x: Date): boolean => {
      if (startFloor && x < startFloor) return false;
      if (endExclusive && x >= endExclusive) return false;
      return true;
    };

    if (ddMmOk && mmDdOk && (startFloor || endExclusive)) {
      const ddMmIn = inRange(ddMm);
      const mmDdIn = inRange(mmDd);
      if (ddMmIn !== mmDdIn) d = ddMmIn ? ddMm : mmDd;
      else d = ddMm;
    } else if (ddMmOk) {
      d = ddMm;
    } else if (mmDdOk) {
      d = mmDd;
    }
  }

  if (!d) return false;
  if (startFloor && d < startFloor) return false;
  if (endExclusive && d >= endExclusive) return false;
  return true;
}

type SessionRecord = {
  program: string;
  course: string;
  date: string;
  time: string;
  cohortName: string;
  track: string;
  cohortIds: string;
  slot: string;
  topic: string;
  agenda: string;
  professorName: string;
  professorEmail: string;
  finalStatus: string;
  inviteSent: number | null;
  peakAttendance: number | null;
  ratedCount: number | null;
  avgRating: number | null;
};

function coerceRow(row: LiveSessionsRow): SessionRecord {
  const program = String(row['Program'] ?? '').trim();
  const course = String(row['Course'] ?? '').trim() || program;
  const date = String(row['Date'] ?? '').trim();
  const time = String(row['Time'] ?? '').trim();
  const cohortName = String(row['Cohort Name'] ?? '').trim();
  const track = String(row['Track'] ?? '').trim();
  const cohortIds = String(row['Cohort Ids'] ?? row['Cohort IDs'] ?? '').trim();
  const slot = String(row['Slot'] ?? row['SLot'] ?? '').trim();
  const topic = String(row['Topic'] ?? '').trim();
  const agenda = String(row['Agenda'] ?? '').trim();
  const professorName = String(row['Professor Name'] ?? '').trim();
  const professorEmail = String(row['Professor Email'] ?? '').trim();
  const finalStatus = String(row['Final Status'] ?? '').trim();
  const inviteSent = parseNumber(String(row['Invite Sent #'] ?? ''));
  const peakAttendance = parseNumber(String(row['Peak Attendance #'] ?? ''));
  const ratedCount = parseNumber(String(row['Students Who Rated #'] ?? ''));
  const avgRating = parseNumber(String(row['Avg. Rating #'] ?? row['Avg. Rating'] ?? ''));

  return {
    program,
    course,
    date,
    time,
    cohortName,
    track,
    cohortIds,
    slot,
    topic,
    agenda,
    professorName,
    professorEmail,
    finalStatus,
    inviteSent,
    peakAttendance,
    ratedCount,
    avgRating,
  };
}

function formatPct(value: number | null): string {
  if (value === null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatMaybeRating(value: number | null): string {
  if (value === null) return '—';
  return value.toFixed(2);
}

function formatAvgCount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return String(Math.round(value));
}

function isNaProfessorName(value: string): boolean {
  const v = normalizeKey(value);
  return v === 'na' || v === 'n a' || v === 'not available';
}

function hasFinalStatus(value: string): boolean {
  return Boolean(String(value ?? '').trim());
}

function isCombinedSlot(value: string): boolean {
  return normalizeKey(value) === 'slot 1 slot 2';
}

function WrappedXAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const value = String(payload?.value ?? '');
  const maxCharsPerLine = 14;
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxCharsPerLine) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const finalLines = lines.length > 0 ? lines.slice(0, 3) : [''];
  if (lines.length > 3) finalLines[2] = `${finalLines[2]}...`;

  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text x={0} y={0} dy={34} textAnchor="middle" className="fill-gray-900 dark:fill-gray-100" fontSize={11} fontWeight={700}>
        {finalLines.map((l, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 0 : 14}>
            {l}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function WrappedYAxisTick({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const value = String(payload?.value ?? '');
  const maxCharsPerLine = 18;
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length <= maxCharsPerLine) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const finalLines = lines.length > 0 ? lines.slice(0, 2) : [''];
  if (lines.length > 2) finalLines[1] = `${finalLines[1]}...`;

  return (
    <g transform={`translate(${x ?? 0},${y ?? 0})`}>
      <text x={0} y={0} dy={4} textAnchor="end" className="fill-gray-900 dark:fill-gray-100" fontSize={11} fontWeight={600}>
        {finalLines.map((l, i) => (
          <tspan key={i} x={0} dy={i === 0 ? 0 : 12}>
            {l}
          </tspan>
        ))}
      </text>
    </g>
  );
}

function normalizeCourseForMatrix(courseRaw: string): string {
  const c = String(courseRaw ?? '').trim();
  const k = normalizeKey(c);
  if (k === 'applied ai innovation' || k === 'emerging digital technologies') {
    return 'Applied AI Innovation / Emerging Digital Technologies';
  }
  return c;
}

import { useLiveSessionsData } from '../hooks/useLiveSessionsData';

export default function LiveSessionsPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { programId } = useProgramConfig();
  const { rows, loading, error } = useLiveSessionsData();

  // Theme-aware chart colors
  const chartColors = {
    grid: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f0f0f0',
    tooltip: {
      content: isDark ? { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' } : { borderRadius: 8, border: '1px solid #e5e7eb' },
      label: isDark ? { color: '#f3f4f6' } : { fontSize: 12 }
    },
    tick: isDark ? '#9ca3af' : '#111827'
  };

  // Map the raw hook rows into the local session format
  const sessions = useMemo(() => rows.map(coerceRow), [rows]);

  const [cohortName, setCohortName] = useState('');
  const [slot, setSlot] = useState('');
  const [professor, setProfessor] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [viewMode, setViewMode] = useState<'analytics' | 'live_sessions'>('analytics');
  const [activeTable, setActiveTable] = useState<'cohort_slot' | 'professors'>('cohort_slot');

  const [cohortSlotPage, setCohortSlotPage] = useState(1);
  const [cohortSlotPerPage, setCohortSlotPerPage] = useState(10);
  const [professorPage, setProfessorPage] = useState(1);
  const [professorPerPage, setProfessorPerPage] = useState(10);

  const options = useMemo(() => {
    function uniq(values: string[]): string[] {
      return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    }

    return {
      programs: uniq(sessions.map((s) => s.program)),
      cohortNames: uniq(sessions.map((s) => s.cohortName)),
      slots: uniq(sessions.map((s) => s.slot)).filter((s) => !isCombinedSlot(s)),
      professors: uniq(
        sessions
          .filter((s) => !isNaProfessorName(s.professorName))
          .map((s) => s.professorName || s.professorEmail)
          .filter(Boolean),
      ),
    };
  }, [sessions]);

  const filtered = useMemo(() => {
    const out = sessions.filter((s) => {
      if (cohortName && s.cohortName !== cohortName) return false;
      if (slot && s.slot !== slot) return false;

      if (professor) {
        const professorName = s.professorName || s.professorEmail || '';
        if (professorName.toLowerCase() !== professor.toLowerCase()) return false;
      }

      if (startDate || endDate) {
        if (!withinDateRange(s.date, startDate, endDate)) return false;
      }

      return true;
    });

    return out;
  }, [sessions, cohortName, slot, professor, startDate, endDate]);

  const kpis = useMemo(() => {
    let totalSessions = 0;
    let totalInvites = 0;
    let totalPeak = 0;
    let totalRated = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    for (const s of filtered) {
      if (!String(s.slot ?? '').trim()) continue;
      if (isCombinedSlot(s.slot)) continue;
      totalSessions += 1;
      if (s.inviteSent !== null) totalInvites += s.inviteSent;
      if (s.peakAttendance !== null) totalPeak += s.peakAttendance;
      if (s.ratedCount !== null) totalRated += s.ratedCount;
      if (s.avgRating !== null) {
        ratingSum += s.avgRating;
        ratingCount += 1;
      }
    }

    const avgRating = ratingCount > 0 ? ratingSum / ratingCount : null;
    const attendanceRate = totalInvites > 0 ? totalPeak / totalInvites : null;
    const ratingParticipation = totalInvites > 0 ? totalRated / totalInvites : null;

    return {
      totalSessions,
      totalInvites,
      totalPeak,
      totalRated,
      attendanceRate,
      ratingParticipation,
      avgRating,
    };
  }, [filtered]);

  const cohortSlotSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        cohortName: string;
        slot: string;
        sessions: number;
        invites: number;
        peak: number;
        rated: number;
        ratingSum: number;
        ratingCount: number;
      }
    >();

    for (const s of filtered) {
      if (!hasFinalStatus(s.finalStatus)) continue;
      if (!String(s.slot ?? '').trim()) continue;
      if (isCombinedSlot(s.slot)) continue;
      const key = `${s.cohortName}__${s.slot}`;
      const cur = map.get(key) ?? {
        cohortName: s.cohortName || '—',
        slot: s.slot || '—',
        sessions: 0,
        invites: 0,
        peak: 0,
        rated: 0,
        ratingSum: 0,
        ratingCount: 0,
      };

      cur.sessions += 1;
      if (s.inviteSent !== null) cur.invites += s.inviteSent;
      if (s.peakAttendance !== null) cur.peak += s.peakAttendance;
      if (s.ratedCount !== null) cur.rated += s.ratedCount;
      if (s.avgRating !== null) {
        cur.ratingSum += s.avgRating;
        cur.ratingCount += 1;
      }

      map.set(key, cur);
    }

    const rows = Array.from(map.values());

    rows.sort((a, b) => {
      if (b.sessions !== a.sessions) return b.sessions - a.sessions;

      const aAvgRating = a.ratingCount > 0 ? a.ratingSum / a.ratingCount : -1;
      const bAvgRating = b.ratingCount > 0 ? b.ratingSum / b.ratingCount : -1;
      if (bAvgRating !== aAvgRating) return bAvgRating - aAvgRating;

      const aAttendancePct = a.invites > 0 ? a.peak / a.invites : -1;
      const bAttendancePct = b.invites > 0 ? b.peak / b.invites : -1;
      if (bAttendancePct !== aAttendancePct) return bAttendancePct - aAttendancePct;

      return b.sessions - a.sessions;
    });

    return rows;
  }, [filtered]);

  const professorSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        professorName: string;
        professorEmail: string;
        sessions: number;
        invites: number;
        peak: number;
        rated: number;
        ratingSum: number;
        ratingCount: number;
      }
    >();

    for (const s of filtered) {
      if (!hasFinalStatus(s.finalStatus)) continue;
      if (isNaProfessorName(s.professorName)) continue;
      if (!String(s.slot ?? '').trim()) continue;
      if (isCombinedSlot(s.slot)) continue;
      const key = (s.professorEmail || s.professorName || '').trim().toLowerCase() || 'unknown';
      const cur = map.get(key) ?? {
        professorName: s.professorName || '—',
        professorEmail: s.professorEmail || '—',
        sessions: 0,
        invites: 0,
        peak: 0,
        rated: 0,
        ratingSum: 0,
        ratingCount: 0,
      };

      cur.sessions += 1;
      if (s.inviteSent !== null) cur.invites += s.inviteSent;
      if (s.peakAttendance !== null) cur.peak += s.peakAttendance;
      if (s.ratedCount !== null) cur.rated += s.ratedCount;
      if (s.avgRating !== null) {
        cur.ratingSum += s.avgRating;
        cur.ratingCount += 1;
      }

      map.set(key, cur);
    }

    const rows = Array.from(map.values());

    rows.sort((a, b) => {
      if (b.sessions !== a.sessions) return b.sessions - a.sessions;

      const aAvgRating = a.ratingCount > 0 ? a.ratingSum / a.ratingCount : -1;
      const bAvgRating = b.ratingCount > 0 ? b.ratingSum / b.ratingCount : -1;
      if (bAvgRating !== aAvgRating) return bAvgRating - aAvgRating;

      const aAttendancePct = a.invites > 0 ? a.peak / a.invites : -1;
      const bAttendancePct = b.invites > 0 ? b.peak / b.invites : -1;
      if (bAttendancePct !== aAttendancePct) return bAttendancePct - aAttendancePct;

      return b.sessions - a.sessions;
    });

    return rows;
  }, [filtered]);

  const cohortSlotTotalPages = useMemo(
    () => Math.max(1, Math.ceil(cohortSlotSummary.length / cohortSlotPerPage)),
    [cohortSlotPerPage, cohortSlotSummary.length],
  );
  const cohortSlotSafePage = Math.min(cohortSlotPage, cohortSlotTotalPages);
  const cohortSlotPageItems = useMemo(() => {
    const start = (cohortSlotSafePage - 1) * cohortSlotPerPage;
    return cohortSlotSummary.slice(start, start + cohortSlotPerPage);
  }, [cohortSlotPerPage, cohortSlotSafePage, cohortSlotSummary]);

  const professorTotalPages = useMemo(
    () => Math.max(1, Math.ceil(professorSummary.length / professorPerPage)),
    [professorPerPage, professorSummary.length],
  );
  const professorSafePage = Math.min(professorPage, professorTotalPages);
  const professorPageItems = useMemo(() => {
    const start = (professorSafePage - 1) * professorPerPage;
    return professorSummary.slice(start, start + professorPerPage);
  }, [professorPerPage, professorSafePage, professorSummary]);

  const cohortSlotPaginationPages = useMemo(() => {
    const pages: Array<number | 'ellipsis'> = [];
    const add = (p: number | 'ellipsis') => {
      if (pages.length === 0 || pages[pages.length - 1] !== p) pages.push(p);
    };
    for (let p = 1; p <= cohortSlotTotalPages; p += 1) {
      const nearCurrent = Math.abs(p - cohortSlotSafePage) <= 1;
      const nearEnds = p <= 3 || p >= cohortSlotTotalPages - 2;
      if (p === 1 || p === cohortSlotTotalPages || nearCurrent || nearEnds) add(p);
      else if (pages[pages.length - 1] !== 'ellipsis') add('ellipsis');
    }
    return pages;
  }, [cohortSlotSafePage, cohortSlotTotalPages]);

  const professorPaginationPages = useMemo(() => {
    const pages: Array<number | 'ellipsis'> = [];
    const add = (p: number | 'ellipsis') => {
      if (pages.length === 0 || pages[pages.length - 1] !== p) pages.push(p);
    };
    for (let p = 1; p <= professorTotalPages; p += 1) {
      const nearCurrent = Math.abs(p - professorSafePage) <= 1;
      const nearEnds = p <= 3 || p >= professorTotalPages - 2;
      if (p === 1 || p === professorTotalPages || nearCurrent || nearEnds) add(p);
      else if (pages[pages.length - 1] !== 'ellipsis') add('ellipsis');
    }
    return pages;
  }, [professorSafePage, professorTotalPages]);

  return (
    <div className="min-h-screen" onClick={() => { /* close any open dropdowns */ }}>

      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Live Sessions</h1>
            <p className="text-gray-600 dark:text-gray-400">Quick insights by cohort / slot and professor. Use filters to narrow the view.</p>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { icon: 'fa-video', gradient: 'from-blue-400 to-blue-600', label: 'Total Sessions', badge: 'text-blue-600 bg-blue-50', bar: 'from-blue-200 to-blue-400', value: <AnimatedNumber value={kpis.totalSessions} />, badgeText: 'Total' },
          { icon: 'fa-users', gradient: 'from-emerald-400 to-emerald-600', label: 'Attendance Rate', badge: 'text-emerald-600 bg-emerald-50', bar: 'from-emerald-200 to-emerald-400', value: <AnimatedNumber value={kpis.attendanceRate === null ? null : kpis.attendanceRate * 100} formatter={(v) => `${v.toFixed(1)}%`} />, badgeText: 'Rate' },
          { icon: 'fa-star', gradient: 'from-purple-400 to-purple-600', label: 'Average Rating', badge: 'text-purple-600 bg-purple-50', bar: 'from-purple-200 to-purple-400', value: <AnimatedNumber value={kpis.avgRating} formatter={(v) => v.toFixed(2)} />, badgeText: 'Avg' },
          { icon: 'fa-comment-dots', gradient: 'from-orange-400 to-orange-600', label: 'Feedback Rate', badge: 'text-orange-600 bg-orange-50', bar: 'from-orange-200 to-orange-400', value: <AnimatedNumber value={kpis.ratingParticipation === null ? null : kpis.ratingParticipation * 100} formatter={(v) => `${v.toFixed(1)}%`} />, badgeText: 'Rate' },
        ].map((k) => (
          <div key={k.label} className="group relative bg-white dark:bg-gray-800 bg-opacity-80 dark:bg-opacity-80 backdrop-blur-lg rounded-xl shadow-xl p-4 border border-white dark:border-white/5 border-opacity-20 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${k.gradient} rounded-full opacity-10 -mr-10 -mt-10 group-hover:opacity-20 transition-opacity`} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                  <i className={`fas ${k.icon} ${k.badge.split(' ')[0]} text-xl`} />
                </div>
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${k.badge}`}>{k.badgeText}</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">{k.value}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">{k.label}</p>
              <div className={`mt-4 h-1 bg-gradient-to-r ${k.bar} rounded-full`} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Console ──────────────────────────────────────────── */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 mb-10 border border-white/60 dark:border-white/10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-gray-700 flex items-center justify-center shadow-sm border border-indigo-100 dark:border-indigo-900">
              <i className="fas fa-sliders-h text-indigo-600 dark:text-indigo-400 text-sm" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-800 dark:text-gray-100 uppercase tracking-widest">Filter Console</h2>
              <p className="text-xs text-gray-400 font-medium">Narrow your data by cohort, slot, professor and date range</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setCohortName(''); setSlot(''); setProfessor(''); setStartDate(''); setEndDate(''); }}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-sync-alt" /> Reset
          </button>
        </div>

        {/* Filter dropdowns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8 relative z-20">
          {/* Cohort */}
          <div className="relative">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Active Cohort</label>
            <select
              value={cohortName}
              onChange={(e) => setCohortName(e.target.value)}
              className={`w-full px-4 py-2.5 text-left border rounded-xl transition-all ${cohortName ? 'border-indigo-500 text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800'}`}
            >
              <option value="">All Cohorts</option>
              {options.cohortNames.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Slot */}
          <div className="relative">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Engagement Slot</label>
            <select
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className={`w-full px-4 py-2.5 text-left border rounded-xl transition-all ${slot ? 'border-indigo-500 text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800'}`}
            >
              <option value="">All Slots</option>
              {options.slots.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Professor */}
          <div className="relative">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Professor</label>
            <select
              value={professor}
              onChange={(e) => setProfessor(e.target.value)}
              className={`w-full px-4 py-2.5 text-left border rounded-xl transition-all ${professor ? 'border-indigo-500 text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800'}`}
            >
              <option value="">All Professors</option>
              {options.professors.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Start Date */}
          <div className="relative">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-xl transition-all ${startDate ? 'border-indigo-500 text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800'}`}
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-xl transition-all ${endDate ? 'border-indigo-500 text-indigo-700 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800'}`}
            />
          </div>
        </div>

        {/* Active filter tags */}
        {(cohortName || slot || professor || startDate || endDate) && (
          <div className="flex border-t border-gray-100 pt-6 flex-wrap gap-2 items-center">
            <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-2">Active:</span>
            {cohortName && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <i className="fas fa-users text-[9px]" />{cohortName}
                <button onClick={() => setCohortName('')} className="hover:text-indigo-900 ml-1"><i className="fas fa-times text-[9px]" /></button>
              </span>
            )}
            {slot && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <i className="fas fa-clock text-[9px]" />{slot}
                <button onClick={() => setSlot('')} className="hover:text-indigo-900 ml-1"><i className="fas fa-times text-[9px]" /></button>
              </span>
            )}
            {professor && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <i className="fas fa-chalkboard-teacher text-[9px]" />{professor}
                <button onClick={() => setProfessor('')} className="hover:text-indigo-900 ml-1"><i className="fas fa-times text-[9px]" /></button>
              </span>
            )}
            {startDate && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <i className="fas fa-calendar text-[9px]" />From: {startDate}
                <button onClick={() => setStartDate('')} className="hover:text-indigo-900 ml-1"><i className="fas fa-times text-[9px]" /></button>
              </span>
            )}
            {endDate && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                <i className="fas fa-calendar text-[9px]" />To: {endDate}
                <button onClick={() => setEndDate('')} className="hover:text-indigo-900 ml-1"><i className="fas fa-times text-[9px]" /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Loading / Error ──────────────────────────────────────────── */}
      {loading && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-12 text-center mb-8">
          <i className="fas fa-spinner fa-spin text-4xl text-indigo-400 mb-4" />
          <p className="text-gray-500 font-medium">Loading Live Sessions…</p>
        </div>
      )}
      {error && (
        <div className="bg-white rounded-3xl shadow-sm border border-red-100 p-8 mb-8">
          <p className="text-red-700 font-semibold mb-1">Failed to load Live Sessions data</p>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Tab Switcher ─────────────────────────────────────────── */}
          <div className="acad-tabs">
            <button
              type="button"
              onClick={() => setViewMode('analytics')}
              className={`acad-tab ${viewMode === 'analytics' ? 'acad-tab-active' : ''}`}
            >
              <i className="fas fa-chart-bar" />
              Analytics
            </button>
            <button
              type="button"
              onClick={() => setViewMode('live_sessions')}
              className={`acad-tab ${viewMode === 'live_sessions' ? 'acad-tab-active' : 'text-gray-500 dark:text-gray-400'}`}
            >
              <i className="fas fa-video" />
              Live Sessions
            </button>
          </div>

          {/* ── Analytics View ───────────────────────────────────────── */}
          {viewMode === 'analytics' ? (
            <div className="w-full block" key={`analytics-${kpis.totalSessions}`}>
              {(() => {
                const rows = filtered.filter((s) => {
                  if (!hasFinalStatus(s.finalStatus)) return false;
                  if (!String(s.slot ?? '').trim()) return false;
                  if (isCombinedSlot(s.slot)) return false;
                  return true;
                });

                const overallFiltered = sessions.filter((s) => {
                  if (cohortName && s.cohortName !== cohortName) return false;
                  if (slot && s.slot !== slot) return false;
                  if (startDate || endDate) {
                    if (!withinDateRange(s.date, startDate, endDate)) return false;
                  }
                  return true;
                });
                const overallRows = overallFiltered.filter((s) => {
                  if (!hasFinalStatus(s.finalStatus)) return false;
                  if (!String(s.slot ?? '').trim()) return false;
                  if (isCombinedSlot(s.slot)) return false;
                  return true;
                });

                // 1. Attendance Rate Trend
                const monthMap = new Map<string, { monthKey: string; monthLabel: string; totalInvites: number; totalPeak: number; count: number }>();
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                for (const s of rows) {
                  if (!s.inviteSent || s.inviteSent <= 0) continue;
                  if (String(s.finalStatus).trim() !== 'Session Done') continue;
                  const dateKey = String(s.date || '').trim();
                  if (!dateKey) continue;
                  const d = parseDateLoose(dateKey);
                  if (!d) continue;
                  const month = d.getMonth();
                  const year = d.getFullYear();
                  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
                  const monthLabel = `${monthNames[month]}-${String(year).slice(-2)}`;
                  const cur = monthMap.get(monthKey) ?? { monthKey, monthLabel, totalInvites: 0, totalPeak: 0, count: 0 };
                  cur.totalInvites += s.inviteSent;
                  if (s.peakAttendance !== null) cur.totalPeak += s.peakAttendance;
                  cur.count += 1;
                  monthMap.set(monthKey, cur);
                }
                const attendanceTrendData = Array.from(monthMap.values())
                  .map((d) => ({ monthKey: d.monthKey, monthLabel: d.monthLabel, attendanceRate: d.totalInvites > 0 ? (d.totalPeak / d.totalInvites) * 100 : 0 }))
                  .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

                // 2. Professor Performance Score
                const profMap = new Map<string, { name: string; email: string; totalRating: number; ratingCount: number; totalInvites: number; totalPeak: number; totalRated: number; sessions: number }>();
                for (const s of rows) {
                  if (isNaProfessorName(s.professorName)) continue;
                  if (String(s.finalStatus).trim() !== 'Session Done') continue;
                  const key = (s.professorEmail || s.professorName || '').trim().toLowerCase() || 'unknown';
                  const cur = profMap.get(key) ?? { name: s.professorName || '—', email: s.professorEmail || '—', totalRating: 0, ratingCount: 0, totalInvites: 0, totalPeak: 0, totalRated: 0, sessions: 0 };
                  cur.sessions += 1;
                  if (s.avgRating !== null && s.avgRating > 0) { cur.totalRating += s.avgRating; cur.ratingCount += 1; }
                  if (s.inviteSent !== null) cur.totalInvites += s.inviteSent;
                  if (s.peakAttendance !== null) cur.totalPeak += s.peakAttendance;
                  if (s.ratedCount !== null) cur.totalRated += s.ratedCount;
                  profMap.set(key, cur);
                }
                const professorData = Array.from(profMap.values()).map((p) => {
                  const avgRating = p.ratingCount > 0 ? p.totalRating / p.ratingCount : 0;
                  const attendanceRate = p.totalInvites > 0 ? (p.totalPeak / p.totalInvites) : 0;
                  const feedbackRate = p.totalInvites > 0 ? (p.totalRated / p.totalInvites) : 0;
                  const performanceScore = (avgRating > 0 ? (avgRating / 5) * 35 : 0) + attendanceRate * 25 + feedbackRate * 20 + Math.min(p.sessions / 20, 1) * 20;
                  return { name: p.name, avgRating, attendanceRate: attendanceRate * 100, feedbackRate: feedbackRate * 100, ratedCount: p.totalRated, sessions: p.sessions, performanceScore };
                }).filter((p) => p.sessions > 0).sort((a, b) => b.performanceScore - a.performanceScore).slice(0, 10);

                // 3. Course Performance
                const courseMap = new Map<string, { course: string; totalRating: number; ratingCount: number; totalInvites: number; totalPeak: number; sessions: number }>();
                for (const s of overallRows) {
                  const course = String(s.course || s.program || '').trim() || 'Unknown';
                  if (course === 'Unknown') continue;
                  const cur = courseMap.get(course) ?? { course, totalRating: 0, ratingCount: 0, totalInvites: 0, totalPeak: 0, sessions: 0 };
                  cur.sessions += 1;
                  if (s.avgRating !== null && s.avgRating > 0) { cur.totalRating += s.avgRating; cur.ratingCount += 1; }
                  if (s.inviteSent !== null) cur.totalInvites += s.inviteSent;
                  if (s.peakAttendance !== null) cur.totalPeak += s.peakAttendance;
                  courseMap.set(course, cur);
                }
                const courseData = Array.from(courseMap.values()).map((c) => ({ course: c.course, avgRating: c.ratingCount > 0 ? c.totalRating / c.ratingCount : 0, attendanceRate: c.totalInvites > 0 ? (c.totalPeak / c.totalInvites) * 100 : 0, sessions: c.sessions })).filter((c) => c.sessions > 0).filter((c) => normalizeKey(c.course) !== 'other').sort((a, b) => b.avgRating - a.avgRating).slice(0, 12);

                // 4. Rating Distribution
                const ratingBuckets = { '4.8 - 5.0': 0, '4.5 - 4.79': 0, '4.0 - 4.49': 0, 'Below 4.0': 0 };
                for (const s of rows) {
                  if (s.avgRating === null) continue;
                  const r = s.avgRating;
                  if (r >= 4.8) ratingBuckets['4.8 - 5.0']++;
                  else if (r >= 4.5) ratingBuckets['4.5 - 4.79']++;
                  else if (r >= 4.0) ratingBuckets['4.0 - 4.49']++;
                  else ratingBuckets['Below 4.0']++;
                }
                const ratingDistData = [
                  { bucket: '4.8 - 5.0', count: ratingBuckets['4.8 - 5.0'], color: '#10b981' },
                  { bucket: '4.5 - 4.79', count: ratingBuckets['4.5 - 4.79'], color: '#6366f1' },
                  { bucket: '4.0 - 4.49', count: ratingBuckets['4.0 - 4.49'], color: '#f59e0b' },
                  { bucket: 'Below 4.0', count: ratingBuckets['Below 4.0'], color: '#ef4444' },
                ].filter((d) => d.count > 0);

                // 5. Cohort-Slot-Course Matrix
                const cohortSlotCourseMap = new Map<string, { cohortSlot: string; course: string; totalRating: number; ratingCount: number; professors: Set<string> }>();
                const uniqueCourses = new Set<string>();
                const uniqueCohortSlots = new Set<string>();
                for (const s of overallRows) {
                  const rawCourse = String(s.course || s.program || '').trim() || 'Unknown';
                  const course = normalizeCourseForMatrix(rawCourse);
                  if (course === 'Unknown') continue;
                  const cohortSlot = `${String(s.cohortName || '—').trim()} | ${String(s.slot || '—').trim()}`;
                  const key = `${cohortSlot}__${course}`;
                  const cur = cohortSlotCourseMap.get(key) ?? { cohortSlot, course, totalRating: 0, ratingCount: 0, professors: new Set<string>() };
                  const pn = String(s.professorName || s.professorEmail || '').trim();
                  if (pn) cur.professors.add(pn);
                  if (s.avgRating !== null && s.avgRating > 0) { cur.totalRating += s.avgRating; cur.ratingCount += 1; }
                  cohortSlotCourseMap.set(key, cur);
                  uniqueCourses.add(course);
                  uniqueCohortSlots.add(cohortSlot);
                }
                const ensureAiEdt = 'Applied AI Innovation / Emerging Digital Technologies';
                uniqueCourses.add(ensureAiEdt);
                const coursesList = Array.from(uniqueCourses).sort((a, b) => a.localeCompare(b)).filter((c) => c !== ensureAiEdt).filter((c) => normalizeKey(c) !== 'other').slice(0, 6);
                coursesList.push(ensureAiEdt);
                const parseCohortNumber = (t: string) => { const m = t.split('|')[0]?.match(/(\d+)/); return m ? Number(m[1]) : Number.POSITIVE_INFINITY; };
                const parseSlotText = (t: string) => String(t.split('|')[1] ?? '').trim();
                const cohortSlotList = Array.from(uniqueCohortSlots).sort((a, b) => { const an = parseCohortNumber(a); const bn = parseCohortNumber(b); if (an !== bn) return an - bn; return parseSlotText(a).localeCompare(parseSlotText(b)); });
                const cohortSlotCourseMatrix = cohortSlotList.map((cs) => {
                  const row: Record<string, string | number> = { cohortSlot: cs };
                  for (const course of coursesList) {
                    const data = Array.from(cohortSlotCourseMap.values()).find((d) => d.cohortSlot === cs && d.course === course);
                    row[course] = data && data.ratingCount > 0 ? Number((data.totalRating / data.ratingCount).toFixed(2)) : 0;
                  }
                  return row;
                });
                const cohortSlotCourseProfessorText = new Map<string, string>();
                for (const [key, d] of cohortSlotCourseMap.entries()) {
                  const names = Array.from(d.professors.values()).map((x) => x.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b));
                  if (names.length > 0) cohortSlotCourseProfessorText.set(key, names.join(', '));
                }

                const hasData = attendanceTrendData.length > 0 || professorData.length > 0 || ratingDistData.length > 0 || courseData.length > 0 || cohortSlotCourseMatrix.length > 0;
                if (!hasData) {
                  return (
                    <div style={{ background: '#fff', borderRadius: '1.5rem', border: '1px solid #f3f4f6', padding: '3rem', textAlign: 'center' }}>
                      <i className="fas fa-chart-line text-4xl text-gray-300 mb-4" />
                      <p className="text-lg font-medium text-gray-500">No analytics data available</p>
                      <p className="text-sm text-gray-400">Try adjusting your filters</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-8">
                    <div key="attendance-trend" className="bg-white dark:bg-gray-800 rounded-[1.5rem] p-8 shadow-sm dark:shadow-2xl border border-gray-100 dark:border-white/10 min-w-0">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Attendance Rate Trend</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Monthly attendance % for completed sessions</p>
                        </div>
                        <span className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">{attendanceTrendData.length} months</span>
                      </div>
                      <div className="h-[320px] w-full block relative overflow-hidden">
                        <LineChart width={1200} height={320} data={attendanceTrendData} margin={{ top: 30, right: 30, bottom: 20, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                          <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: chartColors.tick }} height={40} axisLine={{ stroke: chartColors.grid }} />
                          <YAxis tick={{ fontSize: 11, fill: chartColors.tick }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} axisLine={{ stroke: chartColors.grid }} label={{ value: 'Attendance %', angle: -90, position: 'insideLeft', fontSize: 12, fill: chartColors.tick }} />
                          <Tooltip 
                            formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Attendance Rate']} 
                            labelStyle={chartColors.tooltip.label} 
                            contentStyle={chartColors.tooltip.content} 
                          />
                          <Line type="monotone" dataKey="attendanceRate" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', strokeWidth: 2, r: 5 }} activeDot={{ r: 7, stroke: '#10b981', strokeWidth: 2 }}>
                            <LabelList dataKey="attendanceRate" position="top" formatter={(value) => `${(value as number).toFixed(0)}%`} style={{ fill: isDark ? '#34d399' : '#059669', fontSize: 11, fontWeight: 600 }} offset={10} />
                          </Line>
                        </LineChart>
                      </div>
                    </div>

                    {/* Professor Performance + Rating Distribution */}
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                      <div key="professor-perf" className="bg-white dark:bg-gray-800 rounded-[1.5rem] p-8 shadow-sm dark:shadow-2xl border border-gray-100 dark:border-white/10 min-w-0">
                        <div className="mb-6">
                          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Professor Performance Score</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Composite: Rating 35% + Attendance 25% + Feedback 20% + Experience 20%</p>
                        </div>
                        <div className="h-[400px] w-full block relative overflow-hidden">
                          <BarChart width={560} height={400} data={professorData} layout="vertical" margin={{ top: 5, right: 80, bottom: 10, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} horizontal={true} vertical={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: chartColors.tick }} tickFormatter={(v) => `${v}`} axisLine={{ stroke: chartColors.grid }} />
                            <YAxis type="category" dataKey="name" tick={<WrappedYAxisTick />} width={190} interval={0} axisLine={{ stroke: chartColors.grid }} />
                            <Tooltip content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as { name: string; performanceScore: number; avgRating: number; sessions: number; attendanceRate: number; feedbackRate: number };
                                return (
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-white/10">
                                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{data.name}</p>
                                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Score: {data.performanceScore.toFixed(1)}</p>
                                    <hr className="my-2 border-gray-100 dark:border-white/5" />
                                    <p className="text-sm text-gray-600 dark:text-gray-400">⭐ Rating: {data.avgRating.toFixed(2)}/5</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">📊 Sessions: {data.sessions}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">👥 Attendance: {data.attendanceRate.toFixed(1)}%</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">💬 Feedback: {data.feedbackRate.toFixed(1)}%</p>
                                  </div>
                                );
                              }
                              return null;
                            }} />
                            <Bar dataKey="performanceScore" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24}>
                              {professorData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.performanceScore >= 80 ? '#059669' : entry.performanceScore >= 60 ? '#6366f1' : '#a5b4fc'} />
                              ))}
                              <LabelList dataKey="performanceScore" position="right" formatter={(v) => `${(v as number).toFixed(1)}`} style={{ fill: isDark ? '#818cf8' : '#4f46e5', fontSize: 11, fontWeight: 600 }} />
                            </Bar>
                          </BarChart>
                        </div>
                      </div>

                      <div key="rating-dist" className="bg-white dark:bg-gray-800 rounded-[1.5rem] p-8 shadow-sm dark:shadow-2xl border border-gray-100 dark:border-white/10 min-w-0">
                        <div className="mb-6">
                          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Rating Distribution</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Session count by rating bucket</p>
                        </div>
                        <div className="h-[400px] w-full block relative overflow-hidden">
                          <BarChart width={560} height={400} data={ratingDistData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                            <XAxis dataKey="bucket" tick={{ fontSize: 13, fontWeight: 700, fill: chartColors.tick }} height={72} interval={0} axisLine={{ stroke: chartColors.grid }} />
                            <YAxis tick={{ fontSize: 11, fill: chartColors.tick }} axisLine={{ stroke: chartColors.grid }} label={{ value: 'Count of Sessions', angle: -90, position: 'insideLeft', fontSize: 12, fill: chartColors.tick }} />
                            <Tooltip content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as { bucket: string; count: number };
                                return (
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-white/10">
                                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{data.bucket}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">Sessions: {data.count}</p>
                                  </div>
                                );
                              }
                              return null;
                            }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                              {ratingDistData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                              <LabelList dataKey="count" position="top" style={{ fill: isDark ? '#cbd5e1' : '#374151', fontSize: 12, fontWeight: 600 }} />
                            </Bar>
                          </BarChart>
                        </div>
                      </div>
                    </div>

                    {/* Course-wise Performance */}
                    {(programId !== 'dba' && programId !== 'mba') && (
                      <div key="course-perf" className="bg-white dark:bg-gray-800 rounded-[1.5rem] p-8 shadow-sm dark:shadow-2xl border border-gray-100 dark:border-white/10 min-w-0">
                        <div className="mb-6">
                          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Course-wise Performance Overview</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Avg Rating &amp; Attendance % by Course</p>
                        </div>
                        <div className="h-[580px] w-full block relative overflow-hidden">
                          <BarChart width={1200} height={580} data={courseData} margin={{ top: 24, right: 30, bottom: 150, left: 10 }} barCategoryGap={22} barGap={6}>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                            <XAxis dataKey="course" tick={<WrappedXAxisTick />} height={140} tickMargin={24} interval={0} axisLine={{ stroke: chartColors.grid }} />
                            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: chartColors.tick }} domain={[0, 5]} tickFormatter={(v) => `${v}★`} axisLine={{ stroke: chartColors.grid }} label={{ value: 'Avg Rating', angle: -90, position: 'insideLeft', fontSize: 12, fill: chartColors.tick }} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: chartColors.tick }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} axisLine={{ stroke: chartColors.grid }} label={{ value: 'Attendance %', angle: 90, position: 'insideRight', fontSize: 12, fill: chartColors.tick }} />
                            <Tooltip content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload as { course: string; avgRating: number; attendanceRate: number; sessions: number };
                                return (
                                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-white/10">
                                    <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{data.course}</p>
                                    <hr className="my-2 border-gray-100 dark:border-white/5" />
                                    <p className="text-sm text-gray-600 dark:text-gray-400">⭐ Rating: {data.avgRating.toFixed(2)}/5</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">👥 Attendance: {data.attendanceRate.toFixed(1)}%</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">📊 Sessions: {data.sessions}</p>
                                  </div>
                                );
                              }
                              return null;
                            }} />
                            <Legend />
                            <Bar yAxisId="left" dataKey="avgRating" name="Avg Rating" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={48}>
                              <LabelList dataKey="avgRating" position="top" formatter={(v) => `${(v as number).toFixed(2)}★`} style={{ fill: isDark ? '#a78bfa' : '#7c3aed', fontSize: 10 }} />
                            </Bar>
                            <Bar yAxisId="right" dataKey="attendanceRate" name="Attendance %" fill="#10b981" radius={[4, 4, 0, 0]} barSize={48}>
                              <LabelList dataKey="attendanceRate" position="top" formatter={(v) => `${(v as number).toFixed(0)}%`} style={{ fill: isDark ? '#34d399' : '#059669', fontSize: 10 }} />
                            </Bar>
                          </BarChart>
                        </div>
                      </div>
                    )}

                    {/* Cohort Performance Matrix */}
                    {
                      (programId !== 'dba' && programId !== 'mba') && cohortSlotCourseMatrix.length > 0 && coursesList.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 rounded-[1.5rem] p-8 shadow-sm dark:shadow-2xl border border-gray-100 dark:border-white/10 min-w-0">
                          <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Cohort Performance Within Each Course</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Avg Rating by Cohort and Course (Overall)</p>
                          </div>
                          <div className="w-full overflow-x-auto">
                            <table className="w-full border-collapse table-fixed">
                              <thead>
                                <tr>
                                  <th className="w-44 px-3 py-2 text-left text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b-2 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-900/50 sticky left-0 z-10">Cohort &amp; Slot</th>
                                  {coursesList.map((course) => (
                                    <th key={course} className="w-[120px] px-2 py-2 text-center text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider border-b-2 border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-gray-900/50 whitespace-normal break-words" title={course}>
                                      <span className="block leading-snug">{course}</span>
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 dark:divide-white/5">
                                {cohortSlotCourseMatrix.map((row, idx) => (
                                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                    <td className="w-44 px-3 py-2 text-xs font-semibold text-gray-800 dark:text-gray-200 border-r border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800 sticky left-0 z-10 whitespace-nowrap">{row.cohortSlot}</td>
                                    {coursesList.map((course) => {
                                      const rating = row[course] as number;
                                      const professorText = cohortSlotCourseProfessorText.get(`${String(row.cohortSlot)}__${course}`);
                                      let bgColor = isDark ? 'bg-white/5' : 'bg-gray-100'; 
                                      let textColor = isDark ? 'text-gray-400' : 'text-gray-500';
                                      if (rating > 0) { 
                                        bgColor = rating >= 4.5 ? (isDark ? 'bg-green-500/20' : 'bg-green-100') : (isDark ? 'bg-red-500/20' : 'bg-red-100'); 
                                        textColor = rating >= 4.5 ? (isDark ? 'text-green-400' : 'text-green-700') : (isDark ? 'text-red-400' : 'text-red-700'); 
                                      }
                                      return (
                                        <td key={course} className="px-2 py-2 text-center">
                                          <div className="relative inline-flex group">
                                            <span className={`inline-flex items-center justify-center w-11 h-7 rounded-md text-xs font-bold ${bgColor} ${textColor}`}>{rating > 0 ? rating.toFixed(2) : '—'}</span>
                                            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50">
                                              <div className="bg-slate-900 text-white text-[11px] leading-snug px-3 py-2 rounded-lg shadow-xl border border-slate-700 whitespace-pre-line max-w-[260px]">{professorText ?? 'No professor'}</div>
                                              <div className="w-2.5 h-2.5 bg-slate-900 border border-slate-700 rotate-45 mx-auto -mt-1" />
                                            </div>
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    }
                  </div>
                );
              })()}
            </div>
          ) : (
            <>
              {/* ── Live Sessions Table View ───────────────────────── */}
              {/* Sub-tab: Cohort+Slot vs Professors */}
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-fit mb-6">
                <button type="button" onClick={() => setActiveTable('cohort_slot')} className={`px-5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTable === 'cohort_slot' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  <i className="fas fa-layer-group mr-1" />Cohort &amp; Slot
                </button>
                <button type="button" onClick={() => setActiveTable('professors')} className={`px-5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${activeTable === 'professors' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}>
                  <i className="fas fa-chalkboard-teacher mr-1" />Professors
                </button>
              </div>

              {activeTable === 'cohort_slot' ? (
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden mb-6">
                  <div className="flex items-center gap-3 px-8 py-5 border-b border-gray-100 dark:border-white/5">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <i className="fas fa-layer-group text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Cohort &amp; Slot</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sorted by Attendance % then Avg. Rating</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-white/10">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cohort &amp; Slot</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Attendance %</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg. Rating</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sessions</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg. Learners</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg. Attendance</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Rated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {cohortSlotPageItems.length === 0 ? (
                          <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500"><i className="fas fa-layer-group text-3xl mb-3 block" />No cohort-slot rows found</td></tr>
                        ) : cohortSlotPageItems.map((r) => {
                          const attendancePct = r.invites > 0 ? r.peak / r.invites : null;
                          const avgRating = r.ratingCount > 0 ? r.ratingSum / r.ratingCount : null;
                          return (
                            <tr key={`${r.cohortName}-${r.slot}`} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl flex items-center justify-center text-blue-700 dark:text-blue-400 text-xs font-black flex-shrink-0">
                                    {(r.cohortName || 'C').trim()[0]?.toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{r.cohortName}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">Slot: {r.slot}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatPct(attendancePct)}</td>
                              <td className="px-6 py-4 text-center text-sm font-bold text-purple-700 dark:text-purple-400">{formatMaybeRating(avgRating)}</td>
                              <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">{r.sessions}</td>
                              <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">{formatAvgCount(r.sessions > 0 ? r.invites / r.sessions : 0)}</td>
                              <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">{formatAvgCount(r.sessions > 0 ? r.peak / r.sessions : 0)}</td>
                              <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">{r.rated}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-white/5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>Show</span>
                      <select value={cohortSlotPerPage} onChange={(e) => { setCohortSlotPerPage(Number(e.target.value)); setCohortSlotPage(1); }} className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm">
                        {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <span>entries · Showing {cohortSlotSummary.length === 0 ? 0 : (cohortSlotSafePage - 1) * cohortSlotPerPage + 1}–{Math.min(cohortSlotSafePage * cohortSlotPerPage, cohortSlotSummary.length)} of {cohortSlotSummary.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40" disabled={cohortSlotSafePage <= 1} onClick={() => setCohortSlotPage((p) => Math.max(1, p - 1))}><i className="fas fa-chevron-left" /></button>
                      {cohortSlotPaginationPages.map((p, idx) => p === 'ellipsis' ? <span key={`e-${idx}`} className="px-2 text-gray-400">…</span> : (
                        <button key={`p-${p}`} onClick={() => setCohortSlotPage(p)} className={`px-3 py-1 rounded-lg text-sm font-bold transition-colors ${p === cohortSlotSafePage ? 'bg-indigo-600 text-white' : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}>{p}</button>
                      ))}
                      <button className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40" disabled={cohortSlotSafePage >= cohortSlotTotalPages} onClick={() => setCohortSlotPage((p) => Math.min(cohortSlotTotalPages, p + 1))}><i className="fas fa-chevron-right" /></button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 overflow-hidden mb-6">
                  <div className="flex items-center gap-3 px-8 py-5 border-b border-gray-100 dark:border-white/5">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <i className="fas fa-chalkboard-teacher text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Professors</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sorted by Attendance % then Avg. Rating</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-white/10">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Professor</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Attendance %</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg. Rating</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sessions</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg. Learners</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg. Attendance</th>
                          <th className="px-6 py-4 text-center text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Rated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                        {professorPageItems.length === 0 ? (
                          <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 dark:text-gray-500"><i className="fas fa-chalkboard-teacher text-3xl mb-3 block" />No professors found</td></tr>
                        ) : professorPageItems.map((r) => {
                          const attendancePct = r.invites > 0 ? r.peak / r.invites : null;
                          const avgRating = r.ratingCount > 0 ? r.ratingSum / r.ratingCount : null;
                          const initials = `${(r.professorName || 'N').trim()[0] ?? 'N'}${(r.professorEmail || 'A').trim()[0] ?? 'A'}`.toUpperCase();
                          return (
                            <tr key={`${r.professorEmail}-${r.professorName}`} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 rounded-xl flex items-center justify-center text-purple-700 dark:text-purple-400 text-xs font-black flex-shrink-0">{initials}</div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{r.professorName}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{r.professorEmail}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-center text-sm font-bold text-emerald-700 dark:text-emerald-400">{formatPct(attendancePct)}</td>
                              <td className="px-6 py-4 text-center text-sm font-bold text-purple-700 dark:text-purple-400">{formatMaybeRating(avgRating)}</td>
                              <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">{r.sessions}</td>
                              <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">{formatAvgCount(r.sessions > 0 ? r.invites / r.sessions : 0)}</td>
                              <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">{formatAvgCount(r.sessions > 0 ? r.peak / r.sessions : 0)}</td>
                              <td className="px-6 py-4 text-center text-sm text-gray-700 dark:text-gray-300">{r.rated}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-white/5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>Show</span>
                      <select value={professorPerPage} onChange={(e) => { setProfessorPerPage(Number(e.target.value)); setProfessorPage(1); }} className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg text-sm">
                        {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <span>entries · Showing {professorSummary.length === 0 ? 0 : (professorSafePage - 1) * professorPerPage + 1}–{Math.min(professorSafePage * professorPerPage, professorSummary.length)} of {professorSummary.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40" disabled={professorSafePage <= 1} onClick={() => setProfessorPage((p) => Math.max(1, p - 1))}><i className="fas fa-chevron-left" /></button>
                      {professorPaginationPages.map((p, idx) => p === 'ellipsis' ? <span key={`e-${idx}`} className="px-2 text-gray-400">…</span> : (
                        <button key={`p-${p}`} onClick={() => setProfessorPage(p)} className={`px-3 py-1 rounded-lg text-sm font-bold transition-colors ${p === professorSafePage ? 'bg-indigo-600 text-white' : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'}`}>{p}</button>
                      ))}
                      <button className="px-3 py-1 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-40" disabled={professorSafePage >= professorTotalPages} onClick={() => setProfessorPage((p) => Math.min(professorTotalPages, p + 1))}><i className="fas fa-chevron-right" /></button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )
          }
        </>
      )
      }
    </div >
  );
}

