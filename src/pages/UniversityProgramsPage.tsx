import React, { useState } from 'react';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import { PROGRAMS } from '../lib/config';
import { useProgramStats } from '../hooks/useProgramStats';
import { useAuth } from '../hooks/useAuth';
import { UNIVERSITIES, hasProgramAccess, type University, type Program } from '../lib/universities';
import { useUniversityLearnerStats } from '../hooks/useUniversityLearnerStats';
import { useGGUOverviewAnalytics } from '../hooks/useGGUOverviewAnalytics';
import GGUOverallOverviewDashboard from '../components/GGUOverallOverviewDashboard';

/* ─── Per-university info ──────────────────────────────────────────────────── */
const UNI_META: Record<string, {
  code: string;
  icon: string;
  tagline: string;
  about: string;
  facts: { label: string; value: string }[];
  gradient: string;
}> = {
  ggu: {
    code: 'GGU',
    icon: 'fas fa-university',
    tagline: 'Pioneering Business Education Since 1901',
    about:
      `Golden Gate University is a private university in the heart of San Francisco, renowned for its professional and graduate programs in business, law, and taxation. GGU offers flexible, career-focused education designed for working professionals seeking to advance globally. In partnership with upGrad, GGU delivers world-class doctoral and master's programs to learners across India, Southeast Asia, and beyond.`,
    facts: [
      { label: 'Founded', value: '1901' },
      { label: 'Location', value: 'San Francisco, CA' },
    ],
    gradient: 'bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950',
  },
  psb: {
    code: 'PSB',
    icon: 'fas fa-graduation-cap',
    tagline: 'European Excellence in Management Education',
    about:
      `Paris School of Business is a leading French grande école consistently ranked among Europe's top business schools. PSB combines a strong international perspective with rigorous academic excellence, preparing future global leaders through innovative programs in management, technology, and entrepreneurship.`,
    facts: [
      { label: 'Founded', value: '1974' },
      { label: 'Location', value: 'Paris, France' },
    ],
    gradient: 'bg-gradient-to-r from-amber-900 via-slate-900 to-orange-950',
  },
  esgci: {
    code: 'ESG',
    icon: 'fas fa-globe-europe',
    tagline: 'International Commerce & Global Leadership',
    about:
      `ESGCI (Ecole Superieure de Gestion et de Commerce International) is a prestigious Paris-based business school specialising in international commerce and management, equipping students with the strategic mindset to lead in a globalised economy.`,
    facts: [
      { label: 'Founded', value: '1937' },
      { label: 'Location', value: 'Paris, France' },
    ],
    gradient: 'bg-gradient-to-r from-teal-900 via-slate-900 to-emerald-950',
  },
  edgewood: {
    code: 'EDGE',
    icon: 'fas fa-book-reader',
    tagline: 'Values-Driven Education for Modern Leaders',
    about:
      `Edgewood University in Madison, Wisconsin offers a mission-centred approach to higher education, blending strong liberal arts foundations with professional programs in education, business, and health sciences. Edgewood fosters servant leadership, ethical responsibility, and a commitment to learning as a lifelong endeavour.`,
    facts: [
      { label: 'Founded', value: '1927' },
      { label: 'Location', value: 'Madison, Wisconsin' },
    ],
    gradient: 'bg-gradient-to-r from-rose-900 via-slate-900 to-red-950',
  },
};

/* ─── Stat helpers ──────────────────────────────────────────────────────────── */
function formatLearners(n: number) { return `${Math.floor(n / 10) * 10}+`; }
function formatCohorts(n: number) { return `${Math.max(1, n - 1)}+`; }

function StatSkeleton() {
  return <span className="inline-block h-3 w-8 bg-slate-200 rounded animate-pulse" />;
}

