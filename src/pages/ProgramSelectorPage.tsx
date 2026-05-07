import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { PROGRAMS } from '../lib/config';
import { useProgramStats } from '../hooks/useProgramStats';

interface Program {
    id: string;
    name: string;
    fullName: string;
    description: string;
    icon: string;
    gradient: string;
    available: boolean;
}

interface University {
    id: string;
    name: string;
    fullName: string;
    location: string;
    accentColor: string;
    programs: Program[];
}

const universities: University[] = [
    {
        id: 'ggu',
        name: 'Golden Gate University',
        fullName: 'Golden Gate University',
        location: 'San Francisco, USA',
        accentColor: '#6366f1',
        programs: [
            {
                id: 'dba-et',
                name: 'Doctor of Business Administration in Emerging Technologies',
                fullName: 'Doctor of Business Administration in Emerging Technologies',
                description: 'Research at the intersection of leadership and disruptive innovation.',
                icon: 'fas fa-microchip',
                gradient: 'from-blue-600 to-indigo-600',
                available: true,
            },
            {
                id: 'dba',
                name: 'Doctor of Business Administration',
                fullName: 'Doctor of Business Administration',
                description: 'Elite executive practice through rigorous applied research.',
                icon: 'fas fa-user-graduate',
                gradient: 'from-rose-500 to-orange-600',
                available: true,
            },
            {
                id: 'mba',
                name: 'Master of Business Administration',
                fullName: 'Master of Business Administration',
                description: 'Strategic management and operational excellence.',
                icon: 'fas fa-briefcase',
                gradient: 'from-emerald-600 to-emerald-800',
                available: true,
            },
            {
                id: 'dba-dl',
                name: 'Doctor of Business Administration in Digital Leadership',
                fullName: 'Doctor of Business Administration in Digital Leadership',
                description: 'Transformative leadership at the intersection of digital strategy and organizational impact.',
                icon: 'fas fa-rocket',
                gradient: 'from-violet-500 to-purple-700',
                available: true,
            },
            {
                id: 'm-psych',
                name: 'Master in Psychology',
                fullName: 'Master in Psychology',
                description: 'Advanced study in psychological science and human behavior.',
                icon: 'fas fa-brain',
                gradient: 'from-fuchsia-600 to-pink-600',
                available: true,
            },
        ]
    },
    {
        id: 'psb',
        name: 'Paris School of Business',
        fullName: 'Paris School of Business',
        location: 'Paris, France',
        accentColor: '#ef4444',
        programs: [
            {
                id: 'psb-mba',
                name: 'Master of Business Administration',
                fullName: 'Master of Business Administration',
                description: 'Advanced global management insights from a European perspective.',
                icon: 'fas fa-graduation-cap',
                gradient: 'from-slate-700 to-slate-800',
                available: false,
            },
            {
                id: 'psb-mbmt',
                name: 'Master of Business Management & Technology',
                fullName: 'Master of Business Management & Technology',
                description: 'Bridging technical expertise with strategic business leadership.',
                icon: 'fas fa-network-wired',
                gradient: 'from-slate-700 to-slate-800',
                available: false,
            },
        ]
    },
    {
        id: 'esgci',
        name: 'ESGCI',
        fullName: 'École Supérieure de Gestion et de Commerce International',
        location: 'Paris, France',
        accentColor: '#10b981',
        programs: [
            {
                id: 'esgci-dba',
                name: 'Doctor of Business Administration',
                fullName: 'Doctor of Business Administration',
                description: 'Doctoral excellence in international commerce and management.',
                icon: 'fas fa-award',
                gradient: 'from-slate-700 to-slate-800',
                available: false,
            },
        ]
    },
    {
        id: 'edgewood',
        name: 'Edgewood University',
        fullName: 'Edgewood University',
        location: 'Madison, Wisconsin, USA',
        accentColor: '#f59e0b',
        programs: [
            {
                id: 'edgewood-dba',
                name: 'Doctor of Business Administration',
                fullName: 'Doctor of Business Administration',
                description: 'Focused on organizational leadership and professional advancement.',
                icon: 'fas fa-chart-line',
                gradient: 'from-slate-700 to-slate-800',
                available: false,
            },
            {
                id: 'edgewood-edd',
                name: 'Doctor of Education',
                fullName: 'Doctor of Education',
                description: 'Transformative leadership for educational institutions and systems.',
                icon: 'fas fa-chalkboard-teacher',
                gradient: 'from-slate-700 to-slate-800',
                available: false,
            },
        ]
    }
];

/* ─── Stat formatters ─── */
function formatCohorts(count: number): string {
    // Show (count - 1)+ so e.g. 12 → "11+"
    return `${Math.max(1, count - 1)}+`;
}

function formatLearners(count: number): string {
    // Floor to nearest 50 and add "+" so e.g. 881 → "850+"
    return `${Math.floor(count / 50) * 50}+`;
}

/* ─── Stat skeleton ─── */
function StatSkeleton() {
    return (
        <div className="h-4 w-10 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
    );
}

