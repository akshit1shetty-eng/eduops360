import { useMemo, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import AnimatedNumber from '../components/AnimatedNumber';
import FilterDropdown from '../components/FilterDropdown';
import { Link, useSearchParams } from 'react-router-dom';
import { useLearnerData } from '../hooks/useLearnerData';
import { useProgramConfig } from '../hooks/useProgramConfig';
import { isLearnerActive, normalizeSecondaryStatus, parseNumber } from '../lib/logic';


function uniqSorted(values: Array<string | undefined>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = (v ?? '').trim();
    if (!s) continue;
    set.add(s);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function statusClass(status: string): string {
  const s = status.trim().toLowerCase();
  if (s.includes('active')) return 'bg-green-100 text-green-700';
  if (s.includes('completed')) return 'bg-purple-100 text-purple-700';
  if (s.includes('defer')) return 'bg-yellow-100 text-yellow-700';
  return 'bg-gray-100 text-gray-700';
}


type LearnerRow = {
  firstName: string;
  lastName: string;
  email: string;
  userId?: string;
  batch?: string;
  learnerType?: string;
  region?: string;
  cohort?: string;
  cohortId?: string;
  slot?: string;
  secondaryStatus: string;
  immersion?: string;
  spoc?: string;
  country?: string;
  launchMonth?: string;
  packageKey?: string;
  term?: string;
  aging?: number;
};

const EXCLUDED_SECONDARY_STATUSES = new Set<string>([normalizeSecondaryStatus('deferred out')]);

const EXPORT_COLUMNS = [
  'Email ID', 'First Name', 'Last Name', 'User ID', 'Prism User ID', 'GGU User ID',
  'GGU Email', 'Cohort #', 'Cohort ID', 'Launch Month', 'Term', 'Learner Type',
  'Status', 'Country Of Residence', 'Region', 'Contact', 'Package Key',
  'Status Details', 'Cohort Status', 'Slot', 'Immersion', 'Notes', 'Aging', 'SPOC'
];

function getStatusBucket(secondaryStatus: string): 'active' | 'deferral' | 'inactive' {
  const s = normalizeSecondaryStatus(secondaryStatus);
  if (isLearnerActive(secondaryStatus)) return 'active';
  if (s === 'ipd' || s.includes('in process of deferral')) return 'deferral';
  return 'inactive';
}

export default function LearnersPage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { programId, config } = useProgramConfig();
  const { loading, error, students, merged, needsAttention } = useLearnerData();

  const mergedByEmailAndCohortId = useMemo(() => {
    const map = new Map<string, { coursesCompleted?: string; coursesIncomplete?: string }>();
    for (const m of merged) {
      const email = (m.email ?? '').trim().toLowerCase();
      const cohortId = (m.cohortId ?? '').trim();
      if (!email || !cohortId) continue;
      map.set(`${email}__${cohortId}`, {
        coursesCompleted: m.coursesCompleted,
        coursesIncomplete: m.coursesIncomplete,
      });
    }
    return map;
  }, [merged]);

  const rows: LearnerRow[] = useMemo(() => {
    const out: LearnerRow[] = [];
    const seen = new Set<string>();

    for (const s of students ?? []) {
      const email = (s['Email ID'] ?? s['Email'] ?? s['GGU Student Email ID'] ?? s['GGU Email'] ?? '').trim();
      const emailKey = email.trim().toLowerCase();
      if (!emailKey) continue;

      const cohortId = (s['Cohort ID'] ?? '').trim();
      const cohort = (s['Cohort #'] ?? '').trim();
      const cohortKey = cohortId || cohort;
      const key = `${emailKey}__${cohortKey}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const statusFromStudentList = (
        s['Actual Status'] ??
        s['Actual status'] ??
        s['ActualStatus'] ??
        s['Actual_Status'] ??
        s['Status Details'] ??
        s['Secondary Status'] ??
        s['Secondary status'] ??
        s['Status'] ??
        ''
      ).trim();

      const secondaryStatus = (programId === 'dba' ? statusFromStudentList : (s['upGrad Learner Status'] ?? s['GGU Learner Status'] ?? statusFromStudentList)).trim();
      const learnerType = (programId === 'dba' || programId === 'mba' || programId === 'm-psych' ? (s['Batch'] ?? '').trim() : (s['Learner Type'] ?? '').trim()) || undefined;
      const region = (s['Region'] ?? '').trim() || undefined;
      const immersion = (s['Immersion'] ?? '').trim() || undefined;

      out.push({
        firstName: (s['First Name'] ?? '').trim(),
        lastName: (s['Last Name'] ?? '').trim(),
        email,
        userId: (s['User ID'] ?? '').trim() || undefined,
        batch: (s['Batch'] ?? '').trim() || undefined,
        learnerType,
        region,
        cohort: cohort || undefined,
        cohortId: cohortId || undefined,
        slot: (s['Slot'] ?? '').trim() || undefined,
        secondaryStatus,
        immersion,
        spoc: (s['SPOC'] ?? s['Support POC'] ?? '').trim() || undefined,
        country: (s['Country Of Residence'] ?? s['Country of  Residence'] ?? s['Country of Residence'] ?? s['Country'] ?? '').trim() || undefined,
        launchMonth: (s['Launch Month'] ?? '').trim() || undefined,
        packageKey: (s['Package Key'] ?? '').trim() || undefined,
        term: (s['Term'] ?? '').trim() || undefined,
        aging: parseNumber(s['Aging']) ?? undefined,
      });
    }

    return out;
  }, [students]);

  const [search, setSearch] = useState('');
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [selectedLaunchMonths, setSelectedLaunchMonths] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedLearnerTypes, setSelectedLearnerTypes] = useState<Array<'international' | 'domestic' | 'us'>>([]);
  const [openDropdown, setOpenDropdown] = useState<'cohort' | 'status' | 'slot' | 'learnerType' | 'launchMonth' | 'region' | 'country' | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'learners' | 'analytics'>(
    (searchParams.get('view') as 'learners' | 'analytics') || 'analytics'
  );

  const handleSetViewMode = (mode: 'learners' | 'analytics') => {
    setViewMode(mode);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', mode);
      return next;
    });
  };

  const cohorts = useMemo(() => uniqSorted(rows.map((r) => r.cohort)), [rows]);
  const statuses = useMemo(() => uniqSorted(rows.map((r) => r.secondaryStatus)), [rows]);
  const slots = useMemo(() => uniqSorted(rows.map((r) => (r.slot ?? '').slice(0, 6))), [rows]);
  const launchMonths = useMemo(() => {
    // Deduplicate
    const set = new Set<string>();
    for (const r of rows) {
      const v = (r.launchMonth ?? '').trim();
      if (v) set.add(v);
    }
    // Parse a raw value to a numeric timestamp for sorting
    function toTimestamp(v: string): number {
      // Google Sheets: Date(YYYY,M,D) — month is 0-indexed
      const gs = v.match(/^Date\((\d{4}),(\d{1,2}),\d+\)$/);
      if (gs) return new Date(Number(gs[1]), Number(gs[2])).getTime();
      // ISO: YYYY-MM
      const iso = v.match(/^(\d{4})-(\d{2})$/);
      if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1).getTime();
      // Compact: YYYYMM
      const compact = v.match(/^(\d{4})(\d{2})$/);
      if (compact) return new Date(Number(compact[1]), Number(compact[2]) - 1).getTime();
      // Fallback: let JS try
      const t = new Date(v).getTime();
      return isNaN(t) ? 0 : t;
    }
    return Array.from(set).sort((a, b) => toTimestamp(a) - toTimestamp(b));
  }, [rows]);
  const regions = useMemo(() => uniqSorted(rows.map((r) => r.region)), [rows]);
  const countries = useMemo(() => uniqSorted(rows.map((r) => r.country)), [rows]);
  const learnerTypeFilterValues = useMemo(() => ['international', 'domestic', 'us'], []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return rows.filter((l) => {
      if (term) {
        const name = `${l.firstName} ${l.lastName}`.toLowerCase();
        const email = (l.email ?? '').toLowerCase();
        const userId = (l.userId ?? '').toLowerCase();
        if (!name.includes(term) && !email.includes(term) && !userId.includes(term)) return false;
      }

      if (selectedCohorts.length > 0) {
        const c = (l.cohort ?? '').trim();
        if (!selectedCohorts.includes(c)) return false;
      }

      if (selectedStatuses.length > 0) {
        const s = (l.secondaryStatus ?? '').trim();
        if (!selectedStatuses.includes(s)) return false;
      }

      if (selectedSlots.length > 0) {
        const slot = (l.slot ?? '').slice(0, 6);
        if (!selectedSlots.includes(slot)) return false;
      }

      if (selectedLearnerTypes.length > 0) {
        const raw = (l.learnerType ?? '').trim().toLowerCase();
        const bucket = raw.includes('international')
          ? 'international'
          : raw.includes('domestic')
            ? 'domestic'
            : raw.includes('us')
              ? 'us'
              : null;
        if (!bucket || !selectedLearnerTypes.includes(bucket)) return false;
      }

      if (selectedLaunchMonths.length > 0) {
        const lm = (l.launchMonth ?? '').trim();
        if (!selectedLaunchMonths.includes(lm)) return false;
      }

      if (selectedRegions.length > 0) {
        const r = (l.region ?? '').trim();
        if (!selectedRegions.includes(r)) return false;
      }

      if (selectedCountries.length > 0) {
        const c = (l.country ?? '').trim();
        if (!selectedCountries.includes(c)) return false;
      }

      return true;
    });
  }, [rows, search, selectedCohorts, selectedSlots, selectedStatuses, selectedLearnerTypes, selectedLaunchMonths, selectedRegions, selectedCountries]);

  const filteredForKpis = useMemo(() => {
    return filtered.filter((r) => !EXCLUDED_SECONDARY_STATUSES.has(normalizeSecondaryStatus(r.secondaryStatus)));
  }, [filtered]);

  const totalLearners = useMemo(() => {
    const byEmail = new Set(filteredForKpis.map((l) => (l.email ?? '').trim().toLowerCase()).filter(Boolean));
    return byEmail.size;
  }, [filteredForKpis]);

  const analytics = useMemo(() => {
    type StatusBucket = 'active' | 'in_process_deferral' | 'inactive';

    function getAnalyticsBucket(status: string): StatusBucket {
      const b = getStatusBucket(status);
      if (b === 'active') return 'active';
      if (b === 'deferral') return 'in_process_deferral';
      return 'inactive';
    }

    function getLearnerTypeBucket(value: string | undefined): 'international' | 'domestic' | 'us' | 'unknown' {
      const s = (value ?? '').trim().toLowerCase();
      if (!s) return 'unknown';
      if (s.includes('international')) return 'international';
      if (s.includes('domestic')) return 'domestic';
      if (s.includes('us')) return 'us';
      return 'unknown';
    }

    function getRegionKey(value: string | undefined): string {
      const s = (value ?? '').trim();
      return s || 'Unknown';
    }

    const groupMap = new Map<
      string,
      {
        cohort: string;
        slot: string;
        total: number;
        status: Record<StatusBucket, number>;
        learnerType: Record<'international' | 'domestic' | 'us' | 'unknown', number>;
        region: Map<string, number>;
        completedSum: number;
        completedCount: number;
      }
    >();

    const uniqueOverall = new Set<string>();
    const overallStatus: Record<StatusBucket, number> = {
      active: 0,
      in_process_deferral: 0,
      inactive: 0,
    };

    for (const l of filteredForKpis) {
      const emailKey = (l.email ?? '').trim().toLowerCase();
      if (!emailKey) continue;

      const cohortLabel = (l.cohort ?? '').trim() || 'Unknown';
      const slotLabel = ((l.slot ?? '').trim().slice(0, 6) || 'Unknown').trim();
      const key = `${cohortLabel}__${slotLabel}`;

      if (!groupMap.has(key)) {
        groupMap.set(key, {
          cohort: cohortLabel,
          slot: slotLabel,
          total: 0,
          status: {
            active: 0,
            in_process_deferral: 0,
            inactive: 0,
          },
          learnerType: { international: 0, domestic: 0, us: 0, unknown: 0 },
          region: new Map<string, number>(),
          completedSum: 0,
          completedCount: 0,
        });
      }

      const g = groupMap.get(key);
      if (!g) continue;

      g.total += 1;

      const statusBucket = getAnalyticsBucket(l.secondaryStatus);
      g.status[statusBucket] += 1;

      const lt = getLearnerTypeBucket(l.learnerType);
      g.learnerType[lt] += 1;

      const regionKey = getRegionKey(l.region);
      g.region.set(regionKey, (g.region.get(regionKey) ?? 0) + 1);

      const cohortIdKey = (l.cohortId ?? '').trim();
      const courseKey = cohortIdKey ? `${emailKey}__${cohortIdKey}` : '';
      const mergedCourse = courseKey ? mergedByEmailAndCohortId.get(courseKey) : undefined;
      const completedNum = parseNumber(mergedCourse?.coursesCompleted);
      const incompleteNum = parseNumber(mergedCourse?.coursesIncomplete) ?? 0;
      if (completedNum !== null && completedNum > 0) {
        const net = Math.max(0, Math.round(completedNum - incompleteNum));
        g.completedSum += net;
        g.completedCount += 1;
      }

      if (!uniqueOverall.has(emailKey)) {
        uniqueOverall.add(emailKey);
        overallStatus[statusBucket] += 1;
      }
    }

    const groups = Array.from(groupMap.values()).sort((a, b) => {
      if (a.cohort !== b.cohort) return a.cohort.localeCompare(b.cohort);
      return a.slot.localeCompare(b.slot);
    });

    const overallTotal = Object.values(overallStatus).reduce((a, b) => a + b, 0);
    const overallPct = {
      active: overallTotal > 0 ? overallStatus.active / overallTotal : 0,
      in_process_deferral: overallTotal > 0 ? overallStatus.in_process_deferral / overallTotal : 0,
      inactive: overallTotal > 0 ? overallStatus.inactive / overallTotal : 0,
    };

    // --- Extra Aggregations ---
    const immersionCounts: Record<string, number> = {};
    const spocCounts: Record<string, number> = {};
    const countryCounts: Record<string, number> = {};
    const slotCounts: Record<string, number> = {};
    const launchMonthCounts: Record<string, number> = {};
    const packageKeyCounts: Record<string, number> = {};
    const termCounts: Record<string, number> = {};
    const totalByEmail = new Set<string>();

    for (const l of filteredForKpis) {
      const email = (l.email ?? '').trim().toLowerCase();
      if (!email || totalByEmail.has(email)) continue;
      totalByEmail.add(email);

      const imm = (l.immersion ?? 'Unknown').trim();
      immersionCounts[imm] = (immersionCounts[imm] ?? 0) + 1;

      const spoc = (l.spoc ?? 'Unassigned').trim();
      spocCounts[spoc] = (spocCounts[spoc] ?? 0) + 1;

      const country = (l.country ?? 'Unknown').trim();
      countryCounts[country] = (countryCounts[country] ?? 0) + 1;

      const slot = (l.slot ?? '').slice(0, 6).trim() || 'Other';
      slotCounts[slot] = (slotCounts[slot] ?? 0) + 1;

      const lm = (l.launchMonth ?? 'Unknown').trim();
      launchMonthCounts[lm] = (launchMonthCounts[lm] ?? 0) + 1;

      const pk = (l.packageKey ?? 'Default').trim();
      const shortPk = pk.includes('-v') ? pk.split('-').find(p => p.startsWith('v')) ?? pk : pk;
      packageKeyCounts[shortPk] = (packageKeyCounts[shortPk] ?? 0) + 1;

      const tm = (l.term ?? 'Unknown').trim();
      termCounts[tm] = (termCounts[tm] ?? 0) + 1;
    }

    const sortedSpocs = Object.entries(spocCounts).sort((a, b) => b[1] - a[1]);
    const sortedCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);
    const sortedSlots = Object.entries(slotCounts).sort((a, b) => b[1] - a[1]);
    const sortedLaunchMonths = Object.entries(launchMonthCounts).sort((a, b) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const [ma, ya] = a[0].split('-');
      const [mb, yb] = b[0].split('-');
      if (ya !== yb) return (ya ?? '').localeCompare(yb ?? '');
      return months.indexOf(ma ?? '') - months.indexOf(mb ?? '');
    });
    const sortedPackages = Object.entries(packageKeyCounts).sort((a, b) => b[1] - a[1]);
    const sortedTerms = Object.entries(termCounts).sort((a, b) => b[1] - a[1]);

    const ipdLearners = filteredForKpis
      .filter(l => normalizeSecondaryStatus(l.secondaryStatus) === 'ipd')
      .sort((a, b) => (b.aging ?? 0) - (a.aging ?? 0));

    return {
      groups,
      overallStatus,
      overallPct,
      overallTotal,
      immersionCounts,
      sortedSpocs,
      sortedCountries,
      sortedSlots,
      sortedLaunchMonths,
      sortedPackages,
      sortedTerms,
      ipdLearners
    };
  }, [filteredForKpis, mergedByEmailAndCohortId]);

  const statusCounts = useMemo(() => {
    const counts = {
      active: 0,
      deferral: 0,
      inactive: 0,
      graduated: 0,
    };

    const seen = new Set<string>();
    for (const l of filteredForKpis) {
      const key = (l.email ?? '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const s = normalizeSecondaryStatus(l.secondaryStatus);
      if (s === 'graduated' || s === 'completed' || s.includes('graduated')) {
        counts.graduated += 1;
      } else {
        const bucket = getStatusBucket(l.secondaryStatus);
        if (bucket === 'active') counts.active += 1;
        else if (bucket === 'deferral') counts.deferral += 1;
        else counts.inactive += 1;
      }
    }

    return counts;
  }, [filteredForKpis]);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>([]);


  const handleExport = () => {
    if (selectedExportColumns.length === 0) {
      alert('Please select at least one column to export.');
      return;
    }

    const filteredEmails = new Set(filteredForKpis.map(l => `${l.email.trim().toLowerCase()}__${(l.cohortId || l.cohort || '').trim()}`));

    const dataToExport = students.filter(s => {
      const email = (s['Email ID'] || s['Email'] || s['GGU Student Email ID'] || s['GGU Email'] || '').trim().toLowerCase();
      const cohortId = (s['Cohort ID'] || '').trim();
      const cohort = (s['Cohort #'] || '').trim();
      const key = `${email}__${cohortId || cohort}`;
      return filteredEmails.has(key);
    });

    const headers = selectedExportColumns.join(',');
    const csvRows = dataToExport.map(s =>
      selectedExportColumns.map(col => {
        let val = s[col] ?? '';

        // Formatting Launch Month specifically for professional CSV output
        if (col === 'Launch Month' && val.toString().trim().startsWith('Date(')) {
          const v = val.toString().trim();
          const gSheets = v.match(/^Date\((\d{4}),(\d{1,2}),\s*(\d{1,2})\)$/);
          if (gSheets) {
            const d = new Date(Number(gSheets[1]), Number(gSheets[2]));
            val = `${d.toLocaleString('en', { month: 'short' })}-${gSheets[1]}`;
          }
        }

        return `"${val.toString().replace(/"/g, '""')}"`;
      }).join(',')
    );

    const csvContent = [headers, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `learners_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
  };

  const exportAttentionCSV = () => {
    const headers = ['Learner Name', 'Email', 'Cohort', 'Course', 'Grade', 'GPA'];
    const csvRows: string[] = [];

    for (const learner of attention) {
      const name = learner.name ?? '';
      const email = learner.email ?? '';
      const cohort = learner.cohortId || learner.cohort || 'N/A';
      const details = learner.lowGpaDetails ?? [];

      if (details.length === 0) {
        csvRows.push(
          [name, email, cohort, '', '', ''].map(v => `"${v.toString().replace(/"/g, '""')}"`).join(',')
        );
      } else {
        for (const d of details) {
          csvRows.push(
            [
              name,
              email,
              cohort,
              d.course,
              d.grade ?? '-',
              Number.isFinite(d.gpa) ? d.gpa.toFixed(2) : '',
            ].map(v => `"${v.toString().replace(/"/g, '""')}"`).join(',')
          );
        }
      }
    }

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `attention_learners_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [attentionPage, setAttentionPage] = useState(1);
  const attention = useMemo(() => {
    const filteredEmails = new Set(filtered.map((f) => (f.email ?? '').trim().toLowerCase()));
    return needsAttention.filter((n) => filteredEmails.has((n.email ?? '').trim().toLowerCase()));
  }, [needsAttention, filtered]);
  const totalAttentionPages = Math.max(1, Math.ceil(attention.length / 10));
  const safeAttentionPage = Math.min(attentionPage, totalAttentionPages);
  const attentionPaginated = attention.slice((safeAttentionPage - 1) * 10, safeAttentionPage * 10);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredForKpis.length / perPage)), [filteredForKpis.length, perPage]);
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * perPage;
    return filteredForKpis.slice(start, start + perPage);
  }, [filteredForKpis, perPage, safePage]);

  const paginationPages = useMemo(() => {
    const pages: Array<number | 'ellipsis'> = [];

    const add = (p: number | 'ellipsis') => {
      if (pages.length === 0 || pages[pages.length - 1] !== p) pages.push(p);
    };

    for (let p = 1; p <= totalPages; p += 1) {
      const nearCurrent = Math.abs(p - safePage) <= 1;
      const nearEnds = p <= 3 || p >= totalPages - 2;

      if (p === 1 || p === totalPages || nearCurrent || nearEnds) {
        add(p);
      } else if (pages[pages.length - 1] !== 'ellipsis') {
        add('ellipsis');
      }
    }

    return pages;
  }, [safePage, totalPages]);

  function toggleInList(value: string, list: string[], setList: (v: string[]) => void) {
    setPage(1);
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  function clearAll() {
    setSearch('');
    setSelectedCohorts([]);
    setSelectedStatuses([]);
    setSelectedSlots([]);
    setSelectedLearnerTypes([]);
    setSelectedLaunchMonths([]);
    setSelectedRegions([]);
    setSelectedCountries([]);
    setPage(1);
  }

  return (
    <div className="min-h-screen" onClick={() => setOpenDropdown(null)}>
      <div className="mb-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Learners Management</h1>
            <p className="text-gray-600 dark:text-gray-400">Track and manage all your learners in one place</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8" onClick={(e) => e.stopPropagation()}>
        {[
          { icon: 'fa-users', gradient: 'from-blue-400 to-blue-600', label: 'Total Learners', badge: 'text-blue-600 bg-blue-50', bar: 'from-blue-200 to-blue-400', value: <AnimatedNumber value={totalLearners} />, badgeText: 'Total' },
          { icon: 'fa-user-check', gradient: 'from-emerald-400 to-emerald-600', label: 'Active', badge: 'text-emerald-600 bg-emerald-50', bar: 'from-emerald-200 to-emerald-400', value: <AnimatedNumber value={statusCounts.active} />, badgeText: 'Active' },
          { icon: 'fa-hourglass-half', gradient: 'from-yellow-400 to-yellow-600', label: 'In Process of Deferral', badge: 'text-yellow-700 bg-yellow-50', bar: 'from-yellow-200 to-yellow-400', value: <AnimatedNumber value={statusCounts.deferral} />, badgeText: 'IPD' },
          { icon: 'fa-user-slash', gradient: 'from-slate-400 to-slate-600', label: 'Inactive', badge: 'text-slate-700 bg-slate-50', bar: 'from-slate-200 to-slate-400', value: <AnimatedNumber value={statusCounts.inactive} />, badgeText: 'Inactive' },
          { icon: 'fa-graduation-cap', gradient: 'from-purple-400 to-purple-600', label: 'Graduated', badge: 'text-purple-600 bg-purple-50', bar: 'from-purple-200 to-purple-400', value: <AnimatedNumber value={statusCounts.graduated} />, badgeText: 'Graduated' },
        ].map((k) => (
          <div key={k.label} className="group relative bg-white dark:bg-gray-800 bg-opacity-90 dark:bg-opacity-80 backdrop-blur-lg rounded-xl shadow-xl p-4 border border-gray-100 dark:border-white/5 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${k.gradient} rounded-full opacity-10 -mr-10 -mt-10 group-hover:opacity-20 transition-opacity`} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded-xl flex items-center justify-center shadow-sm border border-blue-100 dark:border-white/10 group-hover:scale-110 transition-transform">
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

      <div className="max-w-6xl mx-auto bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-[2rem] shadow-2xl p-6 mb-8 border border-white/60 dark:border-white/10 relative z-30" onClick={(e) => e.stopPropagation()}>
        {/* Background Graphic Layer */}
        <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
            <i className="fas fa-sliders-h text-[140px] dark:text-white" />
          </div>
        </div>

        <div className="relative mb-10 z-10">
          <div className="flex flex-col items-center max-w-3xl mx-auto">
            <h3 className="text-2xl font-black text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-3">
              <i className="fas fa-user-astronaut text-indigo-600 dark:text-indigo-400" />
              Filter Console
            </h3>

            <div className="w-full relative group">
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Find learners by name, email, or digital fingerprint..."
                className="w-full pl-12 pr-12 py-3.5 bg-gray-50 dark:bg-gray-900/50 border-2 border-transparent focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-800 rounded-2xl transition-all shadow-inner text-base font-medium outline-none placeholder:text-gray-400 text-gray-800 dark:text-gray-100"
              />
              <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-xl group-focus-within:text-indigo-500 transition-colors" />
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setPage(1); }}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500 transition-colors"
                >
                  <i className="fas fa-times-circle text-xl" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-4 mb-6 relative z-20">
          <FilterDropdown
            label="Active Cohort"
            iconClass="fas fa-users-cog"
            placeholder="All Cohorts"
            values={cohorts}
            selected={selectedCohorts}
            onToggle={(v) => toggleInList(v, selectedCohorts, setSelectedCohorts)}
            isOpen={openDropdown === 'cohort'}
            setIsOpen={(open) => setOpenDropdown(open ? 'cohort' : null)}
            formatValue={(v) => `Cohort ${v}`}
          />

          <FilterDropdown
            label="Launch Window"
            iconClass="fas fa-calendar-check"
            placeholder="All Months"
            values={launchMonths}
            selected={selectedLaunchMonths}
            onToggle={(v) => toggleInList(v, selectedLaunchMonths, setSelectedLaunchMonths)}
            isOpen={openDropdown === 'launchMonth'}
            setIsOpen={(open) => setOpenDropdown(open ? 'launchMonth' : null)}
            formatValue={(v) => {
              const gSheets = v.match(/^Date\((\d{4}),(\d{1,2}),\d+\)$/);
              if (gSheets) {
                const d = new Date(Number(gSheets[1]), Number(gSheets[2]));
                return `${d.toLocaleString('en', { month: 'short' })} - ${gSheets[1]}`;
              }
              const iso = v.match(/^(\d{4})-(\d{2})$/);
              if (iso) {
                const d = new Date(Number(iso[1]), Number(iso[2]) - 1);
                return `${d.toLocaleString('en', { month: 'short' })} - ${iso[1]}`;
              }
              const compact = v.match(/^(\d{4})(\d{2})$/);
              if (compact) {
                const d = new Date(Number(compact[1]), Number(compact[2]) - 1);
                return `${d.toLocaleString('en', { month: 'short' })} - ${compact[1]}`;
              }
              const d = new Date(v);
              return !isNaN(d.getTime()) ? `${d.toLocaleString('en', { month: 'short' })} - ${d.getFullYear()}` : v;
            }}
          />

          <FilterDropdown
            label="Region"
            iconClass="fas fa-map-marker-alt"
            placeholder="All Regions"
            values={regions}
            selected={selectedRegions}
            onToggle={(v) => toggleInList(v, selectedRegions, setSelectedRegions)}
            isOpen={openDropdown === 'region'}
            setIsOpen={(open) => setOpenDropdown(open ? 'region' : null)}
          />

          <FilterDropdown
            label="Country"
            iconClass="fas fa-globe-americas"
            placeholder="All Countries"
            values={countries}
            selected={selectedCountries}
            onToggle={(v) => toggleInList(v, selectedCountries, setSelectedCountries)}
            isOpen={openDropdown === 'country'}
            setIsOpen={(open) => setOpenDropdown(open ? 'country' : null)}
          />

          <FilterDropdown
            label="Learner Wellness"
            iconClass="fas fa-heartbeat"
            placeholder="All Statuses"
            values={statuses}
            selected={selectedStatuses}
            onToggle={(v) => toggleInList(v, selectedStatuses, setSelectedStatuses)}
            isOpen={openDropdown === 'status'}
            setIsOpen={(open) => setOpenDropdown(open ? 'status' : null)}
          />

          <FilterDropdown
            label="Slot Segment"
            iconClass="fas fa-clock"
            placeholder="All Slots"
            values={slots}
            selected={selectedSlots}
            onToggle={(v) => toggleInList(v, selectedSlots, setSelectedSlots)}
            isOpen={openDropdown === 'slot'}
            setIsOpen={(open) => setOpenDropdown(open ? 'slot' : null)}
          />

          <FilterDropdown
            label="Student Type"
            iconClass="fas fa-user-tag"
            placeholder="All Types"
            values={learnerTypeFilterValues}
            selected={selectedLearnerTypes}
            onToggle={(v) => toggleInList(v, selectedLearnerTypes, setSelectedLearnerTypes as any)}
            isOpen={openDropdown === 'learnerType'}
            setIsOpen={(open) => setOpenDropdown(open ? 'learnerType' : null)}
            formatValue={(v) => (v === 'us' ? 'US' : v.charAt(0).toUpperCase() + v.slice(1))}
          />
        </div>

        <div className="flex border-t border-gray-100 pt-6 items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2 items-center min-w-0">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Active Tuning:</span>
            {(search.trim() || selectedCohorts.length > 0 || selectedStatuses.length > 0 || (programId !== 'dba' && selectedSlots.length > 0) || selectedLearnerTypes.length > 0 || selectedLaunchMonths.length > 0 || selectedRegions.length > 0 || selectedCountries.length > 0) ? (
              <>
                {search.trim() && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-full px-3 py-1 flex items-center gap-2 group/tag hover:bg-white dark:hover:bg-gray-800 transition-colors">
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">"{search}"</span>
                  </div>
                )}

                {selectedCountries.map(c => (
                  <div key={c} className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-full px-3 py-1 flex items-center gap-2 group/tag hover:bg-white dark:hover:bg-gray-800 transition-colors">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[100px]">{c}</span>
                    <button onClick={() => toggleInList(c, selectedCountries, setSelectedCountries)} className="text-emerald-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-[10px]" /></button>
                  </div>
                ))}
                {selectedCohorts.map(c => (
                  <div key={c} className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-800 rounded-full px-3 py-1 flex items-center gap-2 group/tag hover:bg-white dark:hover:bg-gray-800 transition-colors">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">C{c}</span>
                    <button onClick={() => setSelectedCohorts(p => p.filter(x => x !== c))} className="text-emerald-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-[10px]" /></button>
                  </div>
                ))}
                {(selectedLaunchMonths.length + selectedRegions.length + selectedStatuses.length + (programId !== 'dba' ? selectedSlots.length : 0) + selectedLearnerTypes.length) > 0 && (
                  <div className="bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-white/10 rounded-full px-3 py-1 flex items-center gap-2">
                    <span className="text-[10px] font-black text-gray-500 dark:text-gray-400">{selectedLaunchMonths.length + selectedRegions.length + selectedStatuses.length + (programId !== 'dba' ? selectedSlots.length : 0) + selectedLearnerTypes.length} Parameters</span>
                  </div>
                )}
              </>
            ) : (
              <span className="text-xs italic text-gray-300 dark:text-gray-600">No active filters applied</span>
            )}
          </div>

          <button
            type="button"
            onClick={clearAll}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"
          >
            <i className="fas fa-sync-alt" />
            Reset
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8 gap-4 px-1" onClick={(e) => e.stopPropagation()}>
        <div className="acad-tabs">
          <button
            type="button"
            onClick={() => handleSetViewMode('analytics')}
            className={`acad-tab ${viewMode === 'analytics' ? 'acad-tab-active' : ''}`}
          >
            <i className="fas fa-chart-pie" />
            Analytics
          </button>
          
          <button
            type="button"
            onClick={() => handleSetViewMode('learners')}
            className={`acad-tab ${viewMode === 'learners' ? 'acad-tab-active' : ''}`}
          >
            <i className="fas fa-users" />
            Learners
            {totalLearners > 0 && <span className="acad-tab-badge">{totalLearners}</span>}
          </button>
        </div>

        <div className="flex justify-end">
          {viewMode === 'learners' && (
            <button
              type="button"
              onClick={() => {
                if (selectedExportColumns.length === 0) {
                  // Pre-select some defaults
                  setSelectedExportColumns(['First Name', 'Last Name', 'Email ID', 'Cohort #']);
                }
                setShowExportModal(true);
              }}
              className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-gray-200 dark:border-white/10 px-6 py-2.5 rounded-2xl shadow-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-900 hover:bg-white dark:hover:bg-gray-800 transition-all flex items-center gap-2 text-sm font-bold shadow-indigo-100/10"
            >
              <i className="fas fa-file-export" />
              Export
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-8 text-gray-700">Loading...</div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-md border border-red-200 p-6">
          <div className="text-red-700 font-semibold">Failed to load sheet data</div>
          <div className="text-red-600 text-sm mt-1">{error}</div>
        </div>
      ) : (
        viewMode === 'analytics' ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10" onClick={(e) => e.stopPropagation()}>
              {/* --- Global Footprint & Regions --- */}
              <div className={`bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group ${programId === 'dba' || programId === 'mba' || programId === 'm-psych' ? 'lg:col-span-2' : ''}`}>
                <div className="absolute -top-10 -right-10 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <i className="fas fa-map-marked-alt text-[140px] dark:text-white" />
                </div>
                <div className="relative">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Global Footprint</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Geographic distribution of learners</p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-sm">
                      {analytics.sortedCountries.length} Countries
                    </div>
                  </div>                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-5">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Regional Split</h4>
                      {(() => {
                        const regionCounts = new Map<string, number>();
                        let rTotal = 0;
                        analytics.groups.forEach(g => {
                          g.region.forEach((cnt, r) => {
                            if (r !== 'Unknown') {
                              regionCounts.set(r, (regionCounts.get(r) ?? 0) + cnt);
                              rTotal += cnt;
                            }
                          });
                        });
                        return Array.from(regionCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([r, c]) => (
                          <div key={r} className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center px-1">
                              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{r}</span>
                              <span className="text-xs font-black text-gray-900 dark:text-gray-100">{((c / Math.max(1, rTotal)) * 100).toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                              <div className="h-full rounded-full transition-all duration-1000 bg-indigo-600 dark:bg-indigo-400" style={{ width: `${(c / Math.max(1, rTotal)) * 100}%` }} />
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500">Top Countries</h4>
                      <div className="space-y-2">
                        {analytics.sortedCountries.slice(0, 5).map(([c, count], idx) => (
                          <div key={c} className="flex items-center justify-between p-2 rounded-xl bg-gray-50/50 dark:bg-gray-900/30 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors border border-transparent hover:border-gray-200 dark:hover:border-white/5">
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-lg bg-white dark:bg-gray-700 flex items-center justify-center text-[10px] font-black text-indigo-600 dark:text-indigo-400 shadow-sm">
                                {idx + 1}
                              </div>
                              <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{c}</span>
                            </div>
                            <span className="text-xs font-black text-gray-400 dark:text-gray-500">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- Immersion Profile (Refined) - Hidden for DBA and MBA --- */}
              {programId !== 'dba' && programId !== 'mba' && programId !== 'm-psych' && (
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group">
                  <div className="absolute -top-10 -right-10 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <i className="fas fa-layer-group text-[140px] dark:text-white" />
                  </div>
                  <div className="relative">
                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Immersion Profile</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Learner commitment and immersion levels</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {(() => {
                        const palette = [
                          { bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-900/50', icon: 'text-emerald-600 dark:text-emerald-400', num: 'text-emerald-700 dark:text-emerald-300', label: 'text-emerald-600 dark:text-emerald-500', iconBorder: 'border-emerald-100 dark:border-emerald-900/50' },
                          { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-100 dark:border-yellow-900/50', icon: 'text-yellow-600 dark:text-yellow-400', num: 'text-yellow-700 dark:text-yellow-300', label: 'text-yellow-600 dark:text-yellow-500', iconBorder: 'border-yellow-100 dark:border-yellow-900/50' },
                          { bg: 'bg-slate-50 dark:bg-gray-900/20', border: 'border-slate-200 dark:border-gray-700', icon: 'text-slate-500 dark:text-gray-400', num: 'text-slate-700 dark:text-gray-300', label: 'text-slate-500 dark:text-gray-500', iconBorder: 'border-slate-100 dark:border-gray-700' },
                        ];
                        return Object.entries(analytics.immersionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([type, count], idx) => {
                          const c = palette[idx] ?? palette[2];
                          return (
                            <div key={type} className={`${c.bg} p-6 rounded-3xl border ${c.border} flex flex-col items-center hover:scale-[1.05] transition-transform`}>
                              <div className={`w-12 h-12 rounded-2xl bg-white dark:bg-gray-700 shadow-sm flex items-center justify-center ${c.icon} mb-4 border ${c.iconBorder}`}>
                                <i className="fas fa-check-double" />
                              </div>
                              <span className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">{type}</span>
                              <span className={`text-3xl font-black ${c.num}`}>{count}</span>
                              <span className={`text-[10px] font-black ${c.label} uppercase mt-2`}>Learners</span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* --- Second Row: Package Insights & Archetypes --- */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10" onClick={(e) => e.stopPropagation()}>
              {/* --- Deferral Timeline (IPD Focusing) --- */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <i className="fas fa-hourglass-start text-[140px] dark:text-white" />
                </div>
                <div className="relative">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">Deferral Timeline</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Learners in Process of Deferral (IPD)</p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-sm border border-yellow-100 dark:border-yellow-900/50">
                      {analytics.ipdLearners.length} Cases
                    </div>
                  </div>

                  <div className="space-y-4 max-h-[310px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
                    {analytics.ipdLearners.map((l, idx) => {
                      const aging = l.aging ?? 0;
                      const colors =
                        aging >= 32 ? { bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100 dark:border-red-900/50', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]', label: 'Critical' } :
                          aging >= 20 ? { bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-100 dark:border-yellow-900/50', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]', label: 'Warning' } :
                            { bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-100 dark:border-green-900/50', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]', label: 'Healthy' };

                      return (
                        <div key={`${l.email}-${idx}`} className={`p-4 rounded-2xl border ${colors.border} ${colors.bg} relative group/item hover:scale-[1.02] transition-all`}>
                          <div className="flex justify-between items-center mb-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                              <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{l.firstName} {l.lastName}</span>
                              <span className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-full ${colors.text} bg-white dark:bg-gray-800 opacity-80 border ${colors.border}`}>
                                {colors.label}
                              </span>
                            </div>
                            <span className={`text-xs font-black ${colors.text}`}>{aging} Weeks</span>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest pl-4">
                            <span><i className="fas fa-users mr-1 text-blue-700 dark:text-blue-400" />{l.cohort}</span>
                          </div>
                        </div>
                      );
                    })}
                    {analytics.ipdLearners.length === 0 && (
                      <div className="text-center py-10 opacity-50 italic text-sm text-gray-500">
                        No active IPD cases found.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* --- Learner Archetype (New) --- */}
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-white/5 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                  <i className="fas fa-user-tag text-[140px] dark:text-white" />
                </div>
                <div className="relative">
                  <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Learner Archetype</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Composition by residency status</p>

                  {(() => {
                    const lt = analytics.groups.reduce((acc, g) => {
                      acc.intl += g.learnerType.international;
                      acc.dom += g.learnerType.domestic;
                      acc.us += g.learnerType.us;
                      acc.unknown += g.learnerType.unknown;
                      return acc;
                    }, { intl: 0, dom: 0, us: 0, unknown: 0 });
                    const total = lt.intl + lt.dom + lt.us + lt.unknown;
                    const hasData = total > 0;

                    const archetypeItems = [
                      { label: 'International', val: lt.intl, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', icon: 'fa-globe-asia' },
                      { label: 'Domestic', val: lt.dom, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', icon: 'fa-home' },
                      ...(programId !== 'mba' ? [{ label: 'US Based', val: lt.us, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', icon: 'fa-flag-usa' }] : [])
                    ];

                    return (
                      <div className="space-y-6">
                        {archetypeItems.map(item => (
                          <div key={item.label} className={`group p-4 rounded-2xl ${item.bg} border border-transparent hover:border-white dark:hover:border-white/10 transition-all flex items-center justify-between`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-12 h-12 rounded-xl bg-white dark:bg-gray-700 shadow-sm flex items-center justify-center ${item.color}`}>
                                <i className={`fas ${item.icon} text-lg`} />
                              </div>
                              <div>
                                <span className="block text-sm font-bold text-gray-700 dark:text-gray-300">{item.label}</span>
                                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                                  {hasData ? `${((item.val / total) * 100).toFixed(1)}% Ratio` : '— Ratio'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-2xl font-black ${item.color}`}>{item.val}</span>
                              <span className="block text-[10px] font-black text-gray-300 dark:text-gray-600 uppercase letter-spacing-widest">Learners</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Learners Needing Attention - Analytics View Only */}
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 px-6 py-4 border-b border-gray-100 dark:border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white dark:bg-gray-700 rounded-2xl flex items-center justify-center shadow-sm border border-red-100 dark:border-red-900/50">
                      <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-400 text-lg" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Learners Needing Attention</h2>
                      <p className="text-xs text-gray-600 dark:text-gray-400">Learners with any course GPA &lt; 2.7</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        <AnimatedNumber value={attention.length} />
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Total Cases</div>
                    </div>
                    <button
                      type="button"
                      onClick={exportAttentionCSV}
                      disabled={attention.length === 0}
                      title="Export Attention Learners as CSV"
                      className="bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-red-200 dark:border-red-900/50 px-4 py-2 rounded-xl shadow-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:border-red-400 dark:hover:border-red-700 hover:bg-white dark:hover:bg-gray-800 transition-all flex items-center gap-2 text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <i className="fas fa-file-export" />
                      Export
                    </button>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto" style={{ maxHeight: '1200px' }}>
                {attentionPaginated.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-check-circle text-green-500 text-2xl" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Excellent Performance!</h3>
                    <p className="text-gray-600 text-sm">No learners are currently below 2.7 GPA in any course.</p>
                  </div>
                ) : (
                  attentionPaginated.map((learner) => (
                    <div key={`${learner.email}-${learner.cohortId ?? learner.cohort ?? ''}`} className="px-6 py-4 border-b border-gray-100 dark:border-white/5 hover:bg-gradient-to-r hover:from-red-50 hover:to-orange-50 dark:hover:from-red-900/10 dark:hover:to-orange-900/10 transition-all duration-300">
                      <div className="flex items-start space-x-4">
                        <div className="w-10 h-10 bg-white dark:bg-gray-700 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-red-100 dark:border-red-900/50">
                          <span className="text-red-700 dark:text-red-400 font-bold text-sm">{learner.initials}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{learner.name}</h3>
                            <div className="flex items-center space-x-2">
                              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full font-medium">{learner.slot ?? 'N/A'}</span>
                              <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs rounded-full font-medium">{learner.status ?? 'Active'}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-4 mb-3">
                            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                              <i className="fas fa-users mr-1 text-blue-700 dark:text-blue-400" />Cohort {learner.cohortId || learner.cohort || 'N/A'}
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                              <i className="fas fa-envelope mr-1 text-purple-700 dark:text-purple-400" />{learner.email}
                            </span>
                            <span className="text-xs text-red-700 dark:text-red-400 font-medium">
                              <i className="fas fa-exclamation-circle mr-1 text-red-700 dark:text-red-400" />{learner.lowGpaCourses.length} course{learner.lowGpaCourses.length === 1 ? '' : 's'}
                            </span>
                          </div>

                          <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-3 border-l-4 border-red-400 dark:border-red-600 shadow-sm">
                            <div className="flex items-center mb-2">
                              <div className="w-6 h-6 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center mr-2 shadow-sm border border-red-100 dark:border-red-900/50">
                                <i className="fas fa-exclamation text-red-600 dark:text-red-400 text-xs" />
                              </div>
                              <p className="text-sm text-red-700 dark:text-red-400 font-semibold">Courses Needing Attention</p>
                            </div>

                            <div className="ml-8 space-y-2">
                              {(() => {
                                const rows = learner.lowGpaDetails ?? [];
                                return rows.map((c) => (
                                  <div key={`${c.course}-${c.gpa}`} className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-sm border border-red-100 dark:border-red-900/30 hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center space-x-2 min-w-0">
                                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0"></div>
                                        <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate" title={c.course}>
                                          {c.course}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold rounded-full">{c.grade ?? '-'}</span>
                                        <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold rounded-full">
                                          {Number.isFinite(c.gpa) ? c.gpa.toFixed(2) : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>

                            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 ml-8">
                              <i className="fas fa-info-circle mr-1" />Courses completed: {learner.coursesCompleted ?? 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination for Attention Cases */}
              {totalAttentionPages > 1 && (
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Showing {((safeAttentionPage - 1) * 10) + 1} to {Math.min(safeAttentionPage * 10, attention.length)} of {attention.length} results
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setAttentionPage(Math.max(1, safeAttentionPage - 1))}
                        disabled={safeAttentionPage === 1}
                        className="px-3 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md text-gray-700 dark:text-gray-300"
                      >
                        <i className="fas fa-chevron-left mr-1" />Previous
                      </button>

                      {Array.from({ length: Math.min(5, totalAttentionPages) }, (_, i) => {
                        let pageNum;
                        if (totalAttentionPages <= 5) {
                          pageNum = i + 1;
                        } else if (safeAttentionPage <= 3) {
                          pageNum = i + 1;
                        } else if (safeAttentionPage >= totalAttentionPages - 2) {
                          pageNum = totalAttentionPages - 4 + i;
                        } else {
                          pageNum = safeAttentionPage - 2 + i;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => setAttentionPage(pageNum)}
                            className={`px-3 py-1 text-xs rounded-lg transition-all duration-200 shadow-sm hover:shadow-md ${pageNum === safeAttentionPage
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                              : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                              }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}

                      <button
                        onClick={() => setAttentionPage(Math.min(totalAttentionPages, safeAttentionPage + 1))}
                        disabled={safeAttentionPage === totalAttentionPages}
                        className="px-3 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
                      >
                        Next<i className="fas fa-chevron-right ml-1" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-white/5" onClick={(e) => e.stopPropagation()}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Full name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Email</th>
                    {programId !== 'dba' && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Slot</th>}
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Learner Type</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Courses Completed</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={programId === 'dba' ? 6 : 7} className="px-6 py-12 text-center">
                        <div className="text-gray-500 dark:text-gray-400">
                          <i className="fas fa-users text-4xl mb-4" />
                          <p className="text-lg font-medium">No learners found</p>
                          <p className="text-sm">Try adjusting your search or filter criteria</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((learner) => {
                      const initials = `${(learner.firstName ?? 'N').trim()[0] ?? 'N'}${(learner.lastName ?? 'A').trim()[0] ?? 'A'}`.toUpperCase();
                      const slotText = (learner.slot ?? '').trim();
                      const slotShort = slotText ? slotText.slice(0, 6) : '';
                      const statusText = (learner.secondaryStatus ?? '').trim() || 'Active'; // For display backup, but data should be correct

                      const emailKey = (learner.email ?? '').trim().toLowerCase();
                      const cohortIdKey = (learner.cohortId ?? '').trim();
                      const courseKey = emailKey && cohortIdKey ? `${emailKey}__${cohortIdKey}` : '';
                      const mergedCourse = courseKey ? mergedByEmailAndCohortId.get(courseKey) : undefined;

                      const completedRaw = mergedCourse?.coursesCompleted;
                      const incompleteRaw = mergedCourse?.coursesIncomplete;
                      const completedNum = parseNumber(completedRaw);
                      const incompleteNum = parseNumber(incompleteRaw) ?? 0;
                      const netCompleted =
                        completedNum === null ? null : Math.max(0, Math.round(completedNum - incompleteNum));

                      return (
                        <tr
                          key={`${(learner.email ?? '').trim().toLowerCase()}__${(learner.cohortId ?? '').trim() || (learner.cohort ?? '').trim()}__${learner.userId ?? ''}`}
                          className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-400 font-black text-sm shadow-sm">
                                {initials}
                              </div>
                              <div className="ml-3">
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{learner.firstName} {learner.lastName}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Cohort: {learner.cohort ?? ''}</p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-700 dark:text-gray-300">{learner.email}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{learner.batch ?? ''}</p>
                          </td>

                          {programId !== 'dba' && (
                            <td className="px-6 py-4">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{learner.batch ?? ''}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{slotShort}</p>
                            </td>
                          )}

                          <td className="px-6 py-4 text-center">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{learner.learnerType ?? learner.batch ?? ''}</p>
                          </td>

                          <td className="px-8 py-6 text-center">
                            <span
                              className={[
                                'inline-block px-4 py-2 text-sm font-medium rounded-full min-w-[140px] max-w-[180px] truncate whitespace-nowrap',
                                isDark ? 'bg-gray-700/50 text-gray-300 border border-white/5' : statusClass(statusText),
                              ].join(' ')}
                              title={statusText}
                            >
                              {statusText.length > 16 ? `${statusText.slice(0, 16)}...` : statusText}
                            </span>
                          </td>

                          <td className="px-8 py-6 text-center">
                            <div className="flex flex-col items-center justify-center">
                              {completedNum === null || completedNum <= 0 || netCompleted === null ? (
                                <>
                                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">N/A</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">N/A</p>
                                </>
                              ) : (
                                <>
                                  {(() => {
                                    const PROGRAM_TOTAL = config.totalCourses || 7;
                                    const completed = Math.round(completedNum);
                                    const incomplete = Math.round(incompleteNum);
                                    const effectiveNet =
                                      netCompleted === 0 && incomplete === completed && completed > 0 ? completed : netCompleted;

                                    return (
                                      <p className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
                                        {effectiveNet}/{PROGRAM_TOTAL}
                                      </p>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center">
                              {learner.userId ? (
                                <Link
                                  to={`/${programId}/learner/${encodeURIComponent((learner.userId ?? '').trim())}`}
                                  className="p-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-white/5 rounded-lg transition-colors inline-block"
                                  title="View Profile"
                                >
                                  <i className="fas fa-eye" />
                                </Link>
                              ) : (
                                <span className="text-xs text-gray-400">No ID</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-white/5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Show</span>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-3 py-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 dark:text-gray-300"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-gray-600 dark:text-gray-400">entries</span>
              </div>

              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing <span className="font-medium text-gray-800 dark:text-gray-100">{filteredForKpis.length === 0 ? 0 : (safePage - 1) * perPage + 1}</span> to{' '}
                  <span className="font-medium text-gray-800 dark:text-gray-100">{Math.min(safePage * perPage, filteredForKpis.length)}</span> of{' '}
                  <span className="font-medium text-gray-800 dark:text-gray-100">{filteredForKpis.length}</span> learners
                </p>
              </div>

              <div className="flex space-x-2 items-center">
                <button
                  className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <i className="fas fa-chevron-left" />
                </button>

                {paginationPages.map((p, idx) =>
                  p === 'ellipsis' ? (
                    <span key={`e-${idx}`} className="px-2 py-1 text-gray-500">...</span>
                  ) : p === safePage ? (
                    <button key={p} className="px-3 py-1 bg-blue-600 text-white rounded-lg font-bold">{p}</button>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors font-medium"
                    >
                      {p}
                    </button>
                  ),
                )}

                <button
                  className="px-3 py-1 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-600 dark:text-gray-400"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <i className="fas fa-chevron-right" />
                </button>
              </div>
            </div>
          </div>
        )
      )}
      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowExportModal(false)} />
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-[32px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] border border-white/10">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white dark:from-gray-900/50 dark:to-gray-800">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Export Student List</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Select columns to include in your CSV export</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <i className="fas fa-times" />
              </button>
            </div>

            {/* Modal Quick Selection */}
            <div className="px-8 py-4 bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-100 dark:border-white/5 flex items-center justify-end gap-3">
              <span className="text-xs text-gray-400 mr-auto italic">Pick columns to export</span>
              <button
                type="button"
                onClick={() => setSelectedExportColumns(EXPORT_COLUMNS)}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 rounded-lg transition-colors border border-indigo-100 dark:border-indigo-900/50"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedExportColumns([])}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
              >
                Clear
              </button>
            </div>

            {/* Modal Content - Scrollable grid */}
            <div className="p-8 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {EXPORT_COLUMNS.map(header => (
                  <label
                    key={header}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer group ${selectedExportColumns.includes(header)
                      ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20'
                      : 'border-gray-100 dark:border-white/5 bg-white dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-indigo-500/50'
                      }`}
                  >
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${selectedExportColumns.includes(header)
                      ? 'bg-indigo-600 border-indigo-600'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-white/10 group-hover:border-indigo-400'
                      }`}>
                      {selectedExportColumns.includes(header) && <i className="fas fa-check text-[10px] text-white" />}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedExportColumns.includes(header)}
                      onChange={() => {
                        setSelectedExportColumns(prev =>
                          prev.includes(header) ? prev.filter(x => x !== header) : [...prev, header]
                        );
                      }}
                    />
                    <span className={`text-xs font-medium truncate ${selectedExportColumns.includes(header) ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-600 dark:text-gray-400'}`}>
                      {header}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{totalLearners}</span> learners will be exported with <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedExportColumns.length}</span> columns.
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={selectedExportColumns.length === 0}
                  className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  <i className="fas fa-download mr-2" />
                  Download CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
