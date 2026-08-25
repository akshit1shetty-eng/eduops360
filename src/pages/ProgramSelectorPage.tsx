import React, { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UNIVERSITIES, hasUniversityAccess, hasProgramAccess, type University } from '../lib/universities';
import { useUniversityLearnerStats } from '../hooks/useUniversityLearnerStats';

function StatSkeleton() {
  return <span className="inline-block h-3.5 w-8 bg-slate-200 rounded animate-pulse" />;
}

const UNI_META: Record<string, {
  code: string;
  icon: string;
  tagline: string;
  about: string;
  facts: { label: string; value: string }[];
  theme: {
    banner: string;
    accent: string;
    badge: string;
    badgeText: string;
    iconColor: string;
  };
}> = {
  ggu: {
    code: 'GGU',
    icon: 'fas fa-university',
    tagline: 'Pioneering Business Education Since 1901',
    about:
      `Golden Gate University is a private university in the heart of San Francisco, renowned for its professional and graduate programs in business, law, and taxation. GGU offers flexible, career-focused education designed for working professionals seeking to advance globally.`,
    facts: [
      { label: 'Founded', value: '1901' },
      { label: 'Location', value: 'San Francisco, CA' },
    ],
    theme: {
      banner: 'bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900',
      accent: '#6366f1',
      badge: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300',
      badgeText: 'text-emerald-300',
      iconColor: 'text-indigo-400',
    },
  },
  psb: {
    code: 'PSB',
    icon: 'fas fa-graduation-cap',
    tagline: 'European Excellence in Management Education',
    about:
      `Paris School of Business is a leading French grande école, consistently ranked among Europe's top business schools. PSB combines a strong international perspective with rigorous academic excellence, preparing future global leaders.`,
    facts: [
      { label: 'Founded', value: '1974' },
      { label: 'Location', value: 'Paris, France' },
    ],
    theme: {
      banner: 'bg-gradient-to-br from-amber-600 via-orange-700 to-slate-900',
      accent: '#f59e0b',
      badge: 'bg-amber-500/20 border-amber-400/30 text-amber-300',
      badgeText: 'text-amber-300',
      iconColor: 'text-amber-400',
    },
  },
  esgci: {
    code: 'ESG',
    icon: 'fas fa-globe-europe',
    tagline: 'International Commerce & Global Leadership',
    about:
      `ESGCI (École Supérieure de Gestion et de Commerce International) is a prestigious Paris-based business school specialising in international commerce and management, equipping students with the strategic mindset to lead in a globalised economy.`,
    facts: [
      { label: 'Founded', value: '1937' },
      { label: 'Location', value: 'Paris, France' },
    ],
    theme: {
      banner: 'bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900',
      accent: '#10b981',
      badge: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300',
      badgeText: 'text-emerald-300',
      iconColor: 'text-emerald-400',
    },
  },
  edgewood: {
    code: 'EDGE',
    icon: 'fas fa-book-reader',
    tagline: 'Values-Driven Education for Modern Leaders',
    about:
      `Edgewood University in Madison, Wisconsin offers a mission-centred approach to higher education, blending strong liberal arts foundations with professional programs in education, business, and health sciences.`,
    facts: [
      { label: 'Founded', value: '1927' },
      { label: 'Location', value: 'Madison, Wisconsin' },
    ],
    theme: {
      banner: 'bg-gradient-to-br from-rose-700 via-red-800 to-slate-900',
      accent: '#ef4444',
      badge: 'bg-rose-500/20 border-rose-400/30 text-rose-300',
      badgeText: 'text-rose-300',
      iconColor: 'text-rose-400',
    },
  },
};

