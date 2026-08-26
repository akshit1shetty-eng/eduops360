import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLearnerData } from '../hooks/useLearnerData';
import { useProgramConfig } from '../hooks/useProgramConfig';
import AnimatedNumber from '../components/AnimatedNumber';
import { isLearnerActive, normalizeSecondaryStatus } from '../lib/logic';

const EXCLUDED_SECONDARY_STATUSES = new Set<string>([
  normalizeSecondaryStatus('deferred out'),
  normalizeSecondaryStatus('withdrawn'),
]);

function parseNumberLoose(value: string | undefined): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeKey(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCombinedSlot(value: string): boolean {
  return normalizeKey(value) === 'slot 1 slot 2';
}


import { useLiveSessionsData } from '../hooks/useLiveSessionsData';
import { useDissertationData } from '../hooks/useDissertationData';
import { useAcademicReviewData } from '../hooks/useAcademicReviewData';
import { useProgramStats } from '../hooks/useProgramStats';

function v(row: any, ...possibleKeys: string[]): string {
  if (!row) return '';
  const rowKeys = Object.keys(row);
  for (const search of possibleKeys) {
    const normalizedSearch = search.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k of rowKeys) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSearch) {
        return (row[k] ?? '').toString().trim();
      }
    }
  }
  return '';
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { programId, config } = useProgramConfig();
  const { needsAttention, merged } = useLearnerData();
  const { rows: liveSessionsRows } = useLiveSessionsData();
  const { rows: dissertationRows } = useDissertationData();
  const { rows: academicReviewRows } = useAcademicReviewData();
  const { learnerCount: pTotal, activeCount: pActive, graduatedCount: pGraduated } = useProgramStats(config.sheetId, programId);

  const goToLearners = () => navigate(`/${programId}/learners`);
  const onCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToLearners();
    }
  };

  const attention = useMemo(() => needsAttention, [needsAttention]);

  const { totalLearners, activeLearnersCount, graduatedLearnersCount } = useMemo(() => {
    const seen = new Set<string>();
    let total = 0;
    let activeCount = 0;
    let graduatedCount = 0;

    for (const l of merged ?? []) {
      const email = (l.email ?? '').trim().toLowerCase();
      if (!email) continue;

      const secondaryStatus = normalizeSecondaryStatus(l.secondaryStatus ?? '');
      if (EXCLUDED_SECONDARY_STATUSES.has(secondaryStatus)) continue;

      if (seen.has(email)) continue;
      seen.add(email);

      total += 1;

      if (isLearnerActive(l.secondaryStatus)) {
        activeCount += 1;
      }

      if (secondaryStatus === 'graduated' || secondaryStatus === 'completed' || secondaryStatus === 'alumni') {
        graduatedCount += 1;
      }
    }

    return {
      totalLearners: total,
      activeLearnersCount: activeCount,
      graduatedLearnersCount: graduatedCount,
    };
  }, [merged]);


  const dissertationSummary = useMemo(() => {
    const seen = new Set<string>();
    const graduatedKeys = new Set<string>();
    let researchDefenseCompleted = 0;
    let readyForResearchDefense = 0;
    let graduated = 0;
    let topicProposalApproved = 0;
    let researchProposalApproved = 0;

    for (const row of dissertationRows) {
      // The dissertation sheet has no learner Email column.
      // Use Full name + Phone Number as a composite unique key for deduplication.
      const fullName = v(row, 'Full name', 'Full Name', 'Name').toLowerCase().trim();
      const phone = v(row, 'Phone Number', 'Phone').toLowerCase().trim();
      const uniqueKey = fullName || phone;
      // Skip completely empty rows
      if (!uniqueKey) continue;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);

      const topicStatus = v(row, 'Topic Proposal Submission Status', 'Topic Proposal Status').toLowerCase();
      const researchProposalSub = v(row, 'Research Proposal Submission').toLowerCase();
      const defenseStatus = v(row, 'Research Proposal Defense Status 1');
      const finalVal = (
        v(row, 'Final Proposal Submission') ||
        v(row, 'Final Defense Presentation 1')
      ).toLowerCase();
      const uniSignOff = v(
        row,
        'University sign off',
        'University Sign off',
        'University Sign-Off',
        'University Signoff',
        'University Sign Off'
      ).toLowerCase();

      // Topic Proposal Approved
      if (topicStatus.includes('approved')) topicProposalApproved += 1;

      // Research Proposal Approved
      if (researchProposalSub.includes('approved')) researchProposalApproved += 1;

      // Research Defense completed
      if (defenseStatus.toLowerCase().includes('approved')) {
        researchDefenseCompleted += 1;
      }

      // Ready for Research Defense: proposal approved but defense not yet done
      if (researchProposalSub.includes('approved') && !defenseStatus) {
        readyForResearchDefense += 1;
      }

      // Graduation logic
      const isGraduated = programId === 'dba-et'
        ? uniSignOff.includes('graduated')
        : (finalVal.includes('approved') || finalVal.includes('done') || finalVal.includes('cleared'));

      if (isGraduated) {
        graduated += 1;
        graduatedKeys.add(uniqueKey);
      }
    }

    return {
      total: programId === 'dba-et' ? seen.size - graduatedKeys.size : seen.size,
      researchDefenseCompleted,
      readyForResearchDefense,
      graduated,
      topicProposalApproved,
      researchProposalApproved,
    };
  }, [dissertationRows, programId]);

  const dbaEtCourseworkLearners = useMemo(() => {
    if (programId !== 'dba-et') return null;

    // Coursework learners = total active learners - learners in dissertation phase
    return Math.max(0, activeLearnersCount - dissertationSummary.total);
  }, [programId, activeLearnersCount, dissertationSummary.total]);

  const learnersInCoursework = useMemo(() => {
    let count = 0;
    for (const l of merged ?? []) {
      if (!isLearnerActive(l.secondaryStatus)) continue;
      const completed = parseNumberLoose(l.coursesCompleted) ?? 0;
      if (completed < (config.totalCourses || 7)) {
        count += 1;
      }
    }
    return count;
  }, [merged, config.totalCourses]);

  const liveSessionsSummary = useMemo(() => {
    let totalSessions = 0;
    let totalInvites = 0;
    let totalPeak = 0;
    let totalRated = 0;
    let ratingSum = 0;
    let ratingCount = 0;

    for (const row of liveSessionsRows) {
      const slot = String(row['Slot'] ?? row['SLot'] ?? '').trim();
      if (!slot) continue;
      if (isCombinedSlot(slot)) continue;

      totalSessions += 1;
      const invites = parseNumberLoose(String(row['Invite Sent #'] ?? ''));
      const peak = parseNumberLoose(String(row['Peak Attendance #'] ?? ''));
      const rated = parseNumberLoose(String(row['Students Who Rated #'] ?? ''));
      const avgRating = parseNumberLoose(String(row['Avg. Rating #'] ?? row['Avg. Rating'] ?? ''));
      if (invites !== null) totalInvites += invites;
      if (peak !== null) totalPeak += peak;
      if (rated !== null) totalRated += rated;
      if (avgRating !== null) {
        ratingSum += avgRating;
        ratingCount += 1;
      }
    }

    const attendanceRate = totalInvites > 0 ? totalPeak / totalInvites : null;
    const ratingParticipation = totalInvites > 0 ? totalRated / totalInvites : null;
    const avgRating = ratingCount > 0 ? ratingSum / ratingCount : null;

    return {
      totalSessions,
      attendanceRate,
      ratingParticipation,
      avgRating,
    };
  }, [liveSessionsRows]);

  const academicStanding = useMemo(() => {
    if (!academicReviewRows || academicReviewRows.length === 0) {
      return { goodStanding: 0, disqualified: 0, goodStandingPct: 0, disqualifiedPct: 0, totalCount: 0 };
    }

    let goodStanding = 0;
    let disqualified = 0;

    for (const row of academicReviewRows) {
      // Wide status check - look at multiple possible columns for secondary status
      const status = (v(row, 'Secondary Status', 'upGrad Learner Status', 'GGU Learner Status', 'Actual Status', 'Status') || '').toLowerCase().trim();

      // Wide final status check
      const finalStatus = (v(row, 'Final Academic Review Status', 'Final Academic Review', 'Academic Review Status', 'Final Status', 'Standing', 'Outcome') || '').toLowerCase().trim();

      if (programId === 'dba-et' || programId === 'dba') {
        // Strict: only count rows where secondary status is Active, Active / Deferred In, or Disqualified
        const isTracked = status === 'active' ||
          status === 'active / deferred in' ||
          status === 'disqualified';
        if (!isTracked) continue;
        if (!finalStatus) continue;
        if (finalStatus.includes('good standing')) {
          goodStanding += 1;
        } else if (finalStatus.includes('dismiss') || finalStatus.includes('disqualified')) {
          disqualified += 1;
        }
      } else {
        // DBA DL: Disqualified = upGrad Learner Status is 'Failed'
        //         Good Standing = Final Academic Review is 'Good Standing' (on Active rows)
        if (status === 'failed') {
          disqualified += 1;
        } else if (status === 'active' && finalStatus.includes('good standing')) {
          goodStanding += 1;
        }
      }
    }

    const totalOutcomes = goodStanding + disqualified;

    return {
      goodStanding,
      disqualified,
      goodStandingPct: totalOutcomes > 0 ? (goodStanding / totalOutcomes) * 100 : 0,
      disqualifiedPct: totalOutcomes > 0 ? (disqualified / totalOutcomes) * 100 : 0,
      totalCount: totalOutcomes
    };
  }, [academicReviewRows]);




  return (
    <div className="min-h-screen">
      {/* Dashboard Header - Ver16 Style */}
      <div className="mb-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
              Welcome to Your Dashboard,
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent ml-2">
                {programId.startsWith('dba') ? 'GGU DBA & DBA ET' : `GGU ${config.name}`}
              </span>
            </h1>
            <p className="text-gray-600">Piloting learners to their destination.</p>
          </div>
        </div>
      </div>

      {/* Top Learner Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div role="button" tabIndex={0} onClick={goToLearners} onKeyDown={onCardKeyDown} className="group cursor-pointer relative bg-white bg-opacity-80 backdrop-blur-lg rounded-xl shadow-xl p-4 border border-white border-opacity-20 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full opacity-10 -mr-10 -mt-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-blue-100 shadow-lg group-hover:scale-110 transition-transform">
                <i className="fas fa-users text-blue-600 text-xl" />
              </div>
              <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                <i className="fas fa-arrow-up text-xs mr-1" />Total
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-1">
              <AnimatedNumber value={pTotal ?? totalLearners} />
            </h3>
            <p className="text-sm text-gray-600">Total Learners</p>
            <div className="mt-4 h-1 bg-gradient-to-r from-blue-200 to-blue-400 rounded-full"></div>
          </div>
        </div>

        <div role="button" tabIndex={0} onClick={goToLearners} onKeyDown={onCardKeyDown} className="group cursor-pointer relative bg-white bg-opacity-80 backdrop-blur-lg rounded-xl shadow-xl p-4 border border-white border-opacity-20 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full opacity-10 -mr-10 -mt-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-emerald-100 shadow-lg group-hover:scale-110 transition-transform">
                <i className="fas fa-user-check text-emerald-600 text-xl" />
              </div>
              <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                <i className="fas fa-check text-xs mr-1" />Active
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-1">
              <AnimatedNumber value={pActive ?? activeLearnersCount} />
            </h3>
            <p className="text-sm text-gray-600">Active Learners</p>
            <div className="mt-4 h-1 bg-gradient-to-r from-emerald-200 to-emerald-400 rounded-full"></div>
          </div>
        </div>

        <div role="button" tabIndex={0} onClick={goToLearners} onKeyDown={onCardKeyDown} className="group cursor-pointer relative bg-white bg-opacity-80 backdrop-blur-lg rounded-xl shadow-xl p-4 border border-white border-opacity-20 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full opacity-10 -mr-10 -mt-10 group-hover:opacity-20 transition-opacity"></div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-indigo-100 shadow-lg group-hover:scale-110 transition-transform">
                <i className="fas fa-trophy text-indigo-600 text-xl" />
              </div>
              <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                <i className="fas fa-graduation-cap text-xs mr-1" />Alumni
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-1">
              <AnimatedNumber value={pGraduated ?? (programId === 'mba' ? graduatedLearnersCount : dissertationSummary.graduated)} />
            </h3>
            <p className="text-sm text-gray-600">Graduated Learners</p>
            <div className="mt-4 h-1 bg-gradient-to-r from-indigo-200 to-indigo-400 rounded-full"></div>
          </div>
        </div>
      </div>



      {/* Academic Standing Monitor Section - Featured Banner Style */}
      {(programId === 'dba' || programId === 'dba-et' || programId === 'dba-dl') && (
        <div className="mb-8 relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative bg-white/70 dark:bg-slate-900/80 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
            <div className="flex flex-col lg:flex-row items-stretch">
              {/* Info Side */}
              <div className="p-6 lg:w-1/3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-r border-emerald-100/50 dark:border-emerald-900/30 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl shadow-md flex items-center justify-center text-emerald-600 dark:text-emerald-400 ring-4 ring-emerald-500/10 dark:ring-emerald-500/20">
                      <i className="fas fa-award text-xl" />
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-gray-800 dark:text-white tracking-tight">Academic Standing</h3>
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Final Status Monitor</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed max-w-xs mb-6">
                    Program-wide standings of learners based on the final academic reviews.
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/${programId}/academic-performance`)}
                  className="flex items-center justify-center gap-2 w-full bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-widest py-3 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  View Performance Engine <i className="fas fa-arrow-right text-[10px]" />
                </button>
              </div>

              {/* Stats Side */}
              <div className="p-6 lg:flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="relative group/stat">
                  <div className="absolute -inset-4 bg-emerald-500/5 rounded-2xl opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
                  <div className="relative">
                    <div className="flex justify-between items-end mb-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[0.2em] mb-1 text-shadow-glow">Good Standing</span>
                        <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
                          <AnimatedNumber value={academicStanding.goodStanding} />
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-2xl font-black text-emerald-500 dark:text-emerald-400">
                          <AnimatedNumber value={academicStanding.goodStandingPct} formatter={(v) => `${v.toFixed(2)}%`} />
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">of reviews</span>
                      </div>
                    </div>
                    <div className="h-4 w-full bg-emerald-100 dark:bg-emerald-900/40 rounded-full overflow-hidden p-[3px] shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                        style={{ width: `${academicStanding.goodStandingPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="relative group/stat">
                  <div className="absolute -inset-4 bg-rose-500/5 rounded-2xl opacity-0 group-hover/stat:opacity-100 transition-opacity"></div>
                  <div className="relative">
                    <div className="flex justify-between items-end mb-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-[0.2em] mb-1">Disqualified</span>
                        <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
                          <AnimatedNumber value={academicStanding.disqualified} />
                        </span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-2xl font-black text-rose-500 dark:text-rose-400">
                          <AnimatedNumber value={academicStanding.disqualifiedPct} formatter={(v) => `${v.toFixed(2)}%`} />
                        </span>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">of reviews</span>
                      </div>
                    </div>
                    <div className="h-4 w-full bg-rose-100 dark:bg-rose-900/40 rounded-full overflow-hidden p-[3px] shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-rose-400 to-pink-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                        style={{ width: `${academicStanding.disqualifiedPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}




    </div>
  );
}
