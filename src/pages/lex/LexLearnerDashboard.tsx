import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAllLearnerData } from '../../hooks/useAllLearnerData';
import { useLexFilter } from '../../hooks/useLexFilter';
import { v, getLearnerCategory, getLearnerResidency } from '../../lib/logic';
import FilterDropdown from '../../components/FilterDropdown';
import DateBadge from '../../components/DateBadge';

function StatSkeleton() {
  return <div className="h-5 w-16 bg-slate-200 rounded animate-pulse" />;
}

function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="pl-6 pr-4 py-3.5"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-slate-100" /><div className="h-8 bg-slate-100 rounded-lg w-40" /></div></td>
      <td className="px-8 py-4"><div className="h-10 bg-slate-50 rounded-lg w-32 mx-auto" /></td>
      <td className="px-8 py-4"><div className="h-8 bg-slate-50 rounded-full w-24 mx-auto" /></td>
      <td className="px-8 py-4"><div className="h-8 bg-slate-50 rounded-lg w-20 mx-auto" /></td>
      <td className="px-8 py-4"><div className="h-6 bg-slate-50 rounded w-16 mx-auto" /></td>
    </tr>
  );
}

type SortKey = 'name' | 'program' | 'status' | 'launch';

// Status pill colours, consistent with the Home dashboard (Active red, Graduated teal, LOA gold, Exit grey)
function statusTone(mapped: string): { bg: string; fg: string; dot: string } {
  if (mapped === 'Active') return { bg: '#FDECEE', fg: '#9B000C', dot: '#E50913' };
  if (mapped === 'Graduated') return { bg: '#E6F4F1', fg: '#13705F', dot: '#1f9e89' };
  if (mapped === 'IPD') return { bg: '#FBF3E0', fg: '#7A5A0E', dot: '#d9a21b' };
  return { bg: '#F1F1F2', fg: '#404041', dot: '#A7A9AC' };
}

// Sortable timestamp for "Date(2023,8,30)" or "YYYY-MM[-DD]" launch values
function launchTs(val: string): number {
  const gs = (val || '').match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
  if (gs) return new Date(Number(gs[1]), Number(gs[2]), Number(gs[3])).getTime();
  const iso = (val || '').match(/^(\d{4})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1).getTime();
  return 0;
}

function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
function SubStatSkeleton() {
  return <div className="h-5 w-16 bg-slate-100 rounded animate-pulse" />;
}

