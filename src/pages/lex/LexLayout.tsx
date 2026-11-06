import React, { useState, useEffect } from 'react';
import { SidebarBrand } from '../../components/UpGradLogo';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LexFilterProvider, useLexFilter } from '../../hooks/useLexFilter';
import { PRIMARY_UNIVERSITY, PRIMARY_UNIVERSITY_ID, hasUniversityAccess, hasProgramAccess } from '../../lib/universities';
import { useAuth } from '../../hooks/useAuth';
import TopbarGreeting from '../../components/TopbarGreeting';

export default function LexLayout() {
  return (
    <LexFilterProvider>
      <LexLayoutContent />
    </LexFilterProvider>
  );
}

function LexLayoutContent() {
  const navigate = useNavigate();
  const { selectedUniversityId, setSelectedUniversityId } = useLexFilter();
  const { signOut, profile, permissions } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // The app is GGU-only: always scope data to GGU, and only for users who can see GGU
  const hasGguAccess = !!permissions && (
    hasUniversityAccess(permissions, PRIMARY_UNIVERSITY_ID) ||
    PRIMARY_UNIVERSITY.programs.some(p => hasProgramAccess(permissions, p.id, PRIMARY_UNIVERSITY_ID))
  );

  useEffect(() => {
    if (selectedUniversityId !== PRIMARY_UNIVERSITY_ID) setSelectedUniversityId(PRIMARY_UNIVERSITY_ID);
  }, [selectedUniversityId, setSelectedUniversityId]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Home', path: '/lex/home', icon: 'fas fa-home', permission: 'page_home' },
    { name: 'Learners', path: '/lex/learners', icon: 'fas fa-users', permission: 'page_learners' },
    { name: 'Insights', path: '/lex/insights', icon: 'fas fa-chart-line', permission: 'page_home' },
  ].filter(item => permissions?.includes(item.permission));

  // Keyed on the path so each page replays its entrance animation
  const location = useLocation();

  return (
    <div className="min-h-screen flex bg-slate-50 transition-colors duration-300 relative overflow-hidden">
      <style>{`
        .sidebar-nav-item {
          transition: all 0.2s ease-in-out;
        }
        .sidebar-nav-item:hover {
          color: white !important;
          background-color: rgba(255, 255, 255, 0.05) !important;
        }
        .sidebar-signout-btn:hover {
          background-color: rgba(239, 68, 68, 0.2) !important;
          color: white !important;
        }
      `}</style>

      {/* Decorative canvas: dot grid with a soft crimson/navy glow */}
      <div className="app-canvas" />

      {/* Sidebar */}
      <aside
        style={{
          ...styles.sidebar,
          width: collapsed ? 56 : 240,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div style={{
          ...styles.sidebarLogo,
          padding: collapsed ? '24px 8px' : '24px 20px',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          <div
            onClick={() => navigate('/lex/home')}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: collapsed ? 0 : 12, 
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              width: '100%',
            }}
          >
            <SidebarBrand collapsed={collapsed} subtitle="Golden Gate University" />
          </div>
        </div>

        <nav style={{
          ...styles.sidebarNav,
          padding: collapsed ? '16px 8px' : '16px 12px',
        }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className="sidebar-nav-item"
              style={({ isActive }) => ({
                ...(isActive ? styles.navItemActive : styles.navItem),
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title={collapsed ? item.name : undefined}
            >
              <i className={item.icon} style={{ fontSize: 14 }} />
              {!collapsed && <span>{item.name}</span>}
            </NavLink>
          ))}
          {permissions?.includes('page_admin') && (
            <NavLink
              to="/admin"
              className="sidebar-nav-item"
              style={({ isActive }) => ({
                ...(isActive ? styles.navItemActive : styles.navItem),
                padding: collapsed ? '10px 0' : '10px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
              })}
              title={collapsed ? "Admin Panel" : undefined}
            >
              <i className="fas fa-user-shield" style={{ fontSize: 14 }} />
              {!collapsed && <span>Admin Panel</span>}
            </NavLink>
          )}
        </nav>

        <div style={{
          ...styles.sidebarFooter,
          padding: collapsed ? '16px 8px' : '16px 12px',
        }}>
          {collapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
              <div style={styles.sidebarAvatar} title={profile?.full_name || profile?.email || 'User'}>
                {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : profile?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <button
                onClick={handleLogout}
                style={styles.signOutBtn}
                className="sidebar-signout-btn sidebar-nav-item"
                title="Log Out"
              >
                <i className="fas fa-sign-out-alt" />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%' }}>
              <div style={styles.sidebarUserInfo}>
                <div style={styles.sidebarAvatar}>
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : profile?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile?.full_name || profile?.email?.split('@')[0] || 'User'}
                  </div>
                  <div style={{ color: 'rgba(167, 169, 172,0.5)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {profile?.role || 'User'}
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                style={styles.signOutBtn}
                className="sidebar-signout-btn sidebar-nav-item"
                title="Log Out"
              >
                <i className="fas fa-sign-out-alt" />
              </button>
            </div>
          )}
        </div>

        {/* Collapse toggle (desktop) */}
        <div className="sidebar-footer" style={{ borderTop: 'none', padding: collapsed ? '10px 8px' : '10px 12px' }}>
          <button
            className="sidebar-collapse-btn sidebar-nav-item"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              ...styles.navItem,
              padding: collapsed ? '6px 0' : '6px 10px',
              fontSize: 11,
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            <i className={`fas fa-chevron-${collapsed ? 'right' : 'left'}`} style={{ fontSize: 11 }} />
            {!collapsed && <span style={{ fontSize: 11 }}>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className="flex-1 flex flex-col min-h-screen relative z-10"
        style={{
          marginLeft: collapsed ? 56 : 240,
          transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <header className="h-20 bg-white/75 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-40 flex items-center justify-between px-8">
          <TopbarGreeting />

          <div className="flex items-center space-x-4">
            {/* Partner context: the whole app is scoped to Golden Gate University */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl border border-slate-200 bg-white">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ background: '#0C2340' }}>
                <i className="fas fa-university text-[11px]" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-1">University partner</span>
                <span className="text-[13px] font-bold text-slate-900 leading-none">{PRIMARY_UNIVERSITY.name}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div key={location.pathname} className="flex-1 p-8 page-enter">
          {hasGguAccess ? <Outlet /> : (
            <div className="max-w-lg mx-auto mt-16 text-center bg-white rounded-3xl border border-slate-200 p-10">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <i className="fas fa-user-lock text-xl" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">No access to Golden Gate University</h2>
              <p className="mt-2 text-sm text-slate-500">Your role doesn't include Golden Gate University data. Ask an administrator to update your access.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    width: 240,
    background: 'linear-gradient(160deg, #0D0D0D 0%, #1A0204 100%)',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    flexShrink: 0,
    boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
  },
  sidebarLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '24px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
  },
  sidebarLogoIcon: {
    width: 40,
    height: 40,
    background: 'transparent',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'none',
    flexShrink: 0,
  },
  sidebarNav: {
    flex: 1,
    padding: '16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    color: 'rgba(167, 169, 172,0.7)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    textAlign: 'left',
    width: '100%',
    transition: 'all 0.2s',
  },
  navItemActive: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    color: 'white',
    fontSize: 13,
    fontWeight: 700,
    background: 'rgba(229, 9, 19,0.2)',
    border: '1px solid rgba(229, 9, 19,0.25)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
    textAlign: 'left',
    width: '100%',
    cursor: 'pointer',
  },
  sidebarFooter: {
    padding: '16px 12px',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  sidebarUserInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  sidebarAvatar: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: 'linear-gradient(135deg, #E50913, #9B000C)',
    boxShadow: '0 0 0 2px rgba(255,255,255,0.08), 0 4px 12px rgba(229, 9, 19,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 900,
    fontSize: 14,
    flexShrink: 0,
  },
  signOutBtn: {
    width: 32,
    height: 32,
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8,
    color: 'rgba(252,165,165,0.8)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    fontSize: 13,
  },
};