/* ─── Program card ──────────────────────────────────────────────────────────── */
function ProgramCard({ p, onNavigate }: {
  p: Program;
  onNavigate: (id: string, available: boolean) => void;
}) {
  let baseId = p.id;
  if (p.id.startsWith('dba-et')) baseId = 'dba-et';
  else if (p.id.startsWith('dba')) baseId = 'dba';

  const sheetId = p.available && PROGRAMS[baseId] ? PROGRAMS[baseId].sheetId : '';
  const { learnerCount, activeCount, cohortCount, loading } = useProgramStats(sheetId, baseId);

  return (
    <div
      onClick={() => onNavigate(p.id, p.available)}
      className={`group bg-white rounded-2xl border border-slate-200/90 p-6 transition-all duration-300 shadow-sm flex flex-col justify-between ${p.available
          ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-indigo-200 active:scale-[0.98]'
          : 'opacity-60 cursor-default'
        }`}
    >
      <div>
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white shadow-md transition-transform duration-300 ${p.available ? 'group-hover:scale-105' : ''}`}
          >
            <i className={`${p.icon} text-lg`} />
          </div>
          {p.available ? (
            <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Active
            </span>
          ) : (
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
              Coming Soon
            </span>
          )}
        </div>

        {/* Name + description */}
        <h4 className={`text-base font-black text-slate-900 mb-2 leading-snug transition-colors ${p.available ? 'group-hover:text-indigo-600' : ''}`}>
          {p.name}
        </h4>
        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6">{p.description}</p>
      </div>

      {/* Stats & CTA */}
      <div>
        {p.available && PROGRAMS[p.id] && (
          <div className="flex items-center gap-6 pt-4 border-t border-slate-100 mb-4">
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Cohorts</div>
              <div className="text-sm font-black text-slate-800">
                {loading ? <StatSkeleton /> : cohortCount !== null ? cohortCount.toLocaleString() : '—'}
              </div>
            </div>
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Learners</div>
              <div className="text-sm font-black text-slate-800">
                {loading ? <StatSkeleton /> : learnerCount !== null ? learnerCount.toLocaleString() : '—'}
              </div>
            </div>
          </div>
        )}

        {p.available && (
          <div className="pt-2 flex items-center justify-between text-xs font-bold text-indigo-600 uppercase tracking-wider group-hover:text-indigo-700">
            <span>Open Dashboard</span>
            <i className="fas fa-arrow-right text-xs group-hover:translate-x-1 transition-transform" />
          </div>
        )}
      </div>
    </div>
  );
}

function DbaContainerHeaderStats() {
  const dbaStats = useProgramStats('13GFW9_aT1bKUp26B_1Db72QB7ZPUwm4DzmdMHXDY-98', 'dba');
  const dbaEtStats = useProgramStats('1uRMte-I2N6B_VhYSZFw4zRf5QDchHXBNK1ZGM38l8LY', 'dba-et');
  const dbaDlStats = useProgramStats('184gFR_9JBauSd3XgsYYoYUzLGCG9BbXAcJC96gWCck4', 'dba-dl');

  const loading = dbaStats.loading || dbaEtStats.loading || dbaDlStats.loading;
  const dbaCohorts = dbaStats.cohortCount ?? 40;
  const dbaLearners = dbaStats.learnerCount ?? 1483;

  const dbaEtCohorts = dbaEtStats.cohortCount ?? 14;
  const dbaEtLearners = dbaEtStats.learnerCount ?? 986;

  const dbaDlCohorts = dbaDlStats.cohortCount ?? 2;
  const dbaDlLearners = dbaDlStats.learnerCount ?? 61;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl px-4 py-2.5 flex items-center gap-2">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Regular DBA:</span>
        <span className="text-xs font-black text-slate-900">
          {loading ? <StatSkeleton /> : `${dbaCohorts} Cohorts · ${dbaLearners.toLocaleString()} Learners`}
        </span>
      </div>

      <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
        <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider">DBA ET:</span>
        <span className="text-xs font-black text-indigo-950">
          {loading ? <StatSkeleton /> : `${dbaEtCohorts} Cohorts · ${dbaEtLearners.toLocaleString()} Learners`}
        </span>
      </div>

      <div className="bg-purple-50/70 border border-purple-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
        <span className="text-[9px] font-black text-purple-500 uppercase tracking-wider">DBA DL:</span>
        <span className="text-xs font-black text-purple-950">
          {loading ? <StatSkeleton /> : `${dbaDlCohorts} Cohorts · ${dbaDlLearners.toLocaleString()} Learners`}
        </span>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────────── */

export default function UniversityProgramsPage() {
  const { uniId } = useParams<{ uniId: string }>();
  const navigate = useNavigate();
  const { signOut, profile, permissions } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const uni = UNIVERSITIES.find(u => u.id === uniId);
  const meta = UNI_META[uniId ?? ''];

  const { loading: uniStatsLoading, total, active, graduated } = useUniversityLearnerStats(uniId ?? '');
  const { loading: gguLoading, statusTotals } = useGGUOverviewAnalytics();

  // Filter programs by permission
  const programs: Program[] = uni
    ? uni.programs.filter(p => hasProgramAccess(permissions, p.id, uni.id))
    : [];

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleProgramClick = (programId: string, available: boolean) => {
    if (!available) return;
    let baseId = programId;
    if (programId === 'dba-taught' || programId === 'dba-dissertation') {
      baseId = programId;
    } else if (programId.startsWith('dba-et')) {
      baseId = 'dba-et';
    } else if (programId.startsWith('dba')) {
      baseId = 'dba';
    }

    if (programId === 'dba-dissertation') {
      navigate(`/dba-dissertation/dissertation?program=overall`);
    } else {
      navigate(`/${baseId}/dashboard`);
    }
  };

  const navItems = [
    { name: 'Home', path: '/lex/home', icon: 'fas fa-home', permission: 'page_home' },
    { name: 'Learners', path: '/lex/learners', icon: 'fas fa-users', permission: 'page_learners' },
  ].filter(item => permissions?.includes(item.permission));

  if (!uni) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <i className="fas fa-exclamation-triangle text-4xl text-slate-300 mb-4" />
          <p className="text-slate-500 font-bold">University not found.</p>
          <button onClick={() => navigate('/programs')} className="mt-4 text-indigo-600 font-black text-sm hover:underline">
            ← Back to Universities
          </button>
        </div>
      </div>
    );
  }

  const bannerGradient = meta?.gradient ?? 'from-slate-900 to-indigo-950';

  return (
    <div className="min-h-screen flex bg-slate-50 relative overflow-hidden">
      <style>{`
        .sidebar-nav-item { transition: all 0.2s ease-in-out; }
        .sidebar-nav-item:hover { color: white !important; background-color: rgba(255,255,255,0.05) !important; }
        .sidebar-signout-btn:hover { background-color: rgba(239,68,68,0.2) !important; color: white !important; }
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{ ...styles.sidebar, width: collapsed ? 56 : 240, transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ ...styles.sidebarLogo, padding: collapsed ? '24px 8px' : '24px 20px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div onClick={() => navigate('/lex/home')} style={{ display: 'flex', items: 'center', gap: collapsed ? 0 : 12, cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start', width: '100%' }}>
            <div style={{ ...styles.sidebarLogoIcon, width: collapsed ? 36 : 40, height: collapsed ? 36 : 40 }}>
              <i className="fas fa-graduation-cap" style={{ color: 'white', fontSize: collapsed ? 18 : 22 }} />
            </div>
            {!collapsed && (
              <div>
                <div style={{ color: 'white', fontWeight: 900, fontSize: 16 }}>EduOps360</div>
                <div style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{uni.name}</div>
              </div>
            )}
          </div>
        </div>
        <nav style={{ ...styles.sidebarNav, padding: collapsed ? '16px 8px' : '16px 12px' }}>
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} className="sidebar-nav-item"
              style={({ isActive }) => ({ ...(isActive ? styles.navItemActive : styles.navItem), padding: collapsed ? '10px 0' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start' })}
              title={collapsed ? item.name : undefined}>
              <i className={item.icon} style={{ fontSize: 14 }} />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          ))}
          <NavLink to="/programs" className="sidebar-nav-item"
            style={({ isActive }) => ({ ...(isActive ? styles.navItemActive : styles.navItem), padding: collapsed ? '10px 0' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start' })}
            title={collapsed ? 'Universities' : undefined}>
            <i className="fas fa-university" style={{ fontSize: 14 }} />
            {!collapsed && <span>Universities</span>}
          </NavLink>
          {permissions?.includes('page_admin') && (
            <NavLink to="/admin" className="sidebar-nav-item"
              style={({ isActive }) => ({ ...(isActive ? styles.navItemActive : styles.navItem), padding: collapsed ? '10px 0' : '10px 12px', justifyContent: collapsed ? 'center' : 'flex-start' })}
              title={collapsed ? 'Admin' : undefined}>
              <i className="fas fa-user-shield" style={{ fontSize: 14 }} />
              {!collapsed && <span>Admin Panel</span>}
            </NavLink>
          )}
        </nav>
        <div style={{ ...styles.sidebarFooter, padding: collapsed ? '16px 8px' : '16px 12px' }}>
          {collapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
              <div style={styles.sidebarAvatar} title={profile?.full_name || profile?.email || 'User'}>
                {(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <button onClick={handleLogout} style={styles.signOutBtn} className="sidebar-signout-btn sidebar-nav-item" title="Log Out"><i className="fas fa-sign-out-alt" /></button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%' }}>
              <div style={styles.sidebarUserInfo}>
                <div style={styles.sidebarAvatar}>{(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile?.full_name || profile?.email?.split('@')[0] || 'User'}
                  </div>
                  <div style={{ color: 'rgba(148,163,184,0.5)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{profile?.role || 'User'}</div>
                </div>
              </div>
              <button onClick={handleLogout} style={styles.signOutBtn} className="sidebar-signout-btn sidebar-nav-item" title="Log Out"><i className="fas fa-sign-out-alt" /></button>
            </div>
          )}
        </div>
        <div style={{ borderTop: 'none', padding: collapsed ? '10px 8px' : '10px 12px' }}>
          <button className="sidebar-nav-item" onClick={() => setCollapsed(!collapsed)}
            style={{ ...styles.navItem, padding: collapsed ? '6px 0' : '6px 10px', fontSize: 11, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <i className={`fas fa-chevron-${collapsed ? 'right' : 'left'}`} style={{ fontSize: 11 }} />
            {!collapsed && <span style={{ fontSize: 11 }}>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-h-screen relative z-10"
        style={{ marginLeft: collapsed ? 56 : 240, transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)' }}>

        {/* Sticky header */}
        <header className="h-20 bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-40 flex items-center justify-between px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/programs')}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
            >
              <i className="fas fa-chevron-left text-xs" />
            </button>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-indigo-700 uppercase tracking-[0.25em] mb-0.5">Partner Institution</span>
              <h2 className="text-[11px] font-black text-slate-900 tracking-widest uppercase">{uni.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center gap-2">
              <i className="fas fa-calendar-alt text-indigo-700 text-xs" />
              <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
                {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
        </header>

        {/* Hero banner */}
        <div className={`p-8 text-white ${bannerGradient}`}>
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8 py-4">
            {/* Left: identity */}
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-slate-950/90 border border-white/20 flex flex-col items-center justify-center text-white shadow-md shrink-0">
                <i className={`${meta?.icon ?? 'fas fa-university'} text-base text-indigo-400 mb-0.5`} />
                <span className="text-[10px] font-black tracking-widest text-white">{meta?.code ?? uni.name.slice(0, 3)}</span>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-1 block">
                  <i className="fas fa-map-marker-alt text-[9px] mr-1" />
                  {uni.location}
                </span>
                <h1 className="text-3xl font-black text-white leading-tight mb-1">{uni.fullName}</h1>
                <p className="text-xs font-semibold text-slate-300 max-w-xl">
                  {meta?.tagline ?? ''}
                </p>
              </div>
            </div>

            {/* Right: Learner Stats */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Total Learners</div>
                <div className="text-sm font-black text-white">
                  {uniStatsLoading ? <StatSkeleton /> : (total ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                <div className="text-[8px] font-black text-emerald-400 uppercase tracking-wider mb-0.5">Active</div>
                <div className="text-sm font-black text-emerald-300">
                  {uniStatsLoading ? <StatSkeleton /> : (active ?? 0).toLocaleString()}
                </div>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-center min-w-[90px]">
                <div className="text-[8px] font-black text-indigo-400 uppercase tracking-wider mb-0.5">Graduated</div>
                <div className="text-sm font-black text-indigo-300">
                  {uniStatsLoading ? <StatSkeleton /> : (graduated ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* About Section */}
        {meta?.about && (
          <div className="px-8 pt-8 max-w-6xl mx-auto w-full">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full bg-indigo-600" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">About the University</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">{meta.about}</p>
            </div>
          </div>
        )}

        {/* Overall Overview Section */}
        {uni.id === 'ggu' && (
          <div className="px-8 pt-6 max-w-6xl mx-auto w-full">
            <div
              onClick={() => navigate(`/programs/${uni.id}/overview`)}
              className="group bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md p-6 flex flex-col gap-5 cursor-pointer transition-all duration-300 hover:border-indigo-200"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-4.5 rounded-full bg-indigo-600" />
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider group-hover:text-indigo-600 transition-colors">
                      Overall Operational Overview
                    </h3>
                    <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full ml-2">
                      Operational Analytics
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    View complete operational analytics, status breakdowns, retention rates, graduation rates, and term distribution.
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/programs/${uni.id}/overview`);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                >
                  <span>Explore Overall Overview</span>
                  <i className="fas fa-arrow-right text-xs group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* Live Operational Metrics Summary Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-indigo-700 uppercase tracking-wider mb-1">
                    <i className="fas fa-users text-indigo-600 text-[10px]" />
                    Total Enrolled
                  </div>
                  <div className="text-base font-black text-indigo-950">
                    {gguLoading ? <StatSkeleton /> : (statusTotals?.grandTotal || total).toLocaleString()}
                  </div>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 uppercase tracking-wider mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                    Active Learners
                  </div>
                  <div className="text-base font-black text-emerald-950">
                    {gguLoading ? <StatSkeleton /> : (statusTotals?.active || active).toLocaleString()}
                  </div>
                </div>

                <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                    Exit Learners
                  </div>
                  <div className="text-base font-black text-amber-950">
                    {gguLoading ? <StatSkeleton /> : (statusTotals?.exit || 0).toLocaleString()}
                  </div>
                </div>

                <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-black text-rose-700 uppercase tracking-wider mb-1">
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                    LOA
                  </div>
                  <div className="text-base font-black text-rose-950">
                    {gguLoading ? <StatSkeleton /> : (statusTotals?.inactive || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Programs Grid */}
        <div className="px-8 py-8 max-w-6xl mx-auto w-full">
          {/* Big Featured Container for DBA, DBA ET & DBA DL - Light Theme */}
          {uni.id === 'ggu' && (
            <div className="bg-white rounded-2xl border border-slate-200/90 p-8 shadow-sm mb-10">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                    <i className="fas fa-graduation-cap text-xl" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Doctor of Business Administration (DBA, DBA ET & DBA DL)</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">Executive doctoral framework spanning Taught Coursework and Dissertation Research.</p>
                  </div>
                </div>

                <DbaContainerHeaderStats />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Inner Sub-card 1: Taught Phase */}
                <div
                  onClick={() => handleProgramClick('dba-taught', true)}
                  className="group bg-slate-50/80 hover:bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-indigo-300 transition-all duration-300 shadow-sm hover:shadow-lg cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                        Phase 1 · Taught Phase
                      </span>
                      <span className="text-xs font-bold text-indigo-600 group-hover:text-indigo-700 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Open Dashboard <i className="fas fa-arrow-right text-[10px]" />
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                      Taught Phase
                    </h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Coursework, foundation modules, live session attendance, and qualifying exams.
                    </p>
                  </div>
                </div>

                {/* Inner Sub-card 2: Dissertation Phase */}
                <div
                  onClick={() => navigate('/dba-dissertation/dissertation?program=overall')}
                  className="group bg-slate-50/80 hover:bg-white rounded-2xl p-6 border border-slate-200/80 hover:border-indigo-300 transition-all duration-300 shadow-sm hover:shadow-lg cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[9px] font-black uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full">
                        Phase 2 · Dissertation Phase
                      </span>
                      <span className="text-xs font-bold text-indigo-600 group-hover:text-indigo-700 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                        Open Dashboard <i className="fas fa-arrow-right text-[10px]" />
                      </span>
                    </div>
                    <h4 className="text-base font-black text-slate-900 mb-2 group-hover:text-indigo-600 transition-colors">
                      Dissertation Phase
                    </h4>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Topic proposal approval, research defense, doctoral thesis review, and graduation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-indigo-600" />
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                {uni.id === 'ggu' ? 'Other Academic Programs' : 'Academic Programs'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                {programs.filter(p => p.available && p.id !== 'dba-taught' && p.id !== 'dba-dissertation').length} Active
              </span>
              <span className="text-[10px] font-black text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                {programs.filter(p => p.id !== 'dba-taught' && p.id !== 'dba-dissertation').length} Total
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {programs.filter(p => p.id !== 'dba-taught' && p.id !== 'dba-dissertation').map(p => (
              <ProgramCard key={p.id} p={p} onNavigate={handleProgramClick} />
            ))}
          </div>
        </div>

        <footer className="py-8 border-t border-slate-200/60 text-center bg-white">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.4em]">
            © 2026 EduOps360 · Advanced Student Lifecycle Management
          </p>
        </footer>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: { position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50, width: 240, background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)', display: 'flex', flexDirection: 'column', padding: 0, flexShrink: 0, boxShadow: '4px 0 24px rgba(0,0,0,0.15)' },
  sidebarLogo: { display: 'flex', alignItems: 'center', gap: 12, padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  sidebarLogoIcon: { width: 40, height: 40, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,102,241,0.4)', flexShrink: 0 },
  sidebarNav: { flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: 'rgba(148,163,184,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left', width: '100%', transition: 'all 0.2s' },
  navItemActive: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: 'white', fontSize: 13, fontWeight: 700, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.25)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)', textAlign: 'left', width: '100%', cursor: 'pointer' },
  sidebarFooter: { padding: '16px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10 },
  sidebarUserInfo: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 },
  sidebarAvatar: { width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 14, flexShrink: 0 },
  signOutBtn: { width: 32, height: 32, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'rgba(252,165,165,0.8)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', fontSize: 13 },
};
