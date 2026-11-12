import { useEffect, useRef, useState } from 'react';

const NOTES: Array<{ icon: string; title: string; text: string }> = [
  { icon: 'fa-clock-rotate-left', title: 'Data freshness', text: 'Data is gathered from multiple source systems and may lag by up to 1 day. Figures reflect the last refresh shown above.' },
  { icon: 'fa-scale-balanced', title: 'Official figures', text: 'This portal is a reporting view. Official enrolment and finance figures are those reconciled by our finance team.' },
  { icon: 'fa-person-digging', title: 'In development', text: 'This dashboard is under active development. Metrics, labels, and layouts may change between releases to optimize the portal for viewing.' },
];

/**
 * Top-bar "About this data" button: always visible, but the disclaimers only
 * open on click, so they never take space on the page itself.
 */
export default function DataDisclaimer() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="About this data"
        className={`flex items-center gap-2 h-[50px] px-3.5 rounded-2xl border bg-white text-[12px] font-semibold transition-colors outline-none focus:outline-none
          ${open ? 'border-slate-400 text-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}
        style={{ boxShadow: 'none' }}
      >
        <i className="fas fa-circle-info text-[13px] text-slate-400" />
        <span className="hidden md:inline">About this data</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="About this data"
          className="absolute right-0 top-full mt-2 z-50 w-[340px] max-w-[calc(100vw-32px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_20px_48px_-16px_rgba(0,0,0,0.3)]"
          style={{ animation: 'anaRise .15s ease-out both' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-bold text-slate-900">About this data</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 outline-none focus:outline-none"
              style={{ boxShadow: 'none' }}
            >
              <i className="fas fa-times text-[11px]" />
            </button>
          </div>
          <ul className="space-y-3">
            {NOTES.map(n => (
              <li key={n.title} className="flex items-start gap-3">
                <span className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center bg-slate-100 text-slate-500">
                  <i className={`fas ${n.icon} text-[11px]`} />
                </span>
                <div>
                  <div className="text-[12px] font-semibold text-slate-800">{n.title}</div>
                  <p className="text-[11.5px] leading-snug text-slate-500 mt-0.5">{n.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
