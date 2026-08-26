import React, { useState } from 'react';
import {
  STATUS_LEVEL_DETAILS,
  STATUS_LEVEL_TOTALS,
  RETENTION_ACTIVE_COHORT,
  RETENTION_ACTIVE_TOTAL,
  HISTORICAL_RETENTION,
  HISTORICAL_RETENTION_TOTAL,
  CLOSED_COHORT_GRADUATION,
  CLOSED_COHORT_TOTAL,
  ACTIVE_COHORT_GRADUATION,
  ACTIVE_COHORT_GRADUATION_TOTAL,
  COHORT_COUNTS,
  COHORT_COUNTS_TOTAL,
  TERM_LEVEL_ACTIVE,
} from '../lib/gguOverviewData';

import { useGGUOverviewAnalytics } from '../hooks/useGGUOverviewAnalytics';
import FilterDropdown from './FilterDropdown';

interface Props {
  onClose?: () => void;
}

export default function GGUOverallOverviewDashboard({ onClose }: Props) {
  const {
    loading,
    totalRawRows,
    isCalculatedLive,
    allCountries,
    statusDetails,
    statusTotals,
    retentionActiveCohort,
    retentionActiveTotal,
    historicalRetention,
    historicalRetentionTotal,
    closedCohortGraduation,
    closedCohortTotal,
    activeCohortGraduation,
    activeCohortTotal,
    cohortCounts,
    cohortTotals,
    termLevelActive,
    getFilteredTermActive,
  } = useGGUOverviewAnalytics();

  const [activeTab, setActiveTab] = useState<'status' | 'retention' | 'graduation' | 'cohorts' | 'terms'>('status');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleInList = (item: string, list: string[], setList: (n: string[]) => void) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  // Programs list
  const programs = [
    'GGU DBA',
    'GGU MBA',
    'GGU DBA ET',
    'GGU MPsych',
    'GGU DBA DL',
    'GGU SJD',
    'GGU MBA SA',
    'GGU Bachelors SA',
  ];

  return (
    <div style={{ backgroundColor: '#ffffff', color: '#0f172a' }} className="rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden my-4 transition-all duration-300">
      {/* ── Top Header ── */}
      <div style={{ backgroundColor: '#ffffff' }} className="p-6 border-b border-slate-200/80 text-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-black uppercase tracking-widest">
              Golden Gate University
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            GGU Operational Analytics Overview
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Comprehensive lifecycle performance, retention metrics, graduation rates, and term active distribution.
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="self-start md:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
          >
            <i className="fas fa-times text-xs" />
            <span>Close Overview</span>
          </button>
        )}
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-6 bg-white border-b border-slate-200/80">
        <div style={{ backgroundColor: '#ffffff' }} className="border border-slate-200/80 rounded-2xl p-4 shadow-sm col-span-2 md:col-span-1">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Grand Total Enrolled</div>
          <div className="text-2xl font-black text-slate-900">{statusTotals.grandTotal.toLocaleString()}</div>
          <div className="text-[10px] font-bold text-slate-500 mt-1">across 8 GGU programs</div>
        </div>

        <div style={{ backgroundColor: '#ffffff' }} className="border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Learners</div>
          <div className="text-2xl font-black text-emerald-600">{statusTotals.active.toLocaleString()}</div>
          <div className="text-[10px] font-bold text-emerald-700/80 mt-1">
            {statusTotals.grandTotal > 0 ? ((statusTotals.active / statusTotals.grandTotal) * 100).toFixed(1) : '51.0'}% of total enrolled
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff' }} className="border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Retention Rate</div>
          <div className="text-2xl font-black text-slate-900">{retentionActiveTotal.retentionPct}%</div>
          <div className="text-[10px] font-bold text-slate-500 mt-1">Active cohorts retention</div>
        </div>

        <div style={{ backgroundColor: '#ffffff' }} className="border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Closed Cohort Grad</div>
          <div className="text-2xl font-black text-amber-600">{closedCohortTotal.graduationPct}%</div>
          <div className="text-[10px] font-bold text-amber-700/80 mt-1">{closedCohortTotal.graduatedLearners.toLocaleString()} graduated learners</div>
        </div>

        <div style={{ backgroundColor: '#ffffff' }} className="border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Live Cohorts</div>
          <div className="text-2xl font-black text-cyan-600">{cohortTotals.liveCohorts}</div>
          <div className="text-[10px] font-bold text-slate-500 mt-1">out of {cohortTotals.allTimeCohorts} all-time</div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 px-6 pt-4 border-b border-slate-200 bg-white overflow-x-auto">
        {[
          { id: 'status', label: 'Status Breakdown', icon: 'fas fa-chart-pie' },
          { id: 'retention', label: 'Retention Analytics', icon: 'fas fa-shield-alt' },
          { id: 'graduation', label: 'Graduation Rates', icon: 'fas fa-graduation-cap' },
          { id: 'cohorts', label: 'Cohort Distribution', icon: 'fas fa-layer-group' },
          { id: 'terms', label: 'Term Matrix', icon: 'fas fa-calendar-alt' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-bold text-xs transition-colors shrink-0 ${activeTab === tab.id
                ? 'border-slate-900 text-slate-900 bg-slate-100/70 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-t-xl'
              }`}
          >
            <i className={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="p-6 bg-white">
        {/* ── TAB 1: STATUS LEVEL DETAILS ── */}
        {activeTab === 'status' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 mb-0.5">Status Level Details</h3>
                <p className="text-xs text-slate-500 font-medium">Distribution of Active, Exit, and LOA learners by GGU program.</p>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-black border-b border-slate-200">
                    <th className="px-4 py-3.5">Status</th>
                    {programs.map((p) => (
                      <th key={p} className="px-4 py-3.5 text-center">{p}</th>
                    ))}
                    <th className="px-4 py-3.5 text-right bg-slate-200/60 text-slate-900 font-black">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {/* Total Active */}
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 font-black text-emerald-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-600" />
                      Total Active
                    </td>
                    {statusDetails.map((r) => (
                      <td key={r.program} className="px-4 py-3.5 text-center font-bold text-slate-900">{r.active.toLocaleString()}</td>
                    ))}
                    <td className="px-4 py-3.5 text-right font-black text-emerald-700 bg-emerald-50/60">{statusTotals.active.toLocaleString()}</td>
                  </tr>

                  {/* Total Exit */}
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 font-black text-amber-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-600" />
                      Total Exit
                    </td>
                    {statusDetails.map((r) => (
                      <td key={r.program} className="px-4 py-3.5 text-center text-slate-700">{r.exit.toLocaleString()}</td>
                    ))}
                    <td className="px-4 py-3.5 text-right font-black text-amber-700 bg-amber-50/60">{statusTotals.exit.toLocaleString()}</td>
                  </tr>

                  {/* Total LOA */}
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 font-black text-rose-700 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-600" />
                      Total LOA
                    </td>
                    {statusDetails.map((r) => (
                      <td key={r.program} className="px-4 py-3.5 text-center text-slate-600">{r.inactive.toLocaleString()}</td>
                    ))}
                    <td className="px-4 py-3.5 text-right font-black text-rose-700 bg-rose-50/60">{statusTotals.inactive.toLocaleString()}</td>
                  </tr>

                  {/* Program Total */}
                  <tr className="bg-slate-100/80 font-black text-slate-900 border-t-2 border-slate-200">
                    <td className="px-4 py-3.5 uppercase tracking-wider text-slate-700">Total Enrolled</td>
                    {statusDetails.map((r) => (
                      <td key={r.program} className="px-4 py-3.5 text-center font-black text-slate-900">{r.total.toLocaleString()}</td>
                    ))}
                    <td className="px-4 py-3.5 text-right font-black text-slate-900 bg-slate-200/80">{statusTotals.grandTotal.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Visual Program Distribution Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {statusDetails.map((r) => {
                const activePct = r.total > 0 ? ((r.active / r.total) * 100).toFixed(1) : '0';
                const exitPct = r.total > 0 ? ((r.exit / r.total) * 100).toFixed(1) : '0';
                const inactivePct = r.total > 0 ? ((r.inactive / r.total) * 100).toFixed(1) : '0';

                return (
                  <div key={r.program} className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black text-sm text-slate-900">{r.program}</span>
                      <span className="text-xs font-bold text-slate-500">{r.total.toLocaleString()} learners</span>
                    </div>

                    {/* Progress Segment */}
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex mb-2 border border-slate-200">
                      <div style={{ width: `${activePct}%` }} className="bg-emerald-400 h-full" title={`Active: ${r.active} (${activePct}%)`} />
                      <div style={{ width: `${exitPct}%` }} className="bg-amber-400 h-full" title={`Exit: ${r.exit} (${exitPct}%)`} />
                      <div style={{ width: `${inactivePct}%` }} className="bg-rose-400 h-full" title={`LOA: ${r.inactive} (${inactivePct}%)`} />
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-emerald-700">Active: {r.active} ({activePct}%)</span>
                      <span className="text-amber-700">Exit: {r.exit} ({exitPct}%)</span>
                      <span className="text-rose-700">LOA: {r.inactive} ({inactivePct}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 2: RETENTION ANALYTICS ── */}
        {activeTab === 'retention' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 mb-0.5">Retention Active Cohort vs. Historical Retention</h3>
                <p className="text-xs text-slate-500 font-medium">Comparative retention analysis across active cohorts and all-time historical data.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Cohorts Retention Table */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-black text-emerald-700">Retention Active Cohort</h4>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Current Live Cohorts</span>
                  </div>
                  <div className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black">
                    {retentionActiveTotal.retentionPct}% Retention
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-slate-500 font-bold border-b border-slate-200">
                        <th className="px-3 py-2.5">Program</th>
                        <th className="px-3 py-2.5 text-right">Enrolment</th>
                        <th className="px-3 py-2.5 text-right">Dropout</th>
                        <th className="px-3 py-2.5 text-right">Total</th>
                        <th className="px-3 py-2.5 text-right">Retention</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {retentionActiveCohort.map((r) => (
                        <tr key={r.program} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-bold text-slate-900">{r.program}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{r.totalEnrolment.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right text-rose-600">{r.disqualifiedDropout.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{r.total.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-black text-emerald-700">
                            {r.total > 0 ? `${r.retentionPct}%` : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-black text-slate-900 bg-slate-100/80 border-t border-slate-200">
                        <td className="px-3 py-3 uppercase text-slate-700">Total</td>
                        <td className="px-3 py-3 text-right">{retentionActiveTotal.totalEnrolment.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-rose-600">{retentionActiveTotal.disqualifiedDropout.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right">{retentionActiveTotal.total.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-emerald-700">{retentionActiveTotal.retentionPct}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Historical Retention Table */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-black text-slate-800">Historical Retention</h4>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">All-Time Cumulative Cohorts</span>
                  </div>
                  <div className="px-3 py-1 bg-slate-100 text-slate-800 border border-slate-200 rounded-xl text-xs font-black">
                    {historicalRetentionTotal.retentionPct}% Retention
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-slate-500 font-bold border-b border-slate-200">
                        <th className="px-3 py-2.5">Program</th>
                        <th className="px-3 py-2.5 text-right">Enrolment</th>
                        <th className="px-3 py-2.5 text-right">Dropout</th>
                        <th className="px-3 py-2.5 text-right">Total</th>
                        <th className="px-3 py-2.5 text-right">Retention</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {historicalRetention.map((r) => (
                        <tr key={r.program} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-bold text-slate-900">{r.program}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{r.totalEnrolment.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right text-rose-600">{r.disqualifiedDropout.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{r.total.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-black text-slate-900">
                            {r.total > 0 ? `${r.retentionPct}%` : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-black text-slate-900 bg-slate-100/80 border-t border-slate-200">
                        <td className="px-3 py-3 uppercase text-slate-700">Total</td>
                        <td className="px-3 py-3 text-right">{historicalRetentionTotal.totalEnrolment.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-rose-600">{historicalRetentionTotal.disqualifiedDropout.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right">{historicalRetentionTotal.total.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-slate-900">{historicalRetentionTotal.retentionPct}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: GRADUATION RATES ── */}
        {activeTab === 'graduation' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 mb-0.5">Closed Cohort vs. Active Cohort Graduation Rates</h3>
                <p className="text-xs text-slate-500 font-medium">Graduation completion rates across completed (closed) cohorts and in-progress (active) cohorts.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Closed Cohort Graduation */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-black text-amber-700">Closed Cohort Graduation</h4>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Completed Alumni Cohorts</span>
                  </div>
                  <div className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-black">
                    {closedCohortTotal.graduationPct}% Overall
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-slate-500 font-bold border-b border-slate-200">
                        <th className="px-3 py-2.5">Program</th>
                        <th className="px-3 py-2.5 text-right">Enrolment</th>
                        <th className="px-3 py-2.5 text-right">Graduated</th>
                        <th className="px-3 py-2.5 text-right">Graduation %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {closedCohortGraduation.map((r) => (
                        <tr key={r.program} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-bold text-slate-900">{r.program}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{r.totalEnrolment.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-700 font-bold">{r.graduatedLearners.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-black text-amber-700">
                            {r.graduationPct !== null ? `${r.graduationPct}%` : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-black text-slate-900 bg-slate-100/80 border-t border-slate-200">
                        <td className="px-3 py-3 uppercase text-slate-700">Total</td>
                        <td className="px-3 py-3 text-right">{closedCohortTotal.totalEnrolment.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-emerald-700">{closedCohortTotal.graduatedLearners.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-amber-700">{closedCohortTotal.graduationPct}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Active Cohort Graduation */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h4 className="text-sm font-black text-cyan-700">Active Cohort Graduation</h4>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">In-Progress Cohorts Completion</span>
                  </div>
                  <div className="px-3 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 rounded-xl text-xs font-black">
                    {activeCohortTotal.graduationPct}% Overall
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="text-slate-500 font-bold border-b border-slate-200">
                        <th className="px-3 py-2.5">Program</th>
                        <th className="px-3 py-2.5 text-right">Enrolment</th>
                        <th className="px-3 py-2.5 text-right">Graduated</th>
                        <th className="px-3 py-2.5 text-right">Graduation %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {activeCohortGraduation.map((r) => (
                        <tr key={r.program} className="hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-bold text-slate-900">{r.program}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{r.totalEnrolment.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right text-emerald-700 font-bold">{r.graduatedLearners.toLocaleString()}</td>
                          <td className="px-3 py-2.5 text-right font-black text-cyan-700">
                            {r.graduationPct !== null ? `${r.graduationPct}%` : '—'}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-black text-slate-900 bg-slate-100/80 border-t border-slate-200">
                        <td className="px-3 py-3 uppercase text-slate-700">Total</td>
                        <td className="px-3 py-3 text-right">{activeCohortTotal.totalEnrolment.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-emerald-700">{activeCohortTotal.graduatedLearners.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right text-cyan-700">{activeCohortTotal.graduationPct}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: COHORT DISTRIBUTION ── */}
        {activeTab === 'cohorts' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 mb-0.5">Number of Cohorts</h3>
                <p className="text-xs text-slate-500 font-medium">Comparison of all-time created cohorts versus currently live active cohorts.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cohortCounts.map((r) => (
                <div key={r.program} className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 mb-1">{r.program}</h4>
                    <div className="text-xs text-slate-500 font-medium">
                      All-Time Cohorts: <strong className="text-slate-900 font-bold">{r.allTimeCohorts}</strong>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 text-right">
                    <div>
                      <div className="text-2xl font-black text-emerald-600">{r.liveCohorts}</div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Live</div>
                    </div>
                    <div>
                      <div className="text-2xl font-black text-amber-600">{r.closedCohorts}</div>
                      <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Closed</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Banner */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 text-slate-900 flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Network Cohorts</span>
                <h3 className="text-2xl font-black text-slate-900">{cohortTotals.liveCohorts} Live Cohorts across GGU</h3>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-xs text-slate-500 font-bold">All-Time</div>
                  <div className="text-2xl font-black text-slate-900">{cohortTotals.allTimeCohorts}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-emerald-700 font-bold">Live Active</div>
                  <div className="text-2xl font-black text-emerald-600">{cohortTotals.liveCohorts}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-amber-700 font-bold">Closed</div>
                  <div className="text-2xl font-black text-amber-600">{cohortTotals.closedCohorts}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: TERM LEVEL ACTIVE MATRIX ── */}
        {activeTab === 'terms' && (() => {
          const getYearFromTerm = (term: string): string => {
            const match = term.match(/^(\d{2})\//);
            if (match) return `20${match[1]}`;
            const digits = term.substring(0, 2);
            if (/^\d{2}$/.test(digits)) return `20${digits}`;
            return 'Other';
          };

          const activeMatrix = getFilteredTermActive(selectedCountries);

          const availableYears = Array.from(
            new Set(activeMatrix.map(t => getYearFromTerm(t.term)))
          ).filter(y => y !== 'Other').sort();

          const filteredTermRows = activeMatrix.filter(t => {
            const termYear = getYearFromTerm(t.term);
            const matchesYear = selectedYears.length === 0 || selectedYears.includes(termYear);
            return matchesYear;
          });

          const termTotals = {
            dba: filteredTermRows.reduce((acc, t) => acc + (t.dba || 0), 0),
            mba: filteredTermRows.reduce((acc, t) => acc + (t.mba || 0), 0),
            dbaEt: filteredTermRows.reduce((acc, t) => acc + (t.dbaEt || 0), 0),
            mPsych: filteredTermRows.reduce((acc, t) => acc + (t.mPsych || 0), 0),
            dbaDl: filteredTermRows.reduce((acc, t) => acc + (t.dbaDl || 0), 0),
            sjd: filteredTermRows.reduce((acc, t) => acc + (t.sjd || 0), 0),
            mbaSa: filteredTermRows.reduce((acc, t) => acc + (t.mbaSa || 0), 0),
            bachelorsSa: filteredTermRows.reduce((acc, t) => acc + (t.bachelorsSa || 0), 0),
            grandTotal: filteredTermRows.reduce((acc, t) => acc + (t.grandTotal || 0), 0),
          };

          return (
            <div className="space-y-6">
              {/* ── Beautified Filter Header Bar ── */}
              <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-black text-slate-900">Term Active Matrix</h4>
                  <p className="text-xs text-slate-500 font-medium">Color-coded active learner distribution per intake term.</p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Country Filter Dropdown */}
                  <div className="w-48">
                    <FilterDropdown
                      label="Country"
                      iconClass="fas fa-globe"
                      placeholder="All Countries"
                      values={allCountries}
                      selected={selectedCountries}
                      onToggle={(v) => toggleInList(v, selectedCountries, setSelectedCountries)}
                      isOpen={openDropdown === 'country'}
                      setIsOpen={(open) => setOpenDropdown(open ? 'country' : null)}
                    />
                  </div>

                  {/* Year Filter Dropdown */}
                  <div className="w-44">
                    <FilterDropdown
                      label="Intake Year"
                      iconClass="fas fa-calendar-alt"
                      placeholder="All Years"
                      values={availableYears}
                      selected={selectedYears}
                      onToggle={(v) => toggleInList(v, selectedYears, setSelectedYears)}
                      isOpen={openDropdown === 'year'}
                      setIsOpen={(open) => setOpenDropdown(open ? 'year' : null)}
                    />
                  </div>

                  {/* Reset Button if filtered */}
                  {(selectedYears.length > 0 || selectedCountries.length > 0) && (
                    <button
                      onClick={() => { setSelectedYears([]); setSelectedCountries([]); }}
                      className="mt-5 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                      title="Reset all filters"
                    >
                      <i className="fas fa-undo-alt text-[10px]" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Active Chips */}
              {(selectedYears.length > 0 || selectedCountries.length > 0) && (
                <div className="flex items-center gap-2 bg-indigo-50/80 border border-indigo-100 rounded-xl px-3.5 py-1.5 text-xs text-indigo-700 font-bold w-fit flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider text-indigo-500">Active Filters:</span>
                  {selectedCountries.length > 0 && <span className="bg-indigo-100 px-2 py-0.5 rounded-md">Countries: {selectedCountries.join(', ')}</span>}
                  {selectedYears.length > 0 && <span className="bg-indigo-100 px-2 py-0.5 rounded-md">Years: {selectedYears.join(', ')}</span>}
                </div>
              )}

              {/* ── HEATMAP MATRIX TABLE ONLY ── */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm max-h-[540px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3.5">Term</th>
                      <th className="px-3 py-3.5 text-center">GGU DBA</th>
                      <th className="px-3 py-3.5 text-center">GGU MBA</th>
                      <th className="px-3 py-3.5 text-center">GGU DBA ET</th>
                      <th className="px-3 py-3.5 text-center">GGU MPsych</th>
                      <th className="px-3 py-3.5 text-center">GGU DBA DL</th>
                      <th className="px-3 py-3.5 text-center">GGU SJD</th>
                      <th className="px-3 py-3.5 text-center">GGU MBA SA</th>
                      <th className="px-3 py-3.5 text-center">GGU Bachelors SA</th>
                      <th className="px-4 py-3.5 text-right bg-slate-200/60 text-slate-900 font-black">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredTermRows.length > 0 ? (
                      filteredTermRows.map((t) => {
                        const getHeatmapColor = (val: number) => {
                          if (val === 0) return 'bg-slate-50/40 text-slate-300';
                          if (val <= 15) return 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-100/80';
                          if (val <= 35) return 'bg-emerald-100 text-emerald-900 font-extrabold border border-emerald-200';
                          return 'bg-emerald-600 text-white font-black shadow-sm';
                        };

                        return (
                          <tr key={t.term} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3.5 font-black text-slate-900 flex items-center justify-between gap-2">
                              <span>{t.term}</span>
                              <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                {getYearFromTerm(t.term)}
                              </span>
                            </td>
                            <td className={`px-3 py-3.5 text-center transition-all ${getHeatmapColor(t.dba || 0)}`}>{t.dba || '—'}</td>
                            <td className={`px-3 py-3.5 text-center transition-all ${getHeatmapColor(t.mba || 0)}`}>{t.mba || '—'}</td>
                            <td className={`px-3 py-3.5 text-center transition-all ${getHeatmapColor(t.dbaEt || 0)}`}>{t.dbaEt || '—'}</td>
                            <td className={`px-3 py-3.5 text-center transition-all ${getHeatmapColor(t.mPsych || 0)}`}>{t.mPsych || '—'}</td>
                            <td className={`px-3 py-3.5 text-center transition-all ${getHeatmapColor(t.dbaDl || 0)}`}>{t.dbaDl || '—'}</td>
                            <td className={`px-3 py-3.5 text-center transition-all ${getHeatmapColor(t.sjd || 0)}`}>{t.sjd || '—'}</td>
                            <td className={`px-3 py-3.5 text-center transition-all ${getHeatmapColor(t.mbaSa || 0)}`}>{t.mbaSa || '—'}</td>
                            <td className={`px-3 py-3.5 text-center transition-all ${getHeatmapColor(t.bachelorsSa || 0)}`}>{t.bachelorsSa || '—'}</td>
                            <td className="px-4 py-3.5 text-right font-black text-emerald-700 bg-emerald-50/70">{t.grandTotal.toLocaleString()}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-slate-400 font-medium">
                          No term records found matching the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filteredTermRows.length > 0 && (
                    <tfoot className="sticky bottom-0 z-10 bg-slate-100 text-slate-900 font-black border-t-2 border-slate-300">
                      <tr>
                        <td className="px-4 py-3.5 uppercase tracking-wider text-slate-800">Total ({filteredTermRows.length} terms)</td>
                        <td className="px-3 py-3.5 text-center font-black">{termTotals.dba || '—'}</td>
                        <td className="px-3 py-3.5 text-center font-black">{termTotals.mba || '—'}</td>
                        <td className="px-3 py-3.5 text-center font-black">{termTotals.dbaEt || '—'}</td>
                        <td className="px-3 py-3.5 text-center font-black">{termTotals.mPsych || '—'}</td>
                        <td className="px-3 py-3.5 text-center font-black">{termTotals.dbaDl || '—'}</td>
                        <td className="px-3 py-3.5 text-center font-black">{termTotals.sjd || '—'}</td>
                        <td className="px-3 py-3.5 text-center font-black">{termTotals.mbaSa || '—'}</td>
                        <td className="px-3 py-3.5 text-center font-black">{termTotals.bachelorsSa || '—'}</td>
                        <td className="px-4 py-3.5 text-right text-emerald-700 bg-emerald-100/90 font-black text-sm">{termTotals.grandTotal.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