export default function LexLearnerDashboard() {
  const { selectedUniversityId } = useLexFilter();
  const { students, loading } = useAllLearnerData(selectedUniversityId);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleSort = (k: SortKey) => {
    if (sortKey !== k) { setSortKey(k); setSortDir(k === 'launch' ? 'desc' : 'asc'); }
    else if (sortDir === (k === 'launch' ? 'desc' : 'asc')) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else setSortKey(null);
  };

  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status');

  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(initialStatus ? [initialStatus] : []);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedResidencies, setSelectedResidencies] = useState<string[]>([]);
  const [selectedLaunchMonths, setSelectedLaunchMonths] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<'country' | 'status' | 'program' | 'residency' | 'launchMonth' | null>(null);

  const EXPORT_COLUMNS = [
    'Email ID',
    'First Name',
    'Last Name',
    'User ID',
    'Prism User ID',
    'GGU User ID',
    'GGU Email',
    'Cohort #',
    'Cohort ID',
    'Launch Month',
    'Term',
    'Learner Type',
    'Status',
    'Country Of Residence',
    'Region',
    'Contact',
    'Package Key',
    'Status Details',
    'Cohort Status'
  ];
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(EXPORT_COLUMNS);

  // Auto-reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCountries, selectedStatuses, selectedPrograms, selectedResidencies, selectedLaunchMonths]);

  const toggleFilter = (list: string[], set: (v: string[]) => void, value: string) => {
    if (list.includes(value)) {
      set(list.filter(v => v !== value));
    } else {
      set([...list, value]);
    }
  };

  const formatLaunchMonth = (val: string) => {
    if (!val || val === '-') return '-';
    // Handle Date(2023,8,30) - Google Sheets format (month is 0-indexed)
    const gs = val.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
    if (gs) {
      const date = new Date(Number(gs[1]), Number(gs[2]), Number(gs[3]));
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.toLocaleString('en-US', { year: '2-digit' });
      return `${month} - ${year}`;
    }
    // Handle YYYY-MM-DD or YYYY-MM
    const iso = val.match(/^(\d{4})-(\d{2})(-\d{2})?$/);
    if (iso) {
      const date = new Date(Number(iso[1]), Number(iso[2]) - 1);
      const month = date.toLocaleString('en-US', { month: 'short' });
      const year = date.toLocaleString('en-US', { year: '2-digit' });
      return `${month} - ${year}`;
    }
    return val;
  };

  const handleExportCSV = () => {
    if (selectedExportColumns.length === 0) return;
    const headers = selectedExportColumns;

    const csvRows = filteredRows.map(r => {
      const raw = r.raw || {};
      const rowMap: Record<string, unknown> = {
        'Email ID': raw['Email ID'] ?? '',
        'First Name': raw['First Name'] ?? '',
        'Last Name': raw['Last Name'] ?? '',
        'User ID': raw['User ID'] ?? '',
        'Prism User ID': raw['Prism User ID'] ?? '',
        'GGU User ID': raw['GGU User ID'] ?? '',
        'GGU Email': raw['GGU Email'] ?? '',
        'Cohort #': raw['Cohort #'] ?? '',
        'Cohort ID': raw['Cohort ID'] ?? '',
        'Launch Month': formatLaunchMonth(raw['Batch Launch Month'] || raw['Launch Month'] || ''),
        'Term': raw['GGU Term Id'] || raw['Term'] || '',
        'Learner Type': raw['Learner Type'] ?? '',
        'Status': (raw['Actual Status'] || raw['Status']) ?? '',
        'Country Of Residence': raw['Country Of Residence'] ?? '',
        'Region': raw['Region'] ?? '',
        'Contact': raw['Contact'] ?? '',
        'Package Key': raw['Package Key'] ?? '',
        'Status Details': raw['Status Details'] ?? '',
        'Cohort Status': raw['Cohort Status'] ?? '',
        'Program': raw['Program'] ?? ''
      };

      const cols = selectedExportColumns.map(col => rowMap[col]);
      return cols.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `overall_learners_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportModal(false);
  };

  const { rows, stats, filterOptions } = useMemo(() => {
    let total = 0;
    let active = 0;
    let international = 0;
    let domestic = 0;
    let activeInternational = 0;
    let activeDomestic = 0;
    let graduated = 0;
    let graduatedInternational = 0;
    let graduatedDomestic = 0;
    let loa = 0;
    let loaInternational = 0;
    let loaDomestic = 0;
    let exit = 0;
    let exitInternational = 0;
    let exitDomestic = 0;

    const programsSet = new Set<string>();
    const countriesSet = new Set<string>();
    const statusesSet = new Set<string>();
    const launchMonthsSet = new Set<string>();

    const filteredStudents = students;
    const mappedRows = filteredStudents.map((s, idx) => {
      const rawStatus = v(s, 'Actual Status', 'Secondary Status', 'Learner Status', 'Status Details', 'Status');
      const mappedStatus = getLearnerCategory(rawStatus, s);

      const email = v(s, 'Email ID', 'GGU Email', 'Email', 'GGU Student Email ID') || v(s, 'GGU User ID', 'User ID', 'Prism User ID') || `learner-${idx + 1}`;
      const userId = v(s, 'User ID', 'Prism User ID', 'GGU User ID', 'Student ID', 'id') || `ID-${idx + 1}`;
      const term = v(s, 'Term', 'GGU Term Id', 'Current Term', 'Cohort Term') || '';
      const region = v(s, 'Region', 'Current Region', 'Geographic Region') || '';
      const country = (v(s, 'Country Of Residence', 'Country of Residence', 'Country', 'Country of  Residence') || '').trim();
      const rawLaunch = (v(s, 'Batch Launch Month', 'Launch Month') || '').trim();

      const learnerType = getLearnerResidency(s);
      const isInt = learnerType === 'International';
      const isDom = learnerType === 'India';

      total++;

      if (isInt) {
        international++;
      } else if (isDom) {
        domestic++;
      }

      if (mappedStatus === 'Graduated') {
        graduated++;
        if (isInt) graduatedInternational++;
        if (isDom) graduatedDomestic++;
      } else if (mappedStatus === 'Active') {
        active++;
        if (isInt) activeInternational++;
        if (isDom) activeDomestic++;
      } else if (mappedStatus === 'IPD') {
        loa++;
        if (isInt) loaInternational++;
        if (isDom) loaDomestic++;
      } else if (mappedStatus === 'Other Inactive' || mappedStatus === 'Payment-Dropout') {
        exit++;
        if (isInt) exitInternational++;
        if (isDom) exitDomestic++;
      }

      programsSet.add(s._programName);
      if (country) countriesSet.add(country);
      const cohort = v(s, 'Cohort #', 'Cohort ID', 'Cohort') || '-';

      statusesSet.add(mappedStatus);
      if (rawLaunch) launchMonthsSet.add(formatLaunchMonth(rawLaunch));

      return {
        raw: s,
        name: `${s['First Name'] || ''} ${s['Last Name'] || ''}`.trim(),
        email,
        userId,
        term,
        region,
        program: s._programName,
        country,
        cohort,
        learnerType,
        status: rawStatus,
        mappedStatus,
        launchMonth: rawLaunch,
        formattedLaunch: formatLaunchMonth(rawLaunch)
      };
    });

    const sortedLaunchMonths = Array.from(launchMonthsSet).sort((a, b) => {
      if (a === '-' || b === '-') return 0;
      const parse = (s: string) => {
        const [m, y] = s.split(' - ');
        const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(m);
        return new Date(2000 + Number(y), month).getTime();
      };
      return parse(a) - parse(b);
    });

    return {
      rows: mappedRows,
      stats: {
        total,
        active,
        international,
        domestic,
        activeInternational,
        activeDomestic,
        graduated,
        graduatedInternational,
        graduatedDomestic,
        loa,
        loaInternational,
        loaDomestic,
        exit,
        exitInternational,
        exitDomestic
      },
      filterOptions: {
        countries: Array.from(countriesSet).sort(),
        programs: Array.from(programsSet).sort(),
        statuses: ['Active', 'IPD', 'Exit', 'Graduated'],
        residencies: ['India', 'International'],
        launchMonths: sortedLaunchMonths
      }
    };
  }, [students]);

  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      // Search
      const term = search.toLowerCase();
      const matchesSearch = !search.trim() ||
        r.name.toLowerCase().includes(term) ||
        r.email.toLowerCase().includes(term) ||
        r.program.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // Filters
      if (selectedCountries.length > 0 && !selectedCountries.includes(r.country || '')) return false;
      if (selectedStatuses.length > 0) {
        const matchesStatus = selectedStatuses.some(s => {
          if (s === 'Exit' || s === 'Other Inactive' || s === 'Payment-Dropout') {
            return r.mappedStatus !== 'Active' && r.mappedStatus !== 'Graduated' && r.mappedStatus !== 'IPD';
          }
          return r.mappedStatus === s;
        });
        if (!matchesStatus) return false;
      }
      if (selectedPrograms.length > 0 && !selectedPrograms.includes(r.program)) return false;
      if (selectedResidencies.length > 0 && !selectedResidencies.includes(r.learnerType)) return false;
      if (selectedLaunchMonths.length > 0 && !selectedLaunchMonths.includes(r.formattedLaunch)) return false;

      return true;
    });
  }, [rows, search, selectedCountries, selectedStatuses, selectedPrograms, selectedResidencies, selectedLaunchMonths]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const dir = sortDir === 'asc' ? 1 : -1;
    const val = (r: typeof filteredRows[number]): string | number =>
      sortKey === 'name' ? r.name.toLowerCase()
        : sortKey === 'program' ? `${r.program} ${r.cohort}`.toLowerCase()
          : sortKey === 'status' ? r.mappedStatus
            : launchTs(r.launchMonth);
    return [...filteredRows].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [filteredRows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * perPage;
    return sortedRows.slice(start, start + perPage);
  }, [sortedRows, safePage, perPage]);

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

  const anyFilter = selectedCountries.length > 0 || selectedStatuses.length > 0 || selectedPrograms.length > 0 || selectedResidencies.length > 0 || selectedLaunchMonths.length > 0 || !!search;
  const resetAll = () => {
    setSelectedCountries([]);
    setSelectedStatuses([]);
    setSelectedPrograms([]);
    setSelectedResidencies([]);
    setSelectedLaunchMonths([]);
    setSearch('');
  };

  // Removable chips for every active filter value
  const chips: Array<{ key: string; group: string; label: string; remove: () => void }> = [
    ...(search ? [{ key: 'search', group: 'Search', label: `"${search}"`, remove: () => setSearch('') }] : []),
    ...selectedPrograms.map(v => ({ key: `p-${v}`, group: 'Program', label: v, remove: () => toggleFilter(selectedPrograms, setSelectedPrograms, v) })),
    ...selectedCountries.map(v => ({ key: `c-${v}`, group: 'Country', label: v, remove: () => toggleFilter(selectedCountries, setSelectedCountries, v) })),
    ...selectedLaunchMonths.map(v => ({ key: `m-${v}`, group: 'Launch', label: v, remove: () => toggleFilter(selectedLaunchMonths, setSelectedLaunchMonths, v) })),
    ...selectedResidencies.map(v => ({ key: `r-${v}`, group: 'Residency', label: v, remove: () => toggleFilter(selectedResidencies, setSelectedResidencies, v) })),
    ...selectedStatuses.map(v => ({ key: `s-${v}`, group: 'Status', label: v === 'IPD' ? 'Leave of absence' : v, remove: () => toggleFilter(selectedStatuses, setSelectedStatuses, v) })),
  ];

  const statusCards: Array<{
    key: string; label: string; icon: string; chip: string; bar: string;
    value: number; intl: number; dom: number; filter: string[];
  }> = [
    { key: 'all', label: 'Total learners', icon: 'fa-users', chip: 'bg-slate-900 text-white', bar: '#1A1A1B', value: stats.total, intl: stats.international, dom: stats.domestic, filter: [] },
    { key: 'Active', label: 'Active', icon: 'fa-user-check', chip: 'bg-brand-50 text-brand-600', bar: '#E50913', value: stats.active, intl: stats.activeInternational, dom: stats.activeDomestic, filter: ['Active'] },
    { key: 'Graduated', label: 'Graduated', icon: 'fa-award', chip: 'bg-emerald-50 text-emerald-600', bar: '#1f9e89', value: stats.graduated, intl: stats.graduatedInternational, dom: stats.graduatedDomestic, filter: ['Graduated'] },
    { key: 'IPD', label: 'Leave of absence', icon: 'fa-clock', chip: 'bg-amber-50 text-amber-600', bar: '#d9a21b', value: stats.loa, intl: stats.loaInternational, dom: stats.loaDomestic, filter: ['IPD'] },
    { key: 'Exit', label: 'Exited', icon: 'fa-user-minus', chip: 'bg-slate-100 text-slate-600', bar: '#7A7C7F', value: stats.exit, intl: stats.exitInternational, dom: stats.exitDomestic, filter: ['Exit'] },
  ];

  const sortHeader = (k: SortKey, label: string, className: string, align: 'left' | 'right' = 'left') => {
    const on = sortKey === k;
    return (
      <th className={`py-3 text-[11px] font-semibold uppercase tracking-[0.06em] ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
        aria-sort={on ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className={`inline-flex items-center gap-1.5 uppercase tracking-[0.06em] transition-colors ${on ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'}`}
        >
          {label}
          <i className={`fas ${on ? (sortDir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down') : 'fa-sort'} text-[9px] ${on ? 'text-brand-500' : 'text-slate-300'}`} />
        </button>
      </th>
    );
  };

  return (
    <div className="max-w-7xl mx-auto py-2 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-2">
        <div>
          <p className="text-[11px] font-semibold text-brand-600 uppercase tracking-[0.14em] mb-1.5">Golden Gate University</p>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Learner <span className="text-brand-500">Directory</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">Search, filter and export every learner across Golden Gate University programs.</p>
        </div>
        <DateBadge />
      </div>

      {/* Status cards: click to filter the directory */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {statusCards.map(k => {
          const selected = k.key === 'all'
            ? selectedStatuses.length === 0
            : selectedStatuses.length === 1 && selectedStatuses[0] === k.key;
          const share = (k.value / (stats.total || 1)) * 100;
          return (
            <button
              key={k.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelectedStatuses(k.key === 'all' || selected ? [] : k.filter)}
              className={`group text-left bg-white rounded-2xl border px-3.5 py-3 transition-all duration-300 hover:-translate-y-0.5 ${selected
                ? 'border-brand-500 shadow-[0_0_0_3px_rgba(229,9,19,0.10),0_10px_30px_-14px_rgba(229,9,19,0.35)]'
                : 'border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)] hover:border-slate-300'}`}
              style={selected ? { borderColor: '#E50913' } : undefined}
            >
              <div className="flex items-center justify-between">
                <span className={`w-6 h-6 rounded-md flex items-center justify-center ${k.chip}`}>
                  <i className={`fas ${k.icon} text-[9px]`} />
                </span>
                {selected
                  ? <span className="text-[9.5px] font-semibold text-brand-600 flex items-center gap-1"><i className="fas fa-check text-[8px]" />Showing</span>
                  : <i className="fas fa-filter text-[10px] text-slate-300 group-hover:text-brand-500 transition-colors" />}
              </div>
              <div className="mt-2 text-[11px] font-medium text-slate-500">{k.label}</div>
              <div className="mt-0.5 text-[21px] leading-none font-extrabold text-slate-900 font-display tabular-nums">
                {loading ? <StatSkeleton /> : k.value.toLocaleString()}
              </div>
              <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: loading ? '0%' : `${k.key === 'all' ? 100 : share}%`, background: k.bar }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[10.5px] text-slate-500 tabular-nums">
                {loading ? <SubStatSkeleton /> : (
                  <>
                    <span title="India-based learners"><span className="text-slate-400">India</span> {k.dom.toLocaleString()}</span>
                    <span title="International learners"><span className="text-slate-400">Intl</span> {k.intl.toLocaleString()}</span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <section className="bg-white rounded-3xl border border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] p-5 lg:p-6">
        <div className="relative group/search">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-[13px] text-slate-400 group-focus-within/search:text-brand-500 transition-colors" />
          <input
            type="text"
            placeholder="Search by name, email or program..."
            className="w-full pl-11 pr-10 py-3 rounded-[14px] border border-slate-200 outline-none focus:ring-4 focus:ring-brand-500/10 focus:border-brand-400 transition-all text-sm text-slate-800 placeholder:text-slate-400"
            style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-slate-400 hover:text-slate-700" aria-label="Clear search">
              <i className="fas fa-times text-[11px]" />
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[62px] rounded-[14px] bg-slate-100 animate-pulse" />)
          ) : (
            <>
              <FilterDropdown label="Program" iconClass="fas fa-graduation-cap" placeholder="All programs" values={filterOptions.programs} selected={selectedPrograms}
                onToggle={(v) => toggleFilter(selectedPrograms, setSelectedPrograms, v)} isOpen={openDropdown === 'program'} setIsOpen={(open) => setOpenDropdown(open ? 'program' : null)} />
              <FilterDropdown label="Country of residence" iconClass="fas fa-flag" placeholder="All countries" values={filterOptions.countries} selected={selectedCountries}
                onToggle={(v) => toggleFilter(selectedCountries, setSelectedCountries, v)} isOpen={openDropdown === 'country'} setIsOpen={(open) => setOpenDropdown(open ? 'country' : null)} />
              <FilterDropdown label="Launch month" iconClass="fas fa-calendar-alt" placeholder="All months" values={filterOptions.launchMonths} selected={selectedLaunchMonths}
                onToggle={(v) => toggleFilter(selectedLaunchMonths, setSelectedLaunchMonths, v)} isOpen={openDropdown === 'launchMonth'} setIsOpen={(open) => setOpenDropdown(open ? 'launchMonth' : null)} />
              <FilterDropdown label="Residency" iconClass="fas fa-globe-americas" placeholder="India & International" values={filterOptions.residencies} selected={selectedResidencies}
                onToggle={(v) => toggleFilter(selectedResidencies, setSelectedResidencies, v)} isOpen={openDropdown === 'residency'} setIsOpen={(open) => setOpenDropdown(open ? 'residency' : null)} />
              <FilterDropdown label="Status" iconClass="fas fa-user-tag" placeholder="All statuses" values={filterOptions.statuses} selected={selectedStatuses}
                onToggle={(v) => toggleFilter(selectedStatuses, setSelectedStatuses, v)} isOpen={openDropdown === 'status'} setIsOpen={(open) => setOpenDropdown(open ? 'status' : null)} />
            </>
          )}
        </div>

        {anyFilter && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2" style={{ animation: 'anaRise .25s ease-out both' }}>
            <span className="text-[11px] font-semibold text-slate-500 mr-1">Filtered by</span>
            {chips.map(c => (
              <span key={c.key} className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-slate-200 text-[12px] text-slate-700" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>
                <span className="text-slate-400">{c.group}:</span>
                <span className="font-medium max-w-[180px] truncate">{c.label}</span>
                <button type="button" onClick={c.remove} className="w-5 h-5 rounded-full text-slate-400 hover:text-brand-600 transition-colors" aria-label={`Remove ${c.group} ${c.label}`}>
                  <i className="fas fa-times text-[9px]" />
                </button>
              </span>
            ))}
            <button type="button" onClick={resetAll} className="ml-auto text-[12px] font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1.5">
              <i className="fas fa-rotate-left text-[10px]" />Clear all
            </button>
          </div>
        )}
      </section>

      {/* Directory */}
      <section className="bg-white rounded-3xl border border-slate-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] overflow-hidden">
        <header className="px-6 py-5 flex flex-wrap gap-4 justify-between items-center">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <i className="fas fa-address-book text-sm" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 leading-tight">Learners</h2>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-bold text-slate-600 tabular-nums">{filteredRows.length.toLocaleString()}</span>
              </div>
              <p className="text-[13px] text-slate-500 mt-0.5">
                {loading
                  ? 'Loading learners...'
                  : filteredRows.length === 0
                    ? 'No learners match the current filters'
                    : `Showing ${((safePage - 1) * perPage + 1).toLocaleString()}–${Math.min(safePage * perPage, filteredRows.length).toLocaleString()} of ${filteredRows.length.toLocaleString()}${anyFilter ? ` (filtered from ${rows.length.toLocaleString()})` : ''}`}
              </p>
            </div>
          </div>
          {!loading && filteredRows.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (selectedExportColumns.length === 0) {
                  setSelectedExportColumns(['Email ID', 'First Name', 'Last Name', 'Cohort #', 'Launch Month', 'Status', 'Country Of Residence']);
                }
                setShowExportModal(true);
              }}
              className="px-4 py-2 rounded-[12px] text-white text-[12px] font-semibold flex items-center gap-2 shadow-[0_6px_16px_-8px_rgba(229,9,19,0.6)] hover:brightness-110 transition-all"
              style={{ background: 'linear-gradient(135deg, #E50913, #BF2026)' }}
            >
              <i className="fas fa-file-export text-[11px]" />
              Export CSV
            </button>
          )}
        </header>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="border-y border-slate-100" style={{ background: 'var(--bg-surface-2, #F7F7F8)' }}>
              <tr>
                {sortHeader('name', 'Learner', 'pl-6 pr-4')}
                {sortHeader('program', 'Program & cohort', 'px-4')}
                <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">Residency</th>
                {sortHeader('status', 'Status', 'px-4')}
                {sortHeader('launch', 'Launch', 'pl-4 pr-6', 'right')}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => <TableRowSkeleton key={i} />)
              ) : paginatedRows.length > 0 ? (
                paginatedRows.map((row, idx) => {
                  const tone = statusTone(row.mappedStatus);
                  return (
                    <tr key={`${row.userId}-${idx}`} className="group hover:bg-[#FAFAFB] transition-colors">
                      <td className="pl-6 pr-4 py-3.5 whitespace-nowrap relative">
                        <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-brand-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0" style={{ background: '#F1F1F2', color: '#404041' }}>
                            {initials(row.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 leading-tight">{row.name || 'N/A'}</p>
                            <p className="text-xs text-slate-500 leading-tight mt-0.5">{row.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-sm font-medium text-slate-800 leading-tight">{row.program}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {[row.cohort && row.cohort !== '-' ? `Cohort ${row.cohort}` : '', row.term].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <p className="text-[13px] font-medium text-slate-800 flex items-center gap-1.5">
                          <i className={`fas ${row.learnerType === 'International' ? 'fa-globe-americas' : 'fa-house'} text-[10px] text-slate-400`} />
                          {row.learnerType}
                        </p>
                        {(row.country || row.region) && (
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{[row.country, row.region].filter(Boolean).join(' · ')}</p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] font-medium rounded-full" style={{ background: tone.bg, color: tone.fg }} title={row.mappedStatus}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: tone.dot }} />
                          {row.status || '—'}
                        </span>
                      </td>
                      <td className="pl-4 pr-6 py-3.5 whitespace-nowrap text-right text-[12px] font-medium text-slate-600 tabular-nums">
                        {row.formattedLaunch}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-[16px] flex items-center justify-center text-slate-300 text-xl mb-4" style={{ background: '#F7F7F8' }}>
                        <i className="fas fa-user-slash" />
                      </div>
                      <p className="text-slate-800 font-semibold text-sm">No learners match your filters</p>
                      <p className="text-slate-500 text-xs mt-1">Try a different search or clear the filters.</p>
                      <button onClick={resetAll} className="mt-4 px-4 py-2 rounded-[12px] border border-slate-200 text-slate-700 hover:border-brand-300 hover:text-brand-600 text-xs font-semibold transition-all">
                        <i className="fas fa-rotate-left mr-1.5" />Clear filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <span>Rows per page</span>
            <select
              value={perPage}
              onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2.5 py-1.5 rounded-[10px] border border-slate-200 bg-transparent text-[12px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            >
              {[10, 15, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              className="w-8 h-8 rounded-[10px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <i className="fas fa-chevron-left text-[11px]" />
            </button>
            {paginationPages.map((p, idx) =>
              p === 'ellipsis' ? (
                <span key={`e-${idx}`} className="w-8 text-center text-slate-400">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  aria-current={p === safePage ? 'page' : undefined}
                  className={`min-w-[32px] h-8 px-2 rounded-[10px] text-[12px] font-semibold tabular-nums transition-colors ${p === safePage ? 'text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
                  style={p === safePage ? { background: '#E50913', boxShadow: '0 4px 12px -6px rgba(229,9,19,0.7)' } : undefined}
                >
                  {p}
                </button>
              ),
            )}
            <button
              className="w-8 h-8 rounded-[10px] text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <i className="fas fa-chevron-right text-[11px]" />
            </button>
          </div>
        </div>
      </section>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowExportModal(false)} />
          <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-[32px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] border border-white/10 text-left">
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
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/50 rounded-lg transition-colors border border-brand-100 dark:border-brand-900/50"
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
                      ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20'
                      : 'border-gray-100 dark:border-white/5 bg-white dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-brand-500/50'
                      }`}
                  >
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${selectedExportColumns.includes(header)
                      ? 'bg-brand-600 border-brand-600'
                      : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-white/10 group-hover:border-brand-400'
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
                    <span className={`text-xs font-medium truncate ${selectedExportColumns.includes(header) ? 'text-brand-700 dark:text-brand-300' : 'text-gray-600 dark:text-gray-400'}`}>
                      {header}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <span className="font-bold text-brand-600 dark:text-brand-400">{filteredRows.length}</span> learners will be exported with <span className="font-bold text-brand-600 dark:text-brand-400">{selectedExportColumns.length}</span> columns.
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
                  onClick={handleExportCSV}
                  disabled={selectedExportColumns.length === 0}
                  className="px-8 py-2.5 bg-gradient-to-r from-brand-600 to-brand-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-200 dark:shadow-none hover:shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
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
