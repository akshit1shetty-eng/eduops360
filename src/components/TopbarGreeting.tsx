import { useAuth } from '../hooks/useAuth';

/** Top bar greeting: "Welcome back, <Name>". */
export default function TopbarGreeting() {
  const { profile } = useAuth();
  const firstName = (profile?.full_name || profile?.email?.split('@')[0] || '').split(' ')[0];

  return (
    <div className="topbar-greeting">
      <span className="topbar-greeting-title">
        Welcome back{firstName && <>, <span className="topbar-greeting-name">{firstName}</span></>}
      </span>
    </div>
  );
}