/* ─── Program card with live stats ─── */
function ProgramCard({ p, onNavigate }: { p: Program; onNavigate: (id: string, available: boolean) => void }) {
    // Only fetch stats for available programs that exist in PROGRAMS config
    const sheetId = p.available && PROGRAMS[p.id] ? PROGRAMS[p.id].sheetId : '';
    const { learnerCount, cohortCount, loading } = useProgramStats(sheetId);

    const showStats = p.available && !!PROGRAMS[p.id];

    return (
        <div
            className={`group relative bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-[2rem] p-6 transition-all duration-500 shadow-sm hover:shadow-xl ${p.available ? 'cursor-pointer hover:border-indigo-500/30 dark:hover:border-white/20 hover:bg-white dark:hover:bg-slate-900/80 hover:-translate-y-2 active:scale-[0.98]' : 'opacity-60 cursor-default'}`}
            onClick={() => onNavigate(p.id, p.available)}
        >
            <div className="flex items-start justify-between mb-6">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white text-xl shadow-xl transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
                    <i className={p.icon} />
                </div>
                {!p.available ? (
                    <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-gray-400 rounded-lg border border-slate-200 dark:border-white/5">
                        Coming Soon
                    </span>
                ) : (
                    <div className="flex items-center gap-2 text-[9px] font-black text-emerald-600 dark:text-emerald-500 uppercase tracking-widest px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        Active
                    </div>
                )}
            </div>

            <div className="mb-6">
                <h4 className="text-lg font-black text-slate-800 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{p.name}</h4>
                <p className="text-sm text-slate-500 dark:text-gray-500 font-medium leading-relaxed">{p.description}</p>
            </div>

            {showStats && (
                <div className="flex items-center gap-6 pt-6 border-t border-slate-100 dark:border-white/5">
                    {/* Cohorts */}
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 dark:text-gray-600 uppercase tracking-widest mb-1">Cohorts</div>
                        <div className="text-sm font-black text-slate-700 dark:text-gray-300">
                            {loading ? <StatSkeleton /> : (cohortCount !== null ? formatCohorts(cohortCount) : '—')}
                        </div>
                    </div>
                    {/* Learners */}
                    <div>
                        <div className="text-[10px] font-bold text-slate-400 dark:text-gray-600 uppercase tracking-widest mb-1">Learners</div>
                        <div className="text-sm font-black text-slate-700 dark:text-gray-300">
                            {loading ? <StatSkeleton /> : (learnerCount !== null ? formatLearners(learnerCount) : '—')}
                        </div>
                    </div>
                </div>
            )}

            {p.available && (
                <div className="mt-6 flex items-center justify-between text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                    <span>Initialize Dashboard</span>
                    <i className="fas fa-arrow-right" />
                </div>
            )}

            {/* Light Mode Hover Gradient */}
            <div className={`absolute inset-0 rounded-[2rem] bg-gradient-to-br from-indigo-50 to-white opacity-0 group-hover:opacity-10 dark:group-hover:opacity-0 transition-opacity duration-500 pointer-events-none`} />
        </div>
    );
}

export default function ProgramSelectorPage() {
    const navigate = useNavigate();

    const handleProgramClick = (programId: string, available: boolean) => {
        if (available) {
            navigate(`/${programId}/dashboard`);
        }
    };

    return (
        <div className="program-selector-page min-h-screen relative overflow-x-hidden bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
            {/* Minimalist Background Blobs */}
            <div className="fixed inset-0 z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-600/5 rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] dark:opacity-[0.05]" />
            </div>

            <header className="relative z-20 pt-8 pb-4">
                <div className="w-full px-8 flex items-center justify-between">
                    {/* Left: EduOps360 Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                            <i className="fas fa-graduation-cap text-lg" />
                        </div>
                        <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">
                            EduOps<span className="text-indigo-500">360</span>
                        </h1>
                    </div>

                    {/* Right: Theme Toggle */}
                    <ThemeToggle />
                </div>
            </header>

            <main className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
                <section className="mb-16 mt-12 text-center">
                    <h2 className="text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-6 leading-tight">
                        Program <span className="bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">Selector</span>
                    </h2>
                </section>

                <div className="grid grid-cols-1 gap-16">
                    {universities.map((uni) => (
                        <div key={uni.id} className="uni-section">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="h-8 w-1.5 rounded-full" style={{ backgroundColor: uni.accentColor }} />
                                <div className="flex flex-col">
                                    <h3 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">{uni.fullName}</h3>
                                    <span className="text-xs font-bold text-slate-400 dark:text-gray-500 uppercase tracking-[0.25em]">{uni.location}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {uni.programs.map((p) => (
                                    <ProgramCard key={p.id} p={p} onNavigate={handleProgramClick} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            <footer className="relative z-10 py-12 border-t border-slate-200 dark:border-white/5 text-center">
                <p className="text-[11px] font-bold text-slate-400 dark:text-gray-600 uppercase tracking-[0.4em]">
                    © 2026 EduOps360 · ADVANCED STUDENT LIFECYCLE MANAGEMENT
                </p>
            </footer>
        </div>
    );
}
