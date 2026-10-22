import { useAuth } from '../hooks/useAuth';

/** Top bar greeting: "Welcome back, <Name>" with today's date underneath. */
export default function TopbarGreeting() {
  const { profile } = useAuth();
  const firstName = (profile?.full_name || profile?.email?.split('@')[0] || '').split(' ')[0];
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="topbar-greeting">
      <span className="topbar-greeting-title">
        Welcome back{firstName && <>, <span className="topbar-greeting-name">{firstName}</span></>}
      </span>
      <span className="topbar-greeting-date">
        <span className="live-dot" title="Live data" />
        {today}
      </span>
    </div>
  );
}
