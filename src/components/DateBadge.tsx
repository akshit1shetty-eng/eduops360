/** Today's date pill shown at the top-right of page headers (e.g. "OCT 23, 2026"). */
export default function DateBadge() {
  return (
    <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm flex items-center shrink-0">
      <i className="fas fa-calendar-alt text-brand-700 mr-2 text-xs" />
      <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">
        {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </span>
    </div>
  );
}
