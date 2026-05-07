import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import ThemeToggle from './ThemeToggle';
import { useProgramConfig } from '../hooks/useProgramConfig';

function SidebarLink(props: { to: string; label: string; iconClass: string; collapsed: boolean }) {
  return (
    <NavLink
      to={props.to}
      className={({ isActive }) =>
        [
          'sidebar-link',
          isActive ? 'sidebar-link-active' : '',
        ].join(' ')
      }
      title={props.collapsed ? props.label : undefined}
    >
      <div className="sidebar-link-icon">
        <i className={props.iconClass} />
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

  return (
    <div className="app-layout">
      {/* Mobile overlay */}
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${mobileOpen ? 'sidebar-mobile-open' : ''}`}>
        {/* Logo area */}
        <div className="sidebar-logo-area">
          <button
            className="sidebar-logo-btn"
            onClick={() => navigate('/')}
            title="Back to Programs"
          >
            <div className="sidebar-logo-icon">
              <i className="fas fa-graduation-cap" />
            </div>
            {!collapsed && (
              <div className="sidebar-logo-text">
                <span className="sidebar-logo-title">EduOps360</span>
                <span className="sidebar-logo-sub">GGU · {config.name}</span>
              </div>
            )}
          </button>
        </div>

        {/* Nav section */}
        <div className="sidebar-nav-section">
          <nav className="sidebar-nav">
            <SidebarLink to={`/${programId}/dashboard`} label="Dashboard" iconClass="fas fa-th-large" collapsed={collapsed} />
            <SidebarLink to={`/${programId}/learners`} label="Learners" iconClass="fas fa-users" collapsed={collapsed} />
          </nav>

          {programId !== 'mba' && (
            <>
              {!collapsed && <div className="sidebar-section-label" style={{ marginTop: 18 }}>Coursework Phase</div>}
              {collapsed && <div className="sidebar-divider-collapsed" />}
            </>
          )}
          <nav className="sidebar-nav">
            {programId !== 'mba' && programId !== 'dba' && programId !== 'dba-dl' && (
              <SidebarLink to={`/${programId}/live-sessions`} label="Live Sessions" iconClass="fas fa-video" collapsed={collapsed} />
            )}
            {programId !== 'mba' && (
              <SidebarLink to={`/${programId}/academic-performance`} label="Academic Performance" iconClass="fas fa-chart-line" collapsed={collapsed} />
            )}
          </nav>

          {programId !== 'mba' && (
            <>
              {!collapsed && <div className="sidebar-section-label" style={{ marginTop: 18 }}>Dissertation Phase</div>}
              {collapsed && <div className="sidebar-divider-collapsed" />}
              <nav className="sidebar-nav">
                <SidebarLink to={`/${programId}/dissertation`} label="Dissertation" iconClass="fas fa-scroll" collapsed={collapsed} />
              </nav>
            </>
          )}

          {programId !== 'dba' && programId !== 'mba' && programId !== 'dba-dl' && (
            <>
              {!collapsed && <div className="sidebar-section-label" style={{ marginTop: 18 }}>Immersion</div>}
              {collapsed && <div className="sidebar-divider-collapsed" />}
              <nav className="sidebar-nav">
                <SidebarLink to={`/${programId}/immersion`} label="Immersion" iconClass="fas fa-globe-americas" collapsed={collapsed} />
              </nav>
            </>
          )}
        </div>

        {/* Collapse toggle (desktop) */}
        <div className="sidebar-footer">
          <button
            className="sidebar-collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={`fas fa-chevron-${collapsed ? 'right' : 'left'}`} />
            {!collapsed && <span>Collapse</span>}
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
          <div className="topbar-right">
            <ThemeToggle />
            <button className="topbar-icon-btn" title="Back to Programs" onClick={() => navigate('/')}>
              <i className="fas fa-th" />
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