function UniversityCard({ uni, onClick }: { uni: University; onClick: () => void }) {
  const meta = UNI_META[uni.id] ?? {
    code: uni.name.slice(0, 3).toUpperCase(),
    icon: 'fas fa-university',
    tagline: '',
    about: '',
    facts: [],
    theme: {
      banner: 'bg-gradient-to-br from-slate-800 to-slate-900',
      accent: '#6366f1',
      badge: 'bg-slate-700 border-slate-600 text-slate-300',
      badgeText: 'text-slate-300',
      iconColor: 'text-indigo-400',
    },
  };

  const activeProgramCount = uni.programs.filter(p => p.available).length;
  const { loading: statsLoading, total, active, graduated } = useUniversityLearnerStats(uni.id);

  return (
    <div
      onClick={onClick}
      className="group bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1.5 cursor-pointer overflow-hidden flex flex-col justify-between"
    >
      {/* Top Banner Block */}
      <div className={`relative p-7 text-white ${meta.theme.banner}`}>
        <div className="flex items-start justify-between mb-4">
          {/* Emblem Icon Box */}
          <div className="w-14 h-14 rounded-2xl bg-slate-950/80 border border-white/20 flex flex-col items-center justify-center text-white shadow-md shrink-0">
            <i className={`${meta.icon} text-sm ${meta.theme.iconColor} mb-0.5`} />
            <span className="text-[9px] font-black tracking-widest text-white">{meta.code}</span>
          </div>

          {/* Status Badge */}
          <div>
            {activeProgramCount > 0 ? (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${meta.theme.badge}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {activeProgramCount} Live Program{activeProgramCount > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-slate-600/50 bg-slate-800/60 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                Coming Soon
              </span>
            )}
          </div>
        </div>

        {/* Name & Tagline */}
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300/80 mb-1 block">
            <i className="fas fa-map-marker-alt text-[9px] mr-1" />
            {uni.location}
          </span>
          <h3 className="text-2xl font-black text-white leading-tight mb-1 group-hover:text-indigo-200 transition-colors">
            {uni.fullName}
          </h3>
          <p className="text-xs font-semibold text-slate-200/80 line-clamp-1">
            {meta.tagline}
          </p>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-7 flex-1 flex flex-col justify-between bg-white">
        {/* Description Excerpt */}
        <p className="text-xs text-slate-600 font-medium leading-relaxed mb-6 line-clamp-3">
          {meta.about}
        </p>

        {/* Learner Metric Cards */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-center">
            <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider mb-0.5">Total Learners</div>
            <div className="text-sm font-black text-slate-900">
              {statsLoading ? <StatSkeleton /> : total.toLocaleString()}
            </div>
          </div>
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl px-3 py-2.5 text-center">
            <div className="text-[8px] font-black text-emerald-600 uppercase tracking-wider mb-0.5">Active</div>
            <div className="text-sm font-black text-emerald-700">
              {statsLoading ? <StatSkeleton /> : active.toLocaleString()}
            </div>
          </div>
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl px-3 py-2.5 text-center">
            <div className="text-[8px] font-black text-indigo-600 uppercase tracking-wider mb-0.5">Graduated</div>
            <div className="text-sm font-black text-indigo-700">
              {statsLoading ? <StatSkeleton /> : graduated.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Card Footer CTA */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-black text-slate-500">
            <i className="fas fa-graduation-cap text-indigo-600" />
            <span>{uni.programs.length} Available Program{uni.programs.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 group-hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-sm">
            <span>Explore</span>
            <i className="fas fa-arrow-right text-[10px] group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UniversitySelectorPage() {
  const navigate = useNavigate();
  const { signOut, profile, permissions } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Home', path: '/lex/home', icon: 'fas fa-home', permission: 'page_home' },
    { name: 'Learners', path: '/lex/learners', icon: 'fas fa-users', permission: 'page_learners' },
  ].filter(item => permissions?.includes(item.permission));

  const filteredUnis = UNIVERSITIES.map(uni => {
    const hasUni = hasUniversityAccess(permissions, uni.id);
    const allowedPrograms = uni.programs.filter(p => hasProgramAccess(permissions, p.id, uni.id));
    if (hasUni || allowedPrograms.length > 0) {
      return { ...uni, programs: hasUni ? uni.programs : allowedPrograms };
    }
    return null;
  }).filter(Boolean) as University[];

  return (
    <div className="min-h-screen flex bg-slate-50 relative overflow-hidden">
      <style>{`
        .sidebar-nav-item { transition: all 0.2s ease-in-out; }
        .sidebar-nav-item:hover { color: white !important; background-color: rgba(255,255,255,0.05) !important; }
        .sidebar-signout-btn:hover { background-color: rgba(239,68,68,0.2) !important; color: white !important; }
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{ ...styles.sidebar, width: collapsed ? 56 : 240, transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        {/* Logo */}
        <div style={{ ...styles.sidebarLogo, padding: collapsed ? '24px 8px' : '24px 20px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div onClick={() => navigate('/lex/home')} style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 12, cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start', width: '100%' }}>
            <div style={{ ...styles.sidebarLogoIcon, width: collapsed ? 36 : 40, height: collapsed ? 36 : 40 }}>
              <i className="fas fa-graduation-cap" style={{ color: 'white', fontSize: collapsed ? 18 : 22 }} />
            </div>
            {!collapsed && (
              <div>
                <div style={{ color: 'white', fontWeight: 900, fontSize: 16, letterSpacing: '-0.01em' }}>EduOps360</div>
                <div style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Universities</div>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
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

        {/* User footer */}
        <div style={{ ...styles.sidebarFooter, padding: collapsed ? '16px 8px' : '16px 12px' }}>
          {collapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
              <div style={styles.sidebarAvatar} title={profile?.full_name || profile?.email || 'User'}>
                {(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <button onClick={handleLogout} style={styles.signOutBtn} className="sidebar-signout-btn sidebar-nav-item" title="Log Out">
                <i className="fas fa-sign-out-alt" />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%' }}>
              <div style={styles.sidebarUserInfo}>
                <div style={styles.sidebarAvatar}>{(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile?.full_name || profile?.email?.split('@')[0] || 'User'}
                  </div>
                  <div style={{ color: 'rgba(148,163,184,0.5)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {profile?.role || 'User'}
                  </div>
                </div>
              </div>
              <button onClick={handleLogout} style={styles.signOutBtn} className="sidebar-signout-btn sidebar-nav-item" title="Log Out">
                <i className="fas fa-sign-out-alt" />
              </button>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <div style={{ borderTop: 'none', padding: collapsed ? '10px 8px' : '10px 12px' }}>
          <button className="sidebar-nav-item" onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
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
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-indigo-700 uppercase tracking-[0.25em] mb-1">EduOps360</span>
            <h2 className="text-[11px] font-black text-slate-900 tracking-widest uppercase">University Network</h2>
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

        {/* Content */}
        <div className="flex-1 px-8 pt-8 pb-16">
          <div className="max-w-6xl mx-auto">

            {/* Page Header */}
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em] mb-2 block">Partner Institutions</span>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
                  University <span className="text-indigo-700">Network</span>
                </h1>
                <p className="text-slate-500 text-sm font-medium max-w-xl leading-relaxed">
                  Select a partner university to view its academic programs, operational metrics, and cohort dashboards.
                </p>
              </div>

              {/* Summary Stats Badges */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="px-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm text-center">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Universities</div>
                  <div className="text-xl font-black text-slate-900">{filteredUnis.length}</div>
                </div>
                <div className="px-4 py-2.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm text-center">
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Live Programs</div>
                  <div className="text-xl font-black text-emerald-600">
                    {filteredUnis.reduce((a, u) => a + u.programs.filter(p => p.available).length, 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* University Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
              {filteredUnis.map(uni => (
                <UniversityCard
                  key={uni.id}
                  uni={uni}
                  onClick={() => navigate(`/programs/${uni.id}`)}
                />
              ))}
            </div>
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
