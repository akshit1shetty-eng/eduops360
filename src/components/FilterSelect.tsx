import { useEffect, useRef, useState } from 'react';

export interface FilterOption<T extends string | number> {
  value: T;
  label: string;
  /** Muted figure on the right of the option, e.g. "4,348 learners". */
  meta?: string;
}

/**
 * Portal-styled dropdown (replaces the native <select>, whose OS popup and
 * focus ring don't match the design). Options render in the order given.
 * With a single option it shows as a static, non-interactive pill.
 */
export default function FilterSelect<T extends string | number>({
  label, icon, value, options, onChange, size = 'md', align = 'right',
}: {
  label?: string;
  icon?: string;
  value: T | undefined;
  options: Array<FilterOption<T>>;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(o => o.value === value);
  const single = options.length <= 1;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const sm = size === 'sm';

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => !single && setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={options.length === 0}
        className={`inline-flex items-center gap-2 rounded-[10px] border bg-white transition-all outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300
          ${sm ? 'h-6 px-2 text-[10.5px] rounded-md gap-1.5' : 'h-8 px-3 text-[12px]'}
          ${open ? 'border-slate-400 shadow-[0_0_0_3px_rgba(15,23,42,0.06)]' : 'border-slate-200'}
          ${single ? 'cursor-default' : 'hover:border-slate-300 cursor-pointer'}`}
        style={{ boxShadow: open ? undefined : 'none' }}
      >
        {icon && <i className={`fas ${icon} ${sm ? 'text-[9px]' : 'text-[10px]'} text-slate-400`} />}
        {label && <span className="text-slate-500 font-medium">{label}</span>}
        <span className="font-semibold text-slate-900 whitespace-nowrap">{current?.label ?? '—'}</span>
        {!single && (
          <i className={`fas fa-chevron-down ${sm ? 'text-[7px]' : 'text-[9px]'} text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <ul
          role="listbox"
          className={`absolute z-40 top-full mt-1.5 ${align === 'right' ? 'right-0' : 'left-0'} min-w-full w-max p-1 rounded-xl border border-slate-200 bg-white shadow-[0_16px_40px_-16px_rgba(0,0,0,0.28)]`}
          style={{ animation: 'anaRise .15s ease-out both' }}
        >
          {options.map(o => {
            const sel = o.value === value;
            return (
              <li key={String(o.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={sel}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full flex items-center gap-3 rounded-lg text-left transition-colors outline-none focus:outline-none
                    ${sm ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-[12.5px]'}
                    ${sel ? 'bg-slate-100 text-slate-900 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                  style={{ boxShadow: 'none' }}
                >
                  <span className="w-3 shrink-0">{sel && <i className="fas fa-check text-[9px] text-brand-500" />}</span>
                  <span className="flex-1 whitespace-nowrap">{o.label}</span>
                  {o.meta && <span className="ml-3 text-[10.5px] font-normal text-slate-400 tabular-nums whitespace-nowrap">{o.meta}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
