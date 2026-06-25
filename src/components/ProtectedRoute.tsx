import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { UNIVERSITIES, getAssignedUniversityId, hasProgramAccess } from '../lib/universities';

interface ProtectedRouteProps {
  /** If true, also requires page_admin permission */
  requireAdmin?: boolean;
}

/**
 * Renders a premium, interactive Access Denied glassmorphism block screen.
 */
function AccessDeniedScreen({ role, requiredPermission }: { role: string; requiredPermission: string }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/lex/home');
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      {/* Glow Orbs */}
      <div style={styles.orbContainer}>
        <div style={{ ...styles.orb, background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)', top: '15%', left: '20%', width: 500, height: 500 }} />
        <div style={{ ...styles.orb, background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)', bottom: '15%', right: '20%', width: 450, height: 450 }} />
      </div>

      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <i className="fas fa-user-lock" style={{ color: 'white', fontSize: 32 }} />
        </div>

        <h1 style={styles.title}>Access Denied</h1>

        <p style={styles.message}>
          Your assigned role <span style={styles.highlight}>'{role}'</span> does not have the necessary permission to access the <span style={styles.highlight}>'{requiredPermission}'</span> page.
        </p>

        <div style={styles.btnGroup}>
          <button onClick={handleGoHome} style={styles.primaryBtn}>
            <i className="fas fa-home" style={{ marginRight: 8 }} />Go to Home
          </button>
          <button onClick={handleLogout} style={styles.secondaryBtn}>
            <i className="fas fa-sign-out-alt" style={{ marginRight: 8 }} />Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Wraps routes that require authentication and granular role permission checks.
 */
export default function ProtectedRoute({ requireAdmin = false }: ProtectedRouteProps) {
  const { session, profile, permissions, loading } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{
            width: 48, height: 48,
            border: '3px solid rgba(99,102,241,0.25)',
            borderTop: '3px solid #6366f1',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: 13, fontWeight: 600, margin: 0 }}>
            Authenticating…
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not logged in → go to login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // 1. Check Admin dashboard requirement
  if (requireAdmin && !permissions.includes('page_admin')) {
    return <AccessDeniedScreen role={profile?.role || 'user'} requiredPermission="Admin Panel Console" />;
  }

  // 2. Check granular path permissions
  let isAuthorized = true;
  let pageName = '';

  const pathSegments = path.split('/').filter(Boolean);
  const possibleProgramId = pathSegments[0];
  const isProgramSpecificRoute = possibleProgramId &&
    possibleProgramId !== 'lex' &&
    possibleProgramId !== 'admin' &&
    possibleProgramId !== 'programs' &&
    possibleProgramId !== 'login';

  // Only check global page permissions for global routes (i.e. under /lex)
  if (!isProgramSpecificRoute) {
    if (path.includes('/learners')) {
      isAuthorized = permissions.includes('page_learners');
      pageName = 'Learners Directory';
    } else if (path.includes('/budget')) {
      isAuthorized = permissions.includes('page_budget');
      pageName = 'Financial Budgets';
    } else if (path.includes('/home')) {
      isAuthorized = permissions.includes('page_home');
      pageName = 'Dashboard Home';
    }
  }

  if (!isAuthorized) {
    return <AccessDeniedScreen role={profile?.role || 'user'} requiredPermission={pageName} />;
  }

  // 3. Check University & Program Level access restrictions
  if (isProgramSpecificRoute) {
    const programUni = UNIVERSITIES.find((u) =>
      u.programs.some((p) => p.id === possibleProgramId)
    );
    if (programUni) {
      const hasAccess = hasProgramAccess(permissions, possibleProgramId, programUni.id);
      if (!hasAccess) {
        return (
          <AccessDeniedScreen
            role={profile?.role || 'user'}
            requiredPermission={`${programUni.name} - Program Access`}
          />
        );
      }
    }
  }

  return <Outlet />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #090d16 0%, #1a0f1a 50%, #090d16 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  orbContainer: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  orb: {
    position: 'absolute',
    borderRadius: '50%',
    opacity: 0.8,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    border: '1px solid rgba(239,68,68,0.15)',
    borderRadius: 28,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 460,
    textAlign: 'center',
    position: 'relative',
    zIndex: 10,
    boxShadow: '0 32px 80px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)',
  },
  iconWrapper: {
    width: 76, height: 76,
    background: 'linear-gradient(135deg, #ef4444 0%, #ec4899 100%)',
    borderRadius: 22,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 28px',
    boxShadow: '0 12px 36px rgba(239,68,68,0.4)',
  },
  title: {
    color: '#fca5a5', fontSize: 24, fontWeight: 900, margin: '0 0 12px',
    letterSpacing: '-0.02em',
  },
  message: {
    color: 'rgba(148,163,184,0.75)', fontSize: 14, margin: '0 0 32px',
    lineHeight: 1.6, fontWeight: 500,
  },
  highlight: {
    color: '#fff', fontWeight: 700,
  },
  btnGroup: {
    display: 'flex',
    gap: 12,
    justifyContent: 'center',
  },
  primaryBtn: {
    flex: 1,
    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    border: 'none', borderRadius: 12,
    padding: '12px 20px',
    color: 'white', fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 18px rgba(79,70,229,0.3)',
    transition: 'all 0.2s',
  },
  secondaryBtn: {
    flex: 1,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: '11px 20px',
    color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
