import { useMemo, useState } from 'react';
import { useProgramConfig } from '../hooks/useProgramConfig';
import { useAcademicReviewData, type AcademicReviewRow } from '../hooks/useAcademicReviewData';
import { useARDatesData } from '../hooks/useARDatesData';
import { useLearnerData } from '../hooks/useLearnerData';
import AnimatedNumber from '../components/AnimatedNumber';
import FilterDropdown from '../components/FilterDropdown';

/* ─── helpers ─── */
function v(row: AcademicReviewRow, ...possibleKeys: string[]): string {
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

function parseGPA(val: string): number | null {
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}

/** Parse a date string like '11-Jun-2024', '25-Aug-2026', Excel serial, or '25/08/2026' into a Date */
function parseARDate(val: any): Date | null {
    if (!val) return null;
    const s = String(val).trim();
    if (!s || s.toLowerCase() === 'na' || s.toLowerCase().includes('future') || s === '#N/A' || s === '-') return null;

    // Excel serial number (e.g. 45894 -> 25-Aug-2026)
    if (/^\d{5}(\.\d+)?$/.test(s)) {
        const serial = parseFloat(s);
        // Excel/Sheets base date is Dec 30, 1899
        return new Date((serial - 25569) * 86400 * 1000);
    }

    // Google Sheets GViz date format: e.g. "Date(2026,7,25)"
    const gvizMatch = s.match(/^Date\((\d+),\s*(\d+),\s*(\d+)(?:,\s*\d+,\s*\d+,\s*\d+)?\)$/i);
    if (gvizMatch) {
        // GViz months correspond natively to JS 0-based months
        return new Date(parseInt(gvizMatch[1], 10), parseInt(gvizMatch[2], 10), parseInt(gvizMatch[3], 10));
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    // Try dd-Mon-yyyy or dd/Mon/yyyy
    const m = s.match(/(\d{1,2})[\-\/]([a-zA-Z]{3,})[\-\/](\d{4})/);
    if (m) {
        const monthMap: Record<string, number> = {
            jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
            jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
        };
        const monthIdx = monthMap[m[2].toLowerCase().substring(0, 3)];
        if (monthIdx !== undefined) {
            const parsed = new Date(parseInt(m[3], 10), monthIdx, parseInt(m[1], 10));
            if (!isNaN(parsed.getTime())) return parsed;
        }
    }

    // Try normal DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
    if (dmy) {
        // Assume DD/MM/YYYY
        return new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
    }

    return null;
}

/* ─── Status pill ─── */
function ARStatusPill({ status }: { status: string }) {
    const s = status.toLowerCase();
    let bg = 'rgba(243, 244, 246, 1)', color = '#374151', icon = 'fa-minus';

    if (s.includes('good standing')) { bg = 'rgba(16, 185, 129, 0.12)'; color = '#10b981'; icon = 'fa-check-circle'; }
    else if (s.includes('probation')) { bg = 'rgba(245, 158, 11, 0.12)'; color = '#f59e0b'; icon = 'fa-exclamation-triangle'; }
    else if (s.includes('dismissal') || s.includes('dismissed') || s.includes('disqualified')) { bg = 'rgba(239, 68, 68, 0.12)'; color = '#ef4444'; icon = 'fa-times-circle'; }
    else if (s.includes('eligible') || s.includes('measurable')) { bg = 'rgba(59, 130, 246, 0.12)'; color = '#3b82f6'; icon = 'fa-clipboard-check'; }

    const displayStatus = (s.includes('dismissal') || s.includes('dismissed')) ? 'Disqualified' : status;

    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border"
            style={{
                background: bg,
                color: color,
                borderColor: `${color}30`
            }}>
            <i className={`fas ${icon} text-[9px]`} />
            {displayStatus || '—'}
        </span>
    );
}

function GPABadge({ gpa }: { gpa: number | null }) {
    if (gpa === null) return <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>;
    let bg = 'rgba(16, 185, 129, 0.12)', color = '#10b981';
    if (gpa < 3.0) { bg = 'rgba(239, 68, 68, 0.12)'; color = '#ef4444'; }
    else if (gpa < 3.5) { bg = 'rgba(245, 158, 11, 0.12)'; color = '#f59e0b'; }
    return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-bold border"
            style={{ background: bg, color: color, borderColor: `${color}30` }}>
            {gpa.toFixed(2)}
        </span>
    );
}

