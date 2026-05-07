import { useMemo, useState } from 'react';
import { useDissertationData, type DissertationRow } from '../hooks/useDissertationData';
import { useProgramConfig } from '../hooks/useProgramConfig';
import AnimatedNumber from '../components/AnimatedNumber';
import FilterDropdown from '../components/FilterDropdown';

/* ── helpers ── */
function v(row: DissertationRow, key: string): string {
    return (row[key] ?? '').trim();
}

/** Topic Proposal: reads 'Topic Proposal Submission Status' for dba-et or 'Topic Proposal Status' for dba */
function topicProposalStatus(row: DissertationRow, programId: string): StatusLabel {
    const val = (programId === 'dba' ? (row['Topic Proposal Status'] || '') : (row['Topic Proposal Submission Status'] || '')).toString().toLowerCase();
    if (val.includes('approved')) return 'Approved';
    if (val.includes('not approved') || val.includes('disapproved')) return 'Not Approved';
    if (val.includes('not submitted')) return 'Not Submitted';
    if (val.includes('submitted')) return 'Submitted';
    if (val.includes('wip')) return 'Not Submitted'; // For DBA
    return 'Pending';
}

/** IRB: Only for dba-et */
function irbStatus(row: DissertationRow, programId: string): StatusLabel {
    if (programId === 'dba') return 'Pending'; // Will be hidden in UI
    const status = (row['IRB Status'] || '').toString().toLowerCase();
    if (status === 'approved') return 'Approved';
    if (status === 'not approved' || status.includes('disapproved')) return 'Not Approved';
    if (status === 'not submitted') return 'Not Submitted';
    if (status.startsWith('submitted')) return 'Submitted';
    return 'Pending';
}

/** Research Proposal: Support Attempt 1 and 2 for DBA */
function researchProposalStatus(row: DissertationRow, programId: string): StatusLabel {
    if (programId === 'dba') {
        const attempt1 = (row['Research Proposal Defence (Attempt 1)'] || '').toString().toLowerCase();
        const attempt2 = (row['Research Proposal Defence \n(Attempt 2)'] || '').toString().toLowerCase();
        if (attempt1.includes('approved') || attempt2.includes('approved')) return 'Approved';
        if (attempt1.includes('disapproved')) return 'Not Approved';
        if (attempt1.includes('conducted')) return 'Submitted';
        if (attempt1.includes('submitted')) return 'Submitted';
        return 'Pending';
    }
    const val = (row['Research Proposal Submission'] || '').toString().toLowerCase();
    if (val === 'approved') return 'Approved';
    if (val === 'not approved') return 'Not Approved';
    if (val === 'not submitted') return 'Not Submitted';
    if (val.includes('disapproved')) return 'Not Approved';
    if (val.startsWith('submitted')) return 'Submitted';
    return 'Pending';
}

/** Final Defense: reads 'Dissertation Sign-off Final Status' for DBA */
function finalDefenseStatus(row: DissertationRow, programId: string): StatusLabel {
    if (programId === 'dba') {
        const val = (row['Dissertation Sign-off Final Status'] || '').toString().toLowerCase();
        if (val.includes('done') || val.includes('approved')) return 'Approved';
        if (val.includes('disapproved')) return 'Not Approved';
        if (val.includes('submitted')) return 'Submitted';
        return 'Pending';
    }
    const val = (row['Final Proposal Submission'] || row['Final Defense Presentation 1'] || '').toString().toLowerCase();
    if (val.includes('approved') || val.includes('done') || val.includes('cleared')) return 'Approved';
    if (val === 'not approved' || val.includes('disapproved')) return 'Not Approved';
    if (val.includes('submitted')) return 'Submitted';
    return 'Pending';
}

type StatusLabel = 'Approved' | 'Not Approved' | 'Submitted' | 'Not Submitted' | 'Pending';

interface MilestoneBreakdown {
    approved: { count: number; percent: number };
    not_approved: { count: number; percent: number };
    submitted: { count: number; percent: number };
    not_submitted: { count: number; percent: number };
}

function calcBreakdown(statuses: StatusLabel[], total: number): MilestoneBreakdown {
    const approved = statuses.filter(s => s === 'Approved').length;
    const not_approved = statuses.filter(s => s === 'Not Approved').length;
    const submittedOnly = statuses.filter(s => s === 'Submitted').length;
    const submitted = submittedOnly + approved + not_approved;
    const not_submitted = statuses.filter(s => s === 'Not Submitted').length;
    return {
        approved: { count: approved, percent: total > 0 ? Math.round((approved / total) * 1000) / 10 : 0 },
        not_approved: { count: not_approved, percent: total > 0 ? Math.round((not_approved / total) * 1000) / 10 : 0 },
        submitted: { count: submitted, percent: total > 0 ? Math.round((submitted / total) * 1000) / 10 : 0 },
        not_submitted: { count: not_submitted, percent: total > 0 ? Math.round((not_submitted / total) * 1000) / 10 : 0 },
    };
}

