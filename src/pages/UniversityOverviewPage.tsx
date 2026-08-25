import React, { useState } from 'react';
import { useNavigate, useParams, NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UNIVERSITIES } from '../lib/universities';
import GGUOverallOverviewDashboard from '../components/GGUOverallOverviewDashboard';

export default function UniversityOverviewPage() {
  const { uniId } = useParams<{ uniId: string }>();
  const navigate = useNavigate();
  const { signOut, profile, permissions } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const uni = UNIVERSITIES.find(u => u.id === uniId);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Home', path: '/lex/home', icon: 'fas fa-home', permission: 'page_home' },
    { name: 'Learners', path: '/lex/learners', icon: 'fas fa-users', permission: 'page_learners' },
  ].filter(item => permissions?.includes(item.permission));

  if (!uni) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', color: '#0f172a' }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fas fa-exclamation-triangle" style={{ fontSize: 36, color: '#94a3b8', marginBottom: 16 }} />
          <p style={{ color: '#64748b', fontWeight: 700 }}>University not found.</p>
          <button onClick={() => navigate('/programs')} style={{ marginTop: 16, color: '#4f46e5', fontWeight: 900, fontSize: 14, cursor: 'pointer', background: 'none', border: 'none' }}>
            ← Back to Universities
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#ffffff', color: '#0f172a', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        .sidebar-nav-item { transition: all 0.2s ease-in-out; }
        .sidebar-nav-item:hover { color: white !important; background-color: rgba(255,255,255,0.05) !important; }
        .sidebar-signout-btn:hover { background-color: rgba(239,68,68,0.2) !important; color: white !important; }
      `}</style>

      {/* ── Sidebar ── */}
      <aside style={{ ...styles.sidebar, width: collapsed ? 56 : 240, transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)' }}>
        <div style={{ ...styles.sidebarLogo, padding: collapsed ? '24px 8px' : '24px 20px', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div onClick={() => navigate('/lex/home')} style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 12, cursor: 'pointer', justifyContent: collapsed ? 'center' : 'flex-start', width: '100%' }}>
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

      {/* ── Main Container ── */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          position: 'relative',
          zIndex: 10,
          backgroundColor: '#ffffff',
          marginLeft: collapsed ? 56 : 240,
          transition: 'margin-left 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* Sticky Header */}
        <header
          style={{
            height: 80,
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            position: 'sticky',
            top: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 32,
            paddingRight: 32,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate(`/programs/${uni.id}`)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                backgroundColor: '#f1f5f9',
                border: '1px solid #cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#334155',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              title={`Back to ${uni.name}`}
            >
              <i className="fas fa-chevron-left" style={{ fontSize: 12 }} />
            </button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.25em', marginBottom: 2 }}>
                Overall Overview
              </span>
              <h2 style={{ fontSize: 13, fontWeight: 900, color: '#0f172a', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {uni.fullName}
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate(`/programs/${uni.id}`)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 12,
                color: '#334155',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              <i className="fas fa-arrow-left" style={{ fontSize: 12, color: '#4f46e5' }} />
              <span>Back to Programs</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div style={{ flex: 1, padding: 32, maxWidth: 1280, width: '100%', margin: '0 auto', backgroundColor: '#ffffff' }}>
          {uni.id === 'ggu' ? (
            <GGUOverallOverviewDashboard />
          ) : (
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 48, textAlign: 'center', margin: '32px 0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <i className="fas fa-chart-pie" style={{ fontSize: 48, color: '#cbd5e1', marginBottom: 16 }} />
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', marginBottom: 8 }}>Overall Overview Coming Soon</h3>
              <p style={{ fontSize: 14, color: '#64748b', maxWidth: 440, margin: '0 auto 24px', fontWeight: 500 }}>
                Operational analytics and overall overview metrics for {uni.fullName} are currently being prepared.
              </p>
              <button
                onClick={() => navigate(`/programs/${uni.id}`)}
                style={{ padding: '10px 24px', backgroundColor: '#0f172a', color: '#ffffff', fontWeight: 700, fontSize: 12, borderRadius: 12, border: 'none', cursor: 'pointer' }}
              >
                Return to {uni.name} Programs
              </button>
            </div>
          )}
        </div>

        <footer style={{ padding: '32px 0', borderTop: '1px solid #e2e8f0', textAlign: 'center', backgroundColor: '#ffffff' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4em' }}>
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
