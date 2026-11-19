import { useEffect, useState } from 'react';
import { useGGUStudentList, retryGGUStudentList, loadStartedAt } from '../hooks/useGGUStudentList';

/** Don't flash the banner for loads that finish almost instantly. */
const SHOW_AFTER_MS = 1200;
/** After this long, say it's slower than usual. */
const SLOW_AFTER_MS = 15000;

/**
 * Portal-wide notice about the learner data: shown while it is being fetched (the
 * first load after the portal has been idle can take a few seconds) and, if the
 * load fails, an apology with a Retry button.
 */
export default function DataStatusBanner() {
  const { loading, error } = useGGUStudentList();
  const [now, setNow] = useState(() => Date.now());

  // Tick while loading so the banner can appear after a moment and update its message
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [loading]);

  const elapsed = loading && loadStartedAt ? now - loadStartedAt : 0;

  if (error) {
    return (
      <div
        role="alert"
        className="max-w-7xl mx-auto mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3"
        style={{ background: '#FDECEE', borderColor: '#F5C2C7', animation: 'anaRise .25s ease-out both' }}
      >
        <span className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-white" style={{ background: '#E50913' }}>
          <i className="fas fa-triangle-exclamation text-[12px]" />
        </span>
        <div className="flex-1 min-w-[220px]">
          <p className="text-[13px] font-bold" style={{ color: '#8A0B12' }}>We couldn't load the learner data</p>
          <p className="text-[12px] mt-0.5" style={{ color: '#8A0B12', opacity: 0.85 }}>
            There's an issue on our side and we're looking into it. Figures may be missing until it's resolved — please try again in a few minutes.
          </p>
        </div>
        <button
          type="button"
          onClick={retryGGUStudentList}
          className="px-3.5 py-2 rounded-[10px] text-[12px] font-semibold text-white hover:brightness-110 transition-all"
          style={{ background: '#E50913' }}
        >
          <i className="fas fa-rotate-right mr-1.5 text-[10px]" />Retry
        </button>
      </div>
    );
  }

  if (!loading || elapsed < SHOW_AFTER_MS) return null;

  const slow = elapsed >= SLOW_AFTER_MS;
  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-7xl mx-auto mb-5 flex items-center gap-3 rounded-2xl border px-4 py-3"
      style={{ background: '#F3F6FB', borderColor: '#D6E0EE', animation: 'anaRise .25s ease-out both' }}
    >
      <span className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center" style={{ background: '#E1E8F3', color: '#2A4A75' }}>
        <i className="fas fa-circle-notch fa-spin text-[12px]" />
      </span>
      <div>
        <p className="text-[13px] font-bold" style={{ color: '#1E3557' }}>
          {slow ? 'Still fetching the latest data…' : 'Fetching the latest data'}
        </p>
        <p className="text-[12px] mt-0.5" style={{ color: '#2A4A75' }}>
          {slow
            ? 'This is taking longer than usual — the data source is responding slowly. Thanks for your patience.'
            : 'This can take a few seconds when the portal has been idle. Figures will appear as soon as it loads.'}
        </p>
      </div>
    </div>
  );
}