/* ── Status badge for table cells ── */
function StatusPill({ status }: { status: StatusLabel }) {
    const config = {
        'Approved': { bg: '#dcfce7', color: '#166534', icon: 'fa-check' },
        'Not Approved': { bg: '#fee2e2', color: '#991b1b', icon: 'fa-times' },
        'Submitted': { bg: '#dbeafe', color: '#1e40af', icon: 'fa-clock' },
        'Not Submitted': { bg: '#fef9c3', color: '#854d0e', icon: 'fa-exclamation' },
        'Pending': { bg: '#f3f4f6', color: '#374151', icon: 'fa-minus' },
    };
    const c = config[status] ?? config['Pending'];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 10px', borderRadius: 100,
            fontSize: 11, fontWeight: 600,
            background: c.bg, color: c.color,
        }}>
            <i className={`fas ${c.icon}`} style={{ fontSize: 9 }} />
            {status}
        </span>
    );
}

export default function DissertationPage() {
    const { programId, config } = useProgramConfig();
    const { loading, error, rows } = useDissertationData();

    /* ── Filters ── */
    const [searchText, setSearchText] = useState('');
    const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
    const [selectedMilestones, setSelectedMilestones] = useState<string[]>([]);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
    const [openDropdown, setOpenDropdown] = useState<'cohort' | 'milestone' | 'status' | null>(null);

    function toggleInList(value: string, list: string[], setList: (v: string[]) => void) {
        setCurrentPage(1);
        setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
    }


    /* ── Analytics cohort filter (separate from table filter) ── */
    const [analyticsCohort, setAnalyticsCohort] = useState('');

    /* ── Pagination ── */
    const [currentPage, setCurrentPage] = useState(1);
    const [entriesPerPage, setEntriesPerPage] = useState(25);

    /* ── Derived data ── */
    const cohorts = useMemo(() => {
        const cohortKey = programId === 'dba' ? 'Cohort ID' : 'Cohort #';
        const set = new Set<string>();
        rows.forEach(r => { const c = v(r, cohortKey); if (c) set.add(c); });
        return Array.from(set).sort((a, b) => {
            const na = parseInt(a), nb = parseInt(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
        });
    }, [rows, programId]);

    /* ── Compute milestones per student ── */
    const studentsData = useMemo(() => {
        const cohortKey = programId === 'dba' ? 'Cohort ID' : 'Cohort #';
        return rows.map(row => {
            const topic = topicProposalStatus(row, programId) as StatusLabel;
            const irb = irbStatus(row, programId) as StatusLabel;
            const research = researchProposalStatus(row, programId) as StatusLabel;
            const finalDef = finalDefenseStatus(row, programId) as StatusLabel;

            const relevantMilestones = programId === 'dba' ? [topic, research, finalDef] : [topic, irb, research, finalDef];
            const completed = relevantMilestones.filter(s => s === 'Approved').length;
            const progressPercent = (completed / relevantMilestones.length) * 100;

            const researchPropDef1 = v(row, 'Research Proposal Defense Status 1').trim();
            const finalDefPres1 = v(row, 'Final Proposal Submission').trim();

            return {
                row,
                fullName: v(row, 'Full name'),
                email: v(row, 'Email'),
                cohort: v(row, cohortKey),
                topic, irb, research, finalDef,
                researchProposalSubmission: (programId === 'dba' ? (row['Topic Proposal Status'] || '') : (row['Research Proposal Submission'] || '')).toString().toLowerCase(),
                researchProposalDefenseStatus1: programId === 'dba' ? (row['Research Proposal Defence (Attempt 1)'] || '').toString() : researchPropDef1,
                finalDefensePresentation1: programId === 'dba' ? (row['Dissertation Sign-off Final Status'] || '').toString() : finalDefPres1,
                completed, progressPercent,
                milestoneStatuses: {
                    'Topic Proposal': topic,
                    'IRB': irb,
                    'Research Proposal': research,
                    'Final Defense': finalDef,
                } as Record<string, StatusLabel>,
            };
        });
    }, [rows, programId]);

    /* ── Analytics (filtered by analytics cohort) ── */
    const analytics = useMemo(() => {
        const filtered = analyticsCohort
            ? studentsData.filter(s => s.cohort === analyticsCohort)
            : studentsData;

        const isGraduatedDbaEt = (row: DissertationRow) => {
            const raw = String(
                row['University sign off'] ??
                row['University Sign off'] ??
                row['University Sign-Off'] ??
                row['University Signoff'] ??
                row['University Sign Off'] ??
                ''
            );
            return raw.trim().toLowerCase().includes('graduated');
        };

        // For DBA-ET, "In Dissertation Phase" should exclude graduated learners
        const inPhase = programId === 'dba-et'
            ? filtered.filter(s => !isGraduatedDbaEt(s.row))
            : filtered;

        const total = inPhase.length;
        const topicStatuses = inPhase.map(s => s.topic);
        const irbStatuses = inPhase.map(s => s.irb);
        const researchStatuses = inPhase.map(s => s.research);
        const finalStatuses = inPhase.map(s => s.finalDef);

        const topicBreakdown = calcBreakdown(topicStatuses, total);
        const irbBreakdown = calcBreakdown(irbStatuses, total);
        const researchBreakdown = calcBreakdown(researchStatuses, total);
        const finalBreakdown: MilestoneBreakdown = programId === 'dba-et'
            ? (() => {
                // Helper: find column value by exact name match (case-insensitive, punctuation-tolerant)
                const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
                const getCol = (row: DissertationRow, exactColName: string): string => {
                    const want = normalize(exactColName);
                    for (const k of Object.keys(row ?? {})) {
                        if (normalize(k) === want) {
                            return String((row as any)[k] ?? '').trim();
                        }
                    }
                    return '';
                };

                // DBA-ET Final Defense analytics:
                // - Submitted    → count from "Final Proposal Submission"  (any non-empty value)
                // - Approved     → count from "Final Proposal Approval"    (value = approved / yes)
                // - Not Approved → count from "Final Proposal Approval"    (value = not approved / rejected)
                // NOTE: iterate over ALL filtered rows (including graduated) because approved
                // learners are typically those who have already graduated.
                const finalTotal = filtered.length;
                let approved = 0;
                let notApproved = 0;
                let submitted = 0;
                let notSubmitted = 0;

                for (const s of filtered) {
                    // --- Submitted: from "Final Proposal Submission" ---
                    const submissionRaw = getCol(s.row, 'Final Proposal Submission').toLowerCase();
                    if (submissionRaw && !submissionRaw.includes('not submitted') && submissionRaw !== 'no') {
                        submitted += 1;
                    } else {
                        notSubmitted += 1;
                    }

                    // --- Approved / Not Approved: from "Final Proposal Approval" ---
                    const approvalRaw = getCol(s.row, 'Final Proposal Approval').toLowerCase();
                    if (
                        approvalRaw.includes('not approved') ||
                        approvalRaw.includes('disapproved') ||
                        approvalRaw.includes('rejected') ||
                        approvalRaw === 'no'
                    ) {
                        notApproved += 1;
                    } else if (
                        approvalRaw.includes('approved') ||
                        approvalRaw === 'yes' ||
                        approvalRaw === 'y'
                    ) {
                        approved += 1;
                    }
                }

                return {
                    approved:     { count: approved,     percent: finalTotal > 0 ? Math.round((approved     / finalTotal) * 1000) / 10 : 0 },
                    not_approved: { count: notApproved,  percent: finalTotal > 0 ? Math.round((notApproved  / finalTotal) * 1000) / 10 : 0 },
                    submitted:    { count: submitted,    percent: finalTotal > 0 ? Math.round((submitted    / finalTotal) * 1000) / 10 : 0 },
                    not_submitted:{ count: notSubmitted, percent: finalTotal > 0 ? Math.round((notSubmitted / finalTotal) * 1000) / 10 : 0 },
                };
            })()
            : calcBreakdown(finalStatuses, total);

        const totalApprovals = topicBreakdown.approved.count +
            (programId === 'dba' ? 0 : irbBreakdown.approved.count) +
            researchBreakdown.approved.count + finalBreakdown.approved.count;
        const totalNotApproved = topicBreakdown.not_approved.count +
            (programId === 'dba' ? 0 : irbBreakdown.not_approved.count) +
            researchBreakdown.not_approved.count + finalBreakdown.not_approved.count;
        const totalSubmitted = topicBreakdown.submitted.count +
            (programId === 'dba' ? 0 : irbBreakdown.submitted.count) +
            researchBreakdown.submitted.count + finalBreakdown.submitted.count;
        const pendingReview = Math.max(0, totalSubmitted - totalApprovals - totalNotApproved);

        const finalDefenseCleared = finalBreakdown.approved.count;

        const graduated =
            programId === 'dba-et'
                ? filtered.filter(s => {
                    const raw = String(
                        s.row['University sign off'] ??
                        s.row['University Sign off'] ??
                        s.row['University Sign-Off'] ??
                        s.row['University Signoff'] ??
                        s.row['University Sign Off'] ??
                        ''
                    );
                    return raw.trim().toLowerCase().includes('graduated');
                }).length
                : finalDefenseCleared;

        const researchDefenseCompleted = programId === 'dba' 
            ? researchBreakdown.approved.count 
            : filtered.filter(s => (s.row['Research Proposal Defense Status 1'] || '').toString().toLowerCase().includes('approved')).length;

        const readyForResearchDefense = programId === 'dba'
            ? filtered.filter(s => s.topic === 'Approved' && !s.researchProposalDefenseStatus1).length
            : filtered.filter(s => s.researchProposalSubmission === 'approved' && !s.researchProposalDefenseStatus1).length;

        const readyForFinalDefense = filtered.filter(s => s.research === 'Approved' && !s.finalDefensePresentation1).length;

        return {
            total, totalApprovals, totalNotApproved, pendingReview,
            finalDefenseCleared, graduated, researchDefenseCompleted, readyForResearchDefense, readyForFinalDefense,
            topicProposal: topicBreakdown, irb: irbBreakdown,
            researchProposal: researchBreakdown, finalDefense: finalBreakdown,
        };
    }, [studentsData, analyticsCohort]);

    /* ── Filtered student list (for table) ── */
    const filteredStudents = useMemo(() => {
        return studentsData.filter(student => {
            // Search
            if (searchText) {
                const q = searchText.toLowerCase();
                const haystack = `${student.fullName} ${student.email} ${student.cohort}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            // Cohort
            if (selectedCohorts.length > 0 && !selectedCohorts.includes(student.cohort)) return false;
            // Milestone + Status combined
            if (selectedMilestones.length > 0 && selectedStatuses.length === 0) return false;
            if (selectedMilestones.length > 0 && selectedStatuses.length > 0) {
                let match = false;
                for (const m of selectedMilestones) {
                    const s = student.milestoneStatuses[m];
                    if (s && selectedStatuses.includes(s)) { match = true; break; }
                }
                if (!match) return false;
            }
            if (selectedMilestones.length === 0 && selectedStatuses.length > 0) {
                let match = false;
                for (const s of Object.values(student.milestoneStatuses)) {
                    if (selectedStatuses.includes(s)) { match = true; break; }
                }
                if (!match) return false;
            }
            return true;
        });
    }, [studentsData, searchText, selectedCohorts, selectedMilestones, selectedStatuses]);

    /* ── Pagination ── */
    const totalPages = Math.max(1, Math.ceil(filteredStudents.length / entriesPerPage));
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * entriesPerPage;
    const endIdx = Math.min(startIdx + entriesPerPage, filteredStudents.length);
    const pageStudents = filteredStudents.slice(startIdx, endIdx);


    const paginationPages = useMemo(() => {
        const pages: Array<number | 'ellipsis'> = [];
        for (let p = 1; p <= totalPages; p++) {
            const nearCurrent = Math.abs(p - safePage) <= 1;
            const nearEnds = p <= 2 || p >= totalPages - 1;
            if (p === 1 || p === totalPages || nearCurrent || nearEnds) {
                if (pages.length > 0 && typeof pages[pages.length - 1] === 'number' && (pages[pages.length - 1] as number) < p - 1) {
                    pages.push('ellipsis');
                }
                pages.push(p);
            }
        }
        return pages;
    }, [safePage, totalPages]);

    const clearAllFilters = () => {
        setSearchText('');
        setSelectedCohorts([]);
        setSelectedMilestones([]);
        setSelectedStatuses([]);
        setCurrentPage(1);
    };

    return (
        <div className="diss16-page">
            {/* ═══ Header ═══ */}
            <div className="mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">{config.name} Dissertation Progress</h1>
                        <p className="text-gray-600">
                            Monitor dissertation milestones and track student progress for {config.name}
                        </p>
                    </div>
                </div>
            </div>

            {/* ═══ Loading / Error ═══ */}
            {loading && (
                <div className="diss16-loading-card">
                    <div className="diss16-spinner" />
                    <span>Loading Dissertation Data...</span>
                </div>
            )}
            {error && !loading && (
                <div className="diss16-error-card">
                    <i className="fas fa-exclamation-triangle" />
                    <span>{error}</span>
                </div>
            )}

            {!loading && !error && (
                <>
                    {/* ═══ Overview Stats (4 cards) ═══ */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
                        <StatsCard icon="fa-users" sublabel="In Dissertation Phase" value={analytics.total}
                            orbColor="#a855f7"
                            tagBg="#f3e8ff" tagColor="#7e22ce" tagText="Total Learners"
                            barGradient="linear-gradient(90deg, rgba(168,85,247,0.2), rgba(168,85,247,0.6))" />
                        <StatsCard icon="fa-graduation-cap" sublabel="Ready for Research Defense" value={analytics.readyForResearchDefense}
                            orbColor="#f59e0b"
                            tagBg="#ffedd5" tagColor="#c2410c" tagText="⏳ Incoming"
                            barGradient="linear-gradient(90deg, rgba(245,158,11,0.2), rgba(245,158,11,0.6))" />
                        <StatsCard icon="fa-check-double" sublabel="Research Defense completed" value={analytics.researchDefenseCompleted}
                            orbColor="#16a34a"
                            tagBg="#dcfce7" tagColor="#15803d" tagText="✓ Research Defense"
                            barGradient="linear-gradient(90deg, rgba(22,163,74,0.2), rgba(22,163,74,0.6))" />
                        <StatsCard icon="fa-flag-checkered" sublabel="Ready for Final Defense" value={analytics.readyForFinalDefense}
                            orbColor="#3b82f6"
                            tagBg="#dbeafe" tagColor="#1e40af" tagText="🚩 Final Stage"
                            barGradient="linear-gradient(90deg, rgba(59,130,246,0.2), rgba(59,130,246,0.6))" />
                        <StatsCard icon="fa-trophy" sublabel="Graduated" value={analytics.graduated}
                            orbColor="#8b5cf6"
                            tagBg="#f3e8ff" tagColor="#6d28d9" tagText="🏆 Graduation"
                            barGradient="linear-gradient(90deg, rgba(139,92,246,0.2), rgba(139,92,246,0.6))" />
                    </div>

                    {/* ═══ Dissertation Progress Analytics ═══ */}
                    <div className="diss16-analytics-section">
                        {/* Analytics Header with Cohort Filter */}
                        <div className="diss16-analytics-header">
                            <div className="diss16-analytics-header-left">
                                <div className="diss16-analytics-icon">
                                    <i className="fas fa-graduation-cap" />
                                </div>
                                <div>
                                    <h2 className="diss16-analytics-title">Dissertation Progress Analytics</h2>
                                    <p className="diss16-analytics-subtitle">Track milestone completion across all cohorts</p>
                                </div>
                            </div>
                            <select
                                className="diss16-analytics-cohort-select"
                                value={analyticsCohort}
                                onChange={e => setAnalyticsCohort(e.target.value)}
                            >
                                <option value="">All Cohorts</option>
                                {cohorts.map(c => <option key={c} value={c}>Cohort {c}</option>)}
                            </select>
                        </div>

                        {/* 4 Milestone Breakdown Cards */}
                        <div className={`diss16-milestone-grid ${programId === 'dba' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-4'}`}>
                            <MilestoneCard
                                title="Topic Proposal" step="Step 1" icon="fa-lightbulb"
                                color="green" data={analytics.topicProposal}
                            />
                            {programId !== 'dba' && (
                                <MilestoneCard
                                    title="IRB" step="Step 2" icon="fa-search"
                                    color="blue" data={analytics.irb}
                                />
                            )}
                            <MilestoneCard
                                title={programId === 'dba' ? "Research Proposal" : "Research Proposal"}
                                step={programId === 'dba' ? "Step 2" : "Step 3"}
                                icon="fa-file-alt"
                                color="orange" data={analytics.researchProposal}
                            />
                            <MilestoneCard
                                title={programId === 'dba' ? "Final Dissertation" : "Final Defense"}
                                step="Final" icon="fa-trophy"
                                color="purple" data={analytics.finalDefense}
                                hideNotSubmitted
                            />
                        </div>

                        {/* Summary Bar */}
                        <div className="diss16-summary-bar">
                            <div>
                                <h3 className="diss16-summary-title">Dissertation Overview</h3>
                                <p className="diss16-summary-text">
                                    Total students in dissertation phase: <strong>{analytics.total}</strong>
                                </p>
                            </div>
                            <div className="diss16-summary-stats">
                                <div className="diss16-summary-stat">
                                    <div className="diss16-summary-stat-value" style={{ color: '#ea580c' }}>
                                        <AnimatedNumber value={analytics.readyForResearchDefense} />
                                    </div>
                                    <div className="diss16-summary-stat-label">Ready for Research Defense</div>
                                </div>
                                <div className="diss16-summary-stat">
                                    <div className="diss16-summary-stat-value" style={{ color: '#16a34a' }}>
                                        <AnimatedNumber value={analytics.researchDefenseCompleted} />
                                    </div>
                                    <div className="diss16-summary-stat-label">Research Defense Completed</div>
                                </div>
                                <div className="diss16-summary-stat">
                                    <div className="diss16-summary-stat-value" style={{ color: '#2563eb' }}>
                                        <AnimatedNumber value={analytics.readyForFinalDefense} />
                                    </div>
                                    <div className="diss16-summary-stat-label">Ready for Final Defense</div>
                                </div>
                                <div className="diss16-summary-stat">
                                    <div className="diss16-summary-stat-value" style={{ color: '#7c3aed' }}>
                                        <AnimatedNumber value={analytics.finalDefenseCleared} />
                                    </div>
                                    <div className="diss16-summary-stat-label">Final Defense Cleared</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ Detailed Learner Progress Table ═══ */}
                    <div className="diss16-table-section" onClick={() => setOpenDropdown(null)}>
                        <div className="diss16-table-section-header" onClick={(e) => e.stopPropagation()}>
                            <div className="diss16-table-header-icon">
                                <i className="fas fa-table" />
                            </div>
                            <div>
                                <h3 className="diss16-table-title">Detailed Learner Progress</h3>
                                <p className="diss16-table-subtitle">Individual milestone status for all dissertation students</p>
                            </div>
                        </div>

                        {/* --- NEW FILTER CONSOLE (Learners Page Style) --- */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl p-8 mb-10 border border-white/60 relative z-30" onClick={(e) => e.stopPropagation()}>
                            <div className="relative mb-10 z-10">
                                <div className="flex flex-col items-center max-w-3xl mx-auto">
                                    <h3 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-3">
                                        <i className="fas fa-microscope text-indigo-600" />
                                        Dissertation Filter Console
                                    </h3>

                                    <div className="w-full relative group">
                                        <input
                                            value={searchText}
                                            onChange={(e) => {
                                                setSearchText(e.target.value);
                                                setCurrentPage(1);
                                            }}
                                            placeholder="Find dissertation candidates by name, email, or topic..."
                                            className="w-full pl-14 pr-14 py-4.5 bg-gray-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-3xl transition-all shadow-inner text-lg font-medium outline-none placeholder:text-gray-400 text-gray-800"
                                        />
                                        <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-xl group-focus-within:text-indigo-500 transition-colors" />
                                        {searchText.trim() && (
                                            <button
                                                type="button"
                                                onClick={() => { setSearchText(''); setCurrentPage(1); }}
                                                className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-500 transition-colors"
                                            >
                                                <i className="fas fa-times-circle text-xl" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 relative z-20">
                                <FilterDropdown
                                    label="Academic Cohort"
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
                                    label="Dissertation Phase"
                                    iconClass="fas fa-map-marked-alt"
                                    placeholder="All Milestones"
                                    values={programId === 'dba' ? ['Topic Proposal', 'Research Proposal', 'Final Defense'] : ['Topic Proposal', 'IRB', 'Research Proposal', 'Final Defense']}
                                    selected={selectedMilestones}
                                    onToggle={(v) => toggleInList(v, selectedMilestones, setSelectedMilestones)}
                                    isOpen={openDropdown === 'milestone'}
                                    setIsOpen={(open) => setOpenDropdown(open ? 'milestone' : null)}
                                />

                                <FilterDropdown
                                    label="Submission Status"
                                    iconClass="fas fa-clipboard-check"
                                    placeholder="All Statuses"
                                    values={['Submitted', 'Not Submitted', 'Approved', 'Not Approved']}
                                    selected={selectedStatuses}
                                    onToggle={(v) => toggleInList(v, selectedStatuses, setSelectedStatuses)}
                                    isOpen={openDropdown === 'status'}
                                    setIsOpen={(open) => setOpenDropdown(open ? 'status' : null)}
                                />
                            </div>

                            <div className="flex border-t border-gray-100 pt-8 items-center justify-between gap-4">
                                <div className="flex flex-wrap gap-2 items-center min-w-0">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mr-2">Active Tuning:</span>
                                    {(searchText.trim() || selectedCohorts.length > 0 || selectedMilestones.length > 0 || selectedStatuses.length > 0) ? (
                                        <>
                                            {searchText.trim() && (
                                                <div className="bg-indigo-50 border border-indigo-100 rounded-full px-3 py-1 flex items-center gap-2 transition-colors">
                                                    <span className="text-xs font-bold text-indigo-600">"{searchText}"</span>
                                                    <button onClick={() => setSearchText('')} className="text-indigo-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-[10px]" /></button>
                                                </div>
                                            )}
                                            {selectedCohorts.map(c => (
                                                <div key={c} className="bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1 flex items-center gap-2 transition-colors">
                                                    <span className="text-xs font-bold text-emerald-600">C{c}</span>
                                                    <button onClick={() => setSelectedCohorts(p => p.filter(x => x !== c))} className="text-emerald-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-[10px]" /></button>
                                                </div>
                                            ))}
                                            {selectedMilestones.map(m => (
                                                <div key={m} className="bg-purple-50 border border-purple-100 rounded-full px-3 py-1 flex items-center gap-2 transition-colors">
                                                    <span className="text-xs font-bold text-purple-600">{m}</span>
                                                    <button onClick={() => setSelectedMilestones(p => p.filter(x => x !== m))} className="text-purple-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-[10px]" /></button>
                                                </div>
                                            ))}
                                            {selectedStatuses.map(s => (
                                                <div key={s} className="bg-orange-50 border border-orange-100 rounded-full px-3 py-1 flex items-center gap-2 transition-colors">
                                                    <span className="text-xs font-bold text-orange-600">{s}</span>
                                                    <button onClick={() => setSelectedStatuses(p => p.filter(x => x !== s))} className="text-orange-300 hover:text-red-500 transition-colors"><i className="fas fa-times-circle text-[10px]" /></button>
                                                </div>
                                            ))}
                                        </>
                                    ) : (
                                        <span className="text-xs italic text-gray-300">No active filters applied</span>
                                    )}
                                </div>
                                <button
                                    onClick={clearAllFilters}
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-indigo-200"
                                >
                                    <i className="fas fa-sync-alt" /> Reset Tuning
                                </button>
                            </div>
                        </div>

                        {/* Milestone-Status dependency warning */}
                        {selectedMilestones.length > 0 && selectedStatuses.length === 0 && (
                            <div className="diss16-warning">
                                <i className="fas fa-exclamation-triangle" style={{ color: '#ca8a04', marginRight: 8 }} />
                                <span>
                                    <strong>Filter Dependency:</strong> Milestone filter requires a Status filter to be selected.
                                    Please select at least one status option.
                                </span>
                            </div>
                        )}

                        <div className="diss16-pagination-top" onClick={(e) => e.stopPropagation()}>
                            <div className="diss16-entries-selector">
                                <span>Show</span>
                                <select value={entriesPerPage} onChange={e => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span>entries</span>
                            </div>
                            <p className="diss16-results-info">
                                Showing <strong>{filteredStudents.length > 0 ? startIdx + 1 : 0}</strong> to <strong>{endIdx}</strong> of <strong>{filteredStudents.length}</strong> students
                            </p>
                        </div>

                        {/* Table */}
                        <div className="diss16-table-wrap">
                            <table className="diss16-table">
                                <thead>
                                    <tr>
                                        <th>Learner Name</th>
                                        <th>Email</th>
                                        <th>Cohort</th>
                                        <th style={{ textAlign: 'center' }}>Topic Proposal</th>
                                        {programId !== 'dba' && <th style={{ textAlign: 'center' }}>IRB</th>}
                                        <th style={{ textAlign: 'center' }}>Research Proposal</th>
                                        <th style={{ textAlign: 'center' }}>Final {programId === 'dba' ? 'Dissertation' : 'Defense'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageStudents.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="diss16-table-empty">
                                                <i className="fas fa-inbox" style={{ fontSize: 28, opacity: 0.4, marginBottom: 8, display: 'block' }} />
                                                No learners match the current filters
                                            </td>
                                        </tr>
                                    )}
                                    {pageStudents.map((student, idx) => (
                                        <tr key={`${student.email}-${student.cohort}-${idx}`} className="diss16-table-row">
                                            <td className="diss16-td-name">{student.fullName || '—'}</td>
                                            <td className="diss16-td-email">{student.email || '—'}</td>
                                            <td>
                                                <span className="diss16-cohort-badge">{student.cohort || '—'}</span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}><StatusPill status={student.topic} /></td>
                                            {programId !== 'dba' && <td style={{ textAlign: 'center' }}><StatusPill status={student.irb} /></td>}
                                            <td style={{ textAlign: 'center' }}><StatusPill status={student.research} /></td>
                                            <td style={{ textAlign: 'center' }}><StatusPill status={student.finalDef} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls (bottom) */}
                        <div className="diss16-pagination-bottom">
                            <p className="diss16-results-info">
                                Showing <strong>{filteredStudents.length > 0 ? startIdx + 1 : 0}</strong> to <strong>{endIdx}</strong> of <strong>{filteredStudents.length}</strong> students
                            </p>
                            {totalPages > 1 && (
                                <div className="diss16-pagination-controls">
                                    <button disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)} className="diss16-page-btn">
                                        <i className="fas fa-chevron-left" />
                                    </button>
                                    {paginationPages.map((p, idx) =>
                                        p === 'ellipsis' ? (
                                            <span key={`e${idx}`} className="diss16-page-ellipsis">...</span>
                                        ) : (
                                            <button key={p} onClick={() => setCurrentPage(p)} className={`diss16-page-btn ${p === safePage ? 'diss16-page-active' : ''}`}>
                                                {p}
                                            </button>
                                        )
                                    )}
                                    <button disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)} className="diss16-page-btn">
                                        <i className="fas fa-chevron-right" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Status Legend */}
                        <div className="diss16-legend">
                            <h4 className="diss16-legend-title">Status Legend:</h4>
                            <div className="diss16-legend-items">
                                <div className="diss16-legend-item">
                                    <StatusPill status="Approved" />
                                    <span>Milestone completed and approved</span>
                                </div>
                                <div className="diss16-legend-item">
                                    <StatusPill status="Not Approved" />
                                    <span>Submitted but not approved</span>
                                </div>
                                <div className="diss16-legend-item">
                                    <StatusPill status="Submitted" />
                                    <span>Awaiting review</span>
                                </div>
                                <div className="diss16-legend-item">
                                    <StatusPill status="Not Submitted" />
                                    <span>Explicitly marked as not submitted</span>
                                </div>
                                <div className="diss16-legend-item">
                                    <StatusPill status="Pending" />
                                    <span>Not yet started or no data</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ Dissertation Requirements Info ═══ */}
                    <div className="diss16-requirements">
                        <div className="diss16-requirements-icon">
                            <i className="fas fa-info" />
                        </div>
                        <div>
                            <h3 className="diss16-requirements-title">Dissertation Phase Requirements</h3>
                            <div className="diss16-requirements-grid">
                                <div className="diss16-req-item">
                                    <i className="fas fa-lightbulb" style={{ color: '#3b82f6' }} />
                                    <span><strong>Topic Proposal:</strong> Research topic approval required</span>
                                </div>
                                <div className="diss16-req-item">
                                    <i className="fas fa-search" style={{ color: '#16a34a' }} />
                                    <span><strong>IRB Approval:</strong> Institutional Review Board clearance</span>
                                </div>
                                <div className="diss16-req-item">
                                    <i className="fas fa-file-alt" style={{ color: '#f97316' }} />
                                    <span><strong>Research Proposal:</strong> Detailed research methodology</span>
                                </div>
                                <div className="diss16-req-item">
                                    <i className="fas fa-trophy" style={{ color: '#8b5cf6' }} />
                                    <span><strong>Final Defense:</strong> Dissertation presentation and approval</span>
                                </div>
                                <div className="diss16-req-item">
                                    <i className="fas fa-calendar" style={{ color: '#6366f1' }} />
                                    <span><strong>Duration:</strong> 22 months for dissertation phase</span>
                                </div>
                                <div className="diss16-req-item">
                                    <i className="fas fa-graduation-cap" style={{ color: '#ec4899' }} />
                                    <span><strong>Completion:</strong> All milestones required for graduation</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

/* ──────────────────────── Sub Components ──────────────────────── */

function StatsCard({ icon, sublabel, value, orbColor, tagBg, tagColor, tagText, barGradient, isPercent }: {
    icon: string; sublabel: string; value: number;
    orbColor: string; tagBg: string; tagColor: string; tagText: string; barGradient: string;
    isPercent?: boolean;
}) {
    return (
        <div className="group relative bg-white bg-opacity-80 backdrop-blur-lg rounded-xl shadow-xl p-4 border border-white border-opacity-20 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 -mr-10 -mt-10 group-hover:opacity-20 transition-opacity" style={{ background: orbColor }} />
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                        <i className={`fas ${icon} text-xl`} style={{ color: tagColor }} />
                    </div>
                    <span className="text-sm font-medium px-3 py-1 rounded-full" style={{ background: tagBg, color: tagColor }}>
                        {tagText}
                    </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-1">
                    <AnimatedNumber value={value} />{isPercent && '%'}
                </h3>
                <p className="text-sm text-gray-600">{sublabel}</p>
                <div className="mt-4 h-1 rounded-full" style={{ background: barGradient }} />
            </div>
        </div>
    );
}

function MilestoneCard({ title, step, icon, color, data, hideNotSubmitted }: {
    title: string; step: string; icon: string; color: 'green' | 'blue' | 'orange' | 'purple';
    data: MilestoneBreakdown; hideNotSubmitted?: boolean;
}) {
    const colorMap = {
        green: { bg: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '#bbf7d0', iconBg: '#ffffff', iconColor: '#15803d', stepBg: '#bbf7d0', stepColor: '#15803d', titleColor: '#166534' },
        blue: { bg: 'linear-gradient(135deg, #eff6ff, #dbeafe)', border: '#93c5fd', iconBg: '#ffffff', iconColor: '#1d4ed8', stepBg: '#bfdbfe', stepColor: '#1d4ed8', titleColor: '#1e40af' },
        orange: { bg: 'linear-gradient(135deg, #fff7ed, #ffedd5)', border: '#fed7aa', iconBg: '#ffffff', iconColor: '#c2410c', stepBg: '#fed7aa', stepColor: '#c2410c', titleColor: '#9a3412' },
        purple: { bg: 'linear-gradient(135deg, #faf5ff, #f3e8ff)', border: '#d8b4fe', iconBg: '#ffffff', iconColor: '#6d28d9', stepBg: '#e9d5ff', stepColor: '#6d28d9', titleColor: '#5b21b6' },
    };
    const c = colorMap[color];

    const items: { label: string; dotColor: string; textColor: string; count: number; percent: number }[] = [
        { label: 'Approved', dotColor: '#22c55e', textColor: '#16a34a', count: data.approved.count, percent: data.approved.percent },
        { label: 'Not Approved', dotColor: '#ef4444', textColor: '#dc2626', count: data.not_approved.count, percent: data.not_approved.percent },
        { label: 'Submitted', dotColor: '#eab308', textColor: '#ca8a04', count: data.submitted.count, percent: data.submitted.percent },
    ];

    if (!hideNotSubmitted) {
        items.push({ label: 'Not Submitted', dotColor: '#9ca3af', textColor: '#6b7280', count: data.not_submitted.count, percent: data.not_submitted.percent });
    }

    return (
        <div className="diss16-milestone-card" style={{ background: c.bg, borderColor: c.border }}>
            <div className="diss16-milestone-card-top">
                <div className="diss16-milestone-icon shadow-sm border border-black/5" style={{ background: c.iconBg, color: c.iconColor }}>
                    <i className={`fas ${icon}`} />
                </div>
                <span className="diss16-milestone-step" style={{ background: c.stepBg, color: c.stepColor }}>{step}</span>
            </div>
            <h3 className="diss16-milestone-title" style={{ color: c.titleColor }}>{title}</h3>
            <div className="diss16-milestone-items">
                {items.map(item => (
                    <div key={item.label} className="diss16-milestone-item">
                        <div className="diss16-milestone-item-left">
                            <div className="diss16-milestone-dot" style={{ background: item.dotColor }} />
                            <span>{item.label}</span>
                        </div>
                        <div className="diss16-milestone-item-right">
                            <span style={{ color: item.textColor, fontWeight: 700 }}>{item.count}</span>
                            <span style={{ color: '#6b7280', fontSize: 11 }}>({item.percent}%)</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
