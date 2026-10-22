import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../lib/authService';
import { useAuth } from '../hooks/useAuth';

type Step = 'email' | 'otp';

export default function LoginPage() {
  const navigate = useNavigate();
  const { session, profile, permissions, loading } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Already logged in user → bypass and go directly to app
  useEffect(() => {
    if (!loading && session && profile) {
      if (permissions.includes('page_home')) {
        navigate('/lex/home', { replace: true });
      } else {
        navigate('/programs', { replace: true });
      }
    }
  }, [session, profile, permissions, loading, navigate]);

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const doSendOtp = useCallback(async (emailVal: string) => {
    setSending(true);
    setError('');
    try {
      await authService.sendOtp(emailVal);
      setSending(false);
      return true;
    } catch (err: unknown) {
      setSending(false);
      const msg = err instanceof Error ? err.message : 'Failed to send verification code';
      setError(msg);
      return false;
    }
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    const ok = await doSendOtp(trimmed);
    if (ok) {
      setStep('otp');
      setCooldown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 150);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || sending) return;
    const ok = await doSendOtp(email.trim().toLowerCase());
    if (ok) { setCooldown(60); setOtp(Array(6).fill('')); }
  };

  const verifyOtp = useCallback(async (token: string) => {
    setVerifying(true);
    setError('');
    const { error: verifyError } = await authService.verifyOtp(email, token);
    if (verifyError) {
      setVerifying(false);
      setError(verifyError.message || 'Invalid or expired code. Please try again.');
      setOtp(Array(6).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      return;
    }
    // We do NOT navigate immediately. The useEffect handles regular users, and the component
    // state checks if they are admin to show the Choice Portal.
  }, [email]);

  const handleOtpChange = (i: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[i] = value;
    setOtp(next);
    if (value && i < 5) inputRefs.current[i + 1]?.focus();
    if (next.every(d => d !== '') && next.join('').length === 6) verifyOtp(next.join(''));
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) inputRefs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) inputRefs.current[i + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = Array(6).fill('');
    text.split('').forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    if (text.length === 6) verifyOtp(text);
    else inputRefs.current[text.length]?.focus();
  };


  if (loading) {
    return (
      <div style={styles.fullPage}>
        <div style={styles.spinner} />
        <style>{animations}</style>
      </div>
    );
  }

  // ─── Render: Loading State if already logged in (redirecting) ───────────────
  if (session && profile) {
    return (
      <div style={styles.fullPage}>
        <div style={styles.spinner} />
        <style>{animations}</style>
      </div>
    );
  }

  // ─── Render: Standard Email/OTP Auth Flow ──────────────────────────────────
  return (
    <div className="login-split">
      {/* Brand panel (hidden on small screens) */}
      <aside className="login-hero" aria-hidden="true">
        <div className="login-hero-aurora" />
        <div className="login-hero-grid" />
        <div className="login-hero-inner">
          <div className="login-hero-brand">
            <div className="login-hero-logo"><i className="fas fa-graduation-cap" /></div>
            <span>EduOps<b>360</b></span>
          </div>

          <div>
            <p className="login-hero-kicker">Operations Intelligence Platform</p>
            <h2 className="login-hero-title">
              Every learner journey,<br />
              <em>one clear view.</em>
            </h2>
            <p className="login-hero-copy">
              Live enrolment, academic progress, sessions and budgets across every partner university — in a single console.
            </p>

            <ul className="login-hero-features">
              <li><i className="fas fa-chart-line" /><div><b>Live dashboards</b><span>Synced from programme trackers</span></div></li>
              <li><i className="fas fa-university" /><div><b>Multi-university</b><span>GGU, PSB, ESGCI, Edgewood</span></div></li>
              <li><i className="fas fa-shield-alt" /><div><b>Role-based access</b><span>Everyone sees exactly what they need</span></div></li>
            </ul>
          </div>

          <div className="login-hero-foot">
            <span className="live-dot" /> All systems operational
            <span style={{ opacity: 0.4 }}>·</span> Powered by upGrad
          </div>
        </div>
      </aside>

      {/* Sign-in pane */}
      <section className="login-pane">
      <div style={styles.card}>
        {/* Logo */}
        <div className="login-card-brand" style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={styles.logoBox}>
            <i className="fas fa-graduation-cap" style={{ color: 'white', fontSize: 28 }} />
          </div>
          <h1 style={styles.brandTitle}>
            EduOps<span style={{ color: '#D91E2F' }}>360</span>
          </h1>
          <p style={styles.brandSub}>Operations Intelligence Platform</p>
        </div>

        {/* Step: Email */}
        {step === 'email' && (
          <form onSubmit={handleSendOtp}>
            <div style={{ marginBottom: 28 }}>
              <h2 style={styles.heading}>Welcome back</h2>
              <p style={styles.subheading}>Enter your email to receive a sign-in code</p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={styles.label}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                style={styles.input}
                onFocus={e => {
                  e.currentTarget.style.borderColor = '#D91E2F';
                  e.currentTarget.style.boxShadow = '0 0 0 4px rgba(217, 30, 47, 0.1)';
                  e.currentTarget.style.background = '#ffffff';
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = '#ffffff';
                }}
              />
            </div>

            {error && <div style={styles.errorBox}><i className="fas fa-exclamation-circle" style={{ marginRight: 8 }} />{error}</div>}

            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="primary-btn"
              style={{
                ...styles.primaryBtn,
                opacity: (sending || !email.trim()) ? 0.6 : 1,
                cursor: (sending || !email.trim()) ? 'not-allowed' : 'pointer'
              }}
            >
              {sending
                ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }} />Sending code…</>
                : <><i className="fas fa-paper-plane" style={{ marginRight: 8 }} />Send OTP</>
              }
            </button>
          </form>
        )}

        {/* Step: OTP */}
        {step === 'otp' && (
          <div>
            <div style={{ marginBottom: 28 }}>
              <h2 style={styles.heading}>Check your inbox</h2>
              <p style={styles.subheading}>
                We sent a 6-digit code to{' '}
                <span style={{ color: '#D91E2F', fontWeight: 800 }}>{email}</span>
              </p>
            </div>

            {/* OTP Input Boxes */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  onPaste={i === 0 ? handleOtpPaste : undefined}
                  disabled={verifying}
                  style={{
                    width: 50, height: 58,
                    textAlign: 'center',
                    fontSize: 24, fontWeight: 900,
                    background: digit ? '#FEF2F3' : '#ffffff',
                    border: `${digit ? '2px' : '1px'} solid ${digit ? '#D91E2F' : '#cbd5e1'}`,
                    borderRadius: 14,
                    color: '#0f172a',
                    outline: 'none',
                    transition: 'all 0.15s',
                    caretColor: '#D91E2F',
                    opacity: verifying ? 0.5 : 1,
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#D91E2F';
                    e.currentTarget.style.background = '#FEF2F3';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = digit ? '#D91E2F' : '#cbd5e1';
                    e.currentTarget.style.background = digit ? '#FEF2F3' : '#ffffff';
                  }}
                />
              ))}
            </div>

            {verifying && (
              <div style={{ textAlign: 'center', color: '#475569', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
                <i className="fas fa-spinner fa-spin" style={{ marginRight: 8, color: '#D91E2F' }} />Verifying…
              </div>
            )}

            {error && <div style={styles.errorBox}><i className="fas fa-exclamation-circle" style={{ marginRight: 8 }} />{error}</div>}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(Array(6).fill('')); setError(''); }}
                className="ghost-btn"
                style={styles.ghostBtn}
              >
                <i className="fas fa-arrow-left" style={{ fontSize: 10, marginRight: 6 }} />Change email
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || sending}
                className="ghost-btn"
                style={{
                  ...styles.ghostBtn,
                  color: cooldown > 0 ? '#94a6b8' : '#D91E2F',
                  cursor: cooldown > 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : <><i className="fas fa-redo" style={{ fontSize: 10, marginRight: 6 }} />Resend code</>}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <span><i className="fas fa-lock" style={{ marginRight: 6 }} />Secure one-time code sign-in</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>EduOps360 v2.2</span>
        </div>
      </div>
      </section>

      <style>{animations}</style>
    </div>
  );

}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  fullPage: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #78161F 0%, #ED2B3B 100%)',
    backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px)',
    backgroundSize: '24px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
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
    animationTimingFunction: 'ease-in-out',
    animationIterationCount: 'infinite',
  },
  card: {
    background: '#ffffff',
    border: '1px solid rgba(15, 23, 42, 0.06)',
    borderRadius: 28,
    padding: '48px 44px',
    width: '100%',
    maxWidth: 430,
    position: 'relative',
    zIndex: 10,
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 30px 60px -24px rgba(15, 23, 42, 0.18)',
  },
  logoBox: {
    width: 68, height: 68,
    background: 'linear-gradient(135deg, #D91E2F 0%, #ED2B3B 100%)',
    borderRadius: 20,
    display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 16px',
    boxShadow: '0 8px 24px rgba(217, 30, 47, 0.25)',
  },
  brandTitle: {
    color: '#0f172a', fontSize: 28, fontWeight: 900, margin: '0 0 4px',
    letterSpacing: '-0.025em',
  },
  brandSub: {
    color: '#64748b', fontSize: 11, margin: 0,
    fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  heading: {
    color: '#0f172a', fontSize: 21, fontWeight: 800, margin: '0 0 6px',
    letterSpacing: '-0.01em',
  },
  subheading: {
    color: '#475569', fontSize: 13, margin: 0, lineHeight: 1.5,
  },
  label: {
    display: 'block',
    color: '#475569',
    fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.1em',
    marginBottom: 8,
  },
  input: {
    width: '100%', boxSizing: 'border-box',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: 13,
    padding: '14px 16px',
    color: '#0f172a', fontSize: 15, fontWeight: 500,
    outline: 'none',
    transition: 'all 0.2s',
  },
  primaryBtn: {
    width: '100%',
    background: 'linear-gradient(135deg, #D91E2F 0%, #ED2B3B 100%)',
    border: 'none', borderRadius: 13,
    padding: '15px 24px',
    color: 'white', fontSize: 15, fontWeight: 800,
    letterSpacing: '0.02em',
    boxShadow: '0 4px 16px rgba(217, 30, 47, 0.2)',
    transition: 'all 0.2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
  },
  ghostBtn: {
    background: 'none', border: 'none',
    color: '#D91E2F',
    fontSize: 12, fontWeight: 700,
    cursor: 'pointer', padding: 0,
    display: 'flex', alignItems: 'center',
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 11,
    padding: '11px 14px',
    marginBottom: 18,
    color: '#991b1b',
    fontSize: 13, fontWeight: 600,
    display: 'flex', alignItems: 'center',
  },
  footer: {
    marginTop: 32,
    paddingTop: 20,
    borderTop: '1px solid #e2e8f0',
    textAlign: 'center',
    color: '#94a6b8',
    fontSize: 11,
    fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  spinner: {
    width: 44, height: 44,
    border: '3px solid rgba(217, 30, 47, 0.1)',
    borderTop: '3px solid #D91E2F',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  adminBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    background: 'rgba(217, 30, 47, 0.06)',
    border: '1px solid rgba(217, 30, 47, 0.2)',
    borderRadius: 20,
    padding: '5px 12px',
    color: '#D91E2F',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 20,
    alignSelf: 'center',
  },
  adminBadgeDot: {
    width: 6, height: 6,
    borderRadius: '50%',
    background: '#D91E2F',
    boxShadow: '0 0 6px rgba(217, 30, 47, 0.8)',
    animation: 'pulse 2s ease-in-out infinite',
  },
  portalCardApp: {
    background: 'rgba(217, 30, 47, 0.03)',
    border: '1px solid rgba(217, 30, 47, 0.1)',
    borderRadius: 16,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    cursor: 'pointer',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    color: '#0f172a',
  },
  portalCardAdmin: {
    background: 'rgba(29, 78, 216, 0.03)',
    border: '1px solid rgba(29, 78, 216, 0.1)',
    borderRadius: 16,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    cursor: 'pointer',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    color: '#0f172a',
  },
  portalCardIconApp: {
    width: 42, height: 42,
    background: 'rgba(217, 30, 47, 0.08)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#D91E2F', fontSize: 18,
  },
  portalCardIconAdmin: {
    width: 42, height: 42,
    background: 'rgba(29, 78, 216, 0.08)',
    borderRadius: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#B71826', fontSize: 18,
  },
  portalCardTitle: {
    fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 2,
  },
  portalCardDesc: {
    fontSize: 11, color: '#64748b', fontWeight: 500,
  },
  portalCardArrow: {
    color: '#cbd5e1', fontSize: 12, marginLeft: 'auto',
  },
  portalSignOutBtn: {
    background: 'none',
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    padding: '11px 24px',
    color: '#64748b',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};

const animations = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes float1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(24px,-16px) scale(1.03); } }
  @keyframes float2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-16px,24px) scale(0.97); } }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  
  input[type="text"]::placeholder, input[type="email"]::placeholder { 
    color: #94a6b8; 
  }
  
  .primary-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px rgba(217, 30, 47, 0.3) !important;
  }
  .primary-btn:active {
    transform: translateY(0);
  }
  
  .ghost-btn {
    transition: all 0.2s ease;
  }
  .ghost-btn:hover {
    color: #B71826 !important;
  }
  
  .portal-card {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .portal-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.08) !important;
  }
  .portal-card-app:hover {
    background: rgba(217, 30, 47, 0.08) !important;
    border-color: rgba(217, 30, 47, 0.3) !important;
  }
  .portal-card-admin:hover {
    background: rgba(29, 78, 216, 0.08) !important;
    border-color: rgba(29, 78, 216, 0.3) !important;
  }

  .signout-btn {
    transition: all 0.2s ease;
  }
  .signout-btn:hover {
    background: #f1f5f9 !important;
    color: #0f172a !important;
    border-color: #cbd5e1 !important;
  }
`;

