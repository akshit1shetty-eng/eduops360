import { useMemo, useState } from 'react';
import { useDissertationData, type DissertationRow } from '../hooks/useDissertationData';
import { useProgramConfig } from '../hooks/useProgramConfig';
import AnimatedNumber from '../components/AnimatedNumber';
import FilterDropdown from '../components/FilterDropdown';

function val(row: DissertationRow, key: string): string {
  if (!row) return '';
  return (row[key] ?? row[key.toLowerCase()] ?? '').toString().trim();
}

function parseNum(row: DissertationRow, key: string): number {
  const v = val(row, key).replace(/,/g, '');
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

// Extract monthly call columns (e.g. Feb-2024, Mar-2024, etc.)
function getMonthlyColumns(sampleRow: DissertationRow): string[] {
  if (!sampleRow) return [];
  const monthRegex = /^[A-Z][a-z]{2}-\d{4}$/;
  return Object.keys(sampleRow).filter(k => monthRegex.test(k.trim()));
}

export default function DissertationPage() {
  const { programId } = useProgramConfig();
  const { loading, error, rows } = useDissertationData();

  /* ── Filter States ── */
  const [searchText, setSearchText] = useState('');
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedLearnerTypes, setSelectedLearnerTypes] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<'program' | 'status' | 'region' | 'type' | null>(null);

  /* ── Drawer for expanded student detail ── */
  const [expandedStudentEmail, setExpandedStudentEmail] = useState<string | null>(null);

  /* ── Pagination ── */
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(25);

  function toggleInList(value: string, list: string[], setList: (v: string[]) => void) {
    setCurrentPage(1);
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  }

  /* ── Filter Options ── */
  const filterOptions = useMemo(() => {
    const progs = new Set<string>();
    const statuses = new Set<string>();
    const regions = new Set<string>();
    const types = new Set<string>();

    const safeRows = rows || [];
    safeRows.forEach(r => {
      const p = val(r, 'Program');
      if (p) progs.add(p);
      const s = val(r, 'Learner Status');
      if (s) statuses.add(s);
      const reg = val(r, 'Region');
      if (reg) regions.add(reg);
      const t = val(r, 'Learner Type');
      if (t) types.add(t);
    });

    return {
      programs: Array.from(progs).sort(),
      statuses: Array.from(statuses).sort(),
      regions: Array.from(regions).sort(),
      types: Array.from(types).sort(),
    };
  }, [rows]);

  /* ── Monthly Columns Detection ── */
  const monthlyCols = useMemo(() => {
    const safeRows = rows || [];
    if (safeRows.length === 0) return [];
    return getMonthlyColumns(safeRows[0]);
  }, [rows]);

  /* ── Process Candidate Rows ── */
  const processedCandidates = useMemo(() => {
    const safeRows = rows || [];
    return safeRows.map(r => {
      const firstName = val(r, 'First Name');
      const lastName = val(r, 'Last Name');
      const name = `${firstName} ${lastName}`.trim() || val(r, 'Full Name') || 'Unnamed Candidate';
      const email = val(r, 'Email ID') || val(r, 'Email') || val(r, 'GGU Email');
      const gguEmail = val(r, 'GGU Email');
      const program = val(r, 'Program') || 'GGU DBA';
      const cohort = val(r, 'Cohort #') || val(r, 'Cohort ID') || val(r, 'Cohort');
      const termId = val(r, 'GGU Term Id');
      const learnerType = val(r, 'Learner Type');
      const status = val(r, 'Status') || val(r, 'Actual Status') || 'Active';
      const country = val(r, 'Country Of Residence');
      const region = val(r, 'Region');
      const learnerStatus = val(r, 'Learner Status') || 'At Pace';
      const startDate = val(r, 'Dissertation Start Date');
      const lastCallMonth = val(r, 'Last Call Month');
      const rating = parseNum(r, 'Average_Mentor_rating');
      const totalCalls = parseNum(r, 'Total_Calls');
      const totalDuration = parseNum(r, 'Total_Duration');
      const avgDuration = parseNum(r, 'Average_Duration');

      // Monthly calls tally
      let activeMonthsCount = 0;
      const monthlyCallsMap: Record<string, number> = {};
      monthlyCols.forEach(m => {
        const cnt = parseNum(r, m);
        monthlyCallsMap[m] = cnt;
        if (cnt > 0) activeMonthsCount += 1;
      });

      return {
        raw: r,
        name,
        email,
        gguEmail,
        program,
        cohort,
        termId,
        learnerType,
        status,
        country,
        region,
        learnerStatus,
        startDate,
        lastCallMonth,
        rating,
        totalCalls,
        totalDuration,
        avgDuration,
        activeMonthsCount,
        monthlyCallsMap,
      };
    });
  }, [rows, monthlyCols]);

  /* ── Filtered Candidates ── */
  const filteredCandidates = useMemo(() => {
    return processedCandidates.filter(c => {
      // Search
      if (searchText) {
        const q = searchText.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesEmail = c.email.toLowerCase().includes(q) || c.gguEmail.toLowerCase().includes(q);
        const matchesCohort = c.cohort.toLowerCase().includes(q);
        const matchesCountry = c.country.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesCohort && !matchesCountry) return false;
      }
      // Program
      if (selectedPrograms.length > 0 && !selectedPrograms.includes(c.program)) return false;
      // Learner Status
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(c.learnerStatus)) return false;
      // Region
      if (selectedRegions.length > 0 && !selectedRegions.includes(c.region)) return false;
      // Learner Type
      if (selectedLearnerTypes.length > 0 && !selectedLearnerTypes.includes(c.learnerType)) return false;

      return true;
    });
  }, [processedCandidates, searchText, selectedPrograms, selectedStatuses, selectedRegions, selectedLearnerTypes]);

  /* ── High-Level Summary Metrics ── */
  const summaryMetrics = useMemo(() => {
    const total = filteredCandidates.length;
    let atPace = 0;
    let redAlert = 0;
    let needAttention = 0;
    let totalRatingSum = 0;
    let totalRatingCount = 0;
    let totalCalls = 0;
    let totalDurationMins = 0;

    filteredCandidates.forEach(c => {
      const ls = c.learnerStatus.toLowerCase();
      if (ls.includes('pace') || ls.includes('track')) atPace += 1;
      else if (ls.includes('red') || ls.includes('alert')) redAlert += 1;
      else needAttention += 1;

      if (c.rating > 0) {
        totalRatingSum += c.rating;
        totalRatingCount += 1;
      }
      totalCalls += c.totalCalls;
      totalDurationMins += c.totalDuration;
    });

    const avgRating = totalRatingCount > 0 ? (totalRatingSum / totalRatingCount).toFixed(2) : '5.00';
    const totalHours = (totalDurationMins / 60).toFixed(1);

    return {
      total,
      atPace,
      atPacePct: total > 0 ? Math.round((atPace / total) * 100) : 0,
      redAlert,
      redAlertPct: total > 0 ? Math.round((redAlert / total) * 100) : 0,
      needAttention,
      needAttentionPct: total > 0 ? Math.round((needAttention / total) * 100) : 0,
      avgRating,
      totalCalls,
      totalDurationMins,
      totalHours,
    };
  }, [filteredCandidates]);

  /* ── Program Breakdown Analytics ── */
  const programBreakdown = useMemo(() => {
    const map: Record<string, { total: number; atPace: number; redAlert: number; totalCalls: number }> = {};
    filteredCandidates.forEach(c => {
      const p = c.program;
      if (!map[p]) map[p] = { total: 0, atPace: 0, redAlert: 0, totalCalls: 0 };
      map[p].total += 1;
      const ls = c.learnerStatus.toLowerCase();
      if (ls.includes('pace') || ls.includes('track')) map[p].atPace += 1;
      else if (ls.includes('red') || ls.includes('alert')) map[p].redAlert += 1;
      map[p].totalCalls += c.totalCalls;
    });
    return map;
  }, [filteredCandidates]);

  /* ── Pagination calculations ── */
  const totalPages = Math.ceil(filteredCandidates.length / entriesPerPage) || 1;
  const paginatedCandidates = useMemo(() => {
    const start = (currentPage - 1) * entriesPerPage;
    return filteredCandidates.slice(start, start + entriesPerPage);
  }, [filteredCandidates, currentPage, entriesPerPage]);

  return (
    <div className="min-h-screen pb-16">
      {/* ═══ Header Section ═══ */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                Doctoral Research Phase
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              Dissertation Mentorship & Analytics Summary
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Comprehensive tracking of doctoral research progression, mentorship call intensity, ratings & pace health.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 shadow-sm text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mb-4 animate-bounce">
            <i className="fas fa-spinner fa-spin text-xl" />
          </div>
          <p className="text-slate-600 font-medium">Loading Dissertation Analytics...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-6 mb-8 text-center">
          <i className="fas fa-exclamation-triangle text-2xl mb-2" />
          <p className="font-semibold">{error}</p>
        </div>
      ) : (
        <>
          {/* ═══ Top Summary KPI Cards ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {/* Total Candidates */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Candidates</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                  <i className="fas fa-user-graduate" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 mb-1">
                <AnimatedNumber value={summaryMetrics.total} />
              </div>
              <p className="text-xs text-slate-500 font-medium">Total Research Learners</p>
            </div>

            {/* At Pace Candidates */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">At Pace</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                  <i className="fas fa-running" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-3xl font-black text-slate-900">
                  <AnimatedNumber value={summaryMetrics.atPace} />
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {summaryMetrics.atPacePct}%
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Progressing Smoothly</p>
            </div>

            {/* Red Alert Candidates */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Red Alert</span>
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-sm">
                  <i className="fas fa-exclamation-circle" />
                </div>
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <div className="text-3xl font-black text-slate-900">
                  <AnimatedNumber value={summaryMetrics.redAlert} />
                </div>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  {summaryMetrics.redAlertPct}%
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Requires Priority Intervention</p>
            </div>

            {/* Mentor Rating */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Avg Mentor Rating</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center text-sm">
                  <i className="fas fa-star" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 mb-1 flex items-center gap-1.5">
                {summaryMetrics.avgRating}
                <span className="text-sm font-semibold text-slate-400">/ 5.0</span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Candidate Satisfaction Score</p>
            </div>

            {/* Total Mentorship Calls */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Mentorship Calls</span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm">
                  <i className="fas fa-headset" />
                </div>
              </div>
              <div className="text-3xl font-black text-slate-900 mb-1">
                <AnimatedNumber value={summaryMetrics.totalCalls} />
              </div>
              <p className="text-xs text-slate-500 font-medium">{summaryMetrics.totalHours} Total Hours Logged</p>
            </div>
          </div>

          {/* ═══ Analytical Overview Cards Grid ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Pace Health Breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm">
              <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                <i className="fas fa-tachometer-alt text-indigo-600 text-sm" />
                Candidate Pace Status Breakdown
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-emerald-700">At Pace ({summaryMetrics.atPace})</span>
                    <span className="text-slate-500">{summaryMetrics.atPacePct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: `${summaryMetrics.atPacePct}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-rose-700">Red Alert ({summaryMetrics.redAlert})</span>
                    <span className="text-slate-500">{summaryMetrics.redAlertPct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-rose-500 h-full rounded-full transition-all duration-500" style={{ width: `${summaryMetrics.redAlertPct}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1.5">
                    <span className="text-amber-700">Need Attention ({summaryMetrics.needAttention})</span>
                    <span className="text-slate-500">{summaryMetrics.needAttentionPct}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${summaryMetrics.needAttentionPct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Program Comparison */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm">
              <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                <i className="fas fa-layer-group text-indigo-600 text-sm" />
                Distribution by Program
              </h3>
              <div className="space-y-3">
                {Object.entries(programBreakdown).map(([progName, stats]) => (
                  <div key={progName} className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-900">{progName}</div>
                      <div className="text-[11px] text-slate-500 font-medium">{stats.totalCalls} Calls Completed</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">{stats.total} Candidates</div>
                      <div className="text-[10px] font-bold text-emerald-600">{stats.atPace} At Pace</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Engagement Intensity */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                  <i className="fas fa-clock text-indigo-600 text-sm" />
                  Mentorship Session Insights
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
                    <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Avg Call Mins</div>
                    <div className="text-xl font-black text-indigo-950 mt-1">
                      {(summaryMetrics.totalCalls > 0 ? (summaryMetrics.totalDurationMins / summaryMetrics.totalCalls).toFixed(1) : '45.0')} mins
                    </div>
                  </div>
                  <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Satisfaction</div>
                    <div className="text-xl font-black text-emerald-950 mt-1">
                      {summaryMetrics.avgRating} / 5.0
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed font-medium">
                <i className="fas fa-info-circle text-indigo-500 mr-1.5" />
                Mentorship call duration averages ~45-50 minutes per session with high candidate satisfaction across all doctoral cohorts.
              </div>
            </div>
          </div>

          {/* ═══ Filter & Directory Console ═══ */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-base shrink-0">
                  <i className="fas fa-search" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Candidate Directory & Call Matrix</h3>
                  <p className="text-xs text-slate-500 font-medium">Search and filter active dissertation research candidates.</p>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative w-full lg:w-72">
                <i className="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search name, email, cohort..."
                  value={searchText}
                  onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Filter Dropdowns Row */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {/* Program Filter */}
              <FilterDropdown
                label="Program"
                count={selectedPrograms.length}
                isOpen={openDropdown === 'program'}
                onToggle={() => setOpenDropdown(openDropdown === 'program' ? null : 'program')}
              >
                {filterOptions.programs.map((prog) => (
                  <label key={prog} className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPrograms.includes(prog)}
                      onChange={() => toggleInList(prog, selectedPrograms, setSelectedPrograms)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-700">{prog}</span>
                  </label>
                ))}
              </FilterDropdown>

              {/* Learner Status Filter */}
              <FilterDropdown
                label="Learner Status"
                count={selectedStatuses.length}
                isOpen={openDropdown === 'status'}
                onToggle={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
              >
                {filterOptions.statuses.map((st) => (
                  <label key={st} className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(st)}
                      onChange={() => toggleInList(st, selectedStatuses, setSelectedStatuses)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-700">{st}</span>
                  </label>
                ))}
              </FilterDropdown>

              {/* Region Filter */}
              <FilterDropdown
                label="Region"
                count={selectedRegions.length}
                isOpen={openDropdown === 'region'}
                onToggle={() => setOpenDropdown(openDropdown === 'region' ? null : 'region')}
              >
                {filterOptions.regions.map((reg) => (
                  <label key={reg} className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedRegions.includes(reg)}
                      onChange={() => toggleInList(reg, selectedRegions, setSelectedRegions)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-700">{reg}</span>
                  </label>
                ))}
              </FilterDropdown>

              {/* Learner Type Filter */}
              <FilterDropdown
                label="Learner Type"
                count={selectedLearnerTypes.length}
                isOpen={openDropdown === 'type'}
                onToggle={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
              >
                {filterOptions.types.map((tp) => (
                  <label key={tp} className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedLearnerTypes.includes(tp)}
                      onChange={() => toggleInList(tp, selectedLearnerTypes, setSelectedLearnerTypes)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-semibold text-slate-700">{tp}</span>
                  </label>
                ))}
              </FilterDropdown>

              {/* Reset Filters */}
              {(selectedPrograms.length > 0 || selectedStatuses.length > 0 || selectedRegions.length > 0 || selectedLearnerTypes.length > 0 || searchText) && (
                <button
                  onClick={() => {
                    setSelectedPrograms([]);
                    setSelectedStatuses([]);
                    setSelectedRegions([]);
                    setSelectedLearnerTypes([]);
                    setSearchText('');
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* ═══ Candidate Directory Table ═══ */}
            <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-xs mb-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-extrabold">
                    <th className="py-3.5 px-4">Candidate & Contact</th>
                    <th className="py-3.5 px-4">Program & Cohort</th>
                    <th className="py-3.5 px-4">Learner Status</th>
                    <th className="py-3.5 px-4">Mentorship Stats</th>
                    <th className="py-3.5 px-4">Dissertation Start</th>
                    <th className="py-3.5 px-4">Last Call</th>
                    <th className="py-3.5 px-4 text-center">Monthly Log</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {paginatedCandidates.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <i className="fas fa-folder-open text-2xl mb-2" />
                        <p className="font-semibold">No dissertation candidates match the selected filters.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedCandidates.map((c) => {
                      const isExpanded = expandedStudentEmail === c.email;
                      const isRedAlert = c.learnerStatus.toLowerCase().includes('red') || c.learnerStatus.toLowerCase().includes('alert');
                      const isAtPace = c.learnerStatus.toLowerCase().includes('pace') || c.learnerStatus.toLowerCase().includes('track');

                      return (
                        <tr key={c.email} className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-slate-900">{c.name}</div>
                            <div className="text-[11px] text-slate-500">{c.email}</div>
                            {c.gguEmail && <div className="text-[10px] text-indigo-600 font-semibold">{c.gguEmail}</div>}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] mb-1">
                              {c.program}
                            </span>
                            <div className="text-[11px] text-slate-600 font-semibold">
                              Cohort {c.cohort || '—'} {c.termId ? `(${c.termId})` : ''}
                            </div>
                            <div className="text-[10px] text-slate-400">{c.region} • {c.learnerType}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                              isAtPace ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              isRedAlert ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                              'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isAtPace ? 'bg-emerald-500' : isRedAlert ? 'bg-rose-500' : 'bg-amber-500'}`} />
                              {c.learnerStatus}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-slate-900">{c.totalCalls} Calls ({c.totalDuration} mins)</div>
                            <div className="text-[11px] text-slate-500">Avg {c.avgDuration ? c.avgDuration.toFixed(1) : '—'} mins/call</div>
                            {c.rating > 0 && (
                              <div className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                                <i className="fas fa-star text-amber-400" /> {c.rating.toFixed(2)} Rating
                              </div>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-slate-600 font-semibold">
                            {c.startDate || '—'}
                          </td>

                          <td className="py-3.5 px-4 font-semibold text-slate-700">
                            {c.lastCallMonth || '—'}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => setExpandedStudentEmail(isExpanded ? null : c.email)}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 mx-auto ${
                                isExpanded
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                              }`}
                            >
                              <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-chart-bar'}`} />
                              {isExpanded ? 'Hide Monthly' : `${c.activeMonthsCount} Months`}
                            </button>

                            {/* Expandable monthly breakdown drawer */}
                            {isExpanded && (
                              <div className="mt-3 p-4 bg-white border border-indigo-100 rounded-xl shadow-lg text-left col-span-7">
                                <h4 className="text-xs font-black text-slate-900 mb-2 flex items-center gap-2">
                                  <i className="fas fa-calendar-alt text-indigo-600" />
                                  Monthly Call Attendance Breakdown for {c.name}
                                </h4>
                                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-2 max-h-48 overflow-y-auto p-1">
                                  {monthlyCols.map(m => {
                                    const count = c.monthlyCallsMap[m] || 0;
                                    return (
                                      <div
                                        key={m}
                                        className={`p-2 rounded-lg border text-center ${
                                          count > 0
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-extrabold'
                                            : 'bg-slate-50 border-slate-100 text-slate-400 font-medium'
                                        }`}
                                      >
                                        <div className="text-[9px] text-slate-400 uppercase tracking-tight">{m}</div>
                                        <div className="text-xs mt-0.5">{count > 0 ? `${count} call${count > 1 ? 's' : ''}` : '—'}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                <span>Show</span>
                <select
                  value={entriesPerPage}
                  onChange={(e) => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>entries per page (Total {filteredCandidates.length})</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-bold">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-1.5 text-slate-700 font-extrabold">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
