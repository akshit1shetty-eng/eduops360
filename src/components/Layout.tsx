import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useProgramConfig } from '../hooks/useProgramConfig';
import { useAuth } from '../hooks/useAuth';
import { UNIVERSITIES } from '../lib/universities';


function SidebarLink(props: { to: string; label: string; iconClass: string; collapsed: boolean }) {
  return (
    <NavLink
      to={props.to}
      className="sidebar-link sidebar-nav-item"
      style={({ isActive }) => ({
        ...(isActive ? styles.navItemActive : styles.navItem),
        padding: props.collapsed ? '10px 0' : '10px 12px',
        justifyContent: props.collapsed ? 'center' : 'flex-start',
      })}
      title={props.collapsed ? props.label : undefined}
    >
      <div className="sidebar-link-icon" style={{ background: 'none', color: 'inherit', width: 'auto', height: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <i className={props.iconClass} style={{ fontSize: 14 }} />
      </div>
      {!props.collapsed && <span className="sidebar-link-text">{props.label}</span>}
    </NavLink>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const { programId, config } = useProgramConfig();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut, profile } = useAuth();

  const targetUni = UNIVERSITIES.find(u =>
    u.programs.some(p => p.id === programId || programId.startsWith(p.id.split('-')[0]))
  );
  const backToProgramsPath = targetUni ? `/programs/${targetUni.id}` : '/programs/ggu';

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };


  return (
    <div className="app-layout">
      <style>{`
        .sidebar-nav-item {
          transition: all 0.2s ease-in-out;
        }
        .sidebar-nav-item:hover {
          color: white !important;
          background-color: rgba(255, 255, 255, 0.05) !important;
        }
        .topbar-back-btn {
          width: auto !important;
          padding: 0 16px !important;
          gap: 8px;
          border-radius: 12px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          color: #6366f1 !important;
          background: rgba(99, 102, 241, 0.08) !important;
          border: 1px solid rgba(99, 102, 241, 0.2) !important;
          transition: all 0.2s ease-in-out !important;
        }
        .topbar-back-btn:hover {
          background: rgba(99, 102, 241, 0.15) !important;
          color: #4f46e5 !important;
          border-color: rgba(99, 102, 241, 0.3) !important;
          transform: translateX(-2px);
        }
      `}</style>

      {/* Mobile overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}
        style={{
          background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.15)',
        }}
      >
        {/* Logo area */}
        <div 
          className="sidebar-logo-area" 
          style={{ 
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            padding: collapsed ? '16px 8px' : '16px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            className="sidebar-logo-btn"
            onClick={() => navigate(backToProgramsPath)}
            title="Back to Programs"
            style={{
              padding: collapsed ? '8px 0' : '8px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              gap: collapsed ? 0 : 12,
            }}
          >
            <div 
              className="sidebar-logo-icon" 
              style={{ 
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', 
                boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
                width: collapsed ? 36 : 40,
                height: collapsed ? 36 : 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fas fa-graduation-cap" style={{ fontSize: collapsed ? 16 : 18 }} />
            </div>
            {!collapsed && (
              <div className="sidebar-logo-text">
                <span className="sidebar-logo-title" style={{ color: 'white', fontWeight: 900 }}>EduOps360</span>
                <span className="sidebar-logo-sub" style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 600 }}>GGU · {config.name}</span>
              </div>
            )}
          </button>
        </div>

        {/* Nav section */}
        <div className="sidebar-nav-section" style={{ padding: collapsed ? '16px 8px' : '16px 12px' }}>
          {(() => {
            const isDissertationPhase = programId === 'dba-dissertation' || programId.includes('dissertation') || location.pathname.includes('/dissertation');
            const isTaughtPhase = programId === 'dba-taught' || programId.includes('taught');

            if (isDissertationPhase) {
              return (
                <>
                  {!collapsed && (
                    <div className="sidebar-section-label" style={{ color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>
                      Dissertation Phase
                    </div>
                  )}
                  {collapsed && (
                    <div className="sidebar-divider-collapsed" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '12px 0' }} />
                  )}
                  <nav className="sidebar-nav" style={{ marginTop: collapsed ? 0 : 8 }}>
                    <SidebarLink to={`/${programId}/dashboard`} label="Dissertation Overview" iconClass="fas fa-chart-pie" collapsed={collapsed} />
                    <SidebarLink to={`/${programId}/learners`} label="Dissertation Candidates" iconClass="fas fa-user-graduate" collapsed={collapsed} />
                    <SidebarLink to={`/${programId}/dissertation`} label="Dissertation Summary" iconClass="fas fa-scroll" collapsed={collapsed} />
                  </nav>
                </>
              );
            }

            return (
              <>
                <nav className="sidebar-nav">
                  <SidebarLink to={`/${programId}/dashboard`} label="Dashboard" iconClass="fas fa-th-large" collapsed={collapsed} />
                  <SidebarLink to={`/${programId}/learners`} label="Learners" iconClass="fas fa-users" collapsed={collapsed} />
                </nav>

                {/* Coursework Phase - Only for Taught Phase or general programs */}
                {programId !== 'mba' && programId !== 'm-psych' && (
                  <>
                    {!collapsed && <div className="sidebar-section-label" style={{ marginTop: 18, color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>Coursework Phase</div>}
                    {collapsed && <div className="sidebar-divider-collapsed" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '12px 0' }} />}
                    <nav className="sidebar-nav">
                      {programId !== 'mba' && programId !== 'dba' && programId !== 'dba-dl' && programId !== 'm-psych' && (
                        <SidebarLink to={`/${programId}/live-sessions`} label="Live Sessions" iconClass="fas fa-video" collapsed={collapsed} />
                      )}
                      <SidebarLink to={`/${programId}/academic-performance`} label="Academic Performance" iconClass="fas fa-chart-line" collapsed={collapsed} />
                    </nav>
                  </>
                )}

                {/* Dissertation Phase - Only for general DBA programs if any */}
                {!isTaughtPhase && programId !== 'mba' && programId !== 'm-psych' && (
                  <>
                    {!collapsed && <div className="sidebar-section-label" style={{ marginTop: 18, color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>Dissertation Phase</div>}
                    {collapsed && <div className="sidebar-divider-collapsed" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '12px 0' }} />}
                    <nav className="sidebar-nav">
                      <SidebarLink to={`/${programId}/dissertation`} label="Dissertation Summary" iconClass="fas fa-scroll" collapsed={collapsed} />
                    </nav>
                  </>
                )}

                {/* Immersion - Only for non-dissertation / non-dba programs */}
                {programId !== 'dba' && programId !== 'dba-taught' && programId !== 'mba' && programId !== 'dba-dl' && programId !== 'm-psych' && (
                  <>
                    {!collapsed && <div className="sidebar-section-label" style={{ marginTop: 18, color: 'rgba(148,163,184,0.5)', fontWeight: 600 }}>Immersion</div>}
                    {collapsed && <div className="sidebar-divider-collapsed" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', margin: '12px 0' }} />}
                    <nav className="sidebar-nav">
                      <SidebarLink to={`/${programId}/immersion`} label="Immersion" iconClass="fas fa-globe-americas" collapsed={collapsed} />
                    </nav>
                  </>
                )}
              </>
            );
          })()}
        </div>

        {/* User Profile & Logout section */}
        <div style={{ padding: collapsed ? '12px 8px 0 8px' : '12px 12px 0 12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          {collapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={styles.sidebarUserInfo}>
                <div style={styles.sidebarAvatar}>
                  {profile?.full_name ? profile.full_name.charAt(0).toUpperCase() : profile?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile?.full_name || profile?.email?.split('@')[0] || 'User'}
                  </div>
                  <div style={{ color: 'rgba(148,163,184,0.5)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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

      {/* Main content area */}
      <div className="app-main">
        {/* Top bar */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="topbar-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
              <i className="fas fa-bars" />
            </button>
            <div className="topbar-breadcrumb">
              <span className="topbar-program-badge">{config.name}</span>
            </div>
          </div>
          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button className="topbar-icon-btn topbar-back-btn" title="Back to Programs" onClick={() => navigate(backToProgramsPath)}>
              <i className="fas fa-arrow-left" style={{ fontSize: '12px' }} />
              <span>Back to Programs</span>
            </button>
          </div>

        </header>

        {/* Page content */}
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    color: 'rgba(148,163,184,0.7)',
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
    background: 'rgba(99,102,241,0.2)',
    border: '1px solid rgba(99,102,241,0.25)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
    textAlign: 'left',
    width: '100%',
    cursor: 'pointer',
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
    background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
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