/* ─── KPI card — matches Learners page style ─── */
function KpiCard({ icon, label, value, sublabel, color, gradFrom, gradTo }: {
    icon: string; label: string; value: number | string; sublabel?: string;
    color: string; gradFrom: string; gradTo: string;
}) {
    return (
        <div className="group relative bg-white dark:bg-gray-900/60 backdrop-blur-lg rounded-xl shadow-xl p-4 border border-gray-100 dark:border-gray-800 hover:shadow-2xl hover:scale-105 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-10 -mr-10 -mt-10 group-hover:opacity-20 transition-opacity"
                style={{ background: `linear-gradient(135deg, ${gradFrom}, ${gradTo})` }} />
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-white dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm border group-hover:scale-110 transition-transform"
                        style={{ borderColor: color + '33' }}>
                        <i className={`fas ${icon} text-xl`} style={{ color }} />
                    </div>
                    <span className="text-sm font-medium px-3 py-1 rounded-full" style={{ color, background: color + '18' }}>
                        {sublabel ?? label}
                    </span>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-1">
                    {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
                <div className="mt-4 h-1 rounded-full opacity-60" style={{ background: `linear-gradient(to right, ${gradFrom}60, ${gradTo})` }} />
            </div>
        </div>
    );
}

/* ─── Donut ring chart ─── */
function DonutRing({ good, probation, disqualified, total, label, hideProbation, hideLegend }: { good: number; probation: number; disqualified: number; total: number; label: string; hideProbation?: boolean; hideLegend?: boolean }) {
    const goodPct = total > 0 ? (good / total) * 100 : 0;
    const probPct = total > 0 ? (probation / total) * 100 : 0;
    const disqPct = total > 0 ? (disqualified / total) * 100 : 0;
    const r = 40;
    const circ = 2 * Math.PI * r;
    const goodDash = (goodPct / 100) * circ;
    const probDash = (probPct / 100) * circ;
    const disqDash = (disqPct / 100) * circ;

    return (
        <div className="acad-donut-container">
            <svg width="100" height="100" viewBox="0 0 100 100" className="drop-shadow-sm">
                <g transform="rotate(-90 50 50)">
                    <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="14" className="text-gray-100 dark:text-gray-800" />
                    {good > 0 && (
                        <circle cx="50" cy="50" r={r} fill="none" stroke="#10b981" strokeWidth="14"
                            strokeDasharray={`${goodDash} ${circ}`}
                            strokeDashoffset={0}
                            style={{ transition: 'stroke-dasharray 0.8s ease' }}
                        />
                    )}
                    {probation > 0 && !hideProbation && (
                        <circle cx="50" cy="50" r={r} fill="none" stroke="#f59e0b" strokeWidth="14"
                            strokeDasharray={`${probDash} ${circ}`}
                            strokeDashoffset={-goodDash}
                            style={{ transition: 'stroke-dasharray 0.8s ease' }}
                        />
                    )}
                    {disqualified > 0 && (
                        <circle cx="50" cy="50" r={r} fill="none" stroke="#ef4444" strokeWidth="14"
                            strokeDasharray={`${disqDash} ${circ}`}
                            strokeDashoffset={-(goodDash + (hideProbation ? 0 : probDash))}
                            style={{ transition: 'stroke-dasharray 0.8s ease' }}
                        />
                    )}
                </g>
                <text x="50" y="46" textAnchor="middle" fontSize="13" fontWeight="900" fill="var(--text-primary)">{total}</text>
                <text x="50" y="60" textAnchor="middle" fontSize="8" fontWeight="600" fill="var(--text-muted)">TOTAL</text>
            </svg>
            {label && <div className="acad-donut-label text-gray-400 dark:text-gray-500 mt-2">{label}</div>}
            {!hideLegend && (
                <div className="acad-donut-legend mt-3 space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-gray-900 dark:text-gray-50">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] ring-2 ring-emerald-500/20 dark:ring-emerald-500/40 shadow-xs" />
                        <span>{good} Good</span>
                    </div>
                    {!hideProbation && (
                        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-900 dark:text-gray-50">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] ring-2 ring-amber-500/20 dark:ring-amber-500/40 shadow-xs" />
                            <span>{probation} Prob.</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px] font-bold text-gray-900 dark:text-gray-50">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] ring-2 ring-rose-500/20 dark:ring-rose-500/40 shadow-xs" />
                        <span>{disqualified} Disq.</span>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Analytics section (AR breakdown cards) ─── */
function ARBreakdownCard({ title, step, color, good, probation, disqualified, hideProbation }: {
    title: string; step: string; color: string;
    good: number; probation: number; disqualified: number; hideProbation?: boolean;
}) {
    const actProb = hideProbation ? 0 : probation;
    const actualTotal = good + actProb + disqualified;
    const pct = actualTotal > 0 ? Math.round((good / actualTotal) * 100) : 0;

    return (
        <div className="relative overflow-hidden bg-white/90 dark:bg-gray-900/40 backdrop-blur-xl border border-gray-100 dark:border-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 group flex flex-col h-full">
            {/* Background glowing blob */}
            <div className="absolute top-0 right-0 w-40 h-40 opacity-[0.08] dark:opacity-[0.12] rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-125" style={{ backgroundColor: color }} />

            <div className="p-6 relative z-10 flex-1 flex flex-col">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white dark:bg-gray-800 shadow-sm border border-gray-100/50 dark:border-gray-700 group-hover:scale-110 transition-transform">
                        <i className={`fas fa-chart-pie`} style={{ color }} />
                    </div>
                    <div>
                        <div className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-1 inline-block" style={{ color: color === '#10b981' ? '#10b981' : (color === '#8b5cf6' ? '#8b5cf6' : color), backgroundColor: `${color}15` }}>{step}</div>
                        <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 leading-tight">{title}</h3>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 mt-auto">
                    {/* Donut Chart */}
                    <div className="flex-shrink-0 scale-110 drop-shadow-md dark:drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)] pb-4 sm:pb-0">
                        <DonutRing good={good} probation={actProb} disqualified={disqualified} total={actualTotal} label="" hideProbation={hideProbation} hideLegend={true} />
                    </div>

                    {/* Stats List */}
                    <div className="w-full flex flex-col gap-2">
                        <div className="flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/40 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 shadow-sm group/row">
                            <div className="flex items-center gap-3">
                                <span className="w-3 h-3 rounded-full bg-[#10b981] ring-2 ring-emerald-500/20 dark:ring-emerald-500/40 shadow-sm" />
                                <span className="text-[11px] font-bold text-gray-900 dark:text-gray-50">Good Standing</span>
                            </div>
                            <span className="text-sm font-black text-[#10b981] dark:text-[#34d399] tracking-tight">{good}</span>
                        </div>

                        {!hideProbation && (
                            <div className="flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/40 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 shadow-sm group/row">
                                <div className="flex items-center gap-3">
                                    <span className="w-3 h-3 rounded-full bg-[#f59e0b] ring-2 ring-amber-500/20 dark:ring-amber-500/40 shadow-sm" />
                                    <span className="text-[11px] font-bold text-gray-900 dark:text-gray-50">Probation</span>
                                </div>
                                <span className="text-sm font-black text-[#f59e0b] dark:text-[#fbbf24] tracking-tight">{actProb}</span>
                            </div>
                        )}

                        <div className="flex items-center justify-between bg-gray-50/80 dark:bg-gray-800/40 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-gray-700/50 hover:bg-white dark:hover:bg-gray-800 transition-all duration-200 shadow-sm group/row">
                            <div className="flex items-center gap-3">
                                <span className="w-3 h-3 rounded-full bg-[#ef4444] ring-2 ring-rose-500/20 dark:ring-rose-500/40 shadow-sm" />
                                <span className="text-[11px] font-bold text-gray-900 dark:text-gray-50">Disqualified</span>
                            </div>
                            <span className="text-sm font-black text-[#ef4444] dark:text-[#f87171] tracking-tight">{disqualified}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress line at bottom */}
            <div className="h-1.5 w-full bg-gray-50 dark:bg-gray-800 flex mt-auto">
                <div style={{ width: `${pct}%`, backgroundColor: '#10b981' }} className="h-full relative overflow-hidden group-hover:after:absolute group-hover:after:inset-0 group-hover:after:bg-white/20 group-hover:after:animate-pulse" />
            </div>
        </div>
    );
}

function formatDateForDisplay(val: any): string {
    const d = parseARDate(val);
    if (!d) return String(val).trim();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ─── Upcoming AR date card ─── */
function UpcomingCard({ cohort, date, cgpaReq, type, daysAway }: {
    cohort: string; date: string; cgpaReq: string; type: 'ar1' | 'ar2'; daysAway: number;
}) {
    const color = type === 'ar1' ? '#6366f1' : '#8b5cf6';
    const urgency = daysAway <= 30 ? '#ef4444' : daysAway <= 90 ? '#f59e0b' : '#22c55e';

    return (
        <div className="bg-white/80 dark:bg-gray-900/40 backdrop-blur-md border border-gray-100 dark:border-gray-800 rounded-xl p-3 flex items-center justify-between shadow-sm hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900/50 transition-all duration-300 group">
            <div className="overflow-hidden">
                <div className="text-[11px] font-bold text-gray-800 dark:text-gray-100 mb-1 leading-tight truncate group-hover:translate-x-1 transition-transform" title={`Cohort ${cohort}`}>
                    {cohort.startsWith('ENG-') ? 'ENG' : 'Cohort'} {cohort.replace('ENG-', '')}
                </div>
                <div className="text-[11px] font-black bg-gray-50 dark:bg-gray-800/60 px-2 py-0.5 rounded-md border border-gray-100/50 dark:border-gray-700/50 inline-block" style={{ color }}>
                    {formatDateForDisplay(date)}
                </div>
            </div>

            <div className="flex flex-col items-end flex-shrink-0 ml-2">
                <div className="text-[10px] font-bold px-2 py-0.5 rounded-full mb-1 shadow-sm" style={{ color: urgency, backgroundColor: urgency + '15', border: `1px solid ${urgency}30` }}>
                    {daysAway} days
                </div>
                <div className="text-[9px] text-gray-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                    Req: <span className="text-gray-900 dark:text-gray-100">{cgpaReq}</span>
                </div>
            </div>
        </div>
    );
}

export default function AcademicPerformancePage() {
    const { programId } = useProgramConfig();
    const { loading: arLoading, error: arError, rows } = useAcademicReviewData();
    const { merged: learnerData } = useLearnerData();

    /* Mapping from Cohort ID to Cohort # from Student List */
    const cohortIdToNumMap = useMemo(() => {
        const map = new Map<string, string>();
        if (!learnerData) return map;
        learnerData.forEach(l => {
            const id = v(l as any, 'Cohort ID') || v(l as any, 'Cohort');
            const num = v(l as any, 'Cohort #') || v(l as any, 'Cohort Name');
            if (id && num && !map.has(id)) {
                map.set(id, num);
            }
        });
        return map;
    }, [learnerData]);

    /* Tabs */
    const [activeTab, setActiveTab] = useState<'overview' | 'academic-review'>('overview');

    /* AR table filters */
    const [searchText, setSearchText] = useState('');
    const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
    const [selectedAR1Status, setSelectedAR1Status] = useState<string[]>([]);
    const [selectedQEStatus, setSelectedQEStatus] = useState<string[]>([]);
    const [selectedAR2Status, setSelectedAR2Status] = useState<string[]>([]);
    const [selectedFinalStatus, setSelectedFinalStatus] = useState<string[]>([]);
    const [selectedSecondaryStatuses, setSelectedSecondaryStatuses] = useState<string[]>([]);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [entriesPerPage, setEntriesPerPage] = useState(25);

    /* Export Modal */
    const EXPORT_COLUMNS = [
        'Email ID',
        'upGrad ID',
        'GGU ID',
        'Cohort ID',
        '1st Academic Review CGPA',
        '1st Academic Review Status',
        '2nd Academic Review CGPA',
        'Final Academic Review'
    ];
    const [showExportModal, setShowExportModal] = useState(false);
    const [selectedExportColumns, setSelectedExportColumns] = useState<string[]>(EXPORT_COLUMNS);

    /* Derived cohorts */
    const cohorts = useMemo(() => {
        const set = new Set<string>();
        rows.forEach(r => {
            const id = v(r, 'Cohort ID') || v(r, 'Cohort');
            if (id) set.add(cohortIdToNumMap.get(id) || id);
        });
        return Array.from(set).sort();
    }, [rows, cohortIdToNumMap]);

    /* Compute AR analytics per row */
    const processedRows = useMemo(() => rows.map((row: Record<string, any>) => {
        // Find best keys ignoring case/spaces if needed, or stick to literal lookups and fallbacks
        const ar1Date = v(row, 'Academic Review 1 Date') || v(row, '1st Academic Review Date') || v(row, 'AR1 Date');
        const ar1Cgpa = parseGPA(v(row, '1st Academic Review CGPA'));
        const ar1Status = v(row, '1st Academic Review Status') || v(row, '1st Academic Review');
        const ar2Date = v(row, 'Academic Review 2 Date') || v(row, '2nd Academic Review Date') || v(row, 'AR2 Date');
        const ar2Cgpa = parseGPA(v(row, '2nd Academic Review CGPA'));
        const ar2Status = v(row, '2nd Academic Review Status') || v(row, '2nd Academic Review');
        const finalStatus = v(row, 'Final Academic Review Status') || v(row, 'Final Academic Review');
        const overallCgpa = parseGPA(v(row, 'Overall CGPA'));
        const eligibility = v(row, 'AR ELIGIBILITY');
        const measurableStatus = v(row, 'Measurable Status');
        const cohortId = v(row, 'Cohort ID') || v(row, 'uG Cohort ID') || v(row, 'Cohort');
        const firstName = v(row, 'First Name');
        const lastName = v(row, 'Last Name');
        const email = v(row, 'Email ID') || v(row, 'GGU Email ID') || v(row, 'GGU Student Email ID') || v(row, 'Email');
        const gguId = v(row, 'GGU ID') || v(row, 'GGU Student ID') || v(row, 'GGU User ID');
        const upgradId = v(row, 'upGrad ID') || v(row, 'upGrad Student ID') || v(row, 'Learner ID') || v(row, 'User ID');
        const coursesCompleted = parseInt(v(row, 'Courses Completed')) || 0;
        const learnerType = v(row, 'upGrad Learner Status') || v(row, 'Learner Status');
        const slot = v(row, 'SLOT');

        const cohortNum = cohortIdToNumMap.get(cohortId) || cohortId;
        const qeStatus = v(row, 'QE Review Status');
        const secondaryStatus = v(row, 'Secondary Status') || v(row, 'upGrad Learner Status') || v(row, 'GGU Learner Status') || v(row, 'Actual Status');

        return {
            row, cohortId, cohortNum, firstName, lastName, email, gguId, upgradId, learnerType, slot,
            overallCgpa, coursesCompleted, eligibility, measurableStatus,
            ar1Date, ar1Cgpa, ar1Status,
            ar2Date, ar2Cgpa, ar2Status,
            qeStatus,
            finalStatus,
            secondaryStatus,
            fullName: `${firstName} ${lastName}`.trim(),
        };
    }), [rows, cohortIdToNumMap]);

    /* Unique secondary statuses for filter */
    const secondaryStatuses = useMemo(() => {
        const set = new Set<string>();
        processedRows.forEach(r => { if (r.secondaryStatus) set.add(r.secondaryStatus); });
        return Array.from(set).sort();
    }, [processedRows]);

    /* Table filtering */
    const filteredRows = useMemo(() => {
        return processedRows.filter(r => {
            if (searchText) {
                const q = searchText.toLowerCase();
                const hay = `${r.fullName} ${r.email} ${r.gguId} ${r.cohortNum}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (selectedCohorts.length > 0 && !selectedCohorts.includes(r.cohortNum)) return false;
            if (selectedSecondaryStatuses.length > 0 && !selectedSecondaryStatuses.includes(r.secondaryStatus)) return false;
            if (selectedAR1Status.length > 0 && !selectedAR1Status.some(s => r.ar1Status.toLowerCase().includes(s.toLowerCase()))) return false;
            if (selectedQEStatus.length > 0 && !selectedQEStatus.some(s => r.qeStatus.toLowerCase().includes(s.toLowerCase()))) return false;
            if (selectedAR2Status.length > 0 && !selectedAR2Status.some(s => r.ar2Status.toLowerCase().includes(s.toLowerCase()))) return false;
            if (selectedFinalStatus.length > 0 && !selectedFinalStatus.some(s => r.finalStatus.toLowerCase().includes(s.toLowerCase()))) return false;
            return true;
        });
    }, [processedRows, searchText, selectedCohorts, selectedSecondaryStatuses, selectedAR1Status, selectedQEStatus, selectedAR2Status, selectedFinalStatus]);

    /* Analytics derived */
    const analytics = useMemo(() => {
        const isDbaStrict = programId === 'dba-et' || programId === 'dba';
        const isDlProgram = programId === 'dba-dl';

        const filtered = filteredRows.filter(r => {
            const ss = (r.secondaryStatus || '').toLowerCase().trim();
            if (isDbaStrict) {
                // Strict: exactly the three recognised statuses
                return ss === 'active' || ss === 'active / deferred in' || ss === 'disqualified';
            } else if (isDlProgram) {
                // DBA DL: Active (good standing) + Failed (disqualified)
                return ss === 'active' || ss === 'failed';
            } else {
                // Broad (DBA DL old logic): include 'failed', 'program change', or any row with a disq final outcome
                const fs = (r.finalStatus || '').toLowerCase().trim();
                const isActiveOrDisq = ss === 'active' || ss === 'active / deferred in' || ss === 'disqualified'
                    || ss === 'failed' || ss.includes('program change');
                const hasDisqFinalOutcome = fs.includes('disqualif') || fs.includes('dismiss');
                return isActiveOrDisq || hasDisqFinalOutcome;
            }
        });

        const total = filtered.length;
        const activeCount = filtered.length;

        const ar1Good = filtered.filter(r => r.ar1Status.toLowerCase().includes('good standing')).length;
        const ar1Prob = filtered.filter(r => r.ar1Status.toLowerCase().includes('probation')).length;
        const ar1Disq = filtered.filter(r => r.ar1Status.toLowerCase().includes('dismiss') || r.ar1Status.toLowerCase().includes('disqualif')).length;
        const ar1Dates = [...new Set(filtered.filter(r => r.ar1Date).map(r => r.ar1Date))].sort();

        const qeGood = filtered.filter(r => r.qeStatus.toLowerCase().includes('good standing')).length;
        const qeProb = filtered.filter(r => r.qeStatus.toLowerCase().includes('probation')).length;
        const qeDisq = filtered.filter(r => r.qeStatus.toLowerCase().includes('dismiss') || r.qeStatus.toLowerCase().includes('disqualif')).length;

        const ar2Good = filtered.filter(r => r.ar2Status.toLowerCase().includes('good standing')).length;
        const ar2Prob = filtered.filter(r => r.ar2Status.toLowerCase().includes('probation')).length;
        const ar2Disq = filtered.filter(r => r.ar2Status.toLowerCase().includes('dismiss') || r.ar2Status.toLowerCase().includes('disqualif')).length;
        const ar2Dates = [...new Set(filtered.filter(r => r.ar2Date).map(r => r.ar2Date))].sort();

        const finalGood = isDlProgram
            ? filtered.filter(r => (r.secondaryStatus || '').toLowerCase().trim() === 'active' && r.finalStatus.toLowerCase().includes('good standing')).length
            : filtered.filter(r => r.finalStatus.toLowerCase().includes('good standing')).length;

        const finalProb = filtered.filter(r => r.finalStatus.toLowerCase().includes('probation')).length;

        const finalDisq = isDlProgram
            ? filtered.filter(r => (r.secondaryStatus || '').toLowerCase().trim() === 'failed').length
            : filtered.filter(r => r.finalStatus.toLowerCase().includes('dismiss') || r.finalStatus.toLowerCase().includes('disqualif')).length;

        // Final Disqualified KPI card
        const finalDisqActive = isDlProgram
            // DBA DL: count rows where upGrad Learner Status = 'Failed'
            ? filtered.filter(r => (r.secondaryStatus || '').toLowerCase().trim() === 'failed').length
            : filtered.filter(r => {
                const isDisq = r.finalStatus.toLowerCase().includes('dismiss') || r.finalStatus.toLowerCase().includes('disqualif');
                if (isDbaStrict) {
                    const ss = (r.secondaryStatus || '').toLowerCase().trim();
                    const isEligible = ss === 'active' || ss === 'active / deferred in' || ss === 'disqualified';
                    return isEligible && isDisq;
                }
                return isDisq;
            }).length;

        const avgCgpa = filtered.filter(r => r.overallCgpa !== null).reduce((s, r) => s + (r.overallCgpa ?? 0), 0) /
            (filtered.filter(r => r.overallCgpa !== null).length || 1);

        // Count unique learners across ALL statuses (not filtered to active/disqualified)
        const totalAllStatuses = (() => {
            const emails = new Set<string>();
            for (const row of rows) {
                const email = (
                    v(row, 'Email ID') ||
                    v(row, 'GGU Email ID') ||
                    v(row, 'GGU Student Email ID') ||
                    v(row, 'Email') || ''
                ).trim().toLowerCase();
                if (email) emails.add(email);
            }
            return emails.size;
        })();

        return {
            total, activeCount, avgCgpa, totalAllStatuses,
            ar1Good, ar1Prob, ar1Disq, ar1Dates,
            qeGood, qeProb, qeDisq,
            ar2Good, ar2Prob, ar2Disq, ar2Dates,
            finalGood, finalProb, finalDisq, finalDisqActive
        };
    }, [filteredRows, rows]);

    /* Per-cohort AR summary (for the cohort table) */
    const cohortSummaries = useMemo(() => {
        const map = new Map<string, { cohortNum: string; total: number; active: number; ar1Good: number; ar1Prob: number; ar1Disq: number; ar1Date: string; ar2Good: number; ar2Prob: number; ar2Date: string; finalGood: number; finalDisq: number }>();

        // 1. Initial pass over RAW rows to discover all cohorts (by Label) and set Total counts
        for (const row of rows) {
            const cohortId = v(row, 'Cohort ID') || v(row, 'Cohort');
            if (!cohortId) continue;
            const cohortNum = cohortIdToNumMap.get(cohortId) || cohortId;

            if (!map.has(cohortNum)) {
                map.set(cohortNum, {
                    cohortNum: cohortNum,
                    total: 0, active: 0, ar1Good: 0, ar1Prob: 0, ar1Disq: 0, ar1Date: '', ar2Good: 0, ar2Prob: 0, ar2Date: '', finalGood: 0, finalDisq: 0
                });
            }
            map.get(cohortNum)!.total++;
        }

        // 2. Second pass over filteredRows to populate Active counts and AR metrics
        for (const r of filteredRows) {
            if (!r.cohortId) continue;
            const cohortNum = r.cohortNum;
            if (!map.has(cohortNum)) continue;

            const g = map.get(cohortNum)!;
            g.active++;

            if (r.ar1Status.toLowerCase().includes('good standing')) g.ar1Good++;
            if (r.ar1Status.toLowerCase().includes('probation')) g.ar1Prob++;
            if (r.ar1Status.toLowerCase().includes('dismiss') || r.ar1Status.toLowerCase().includes('disqualif')) g.ar1Disq++;
            if (r.ar1Date && !g.ar1Date && parseARDate(r.ar1Date)) g.ar1Date = r.ar1Date;

            if (r.ar2Status.toLowerCase().includes('good standing')) g.ar2Good++;
            if (r.ar2Status.toLowerCase().includes('probation')) g.ar2Prob++;
            if (r.ar2Date && !g.ar2Date && parseARDate(r.ar2Date)) g.ar2Date = r.ar2Date;

            if (r.finalStatus.toLowerCase().includes('good standing')) g.finalGood++;
            if (r.finalStatus.toLowerCase().includes('dismiss') || r.finalStatus.toLowerCase().includes('disqualif')) g.finalDisq++;
        }

        // Filter out cohorts that have 0 active/filtered learners if any filters are applied
        let results = Array.from(map.values());
        if (searchText || selectedCohorts.length > 0 || selectedAR1Status.length > 0 || selectedQEStatus.length > 0 || selectedAR2Status.length > 0 || selectedFinalStatus.length > 0) {
            results = results.filter(cs => cs.active > 0);
        }

        return results.sort((a, b) => a.cohortNum.localeCompare(b.cohortNum, undefined, { numeric: true, sensitivity: 'base' }));
    }, [filteredRows, rows, cohortIdToNumMap, searchText, selectedCohorts, selectedAR1Status, selectedQEStatus, selectedAR2Status, selectedFinalStatus]);

    /* Upcoming dates: derived from data, only show future dates (or within selected range) */
    const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
    
    // Fetch AR dates sheet and construct date ranges
    const { rows: arDatesRows, loading: arDatesLoading } = useARDatesData();
    const [selectedDateRange, setSelectedDateRange] = useState<string>('');

    const arDateRanges = useMemo(() => {
        if (!arDatesRows || arDatesRows.length < 2) return [];
        // Extract unique dates
        const dates = arDatesRows.map(r => v(r, 'Academic Review Date') || '').filter(Boolean);
        const uniqueDates = [...new Set(dates)];
        
        uniqueDates.sort((a, b) => {
            const da = parseARDate(a);
            const db = parseARDate(b);
            if (!da || !db) return 0;
            return da.getTime() - db.getTime();
        });

        const fmtDate = (dStr: string) => {
            const d = parseARDate(dStr);
            if (!d) return dStr;
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
        };

        const ranges: string[] = [];
        for (let i = 0; i < uniqueDates.length - 1; i++) {
            ranges.push(`${fmtDate(uniqueDates[i])} - ${fmtDate(uniqueDates[i + 1])}`);
        }
        return ranges;
    }, [arDatesRows]);

    const upcomingARDates = useMemo(() => {
        const items: Array<{ cohort: string; arLabel: string; date: string; type: 'ar1' | 'ar2'; daysAway: number }> = [];
        
        let rangeStart: Date | null = null;
        let rangeEnd: Date | null = null;
        if (selectedDateRange) {
            const parts = selectedDateRange.split(' - ');
            if (parts.length === 2) {
                rangeStart = parseARDate(parts[0]);
                rangeEnd = parseARDate(parts[1]);
                if (rangeStart) rangeStart.setHours(0, 0, 0, 0);
                if (rangeEnd) rangeEnd.setHours(23, 59, 59, 999);
            }
        }

        for (const cs of cohortSummaries) {
            const check = (dateStr: string, type: 'ar1' | 'ar2') => {
                const d = parseARDate(dateStr);
                if (!d) return;
                d.setHours(0, 0, 0, 0);
                
                let include = false;
                if (rangeStart && rangeEnd) {
                    if (d >= rangeStart && d <= rangeEnd) include = true;
                } else {
                    if (d >= today) include = true;
                }

                if (include) {
                    const daysAway = Math.round((d.getTime() - today.getTime()) / 86400000);
                    items.push({ cohort: cs.cohortNum, arLabel: type === 'ar1' ? 'Academic Review 1' : 'Academic Review 2', date: dateStr, type, daysAway });
                }
            };
            check(cs.ar1Date, 'ar1');
            check(cs.ar2Date, 'ar2');
        }
        return items.sort((a, b) => a.daysAway - b.daysAway);
    }, [cohortSummaries, today, selectedDateRange]);

    /* Pagination */
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / entriesPerPage));
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * entriesPerPage;
    const endIdx = Math.min(startIdx + entriesPerPage, filteredRows.length);
    const pageRows = filteredRows.slice(startIdx, endIdx);

    const clearAllFilters = () => {
        setSearchText(''); setSelectedCohorts([]); setSelectedSecondaryStatuses([]);
        setSelectedAR1Status([]); setSelectedQEStatus([]); setSelectedAR2Status([]); setSelectedFinalStatus([]);
        setCurrentPage(1);
    };

    const handleExportCSV = () => {
        if (selectedExportColumns.length === 0) return;
        const headers = selectedExportColumns;

        const csvRows = filteredRows.map(r => {
            const rowMap: Record<string, any> = {
                'Email ID': r.email,
                'upGrad ID': r.upgradId,
                'GGU ID': r.gguId,
                'Cohort ID': r.cohortId,
                '1st Academic Review CGPA': r.ar1Cgpa !== null ? r.ar1Cgpa : '',
                '1st Academic Review Status': r.ar1Status,
                '2nd Academic Review CGPA': r.ar2Cgpa !== null ? r.ar2Cgpa : '',
                'Final Academic Review': r.finalStatus
            };
            
            const cols = selectedExportColumns.map(col => rowMap[col]);
            return cols.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',');
        });

        const csvContent = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `academic_review_export_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowExportModal(false);
    };

    const arStatusOptions = ['Good Standing', 'Probation', 'Disqualified'];
    const finalStatusOptions = ['Good Standing', 'Disqualified'];


    const loading = arLoading;

    return (
        <>
            <div className="acad-page" onClick={() => setOpenDropdown(null)}>
                {/* ─── Header ─── */}
            <div className="mb-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Coursework Phase</h1>
                        <p className="text-gray-600">Track CGPA trends, academic review outcomes, and standing status across cohorts</p>
                    </div>
                </div>
            </div>

            {/* ─── Loading ─── */}
            {loading && (
                <div className="acad-loading">
                    <div className="acad-spinner" />
                    <span>Loading Academic Performance Data...</span>
                </div>
            )}

            {/* ─── Error ─── */}
            {arError && !loading && (
                <div className="acad-error">
                    <i className="fas fa-exclamation-triangle" />
                    <span>{arError}</span>
                </div>
            )}

            {/* ─── Only DBA / DBA ET / DBA DL ─── */}
            {programId !== 'dba-et' && programId !== 'dba' && programId !== 'dba-dl' && !loading && (
                <div className="acad-not-available">
                    <i className="fas fa-lock" />
                    <h2>Not Available</h2>
                    <p>Academic Performance tracking is only available for fixed-curriculum DBA programs.</p>
                </div>
            )}

            {!loading && (programId === 'dba-et' || programId === 'dba' || programId === 'dba-dl') && (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <KpiCard icon="fa-users" label="Total Learners" value={analytics.totalAllStatuses}
                            sublabel="Total Learners" color="#6b7280" gradFrom="#9ca3af" gradTo="#6b7280" />
                        <KpiCard icon="fa-user-check" label="Active Learners" value={analytics.total}
                            sublabel="Active" color="#2563eb" gradFrom="#60a5fa" gradTo="#2563eb" />
                        <KpiCard icon="fa-medal" label="Final Good Standing" value={analytics.finalGood}
                            sublabel="End of Course 7" color="#10b981" gradFrom="#34d399" gradTo="#10b981" />
                        <KpiCard icon="fa-times-circle" label="Final Disqualified" value={analytics.finalDisqActive}
                            sublabel="Active & Disqualified" color="#be123c" gradFrom="#fda4af" gradTo="#be123c" />
                    </div>

                    {/* Filter Console - Always Visible */}
                    <div className="acad-filter-console mb-8 dark:bg-slate-900/60 dark:border-white/10 dark:backdrop-blur-xl" onClick={e => e.stopPropagation()}>
                        <div className="acad-filter-console-header">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-800/50">
                                    <i className="fas fa-sliders-h" style={{ fontSize: 18 }} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">Academic Review Filter Console</h3>
                                    <p className="text-xs text-gray-500 dark:text-slate-400">Search and filter across all review stages</p>
                                </div>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="acad-search-wrap">
                            <i className="fas fa-search acad-search-icon" />
                            <input
                                className="acad-search-input"
                                value={searchText}
                                onChange={e => { setSearchText(e.target.value); setCurrentPage(1); }}
                                placeholder="Search by name, email, cohort..."
                            />
                            {searchText && (
                                <button className="acad-search-clear" onClick={() => { setSearchText(''); setCurrentPage(1); }}>
                                    <i className="fas fa-times" />
                                </button>
                            )}
                        </div>

                        {/* Dropdowns */}
                        <div className="acad-filters-row">
                            <FilterDropdown
                                label="Cohort"
                                iconClass="fas fa-users-cog"
                                placeholder="All Cohorts"
                                values={cohorts}
                                selected={selectedCohorts}
                                onToggle={(v) => {
                                    setCurrentPage(1);
                                    setSelectedCohorts(selectedCohorts.includes(v) ? selectedCohorts.filter(x => x !== v) : [...selectedCohorts, v]);
                                }}
                                isOpen={openDropdown === 'cohort'}
                                setIsOpen={(open) => setOpenDropdown(open ? 'cohort' : null)}
                            />

                            <FilterDropdown
                                label="Secondary Status"
                                iconClass="fas fa-tag"
                                placeholder="All Statuses"
                                values={secondaryStatuses}
                                selected={selectedSecondaryStatuses}
                                onToggle={(v) => {
                                    setCurrentPage(1);
                                    setSelectedSecondaryStatuses(selectedSecondaryStatuses.includes(v) ? selectedSecondaryStatuses.filter(x => x !== v) : [...selectedSecondaryStatuses, v]);
                                }}
                                isOpen={openDropdown === 'secondary_status'}
                                setIsOpen={(open) => setOpenDropdown(open ? 'secondary_status' : null)}
                            />

                            <FilterDropdown
                                label="AR1 Status"
                                iconClass="fas fa-clipboard-check"
                                placeholder="All AR1"
                                values={arStatusOptions}
                                selected={selectedAR1Status}
                                onToggle={(v) => {
                                    setCurrentPage(1);
                                    setSelectedAR1Status(selectedAR1Status.includes(v) ? selectedAR1Status.filter(x => x !== v) : [...selectedAR1Status, v]);
                                }}
                                isOpen={openDropdown === 'ar1'}
                                setIsOpen={(open) => setOpenDropdown(open ? 'ar1' : null)}
                            />

                            {programId === 'dba' && (
                                <FilterDropdown
                                    label="QE Status"
                                    iconClass="fas fa-microscope"
                                    placeholder="All QE"
                                    values={arStatusOptions}
                                    selected={selectedQEStatus}
                                    onToggle={(v) => {
                                        setCurrentPage(1);
                                        setSelectedQEStatus(selectedQEStatus.includes(v) ? selectedQEStatus.filter(x => x !== v) : [...selectedQEStatus, v]);
                                    }}
                                    isOpen={openDropdown === 'qe'}
                                    setIsOpen={(open) => setOpenDropdown(open ? 'qe' : null)}
                                />
                            )}

                            <FilterDropdown
                                label="AR2 Status"
                                iconClass="fas fa-clipboard-check"
                                placeholder="All AR2"
                                values={arStatusOptions}
                                selected={selectedAR2Status}
                                onToggle={(v) => {
                                    setCurrentPage(1);
                                    setSelectedAR2Status(selectedAR2Status.includes(v) ? selectedAR2Status.filter(x => x !== v) : [...selectedAR2Status, v]);
                                }}
                                isOpen={openDropdown === 'ar2'}
                                setIsOpen={(open) => setOpenDropdown(open ? 'ar2' : null)}
                            />

                            <FilterDropdown
                                label="Final AR Status"
                                iconClass="fas fa-graduation-cap"
                                placeholder="All Final"
                                values={finalStatusOptions}
                                selected={selectedFinalStatus}
                                onToggle={(v) => {
                                    setCurrentPage(1);
                                    setSelectedFinalStatus(selectedFinalStatus.includes(v) ? selectedFinalStatus.filter(x => x !== v) : [...selectedFinalStatus, v]);
                                }}
                                isOpen={openDropdown === 'final'}
                                setIsOpen={(open) => setOpenDropdown(open ? 'final' : null)}
                            />
                        </div>

                        {/* Active filters */}
                        <div className="acad-filter-footer">
                            <div className="acad-active-tags">
                                <span className="acad-active-label">Active Filters:</span>
                                {(searchText || selectedCohorts.length > 0 || selectedSecondaryStatuses.length > 0 || selectedAR1Status.length > 0 || selectedAR2Status.length > 0 || selectedFinalStatus.length > 0) ? (
                                    <>
                                        {searchText && <span className="acad-tag acad-tag-blue">"{searchText}"</span>}
                                        {selectedCohorts.map(c => <span key={c} className="acad-tag acad-tag-green">Cohort {c}</span>)}
                                        {selectedSecondaryStatuses.map(s => <span key={s} className="acad-tag acad-tag-blue">Status: {s}</span>)}
                                        {selectedAR1Status.map(s => <span key={s} className="acad-tag acad-tag-purple">AR1: {s}</span>)}
                                        {selectedAR2Status.map(s => <span key={s} className="acad-tag acad-tag-purple">AR2: {s}</span>)}
                                        {selectedFinalStatus.map(s => <span key={s} className="acad-tag acad-tag-orange">Final: {s}</span>)}
                                    </>
                                ) : <span className="acad-no-filters">None applied</span>}
                            </div>
                            <button className="acad-reset-btn" onClick={clearAllFilters}>
                                <i className="fas fa-sync-alt" /> Reset Filters
                            </button>
                        </div>
                    </div>

                    {/* ─── Tabs ─── */}
                    <div className="acad-tabs">
                        <button
                            className={`acad-tab ${activeTab === 'overview' ? 'acad-tab-active' : ''}`}
                            onClick={() => setActiveTab('overview')}
                        >
                            <i className="fas fa-chart-pie" />
                            Overview
                        </button>
                        <button
                            className={`acad-tab ${activeTab === 'academic-review' ? 'acad-tab-active' : ''}`}
                            onClick={() => setActiveTab('academic-review')}
                        >
                            <i className="fas fa-clipboard-list" />
                            Academic Review
                            {filteredRows.length > 0 && (
                                <span className="acad-tab-badge">{filteredRows.length}</span>
                            )}
                        </button>
                    </div>

                    {/* ══════════ OVERVIEW TAB ══════════ */}
                    {activeTab === 'overview' && (
                        <>

                            {/* Upcoming Dates Section */}
                            <div className="acad-section-card">
                                <div className="acad-section-header" style={{ display: 'flex', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                        <div className="acad-section-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                                            <i className="fas fa-calendar-check" />
                                        </div>
                                        <div>
                                            <h2 className="acad-section-title">Upcoming Academic Review Dates</h2>
                                            <p className="acad-section-sub">Scheduled review dates from today onward — sorted by proximity</p>
                                        </div>
                                    </div>
                                    
                                    {/* Date Range Dropdown */}
                                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Date Range:</label>
                                        {arDatesLoading ? (
                                            <span style={{ fontSize: 13, color: '#9ca3af' }}>Loading...</span>
                                        ) : (
                                            <select
                                                className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm rounded-lg px-2 py-1 outline-none text-gray-700 dark:text-gray-200 shadow-sm"
                                                value={selectedDateRange}
                                                onChange={e => setSelectedDateRange(e.target.value)}
                                            >
                                                <option value="">All Upcoming</option>
                                                {arDateRanges.map(dr => <option key={dr} value={dr}>{dr}</option>)}
                                            </select>
                                        )}
                                    </div>
                                </div>
                                {upcomingARDates.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No upcoming review dates found in the data.</p>
                                ) : (
                                    <div className={`grid grid-cols-1 ${upcomingARDates.some(ud => ud.type === 'ar1') && upcomingARDates.some(ud => ud.type === 'ar2') ? 'lg:grid-cols-2 lg:gap-8' : ''} gap-6 mt-4 items-start`}>
                                        {upcomingARDates.some(ud => ud.type === 'ar1') && (
                                            <div className="w-full">
                                                <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 mb-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-2">Academic Review 1</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {upcomingARDates.filter(ud => ud.type === 'ar1').map(ud => (
                                                        <UpcomingCard key={`${ud.cohort}-${ud.type}`} cohort={ud.cohort}
                                                            date={ud.date} cgpaReq="3.0+"
                                                            type={ud.type} daysAway={ud.daysAway} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {upcomingARDates.some(ud => ud.type === 'ar2') && (
                                            <div className="w-full">
                                                <h3 className="text-sm font-bold text-purple-700 dark:text-purple-400 mb-3 border-b border-purple-100 dark:border-purple-900/40 pb-2">Academic Review 2</h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {upcomingARDates.filter(ud => ud.type === 'ar2').map(ud => (
                                                        <UpcomingCard key={`${ud.cohort}-${ud.type}`} cohort={ud.cohort}
                                                            date={ud.date} cgpaReq="3.0+"
                                                            type={ud.type} daysAway={ud.daysAway} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Cohort AR Status Summary Table */}
                                {cohortSummaries.length > 0 && (
                                    <>
                                        <div style={{ margin: '20px 0 10px', paddingTop: 16, borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <i className="fas fa-table" style={{ color: '#6366f1', fontSize: 14 }} />
                                            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-primary)' }}>Cohort AR Status Summary</span>
                                        </div>
                                        <div className="acad-table-wrap">
                                            <table className="acad-table">
                                                <thead>
                                                    <tr>
                                                        <th>Cohort #</th>
                                                        <th style={{ textAlign: 'center' }}>Total</th>
                                                        <th style={{ textAlign: 'center' }}>Active</th>
                                                        <th style={{ textAlign: 'center' }}>AR1 Date</th>
                                                        <th style={{ textAlign: 'center' }}>AR1 Good</th>
                                                        <th style={{ textAlign: 'center' }}>AR1 Prob.</th>
                                                        <th style={{ textAlign: 'center' }}>AR1 Disq.</th>
                                                        <th style={{ textAlign: 'center' }}>AR2 Date</th>
                                                        <th style={{ textAlign: 'center' }}>AR2 Good</th>
                                                        <th style={{ textAlign: 'center' }}>AR2 Prob.</th>
                                                        <th style={{ textAlign: 'center' }}>Final Good</th>
                                                        <th style={{ textAlign: 'center' }}>Final Disq.</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {cohortSummaries.map(cs => (
                                                        <tr key={cs.cohortNum} className="acad-table-row">
                                                            <td><span className="acad-cohort-badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px', fontSize: '10px' }}>{cs.cohortNum}</span></td>
                                                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{cs.total}</td>
                                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#10b981', fontWeight: 800 }}>{cs.active}</span></td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                {(() => {
                                                                    if (!cs.ar1Date) return '—';
                                                                    const p = parseARDate(cs.ar1Date);
                                                                    if (!p) return <span className="acad-date-pill">{formatDateForDisplay(cs.ar1Date)}</span>;
                                                                    p.setHours(0, 0, 0, 0);
                                                                    const passed = p <= today;
                                                                    return <span className="acad-date-pill shadow-sm" style={{ backgroundColor: passed ? '#dcfce7' : '#fef9c3', color: passed ? '#059669' : '#d97706', border: `1px solid ${passed ? '#10b98130' : '#f59e0b30'}`, fontSize: '11px' }}>{formatDateForDisplay(cs.ar1Date)}</span>;
                                                                })()}
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#10b981', fontWeight: 800 }}>{cs.ar1Good}</span></td>
                                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#f59e0b', fontWeight: 800 }}>{cs.ar1Prob}</span></td>
                                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#ef4444', fontWeight: 800 }}>{cs.ar1Disq}</span></td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                {(() => {
                                                                    if (!cs.ar2Date) return '—';
                                                                    const p = parseARDate(cs.ar2Date);
                                                                    if (!p) return <span className="acad-date-pill">{formatDateForDisplay(cs.ar2Date)}</span>;
                                                                    p.setHours(0, 0, 0, 0);
                                                                    const passed = p <= today;
                                                                    return <span className="acad-date-pill shadow-sm" style={{ backgroundColor: passed ? '#dcfce7' : '#fef9c3', color: passed ? '#059669' : '#d97706', border: `1px solid ${passed ? '#10b98130' : '#f59e0b30'}`, fontSize: '11px' }}>{formatDateForDisplay(cs.ar2Date)}</span>;
                                                                })()}
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#10b981', fontWeight: 800 }}>{cs.ar2Good}</span></td>
                                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#f59e0b', fontWeight: 800 }}>{cs.ar2Prob}</span></td>
                                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#6366f1', fontWeight: 800 }}>{cs.finalGood}</span></td>
                                                            <td style={{ textAlign: 'center' }}><span style={{ color: '#ef4444', fontWeight: 800 }}>{cs.finalDisq}</span></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* AR Breakdown Analytics */}
                            <div className="acad-section-card">
                                <div className="acad-section-header">
                                    <div className="acad-section-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                                        <i className="fas fa-chart-bar" />
                                    </div>
                                    <div>
                                        <h2 className="acad-section-title">Academic Review Breakdown</h2>
                                        <p className="acad-section-sub">Standing distribution and phase completion rates</p>
                                    </div>
                                </div>
                                <div className={`grid grid-cols-1 ${programId === 'dba' ? 'lg:grid-cols-2' : 'lg:grid-cols-3'} gap-6`}>
                                    <ARBreakdownCard
                                        title="Academic Review 1"
                                        step="AR 1"
                                        color="#6366f1"
                                        good={analytics.ar1Good}
                                        probation={analytics.ar1Prob}
                                        disqualified={analytics.ar1Disq}
                                    />
                                    {programId === 'dba' && (
                                        <ARBreakdownCard
                                            title="QE Review"
                                            step="QE"
                                            color="#ec4899"
                                            good={analytics.qeGood}
                                            probation={analytics.qeProb}
                                            disqualified={analytics.qeDisq}
                                        />
                                    )}
                                    <ARBreakdownCard
                                        title="Academic Review 2"
                                        step="AR 2"
                                        color="#8b5cf6"
                                        good={analytics.ar2Good}
                                        probation={analytics.ar2Prob}
                                        disqualified={analytics.ar2Disq}
                                    />
                                    <ARBreakdownCard
                                        title="Final Academic Review"
                                        step="Final"
                                        color="#10b981"
                                        good={analytics.finalGood}
                                        probation={analytics.finalProb}
                                        disqualified={analytics.finalDisq}
                                        hideProbation={true}
                                    />
                                </div>
                            </div>

                            {/* Summary bar */}
                            <div className="acad-summary-bar">
                                <div className="acad-summary-left">
                                    <i className="fas fa-info-circle" style={{ color: '#6366f1', marginRight: 8 }} />
                                    <span>Academic Standing Summary — </span>
                                    <strong style={{ marginLeft: 4 }}>{analytics.total} learners tracked across all reviews</strong>
                                </div>
                                <div className="acad-summary-stats">
                                    <div className="acad-summary-stat">
                                        <span className="acad-summary-val" style={{ color: '#22c55e' }}>{analytics.finalGood}</span>
                                        <span className="acad-summary-lbl">Final Good Standing</span>
                                    </div>
                                    <div className="acad-summary-divider" />
                                    <div className="acad-summary-stat">
                                        <span className="acad-summary-val" style={{ color: '#ef4444' }}>{analytics.finalDisq}</span>
                                        <span className="acad-summary-lbl">Disqualified</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* ══════════ ACADEMIC REVIEW TAB ══════════ */}
                    {activeTab === 'academic-review' && (
                        <div className="acad-table-section" onClick={() => setOpenDropdown(null)}>
                            {/* Empty state */}
                            {rows.length === 0 && !arLoading && (
                                <div className="acad-empty">
                                    <i className="fas fa-clipboard-list" />
                                    <h3>No Academic Review Data</h3>
                                    <p>The "Academic Review" sheet tab has no data or could not be loaded.</p>
                                    <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
                                        Make sure the sheet tab is named exactly: <strong>"Academic Review"</strong>
                                    </p>
                                </div>
                            )}

                            {rows.length > 0 && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

                                    {/* Table Toolbar */}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
                                        <button 
                                            onClick={() => setShowExportModal(true)} 
                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-semibold py-2 px-4 rounded-lg transition-colors border border-indigo-100 shadow-sm flex items-center gap-2"
                                            title="Export displayed learners to CSV"
                                        >
                                            <i className="fas fa-download" />
                                            Export CSV
                                        </button>
                                    </div>

                                    {/* Table */}
                                    <div className="acad-table-wrap">
                                        <table className="acad-table">
                                            <thead>
                                                <tr>
                                                    <th style={{ width: 40 }}>#</th>
                                                    <th>Learner</th>
                                                    <th style={{ textAlign: 'center' }}>Cohort #</th>
                                                    <th style={{ textAlign: 'center' }}>Status</th>
                                                    <th style={{ textAlign: 'center' }}>Overall CGPA</th>
                                                    <th style={{ textAlign: 'center' }}>Courses</th>
                                                    <th style={{ textAlign: 'center' }}>AR1 CGPA</th>
                                                    <th style={{ textAlign: 'center' }}>AR1 Status</th>
                                                    {programId === 'dba' && <th style={{ textAlign: 'center' }}>QE Review</th>}
                                                    <th style={{ textAlign: 'center' }}>AR2 CGPA</th>
                                                    <th style={{ textAlign: 'center' }}>AR2 Status</th>
                                                    <th style={{ textAlign: 'center' }}>Final AR</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pageRows.length === 0 && (
                                                    <tr>
                                                        <td colSpan={programId === 'dba' ? 12 : 11} className="acad-table-empty">
                                                            <i className="fas fa-inbox" style={{ fontSize: 28, opacity: 0.4, display: 'block', marginBottom: 8 }} />
                                                            No learners match the current filters
                                                        </td>
                                                    </tr>
                                                )}
                                                {pageRows.map((r, idx) => (
                                                    <tr key={`${r.gguId}-${r.cohortId}-${idx}`} className="acad-table-row">
                                                        <td className="acad-td-num">{startIdx + idx + 1}</td>
                                                        <td>
                                                            <div className="acad-td-name">{r.fullName || '—'}</div>
                                                            <div className="acad-td-email">{r.email || '—'}</div>
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}><span className="acad-cohort-badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '10px' }}>{r.cohortNum || '—'}</span></td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            {r.secondaryStatus ? (
                                                                <span style={{
                                                                    display: 'inline-block',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '9999px',
                                                                    fontSize: '10px',
                                                                    fontWeight: 700,
                                                                    whiteSpace: 'nowrap',
                                                                    backgroundColor:
                                                                        r.secondaryStatus.toLowerCase().includes('active') ? 'rgba(16,185,129,0.1)' :
                                                                        r.secondaryStatus.toLowerCase().includes('disqualif') ? 'rgba(239,68,68,0.1)' :
                                                                        r.secondaryStatus.toLowerCase().includes('graduated') ? 'rgba(99,102,241,0.1)' :
                                                                        'rgba(156,163,175,0.15)',
                                                                    color:
                                                                        r.secondaryStatus.toLowerCase().includes('active') ? '#10b981' :
                                                                        r.secondaryStatus.toLowerCase().includes('disqualif') ? '#ef4444' :
                                                                        r.secondaryStatus.toLowerCase().includes('graduated') ? '#6366f1' :
                                                                        '#6b7280',
                                                                    border: `1px solid ${
                                                                        r.secondaryStatus.toLowerCase().includes('active') ? '#10b98130' :
                                                                        r.secondaryStatus.toLowerCase().includes('disqualif') ? '#ef444430' :
                                                                        r.secondaryStatus.toLowerCase().includes('graduated') ? '#6366f130' :
                                                                        '#9ca3af30'
                                                                    }`,
                                                                }}>{r.secondaryStatus}</span>
                                                            ) : '—'}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}><GPABadge gpa={r.overallCgpa} /></td>
                                                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#6366f1' }}>{r.coursesCompleted || '—'}</td>
                                                        <td style={{ textAlign: 'center' }}><GPABadge gpa={r.ar1Cgpa} /></td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            {r.ar1Status ? <ARStatusPill status={r.ar1Status} /> : '—'}
                                                        </td>
                                                        {programId === 'dba' && (
                                                            <td style={{ textAlign: 'center' }}>
                                                                {r.qeStatus ? <ARStatusPill status={r.qeStatus} /> : '—'}
                                                            </td>
                                                        )}
                                                        <td style={{ textAlign: 'center' }}><GPABadge gpa={r.ar2Cgpa} /></td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            {r.ar2Status ? <ARStatusPill status={r.ar2Status} /> : '—'}
                                                        </td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            {r.finalStatus ? <ARStatusPill status={r.finalStatus} /> : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination bottom */}
                                    <div className="acad-pagination-bottom">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                            <div className="acad-entries-sel">
                                                Show
                                                <select value={entriesPerPage} onChange={e => { setEntriesPerPage(Number(e.target.value)); setCurrentPage(1); }}>
                                                    <option value={10}>10</option>
                                                    <option value={25}>25</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                </select>
                                                entries
                                            </div>
                                            <p className="acad-results-info">
                                                Showing <strong>{filteredRows.length > 0 ? startIdx + 1 : 0}</strong> – <strong>{endIdx}</strong> of <strong>{filteredRows.length}</strong>
                                            </p>
                                        </div>
                                        {totalPages > 1 && (
                                            <div className="acad-page-controls">
                                                <button disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)} className="acad-page-btn">
                                                    <i className="fas fa-chevron-left" />
                                                </button>
                                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                                                    .map((p, i, arr) => (
                                                        <>
                                                            {i > 0 && arr[i - 1] < p - 1 && <span key={`e${p}`} className="acad-page-ellipsis">…</span>}
                                                            <button
                                                                key={p}
                                                                onClick={() => setCurrentPage(p)}
                                                                className={`acad-page-btn ${p === safePage ? 'acad-page-active' : ''}`}
                                                            >{p}</button>
                                                        </>
                                                    ))}
                                                <button disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)} className="acad-page-btn">
                                                    <i className="fas fa-chevron-right" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Legend */}
                                    <div className="acad-legend">
                                        <h4 className="acad-legend-title">Academic Standing Legend</h4>
                                        <div className="acad-legend-items">
                                            <div className="acad-legend-item"><ARStatusPill status="Good Standing" /> Maintaining required CGPA (≥3.0)</div>
                                            <div className="acad-legend-item"><ARStatusPill status="Probation" /> CGPA below required threshold</div>
                                            <div className="acad-legend-item"><ARStatusPill status="Academic Dismissal" /> At risk of program dismissal</div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>

        {/* Export Modal */}
        {showExportModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowExportModal(false)} />
                <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-[32px] shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[85vh] border border-white/10">
                    {/* Modal Header */}
                    <div className="px-8 py-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white dark:from-gray-900/50 dark:to-gray-800">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Export Academic Review</h2>
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
                        <div className="grid grid-cols-2 gap-3">
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
        </>
    );
}
