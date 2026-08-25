import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LexFilterProvider, useLexFilter } from '../../hooks/useLexFilter';
import { UNIVERSITIES, getAssignedUniversityId, hasUniversityAccess, hasProgramAccess } from '../../lib/universities';
import { useAuth } from '../../hooks/useAuth';

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

  useEffect(() => {
    if (permissions) {
      const allowedUnis = UNIVERSITIES.filter(uni => {
        const hasUni = hasUniversityAccess(permissions, uni.id);
        const allowedPrograms = uni.programs.filter(p => hasProgramAccess(permissions, p.id, uni.id));
        return hasUni || allowedPrograms.length > 0;
      });

      const hasGlobal = permissions.includes('page_admin') || permissions.includes('page_home');

      if (!hasGlobal || allowedUnis.length === 1) {
        if (allowedUnis.length > 0 && selectedUniversityId !== allowedUnis[0].id) {
          setSelectedUniversityId(allowedUnis[0].id);
        }
      }
    }
  }, [permissions, selectedUniversityId, setSelectedUniversityId]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'Home', path: '/lex/home', icon: 'fas fa-home', permission: 'page_home' },
    { name: 'Learners', path: '/lex/learners', icon: 'fas fa-users', permission: 'page_learners' },
  ].filter(item => permissions?.includes(item.permission));

  // Helper to check if a university is available (has at least one available program)
  const isUniAvailable = (uniId: string) => {
    const uni = UNIVERSITIES.find(u => u.id === uniId);
    return uni?.programs.some(p => p.available) ?? false;
  };

  const [isUniOpen, setIsUniOpen] = useState(false);
  const selectedUni = UNIVERSITIES.find(u => u.id === selectedUniversityId);

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

      {/* Decorative Background for Light Mode */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]" />
      </div>

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
            <div style={{
              ...styles.sidebarLogoIcon,
              width: collapsed ? 36 : 40,
              height: collapsed ? 36 : 40,
            }}>
              <i className="fas fa-graduation-cap" style={{ color: 'white', fontSize: collapsed ? 18 : 22 }} />
            </div>
            {!collapsed && (
              <div>
                <div style={{ color: 'white', fontWeight: 900, fontSize: 16, letterSpacing: '-0.01em' }}>EduOps360</div>
                <div style={{ color: 'rgba(148,163,184,0.6)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Overall Dashboard</div>
              </div>
            )}
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
          <NavLink
            to="/programs"
            className="sidebar-nav-item"
            style={({ isActive }) => ({
              ...(isActive ? styles.navItemActive : styles.navItem),
              padding: collapsed ? '10px 0' : '10px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
            })}
            title={collapsed ? "Universities" : undefined}
          >
            <i className="fas fa-university" style={{ fontSize: 14 }} />
            {!collapsed && <span>Universities</span>}
          </NavLink>
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

      {/* Main Content */}
      <main
        className="flex-1 flex flex-col min-h-screen relative z-10"
        style={{
          marginLeft: collapsed ? 56 : 240,
          transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-40 flex items-center justify-between px-8">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-indigo-700 uppercase tracking-[0.25em] mb-1">Operational Intel</span>
            <h2 className="text-[11px] font-black text-slate-900 tracking-widest uppercase">Overall Dashboard</h2>
          </div>

          <div className="flex items-center space-x-4">
            {/* Global University Filter - Modern Custom Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsUniOpen(!isUniOpen)}
                className={`flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all duration-300 ${isUniOpen ? 'bg-white border-indigo-200 shadow-lg ring-4 ring-indigo-500/5' : 'bg-slate-50 border-slate-200 hover:border-indigo-200 hover:bg-white'}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${selectedUni ? 'bg-indigo-700 text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-100'}`}>
                  <i className={`fas ${selectedUni ? 'fa-university' : 'fa-globe-americas'} text-[10px]`} />
                </div>
                <div className="flex flex-col items-start min-w-[120px]">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">University</span>
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-wider truncate max-w-[140px]">
                    {selectedUni ? selectedUni.name : 'All Universities'}
                  </span>
                </div>
                <i className={`fas fa-chevron-down text-[9px] text-slate-300 transition-transform duration-300 ${isUniOpen ? 'rotate-180 text-indigo-500' : ''}`} />
              </button>

              {isUniOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsUniOpen(false)} />
                  <div className="absolute right-0 mt-3 w-72 bg-white rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-slate-50 bg-slate-50/30">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-3">Select Context</span>
                    </div>
                    <div className="p-2 max-h-[320px] overflow-y-auto custom-scrollbar">
                      {(() => {
                        const allowedUnis = UNIVERSITIES.filter(uni => {
                          const hasUni = hasUniversityAccess(permissions, uni.id);
                          const allowedPrograms = uni.programs.filter(p => hasProgramAccess(permissions, p.id, uni.id));
                          return hasUni || allowedPrograms.length > 0;
                        });
                        const hasGlobal = permissions?.includes('page_admin') || permissions?.includes('page_home');
                        
                        return (
                          <>
                            {hasGlobal && allowedUnis.length > 1 && (
                              <>
                                <button
                                  onClick={() => { setSelectedUniversityId(null); setIsUniOpen(false); }}
                                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all ${!selectedUniversityId ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                >
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${!selectedUniversityId ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    <i className="fas fa-globe-americas text-[10px]" />
                                  </div>
                                  <div className="flex flex-col items-start">
                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">All Universities</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Enterprise View</span>
                                  </div>
                                  {!selectedUniversityId && <i className="fas fa-check-circle text-indigo-600 ml-auto text-xs" />}
                                </button>

                                <div className="my-2 border-t border-slate-50 mx-3" />
                              </>
                            )}

                            {allowedUnis.map(uni => {
                              const available = isUniAvailable(uni.id);
                              const isSelected = selectedUniversityId === uni.id;
                              return (
                                <button
                                  key={uni.id}
                                  disabled={!available}
                                  onClick={() => { setSelectedUniversityId(uni.id); setIsUniOpen(false); }}
                                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-left mb-1 ${isSelected ? 'bg-indigo-50' : available ? 'hover:bg-slate-50' : 'opacity-40 cursor-not-allowed'}`}
                                >
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isSelected ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    <i className="fas fa-university text-[10px]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight truncate">{uni.name}</span>
                                      {!available && <span className="text-[7px] font-black bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Under Const.</span>}
                                    </div>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{uni.programs.length} Programs Registered</span>
                                  </div>
                                  {isSelected && <i className="fas fa-check-circle text-indigo-600 ml-auto text-xs" />}
                                </button>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-8">
          <Outlet />
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
    background: 'linear-gradient(160deg, #0f172a 0%, #1e1b4b 100%)',
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
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(99,102,241,0.4)',
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
