import { useAuth } from '../hooks/useAuth';

/** Top bar greeting: "Good to see you, <Name>". */
export default function TopbarGreeting() {
  const { profile } = useAuth();
  const firstName = (profile?.full_name || profile?.email?.split('@')[0] || '').split(' ')[0];

  return (
    <div className="topbar-greeting">
      <span className="topbar-greeting-title">
        Good to see you{firstName && <>, <span className="topbar-greeting-name">{firstName}</span></>}
      </span>
    </div>
  );
}
