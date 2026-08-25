import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAllLearnerData } from '../../hooks/useAllLearnerData';
import { useLexFilter } from '../../hooks/useLexFilter';
import { v, normalizeSecondaryStatus, isLearnerActive } from '../../lib/logic';
import FilterDropdown from '../../components/FilterDropdown';

function StatSkeleton() {
  return <div className="h-8 w-24 bg-slate-200 rounded animate-pulse" />;
}

function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-8 py-4"><div className="h-10 bg-slate-100 rounded-xl w-48" /></td>
      <td className="px-8 py-4"><div className="h-10 bg-slate-50 rounded-lg w-32 mx-auto" /></td>
      <td className="px-8 py-4"><div className="h-8 bg-slate-50 rounded-full w-24 mx-auto" /></td>
      <td className="px-8 py-4"><div className="h-8 bg-slate-50 rounded-lg w-20 mx-auto" /></td>
      <td className="px-8 py-4"><div className="h-6 bg-slate-50 rounded w-16 mx-auto" /></td>
    </tr>
  );
}

function statusClass(status: string): string {
  const s = (status || '').trim().toLowerCase();
  if (s.includes('active')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (s.includes('completed') || s.includes('graduated')) return 'bg-purple-50 text-purple-700 border-purple-100';
  if (s.includes('defer')) return 'bg-amber-50 text-amber-700 border-amber-100';
  if (s.includes('withdrawn')) return 'bg-rose-50 text-rose-700 border-rose-100';
  return 'bg-slate-50 text-slate-700 border-slate-100';
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
      const rowMap: Record<string, any> = {
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
    let inactive = 0;
    let international = 0;
    let domestic = 0;
    let activeInternational = 0;
    let activeDomestic = 0;
    let inactiveInternational = 0;
    let inactiveDomestic = 0;
    let graduated = 0;
    let graduatedInternational = 0;
    let graduatedDomestic = 0;
    let ipd = 0;
    let ipdInternational = 0;
    let ipdDomestic = 0;
    let paymentDropout = 0;
    let paymentDropoutInternational = 0;
    let paymentDropoutDomestic = 0;
    let otherInactive = 0;
    let otherInactiveInternational = 0;
    let otherInactiveDomestic = 0;
    const programsSet = new Set<string>();
    const countriesSet = new Set<string>();
    const statusesSet = new Set<string>();
    const launchMonthsSet = new Set<string>();

    const seenEmailsForStats = new Set<string>();
    const filteredStudents = students;
    const mappedRows = filteredStudents.map((s, idx) => {
      const rawStatus = v(s, 'Secondary Status', 'Learner Status', 'Actual Status', 'Actual status', 'Status Details', 'Status');
      const normalized = normalizeSecondaryStatus(rawStatus);

      const email = v(s, 'Email ID', 'Email', 'GGU Student Email ID', 'GGU Email') || v(s, 'GGU User ID', 'User ID', 'Prism User ID') || `learner-${idx + 1}`;
      const userId = v(s, 'User ID', 'Prism User ID', 'GGU User ID', 'Student ID', 'id') || `ID-${idx + 1}`;
      const term = v(s, 'Term', 'GGU Term Id', 'Current Term', 'Cohort Term') || '';
      const region = v(s, 'Region', 'Current Region', 'Geographic Region') || '';
      const country = (s['Country Of Residence'] || s['Country of Residence'] || s['Country'] || s['Country of  Residence'] || '').trim();
      const rawType = v(s, 'Learner Type', 'Type').toLowerCase();
      const rawLaunch = (s['Batch Launch Month'] || s['Launch Month'] || '').trim();

      let learnerType = 'Unknown';
      const isInt = rawType.includes('international') || rawType.includes('us');
      const isDom = rawType.includes('domestic');

      // For stats: count each unique email only once
      const isActive = isLearnerActive(rawStatus) || !normalized;
      const isGraduated = normalized === 'completed' || normalized === 'graduated';

      let mappedStatus = 'Inactive';
      if (isGraduated) mappedStatus = 'Graduated';
      else if (isActive) mappedStatus = 'Active';
      else if (normalized === 'ipd' || normalized.includes('ipd') || normalized.includes('deferral') || normalized.includes('defferal')) mappedStatus = 'IPD';
      else if (normalized === 'payment dropout' || normalized.includes('dropout') || normalized.includes('payment')) mappedStatus = 'Payment-Dropout';
      else mappedStatus = 'Other Inactive';

      if (isInt) learnerType = 'International';
      else if (isDom) learnerType = 'Domestic';

      const isNewEmail = !seenEmailsForStats.has(email);
      if (isNewEmail) {
        seenEmailsForStats.add(email);

        if (isInt) {
          international++;
        } else if (isDom) {
          domestic++;
        }

        if (isGraduated) {
          graduated++;
          if (isInt) graduatedInternational++;
          if (isDom) graduatedDomestic++;
        } else if (isActive) {
          active++;
          if (isInt) activeInternational++;
          if (isDom) activeDomestic++;
        } else {
          if (normalized === 'ipd' || normalized.includes('ipd') || normalized.includes('deferral') || normalized.includes('defferal')) {
            ipd++;
            if (isInt) ipdInternational++;
            if (isDom) ipdDomestic++;
          } else if (normalized === 'payment dropout' || normalized.includes('dropout') || normalized.includes('payment')) {
            paymentDropout++;
            if (isInt) paymentDropoutInternational++;
            if (isDom) paymentDropoutDomestic++;
          } else {
            otherInactive++;
            if (isInt) otherInactiveInternational++;
            if (isDom) otherInactiveDomestic++;
          }
          inactive++;
          if (isInt) inactiveInternational++;
          if (isDom) inactiveDomestic++;
        }

        total++;
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
      return parse(a) - parse(b); // Past to New
    });

    return {
      rows: mappedRows,
      stats: {
        total,
        active,
        inactive,
        international,
        domestic,
        activeInternational,
        activeDomestic,
        inactiveInternational,
        inactiveDomestic,
        graduated,
        graduatedInternational,
        graduatedDomestic,
        ipd,
        ipdInternational,
        ipdDomestic,
        paymentDropout,
        paymentDropoutInternational,
        paymentDropoutDomestic,
        otherInactive,
        otherInactiveInternational,
        otherInactiveDomestic
      },
      filterOptions: {
        countries: Array.from(countriesSet).sort(),
        programs: Array.from(programsSet).sort(),
        statuses: ['Active', 'IPD', 'Payment-Dropout', 'Other Inactive', 'Graduated'],
        residencies: ['International', 'Domestic'],
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
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(r.mappedStatus)) return false;
      if (selectedPrograms.length > 0 && !selectedPrograms.includes(r.program)) return false;
      if (selectedResidencies.length > 0 && !selectedResidencies.includes(r.learnerType)) return false;
      if (selectedLaunchMonths.length > 0 && !selectedLaunchMonths.includes(r.formattedLaunch)) return false;

      return true;
    });
  }, [rows, search, selectedCountries, selectedStatuses, selectedPrograms, selectedResidencies, selectedLaunchMonths]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * perPage;
    return filteredRows.slice(start, start + perPage);
  }, [filteredRows, safePage, perPage]);

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

  return (
    <div className="max-w-6xl mx-auto py-2">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Learner <span className="text-indigo-700">Dashboard</span></h1>
          <p className="text-slate-600 text-base font-medium opacity-80">Cross-program learner analytics and student lifecycle tracking.</p>
        </div>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Total Learners Card */}
        {(() => {
          const isSelected = selectedStatuses.length === 0;
          return (
            <div
              onClick={() => setSelectedStatuses([])}
              className={`cursor-pointer bg-white rounded-2xl p-3.5 border shadow-sm flex flex-col relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ${isSelected ? 'border-slate-800 ring-2 ring-slate-800/10' : 'border-slate-100'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-sm">
                    <i className="fas fa-users text-[10px]" />
                  </div>
                  <div className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider">Total Volume</div>
                </div>
                <div className="text-xl font-black text-slate-900">
                  {loading ? <StatSkeleton /> : stats.total.toLocaleString()}
                </div>
              </div>
              <div className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 leading-none">Total Learners</div>

              {/* Progress split bar */}
              <div className="h-1 w-full bg-slate-100 rounded-full flex overflow-hidden mt-1 mb-0.5">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${(stats.international / (stats.total || 1)) * 100}%` }}
                />
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${(stats.domestic / (stats.total || 1)) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-50">
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">International</div>
                  <div className="text-[13px] font-black text-indigo-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.international.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.international / (stats.total || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Domestic</div>
                  <div className="text-[13px] font-black text-emerald-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.domestic.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.domestic / (stats.total || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Active Learners Card */}
        {(() => {
          const isSelected = selectedStatuses.length === 1 && selectedStatuses[0] === 'Active';
          return (
            <div
              onClick={() => setSelectedStatuses(isSelected ? [] : ['Active'])}
              className={`cursor-pointer bg-white rounded-2xl p-3.5 border shadow-sm flex flex-col relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ${isSelected ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-100'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-indigo-700 rounded-lg flex items-center justify-center text-white shadow-sm">
                    <i className="fas fa-user-check text-[10px]" />
                  </div>
                  <div className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider">Active Pool</div>
                </div>
                <div className="text-xl font-black text-indigo-700">
                  {loading ? <StatSkeleton /> : stats.active.toLocaleString()}
                </div>
              </div>
              <div className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 leading-none">Active Learners</div>

              {/* Progress split bar */}
              <div className="h-1 w-full bg-slate-100 rounded-full flex overflow-hidden mt-1 mb-0.5">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${(stats.activeInternational / (stats.active || 1)) * 100}%` }}
                />
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${(stats.activeDomestic / (stats.active || 1)) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-50">
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">International</div>
                  <div className="text-[13px] font-black text-indigo-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.activeInternational.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.activeInternational / (stats.active || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Domestic</div>
                  <div className="text-[13px] font-black text-emerald-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.activeDomestic.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.activeDomestic / (stats.active || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Graduated Learners Card */}
        {(() => {
          const isSelected = selectedStatuses.length === 1 && selectedStatuses[0] === 'Graduated';
          return (
            <div
              onClick={() => setSelectedStatuses(isSelected ? [] : ['Graduated'])}
              className={`cursor-pointer bg-white rounded-2xl p-3.5 border shadow-sm flex flex-col relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ${isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-slate-100'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                    <i className="fas fa-graduation-cap text-[10px]" />
                  </div>
                  <div className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider">Alumni Success</div>
                </div>
                <div className="text-xl font-black text-emerald-600">
                  {loading ? <StatSkeleton /> : stats.graduated.toLocaleString()}
                </div>
              </div>
              <div className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 leading-none">Graduated</div>

              {/* Progress split bar */}
              <div className="h-1 w-full bg-slate-100 rounded-full flex overflow-hidden mt-1 mb-0.5">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${(stats.graduatedInternational / (stats.graduated || 1)) * 100}%` }}
                />
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${(stats.graduatedDomestic / (stats.graduated || 1)) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-50">
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">International</div>
                  <div className="text-[13px] font-black text-indigo-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.graduatedInternational.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.graduatedInternational / (stats.graduated || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Domestic</div>
                  <div className="text-[13px] font-black text-emerald-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.graduatedDomestic.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.graduatedDomestic / (stats.graduated || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* IPD Learners Card */}
        {(() => {
          const isSelected = selectedStatuses.length === 1 && selectedStatuses[0] === 'IPD';
          return (
            <div
              onClick={() => setSelectedStatuses(isSelected ? [] : ['IPD'])}
              className={`cursor-pointer bg-white rounded-2xl p-3.5 border shadow-sm flex flex-col relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ${isSelected ? 'border-amber-500 ring-2 ring-amber-500/10' : 'border-slate-100'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-amber-400 rounded-lg flex items-center justify-center text-white shadow-sm">
                    <i className="fas fa-hourglass-half text-[10px]" />
                  </div>
                  <div className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider">IPD</div>
                </div>
                <div className="text-xl font-black text-amber-400">
                  {loading ? <StatSkeleton /> : stats.ipd.toLocaleString()}
                </div>
              </div>
              <div className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 leading-none">In Process of Deferral</div>

              {/* Progress split bar */}
              <div className="h-1 w-full bg-slate-100 rounded-full flex overflow-hidden mt-1 mb-0.5">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${(stats.ipdInternational / (stats.ipd || 1)) * 100}%` }}
                />
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${(stats.ipdDomestic / (stats.ipd || 1)) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-50">
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">International</div>
                  <div className="text-[13px] font-black text-indigo-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.ipdInternational.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.ipdInternational / (stats.ipd || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Domestic</div>
                  <div className="text-[13px] font-black text-emerald-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.ipdDomestic.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.ipdDomestic / (stats.ipd || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Payment Dropout Card */}
        {(() => {
          const isSelected = selectedStatuses.length === 1 && selectedStatuses[0] === 'Payment-Dropout';
          return (
            <div
              onClick={() => setSelectedStatuses(isSelected ? [] : ['Payment-Dropout'])}
              className={`cursor-pointer bg-white rounded-2xl p-3.5 border shadow-sm flex flex-col relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ${isSelected ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-slate-100'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-rose-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                    <i className="fas fa-user-minus text-[10px]" />
                  </div>
                  <div className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider">Payment-Dropout</div>
                </div>
                <div className="text-xl font-black text-rose-600">
                  {loading ? <StatSkeleton /> : stats.paymentDropout.toLocaleString()}
                </div>
              </div>
              <div className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 leading-none">Payment Dropout</div>

              {/* Progress split bar */}
              <div className="h-1 w-full bg-slate-100 rounded-full flex overflow-hidden mt-1 mb-0.5">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${(stats.paymentDropoutInternational / (stats.paymentDropout || 1)) * 100}%` }}
                />
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${(stats.paymentDropoutDomestic / (stats.paymentDropout || 1)) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-50">
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">International</div>
                  <div className="text-[13px] font-black text-indigo-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.paymentDropoutInternational.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.paymentDropoutInternational / (stats.paymentDropout || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Domestic</div>
                  <div className="text-[13px] font-black text-emerald-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.paymentDropoutDomestic.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.paymentDropoutDomestic / (stats.paymentDropout || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Others Card */}
        {(() => {
          const isSelected = selectedStatuses.length === 1 && selectedStatuses[0] === 'Other Inactive';
          return (
            <div
              onClick={() => setSelectedStatuses(isSelected ? [] : ['Other Inactive'])}
              className={`cursor-pointer bg-white rounded-2xl p-3.5 border shadow-sm flex flex-col relative overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 ${isSelected ? 'border-slate-600 ring-2 ring-slate-600/10' : 'border-slate-100'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-slate-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                    <i className="fas fa-tags text-[10px]" />
                  </div>
                  <div className="text-[9.5px] font-black text-slate-400 uppercase tracking-wider">Others</div>
                </div>
                <div className="text-xl font-black text-slate-600">
                  {loading ? <StatSkeleton /> : stats.otherInactive.toLocaleString()}
                </div>
              </div>
              <div className="text-[7.5px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 leading-none">Other Inactive</div>

              {/* Progress split bar */}
              <div className="h-1 w-full bg-slate-100 rounded-full flex overflow-hidden mt-1 mb-0.5">
                <div
                  className="bg-indigo-600 h-full transition-all duration-500"
                  style={{ width: `${(stats.otherInactiveInternational / (stats.otherInactive || 1)) * 100}%` }}
                />
                <div
                  className="bg-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${(stats.otherInactiveDomestic / (stats.otherInactive || 1)) * 100}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-50">
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">International</div>
                  <div className="text-[13px] font-black text-indigo-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.otherInactiveInternational.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.otherInactiveInternational / (stats.otherInactive || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Domestic</div>
                  <div className="text-[13px] font-black text-emerald-600 leading-none">
                    {loading ? <SubStatSkeleton /> : (
                      <>
                        {stats.otherInactiveDomestic.toLocaleString()}
                        <span className="text-[9px] text-slate-600 font-bold ml-1">
                          ({((stats.otherInactiveDomestic / (stats.otherInactive || 1)) * 100).toFixed(1)}%)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Filter Engine */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 mb-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="relative group/search flex-1">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="Search by name, email, or program..."
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium text-slate-700 shadow-inner"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-50 rounded-2xl animate-pulse" />
            ))
          ) : (
            <>
              <FilterDropdown
                label="Academic Program"
                iconClass="fas fa-graduation-cap"
                placeholder="Select Programs"
                values={filterOptions.programs}
                selected={selectedPrograms}
                onToggle={(v) => toggleFilter(selectedPrograms, setSelectedPrograms, v)}
                isOpen={openDropdown === 'program'}
                setIsOpen={(open) => setOpenDropdown(open ? 'program' : null)}
              />
              <FilterDropdown
                label="Country of Residence"
                iconClass="fas fa-flag"
                placeholder="Select Countries"
                values={filterOptions.countries}
                selected={selectedCountries}
                onToggle={(v) => toggleFilter(selectedCountries, setSelectedCountries, v)}
                isOpen={openDropdown === 'country'}
                setIsOpen={(open) => setOpenDropdown(open ? 'country' : null)}
              />
              <FilterDropdown
                label="Launch Month"
                iconClass="fas fa-calendar-alt"
                placeholder="Select Months"
                values={filterOptions.launchMonths}
                selected={selectedLaunchMonths}
                onToggle={(v) => toggleFilter(selectedLaunchMonths, setSelectedLaunchMonths, v)}
                isOpen={openDropdown === 'launchMonth'}
                setIsOpen={(open) => setOpenDropdown(open ? 'launchMonth' : null)}
              />
              <FilterDropdown
                label="Learner Type"
                iconClass="fas fa-globe-americas"
                placeholder="Select Type"
                values={filterOptions.residencies}
                selected={selectedResidencies}
                onToggle={(v) => toggleFilter(selectedResidencies, setSelectedResidencies, v)}
                isOpen={openDropdown === 'residency'}
                setIsOpen={(open) => setOpenDropdown(open ? 'residency' : null)}
              />
              <FilterDropdown
                label="Learner Status"
                iconClass="fas fa-user-tag"
                placeholder="Select Status"
                values={filterOptions.statuses}
                selected={selectedStatuses}
                onToggle={(v) => toggleFilter(selectedStatuses, setSelectedStatuses, v)}
                isOpen={openDropdown === 'status'}
                setIsOpen={(open) => setOpenDropdown(open ? 'status' : null)}
              />
            </>
          )}
        </div>

        {/* Clear Filters */}
        <div className="mt-8 flex border-t border-slate-50 pt-6 items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2 items-center min-w-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Active Tuning:</span>
            {(selectedCountries.length > 0 || selectedStatuses.length > 0 || selectedPrograms.length > 0 || selectedResidencies.length > 0 || selectedLaunchMonths.length > 0 || search) ? (
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-wider animate-in fade-in zoom-in duration-300">
                {([search, ...selectedCountries, ...selectedStatuses, ...selectedPrograms, ...selectedResidencies, ...selectedLaunchMonths].filter(Boolean).length)} Parameters Active
              </span>
            ) : (
              <span className="text-[10px] italic text-slate-300 uppercase tracking-widest">No active filters applied</span>
            )}
          </div>

          {(selectedCountries.length > 0 || selectedStatuses.length > 0 || selectedPrograms.length > 0 || selectedResidencies.length > 0 || selectedLaunchMonths.length > 0 || search) && (
            <button
              onClick={() => {
                setSelectedCountries([]);
                setSelectedStatuses([]);
                setSelectedPrograms([]);
                setSelectedResidencies([]);
                setSelectedLaunchMonths([]);
                setSearch('');
              }}
              className="px-8 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2 whitespace-nowrap animate-in slide-in-from-right-4 duration-300"
            >
              <i className="fas fa-sync-alt" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Table Section */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-lg overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Learners:</span>
            <span className="px-3 py-1 bg-white border border-slate-100 rounded-lg text-[10px] font-black text-indigo-700 shadow-sm">
              {filteredRows.length.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-end">
            {!loading && filteredRows.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (selectedExportColumns.length === 0) {
                    setSelectedExportColumns([
                      'Email ID',
                      'First Name',
                      'Last Name',
                      'Cohort #',
                      'Launch Month',
                      'Status',
                      'Country Of Residence'
                    ]);
                  }
                  setShowExportModal(true);
                }}
                className="bg-white border border-slate-200 px-5 py-2 rounded-xl shadow-sm text-slate-600 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center gap-2 text-xs font-bold"
              >
                <i className="fas fa-file-export" />
                Export
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Learner Profile</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Academic Path</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Classification</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Launch Month</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => <TableRowSkeleton key={i} />)
              ) : paginatedRows.length > 0 ? (
                paginatedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-50 border border-blue-100 rounded-full flex items-center justify-center text-blue-700 font-black text-sm shadow-sm">
                          {row.name ? row.name.charAt(0) : '?'}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-semibold text-gray-800">{row.name || 'N/A'}</p>
                          <p className="text-xs text-slate-500 mb-0.5">{row.email}</p>
                          {row.userId && (
                            <p className="text-[10px] text-slate-400 font-medium font-mono leading-none">
                              ID: {row.userId}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <p className="text-sm font-medium text-gray-800 mb-0.5">{row.program}</p>
                      <div className="flex items-center justify-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider leading-none">{row.cohort}</span>
                        {row.term && (
                          <>
                            <span className="text-[10px] text-slate-300 select-none leading-none">•</span>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none">{row.term}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-sm ${row.learnerType === 'International'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                        <i className={`fas ${row.learnerType === 'International' ? 'fa-globe-americas' : 'fa-home'} mr-2`} />
                        {row.learnerType}
                      </span>
                      {(row.country || row.region) && (
                        <p className="text-[9.5px] text-slate-500 font-semibold mt-1 uppercase tracking-wider leading-none">
                          {[row.country, row.region].filter(Boolean).join(' • ')}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-block px-4 py-1.5 text-xs font-medium rounded-full border min-w-[120px] ${statusClass(row.status)}`}>
                        {row.status || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-medium text-gray-500">
                      {formatLaunchMonth(row.launchMonth)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center">
                      <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center text-slate-200 text-3xl mb-6 shadow-inner">
                        <i className="fas fa-fingerprint" />
                      </div>
                      <p className="text-slate-400 font-black text-xs uppercase tracking-[0.2em]">Zero Match Correlation</p>
                      <button onClick={() => {
                        setSelectedCountries([]);
                        setSelectedStatuses([]);
                        setSelectedPrograms([]);
                        setSelectedResidencies([]);
                        setSelectedLaunchMonths([]);
                        setSearch('');
                      }} className="mt-4 text-indigo-700 font-black text-[10px] uppercase tracking-widest hover:underline decoration-2 underline-offset-4">Reset Search Matrix</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Matrix */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Show</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-600">entries</span>
          </div>

          <div className="flex items-center space-x-2">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium text-gray-800">{filteredRows.length === 0 ? 0 : (safePage - 1) * perPage + 1}</span> to{' '}
              <span className="font-medium text-gray-800">{Math.min(safePage * perPage, filteredRows.length)}</span> of{' '}
              <span className="font-medium text-gray-800">{filteredRows.length}</span> learners
            </p>
          </div>

          <div className="flex space-x-2 items-center">
            <button
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <i className="fas fa-chevron-left" />
            </button>

            {paginationPages.map((p, idx) =>
              p === 'ellipsis' ? (
                <span key={`e-${idx}`} className="px-2 py-1 text-gray-500">...</span>
              ) : p === safePage ? (
                <button key={p} className="px-3 py-1 bg-indigo-600 text-white rounded-lg font-bold shadow-md shadow-indigo-100">{p}</button>
              ) : (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 transition-colors font-medium"
                >
                  {p}
                </button>
              ),
            )}

            <button
              className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <i className="fas fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>

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
                <span className="font-bold text-indigo-600 dark:text-indigo-400">{filteredRows.length}</span> learners will be exported with <span className="font-bold text-indigo-600 dark:text-indigo-400">{selectedExportColumns.length}</span> columns.
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
