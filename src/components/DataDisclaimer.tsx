const NOTES: Array<{ icon: string; text: string }> = [
  { icon: 'fa-clock-rotate-left', text: 'Data is gathered from multiple source systems and may lag by up to 1 day. Figures reflect the last refresh shown above.' },
  { icon: 'fa-scale-balanced', text: 'This portal is a reporting view. Official enrolment and finance figures are those reconciled by our finance team.' },
  { icon: 'fa-person-digging', text: 'This dashboard is under active development. Metrics, labels, and layouts may change between releases to optimize the portal for viewing.' },
];

/** Portal-wide disclaimers, shown at the foot of every page. */
export default function DataDisclaimer() {
  return (
    <footer className="max-w-7xl mx-auto w-full mt-10 pt-5 border-t border-slate-200/80" aria-label="Data disclaimers">
      <ul className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-2.5">
        {NOTES.map(n => (
          <li key={n.icon} className="flex items-start gap-2 text-[11px] leading-snug text-slate-500">
            <i className={`fas ${n.icon} text-[10px] text-slate-400 mt-[3px] w-3 shrink-0`} />
            <span>{n.text}</span>
          </li>
        ))}
      </ul>
    </footer>
  );
}
