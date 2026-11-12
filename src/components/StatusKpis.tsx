import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAllLearnerData } from '../hooks/useAllLearnerData';
import { useLexFilter } from '../hooks/useLexFilter';
import { v } from '../lib/logic';
import StatusBreakdownPanel from './StatusBreakdownPanel';

interface KpiDef {
  key: 'total' | 'active' | 'loa' | 'exit';
  label: string;
  caption: string;
  icon: string;
  value: number;
  /** tint for the icon chip (class) + meter colour (hex, inline so global CSS overrides can't wash it out) */
  tone: { chip: string; bar: string };
  to: string;
  showShare: boolean;
}

function Skeleton({ className }: { className: string }) {
  return <span className={`inline-block rounded bg-slate-200 animate-pulse ${className}`} />;
}

/**
 * The four learner-status cards — Total learners, Active, Leave of absence,
 * Exited — strictly from Column U (GGU Data Type). LOA and Exited expand into
 * their reasons (Column R, Actual Status). Shared by the Overall Dashboard and
 * Program Insights so both always show the same figures.
 */
export default function StatusKpis() {
  const navigate = useNavigate();
  const { selectedUniversityId } = useLexFilter();
  const { students, loading } = useAllLearnerData(selectedUniversityId);
  const [openKey, setOpenKey] = useState<'loa' | 'exit' | null>(null);

  const stats = useMemo(() => {
    let total = 0, active = 0, loa = 0, exit = 0;
    const loaSub: Record<string, number> = {};
    const exitSub: Record<string, number> = {};
    const subStatusOf = (s: Record<string, any>) =>
      (v(s, 'Actual Status', 'actual_status') || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim() || 'Not specified';
    const toList = (m: Record<string, number>) =>
      Object.entries(m).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

    for (const s of students) {
      total++;
      const dataType = (v(s, 'GGU Data Type', 'ggu_data_type', 'col_20') || '').trim().toLowerCase();
      if (dataType === 'active') active++;
      else if (dataType === 'loa' || dataType === 'inactive') {
        loa++;
        const sub = subStatusOf(s);
        loaSub[sub] = (loaSub[sub] || 0) + 1;
      } else if (dataType === 'exit') {
        exit++;
        const sub = subStatusOf(s);
        exitSub[sub] = (exitSub[sub] || 0) + 1;
      }
    }
    return { total, active, loa, exit, loaSubStatuses: toList(loaSub), exitSubStatuses: toList(exitSub) };
  }, [students]);

  const kpis: KpiDef[] = [
    { key: 'total', label: 'Total learners', caption: 'All enrolments', icon: 'fa-users', value: stats.total, tone: { chip: 'bg-slate-900 text-white', bar: '#1A1A1B' }, to: '/lex/learners', showShare: false },
    { key: 'active', label: 'Active', caption: 'Currently studying', icon: 'fa-user-check', value: stats.active, tone: { chip: 'bg-brand-50 text-brand-600', bar: '#E50913' }, to: '/lex/learners?status=Active', showShare: true },
    { key: 'loa', label: 'Leave of absence', caption: 'In process of deferral', icon: 'fa-clock', value: stats.loa, tone: { chip: 'bg-amber-50 text-amber-600', bar: '#d9a21b' }, to: '/lex/learners?status=IPD', showShare: true },
    { key: 'exit', label: 'Exited', caption: 'Inactive or dropped', icon: 'fa-user-minus', value: stats.exit, tone: { chip: 'bg-slate-100 text-slate-600', bar: '#64748B' }, to: '/lex/learners?status=Exit', showShare: true },
  ];

  const breakdowns = {
    loa: {
      title: 'Why learners are on leave', icon: 'fa-clock', total: stats.loa, items: stats.loaSubStatuses,
      empty: 'No learners on leave of absence.', to: '/lex/learners?status=IPD',
      color: '#d9a21b', tint: '#FBF3E0',
      ring: 'border-amber-300 ring-2 ring-amber-100', chevron: 'text-amber-500', chevronHover: 'group-hover:text-amber-500',
    },
    exit: {
      title: 'Why learners exited', icon: 'fa-user-minus', total: stats.exit, items: stats.exitSubStatuses,
      empty: 'No exited learners.', to: '/lex/learners?status=Exit',
      color: '#475569', tint: '#F1F5F9',
      ring: 'border-slate-400 ring-2 ring-slate-100', chevron: 'text-slate-600', chevronHover: 'group-hover:text-slate-600',
    },
  } as const;
  const openBreakdown = openKey ? breakdowns[openKey] : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map(k => {
          const share = (k.value / (stats.total || 1)) * 100;
          const bKey = k.key === 'loa' || k.key === 'exit' ? k.key : null;
          const b = bKey ? breakdowns[bKey] : null;
          const isOpen = bKey !== null && openKey === bKey;
          return (
            <button
              key={k.key}
              type="button"
              onClick={() => (bKey ? setOpenKey(o => (o === bKey ? null : bKey)) : navigate(k.to))}
              aria-expanded={bKey ? isOpen : undefined}
              className={`group text-left bg-white rounded-2xl border px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.18)] hover:-translate-y-0.5 transition-all duration-300 ${isOpen && b ? b.ring : 'border-slate-200/70 hover:border-slate-300'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`w-6 h-6 rounded-md flex items-center justify-center ${k.tone.chip}`}>
                  <i className={`fas ${k.icon} text-[9px]`} />
                </span>
                {b ? (
                  <i className={`fas fa-chevron-down text-[10px] ${b.chevronHover} transition-transform duration-300 ${isOpen ? `rotate-180 ${b.chevron}` : 'text-slate-300'}`} />
                ) : (
                  <i className="fas fa-arrow-right text-[10px] text-slate-300 group-hover:text-brand-500 group-hover:translate-x-0.5 transition-all" />
                )}
              </div>
              <div className="mt-2 text-[11px] font-medium text-slate-500">{k.label}</div>
              <div className="mt-0.5 text-[21px] leading-none font-extrabold text-slate-900 font-display tabular-nums">
                {loading ? <Skeleton className="h-5 w-16" /> : k.value.toLocaleString()}
              </div>
              <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ background: k.tone.bar, width: loading ? '0%' : `${k.showShare ? share : 100}%` }} />
              </div>
              <div className="mt-1 text-[10.5px] text-slate-500">
                {k.showShare
                  ? (loading ? '—' : <><span className="font-semibold text-slate-700">{share.toFixed(1)}%</span> of total</>)
                  : k.caption}
              </div>
            </button>
          );
        })}
      </div>

      {/* Reasons behind LOA / Exited (from Column R) */}
      {openKey && openBreakdown && (
        <StatusBreakdownPanel
          title={openBreakdown.title}
          icon={openBreakdown.icon}
          color={openBreakdown.color}
          tint={openBreakdown.tint}
          total={openBreakdown.total}
          shareOfAll={(openBreakdown.total / (stats.total || 1)) * 100}
          items={openBreakdown.items}
          loading={loading}
          emptyText={openBreakdown.empty}
          onViewAll={() => navigate(openBreakdown.to)}
          onSelect={label => navigate(`${openBreakdown.to}&sub=${encodeURIComponent(label)}`)}
          onClose={() => setOpenKey(null)}
        />
      )}
    </div>
  );
}
