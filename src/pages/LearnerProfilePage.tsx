import { useMemo, Fragment } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLearnerData } from '../hooks/useLearnerData';
import { useDissertationData } from '../hooks/useDissertationData';
import { useAcademicReviewData } from '../hooks/useAcademicReviewData';
import { useProgramConfig } from '../hooks/useProgramConfig';
import AnimatedNumber from '../components/AnimatedNumber';

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function gradeCategory(grade: string | undefined, gpa?: number | null): 'excellent' | 'good' | 'satisfactory' | 'low' | 'pending' {
  const g = (grade ?? '').trim();
  if (!g) {
    if (gpa !== null && gpa !== undefined && gpa > 0) {
      if (gpa >= 3.7) return 'excellent';
      if (gpa >= 3.3) return 'good';
      if (gpa >= 3.0) return 'satisfactory';
      return 'low';
    }
    return 'pending';
  }
  if (['A+', 'A', 'A-'].includes(g)) return 'excellent';
  if (g === 'B+') return 'good';
  if (['B', 'B-'].includes(g)) return 'satisfactory';
  return 'low';
}

type StatusLabel = 'Approved' | 'Not Approved' | 'Submitted' | 'Not Submitted' | 'Pending';

function parseARDate(val: any): string {
  if (!val) return 'N/A';
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'na') return 'N/A';

  // Try to parse excel date or standard date
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Google Sheets: Date(YYYY,M,D)
  const gs = s.match(/^Date\((\d{4}),(\d{1,2}),\d+\)$/);
  if (gs) {
    const d2 = new Date(Number(gs[1]), Number(gs[2]));
    return d2.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return s;
}

function getARField(row: Record<string, any>, ...possibleKeys: string[]): string {
  if (!row) return '';
  const rowKeys = Object.keys(row);
  for (const search of possibleKeys) {
    const normalizedSearch = search.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const k of rowKeys) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedSearch) {
        return (row[k] ?? '').toString().trim();
      }
    }
  }
  return '';
}

function formatGPA(val: any): string {
  if (!val) return '—';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return n.toFixed(2);
}

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function normEmail(value: string): string {
  return String(value ?? '').trim().toLowerCase();
}

function getAnyField(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = (row[k] ?? '').trim();
    if (v) return v;
  }
  return '';
}

function dissertationStatusFromValue(value: string): StatusLabel {
  const val = (value ?? '').trim().toLowerCase();
  if (val === 'approved') return 'Approved';
  if (val === 'not approved') return 'Not Approved';
  if (val === 'not submitted') return 'Not Submitted';
  if (val.includes('disapproved')) return 'Not Approved';
  if (val.startsWith('submitted')) return 'Submitted';
  return 'Pending';
}

function topicProposalStatus(row: Record<string, string>, programId: string): StatusLabel {
  const val = (programId === 'dba' ? (row['Topic Proposal Status'] || '') : (row['Topic Proposal Submission Status'] || '')).toString().toLowerCase();
  if (val.includes('approved')) return 'Approved';
  if (val.includes('not approved') || val.includes('disapproved')) return 'Not Approved';
  if (val.includes('not submitted')) return 'Not Submitted';
  if (val.includes('submitted')) return 'Submitted';
  if (val.includes('wip')) return 'Not Submitted';
  return 'Pending';
}

function irbStatus(row: Record<string, string>, programId: string): StatusLabel {
  if (programId === 'dba') return 'Pending';
  const status = (row['IRB Status'] || '').toString().toLowerCase();
  if (status === 'approved') return 'Approved';
  if (status === 'not approved' || status.includes('disapproved')) return 'Not Approved';
  if (status === 'not submitted') return 'Not Submitted';
  if (status.startsWith('submitted')) return 'Submitted';
  return 'Pending';
}

function researchProposalStatus(row: Record<string, string>, programId: string): StatusLabel {
  if (programId === 'dba') {
    const attempt1 = (row['Research Proposal Defence (Attempt 1)'] || '').toString().toLowerCase();
    const attempt2 = (row['Research Proposal Defence \n(Attempt 2)'] || '').toString().toLowerCase();
    if (attempt1.includes('approved') || attempt2.includes('approved')) return 'Approved';
    if (attempt1.includes('disapproved')) return 'Not Approved';
    if (attempt1.includes('conducted')) return 'Submitted';
    if (attempt1.includes('submitted')) return 'Submitted';
    return 'Pending';
  }
  return dissertationStatusFromValue((row['Research Proposal Submission'] ?? '').trim());
}

function finalDefenseStatus(row: Record<string, string>, programId: string): StatusLabel {
  if (programId === 'dba') {
    const val = (row['Dissertation Sign-off Final Status'] || '').toString().toLowerCase();
    if (val.includes('done') || val.includes('approved')) return 'Approved';
    if (val.includes('disapproved')) return 'Not Approved';
    if (val.includes('submitted')) return 'Submitted';
    return 'Pending';
  }
  const val = (row['Final Proposal Submission'] || row['Final Defense Presentation 1'] || '').toString().toLowerCase();
  if (val.includes('approved') || val.includes('done') || val.includes('cleared')) return 'Approved';
  if (val.includes('disapproved') || val === 'not approved') return 'Not Approved';
  if (val.includes('submitted')) return 'Submitted';
  return 'Pending';
}

type StepStatus = 'approved' | 'not-approved' | 'submitted' | 'not-submitted' | 'pending';

function toStepStatus(s: StatusLabel): StepStatus {
  if (s === 'Approved') return 'approved';
  if (s === 'Not Approved') return 'not-approved';
  if (s === 'Submitted') return 'submitted';
  if (s === 'Not Submitted') return 'not-submitted';
  return 'pending';
}

function stepCircleClass(status: StepStatus): string {
  if (status === 'approved') return 'diss-step-approved';
  if (status === 'not-approved') return 'diss-step-not-approved';
  if (status === 'submitted') return 'diss-step-submitted';
  if (status === 'not-submitted') return 'diss-step-not-submitted';
  return 'diss-step-pending';
}

function stepLineClass(status: StepStatus): string {
  if (status === 'approved') return 'diss-line-approved';
  if (status === 'not-approved') return 'diss-line-not-approved';
  if (status === 'submitted') return 'diss-line-submitted';
  if (status === 'not-submitted') return 'diss-line-not-submitted';
  return 'diss-line-pending';
}

function StepCircle({ status, stepNum }: { status: StepStatus; stepNum: number }) {
  return (
    <div className={`lp-step-circle ${stepCircleClass(status)}`}>
      {status === 'approved' && <i className="fas fa-check" />}
      {status === 'not-approved' && <i className="fas fa-times" />}
      {status === 'submitted' && <i className="fas fa-clock" />}
      {status === 'not-submitted' && <i className="fas fa-exclamation" />}
      {status === 'pending' && <span className="lp-step-num">{stepNum}</span>}
    </div>
  );
}

function ARStatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  let cls = '';
  let icon = 'fa-clock';
  if (s.includes('good standing')) {
    cls = 'ar-badge-good';
    icon = 'fa-check-circle';
  } else if (s.includes('probation')) {
    cls = 'ar-badge-probation';
    icon = 'fa-exclamation-triangle';
  } else if (s.includes('dismissal') || s.includes('disqualified')) {
    cls = 'ar-badge-disqualified';
    icon = 'fa-times-circle';
  }

  return (
    <div className={`ar-badge ${cls}`}>
      <i className={`fas ${icon}`} />
      {status || 'Pending Review'}
    </div>
  );
}

export default function LearnerProfilePage() {
  const { programId, config } = useProgramConfig();
  const { userId } = useParams();
  const decodedUserId = useMemo(() => {
    try {
      return userId ? decodeURIComponent(userId) : '';
    } catch {
      return userId ?? '';
    }
  }, [userId]);

  const { loading, error, students, merged } = useLearnerData();
  const { rows: dissertationRows } = useDissertationData();
  const { rows: arRows } = useAcademicReviewData();

  const learnerRows = useMemo(() => {
    if (!decodedUserId) return [];
    return merged.filter((l) => (l.userId ?? '').trim() === decodedUserId);
  }, [merged, decodedUserId]);

  const learnerInfo = useMemo(() => {
    if (!decodedUserId) return null;
    const fromStudent = students.find((s) => (s['User ID'] ?? '').trim() === decodedUserId) ?? null;
    const fromMerged = learnerRows[0] ?? null;

    if (!fromStudent && !fromMerged) return null;

    const firstName = fromMerged?.firstName ?? (fromStudent?.['First Name'] ?? '');
    const lastName = fromMerged?.lastName ?? (fromStudent?.['Last Name'] ?? '');
    const email = fromMerged?.email ?? (fromStudent?.['Email ID'] ?? '');

    return {
      firstName,
      lastName,
      email,
      contact: fromStudent?.['Contact'] ?? fromStudent?.['Phone'] ?? undefined,
      countryOfOrigin: fromStudent?.['Country Of Origin'] ?? fromStudent?.['Country of Origin'] ?? undefined,
      countryOfResidence: fromStudent?.['Country Of Residence'] ?? fromStudent?.['Country of Residence'] ?? undefined,
      company: fromStudent?.['Company'] ?? undefined,
      industry: fromStudent?.['Industry'] ?? undefined,
      designation: fromStudent?.['Designation'] ?? undefined,
      seniority: fromStudent?.['Seniority'] ?? undefined,
      gguId: fromStudent?.['GGU User ID'] ?? fromStudent?.['GGU ID'] ?? fromStudent?.['GGU Id'] ?? undefined,
    };
  }, [decodedUserId, learnerRows, students]);

  const latestCohort = useMemo(() => {
    if (learnerRows.length === 0) return null;
    const withCohort = learnerRows
      .map((r) => ({ r, n: Number(String(r.cohort ?? '').replace(/[^0-9]/g, '')) }))
      .filter((x) => Number.isFinite(x.n));

    if (withCohort.length === 0) return learnerRows[learnerRows.length - 1];

    withCohort.sort((a, b) => a.n - b.n);
    return withCohort[withCohort.length - 1].r;
  }, [learnerRows]);

  const initials = `${(learnerInfo?.firstName ?? 'N').trim()[0] ?? 'N'}${(learnerInfo?.lastName ?? 'A').trim()[0] ?? 'A'}`.toUpperCase();

  const cohorts = useMemo(() => {
    const rows = [...learnerRows];
    rows.sort((a, b) => String(a.cohort ?? '').localeCompare(String(b.cohort ?? '')));
    return rows;
  }, [learnerRows]);

  const dissertationRow = useMemo(() => {
    if (!latestCohort || !learnerInfo?.email) return null;
    if (!dissertationRows || dissertationRows.length === 0) return null;

    const wantedEmail = normEmail(learnerInfo.email);
    const wantedCohortDigits = programId === 'dba'
      ? digitsOnly(String(latestCohort.cohortId ?? ''))
      : digitsOnly(String(latestCohort.cohort ?? ''));
    const matchesEmail = dissertationRows.filter((r) => normEmail(String(r['Email'] ?? '')) === wantedEmail);
    if (matchesEmail.length === 0) return null;

    if (!wantedCohortDigits) return matchesEmail[0];
    const cohortKey = programId === 'dba' ? 'Cohort ID' : 'Cohort #';
    return (
      matchesEmail.find((r) => digitsOnly(String(r[cohortKey] ?? '')) === wantedCohortDigits) ??
      matchesEmail[0]
    );
  }, [latestCohort, learnerInfo?.email, dissertationRows, programId]);

  // ─── Status helpers ──────────────────────────────────────────────
  const statusBadgeStyle = (status: string) => {
    const s = (status ?? '').trim().toLowerCase();
    if (s === 'active') return { bg: 'rgba(16,185,129,0.12)', color: '#059669', border: '1px solid rgba(16,185,129,0.3)' };
    if (s.startsWith('deferred')) return { bg: 'rgba(249,115,22,0.12)', color: '#ea6c00', border: '1px solid rgba(249,115,22,0.3)' };
    return { bg: 'rgba(148,163,184,0.12)', color: 'var(--text-secondary)', border: '1px solid rgba(148,163,184,0.3)' };
  };

  return (
    <>
      {/* ── Page-scoped styles ── */}
      <style>{`
        /* ─── Learner Profile Page ─── */
        .lp-page { max-width: 1100px; margin: 0 auto; padding: 1rem 1.5rem 3rem; }

        .lp-back-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 500;
          color: var(--accent-blue);
          text-decoration: none;
          margin-bottom: 1.25rem;
          transition: opacity 150ms;
        }
        .lp-back-link:hover { opacity: 0.75; }

        /* ─── State cards ─── */
        .lp-state-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          padding: 2rem;
          box-shadow: var(--shadow-sm);
          color: var(--text-secondary);
        }

        /* ─── Profile header ─── */
        .lp-header {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-2xl);
          padding: 1.75rem;
          box-shadow: var(--shadow-md);
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          margin-bottom: 1.5rem;
          position: relative;
          overflow: hidden;
        }
        .lp-header::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple), var(--accent-cyan));
          border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
        }

        @media (min-width: 768px) {
          .lp-header { flex-direction: row; align-items: center; }
        }

        .lp-avatar {
          flex-shrink: 0;
          width: 88px; height: 88px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
          display: flex; align-items: center; justify-content: center;
          font-size: 1.8rem; font-weight: 800; color: #fff;
          box-shadow: 0 0 0 4px rgba(59,108,246,0.15), var(--shadow-md);
        }

        .lp-header-info { flex: 1; }
        .lp-header-name {
          font-size: 1.6rem; font-weight: 800;
          color: var(--text-primary);
          letter-spacing: -0.5px;
          line-height: 1.2;
        }
        .lp-header-ids {
          font-size: 12px; color: var(--text-muted);
          margin-top: 4px;
        }
        .lp-header-ids span { color: var(--text-secondary); font-weight: 600; }

        .lp-cohort-badge {
          display: inline-flex; align-items: center;
          background: linear-gradient(135deg, var(--accent-blue), var(--accent-indigo));
          color: #fff; font-size: 11px; font-weight: 700;
          padding: 4px 12px; border-radius: 100px;
          margin-top: 8px;
          letter-spacing: 0.2px;
        }

        .lp-header-contact {
          text-align: right;
          display: flex; flex-direction: column; gap: 4px;
          align-items: flex-end;
        }
        .lp-contact-item {
          display: flex; align-items: center; gap: 6px;
          font-size: 12.5px; color: var(--text-secondary);
        }
        .lp-contact-item i { color: var(--accent-blue); width: 14px; text-align: center; }

        /* ─── Timeline layout ─── */
        .lp-timeline { 
          position: relative; 
          padding-left: 80px; /* Increased to give icons room and breathe */
          margin-top: 1rem;
        }
        .lp-timeline::before {
          content: '';
          position: absolute;
          left: 40px; /* Exactly half of padding-left */
          top: 30px; 
          bottom: 30px;
          width: 3px;
          background: linear-gradient(to bottom, 
            #3a86ff, 
            #8338ec, 
            #ff006e, 
            #fb5607
          );
          border-radius: 10px;
          transform: translateX(-50%);
          opacity: 0.8;
        }
        [data-theme="dark"] .lp-timeline::before {
          box-shadow: 0 0 8px rgba(131, 56, 236, 0.3);
          opacity: 1;
        }

        .lp-tl-section { 
          position: relative; 
          margin-bottom: 2rem; 
        }

        .lp-tl-icon {
          position: absolute;
          left: -40px; /* Center it on the line which is 40px from the container edge */
          top: 10px;
          transform: translateX(-50%);
          width: 42px; 
          height: 42px;
          border-radius: 50%;
          display: flex; 
          align-items: center; 
          justify-content: center;
          color: #1e40af;
          background: #fff;
          font-size: 1.05rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          z-index: 10;
          border: 3px solid var(--bg-surface); /* Gap effect */
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .lp-tl-section:hover .lp-tl-icon {
          transform: translateX(-50%) scale(1.1);
          box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        }

        .lp-tl-icon-prof   { color: #3a86ff; border: 1px solid rgba(58,134,255,0.2); }
        .lp-tl-icon-cohort { color: #8338ec; border: 1px solid rgba(131, 56, 236, 0.2); }
        .lp-tl-icon-diss   { color: #ff006e; border: 1px solid rgba(255, 0, 110, 0.2); }

        /* ─── Section cards ─── */
        .lp-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-xl);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
          margin-bottom: 1.5rem;
        }
        .lp-card-body { padding: 1.5rem; }

        .lp-section-title {
          font-size: 1.1rem; font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 1rem;
        }

        /* ─── Professional Background ─── */
        .lp-prof-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }
        @media (min-width: 640px) { .lp-prof-grid { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 1024px) { .lp-prof-grid { grid-template-columns: repeat(3, 1fr); } }

        .lp-prof-box {
          background: var(--bg-surface-2);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 1rem;
        }
        .lp-prof-box-title {
          font-size: 12px; font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase; letter-spacing: 0.5px;
          margin-bottom: 0.6rem;
        }
        .lp-prof-item {
          display: flex; align-items: center; gap: 6px;
          font-size: 12.5px;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }
        .lp-prof-item i { width: 14px; text-align: center; font-size: 11px; }
        .lp-prof-item:last-child { margin-bottom: 0; }

        /* ─── Cohort header strip ─── */
        .lp-cohort-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 1rem 1.5rem;
          background: var(--bg-surface-2);
          border-bottom: 1px solid var(--border-color);
        }
        .lp-cohort-title { font-size: 1rem; font-weight: 700; color: var(--text-primary); }

        /* ─── Stat mini-cards ─── */
        .lp-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        @media (min-width: 768px) { .lp-stat-grid { grid-template-columns: repeat(4, 1fr); } }

        .lp-stat-card {
          border-radius: var(--radius-md);
          padding: 0.9rem 1rem;
          border: 1px solid;
        }
        .lp-stat-card-blue   { background: rgba(59,108,246,0.08);  border-color: rgba(59,108,246,0.2);  }
        .lp-stat-card-green  { background: rgba(16,185,129,0.08);  border-color: rgba(16,185,129,0.2);  }
        .lp-stat-card-purple { background: rgba(124,92,246,0.08);  border-color: rgba(124,92,246,0.2);  }
        .lp-stat-card-amber  { background: rgba(245,158,11,0.08);  border-color: rgba(245,158,11,0.2);  }

        .lp-stat-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 4px; }
        .lp-stat-value { font-size: 1.1rem; font-weight: 800; }
        .lp-stat-card-blue   .lp-stat-label { color: var(--accent-blue); }
        .lp-stat-card-blue   .lp-stat-value { color: var(--accent-blue); }
        .lp-stat-card-green  .lp-stat-label { color: var(--accent-emerald); }
        .lp-stat-card-green  .lp-stat-value { color: var(--accent-emerald); }
        .lp-stat-card-purple .lp-stat-label { color: var(--accent-purple); }
        .lp-stat-card-purple .lp-stat-value { color: var(--accent-purple); }
        .lp-stat-card-amber  .lp-stat-label { color: var(--accent-amber); }
        .lp-stat-card-amber  .lp-stat-value { color: var(--accent-amber); }

        /* ─── Academic table ─── */
        .lp-table-wrap { overflow-x: auto; border-radius: var(--radius-md); border: 1px solid var(--border-color); }
        .lp-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
        .lp-table thead tr {
          background: var(--bg-surface-2);
          border-bottom: 1px solid var(--border-color);
        }
        .lp-table thead th {
          padding: 10px 14px;
          font-size: 10.5px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.5px;
          color: var(--text-muted);
          text-align: left;
        }
        .lp-table tbody tr {
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-surface);
          transition: background 150ms;
        }
        .lp-table tbody tr:hover { background: var(--bg-surface-2); }
        .lp-table tbody tr:last-child { border-bottom: none; }
        .lp-table tbody td { padding: 10px 14px; color: var(--text-primary); }

        .grade-badge {
          display: inline-block;
          font-size: 10px; font-weight: 700;
          padding: 2px 8px; border-radius: 100px;
        }
        .grade-excellent { background: rgba(16,185,129,0.1); color: #059669; }
        .grade-good      { background: rgba(245,158,11,0.1);  color: #d97706; }
        .grade-satisfactory { background: rgba(59,108,246,0.1); color: var(--accent-blue); }
        .grade-low       { background: rgba(239,68,68,0.1);   color: #dc2626; }
        .grade-pending   { background: rgba(148,163,184,0.1); color: #64748b; }

        /* ─── Low GPA alert ─── */
        .lp-alert-box {
          background: rgba(239,68,68,0.06);
          border: 1px solid rgba(239,68,68,0.2);
          border-radius: var(--radius-md);
          padding: 1rem;
          margin-top: 1rem;
        }
        .lp-alert-header { display: flex; align-items: center; gap: 10px; margin-bottom: 0.75rem; }
        .lp-alert-icon {
          width: 32px; height: 32px;
          background: #fff; border: 1px solid rgba(239,68,68,0.2); border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .lp-alert-icon i { color: #ef4444; font-size: 11px; }
        .lp-alert-title { font-size: 13px; font-weight: 700; color: #dc2626; }
        .lp-alert-sub   { font-size: 11px; color: #ef4444; }

        .lp-alert-items { display: grid; grid-template-columns: 1fr; gap: 8px; }
        @media (min-width: 640px) { .lp-alert-items { grid-template-columns: 1fr 1fr; } }
        .lp-alert-item {
          background: var(--bg-surface);
          border: 1px solid rgba(239,68,68,0.15);
          border-radius: var(--radius-sm);
          padding: 0.6rem 0.8rem;
          display: flex; justify-content: space-between; align-items: center;
        }
        .lp-alert-course { font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
        .lp-alert-tags { display: flex; gap: 6px; }
        .lp-alert-grade-tag {
          font-size: 10px; padding: 1px 7px; border-radius: 100px;
          background: var(--bg-surface-2);
          color: var(--text-secondary); font-weight: 600;
        }
        .lp-alert-gpa-tag {
          font-size: 10px; padding: 1px 7px; border-radius: 100px;
          background: rgba(239,68,68,0.1);
          color: #dc2626; font-weight: 700;
        }

        /* ─── Dissertation Progress ─── */
        .lp-diss-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-surface-2);
          display: flex; justify-content: space-between; align-items: center;
        }
        .lp-diss-header-title {
          font-size: 1.25rem; font-weight: 800;
          color: var(--text-primary);
        }
        .lp-diss-header-sub {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .lp-diss-journey-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 100px;
          background: rgba(123,92,246,0.1);
          border: 1px solid rgba(123,92,246,0.2);
          color: var(--accent-purple);
          font-size: 11px; font-weight: 700;
        }

        /* Cohort label inside diss */
        .lp-diss-cohort-label {
          font-size: 1rem; font-weight: 700;
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        /* Info cards: Mode, Chair, Co-Chair */
        .lp-diss-info-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }
        @media (min-width: 640px) { 
          .lp-diss-info-grid:not(.lp-dba-grid) { grid-template-columns: repeat(3, 1fr); } 
          .lp-diss-info-grid.lp-dba-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .lp-diss-info-card {
          border-radius: var(--radius-md);
          padding: 0.9rem 1rem;
          border: 1px solid;
        }
        .lp-diss-info-purple {
          background: rgba(124,92,246,0.08);
          border-color: rgba(124,92,246,0.2);
        }
        .lp-diss-info-blue {
          background: rgba(59,108,246,0.08);
          border-color: rgba(59,108,246,0.2);
        }
        .lp-diss-info-indigo {
          background: rgba(99,102,241,0.08);
          border-color: rgba(99,102,241,0.2);
        }
        .lp-diss-info-label {
          font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.4px;
          margin-bottom: 5px;
        }
        .lp-diss-info-purple .lp-diss-info-label { color: var(--accent-purple); }
        .lp-diss-info-blue   .lp-diss-info-label { color: var(--accent-blue); }
        .lp-diss-info-indigo .lp-diss-info-label { color: var(--accent-indigo); }

        .lp-diss-info-value {
          font-size: 1rem; font-weight: 700;
          color: var(--text-primary);
        }

        /* Progress Tracker box */
        .lp-diss-tracker {
          background: var(--bg-surface-2);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
        }
        .lp-diss-tracker-title {
          font-size: 14px; font-weight: 700;
          color: var(--text-primary);
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 1.5rem;
        }
        .lp-diss-tracker-title i { color: var(--accent-blue); }

        /* Steps row */
        .lp-steps-row {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        @media (min-width: 768px) {
          .lp-steps-row {
            flex-direction: row;
            align-items: flex-start;
          }
        }

        .lp-step-wrapper { display: flex; align-items: center; flex: 1; }
        .lp-step-wrapper:last-child .lp-step-line { display: none; }

        .lp-step-inner { display: flex; flex-direction: column; align-items: center; }

        /* Step circle */
        .lp-step-circle {
          width: 48px; height: 48px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 1.1rem;
          box-shadow: 0 4px 14px rgba(0,0,0,0.2);
          transition: transform 300ms ease, box-shadow 300ms ease;
          cursor: default;
        }
        .lp-step-circle:hover {
          transform: scale(1.12);
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }

        .diss-step-approved    { background: linear-gradient(135deg, #22c55e, #10b981); }
        .diss-step-not-approved { background: linear-gradient(135deg, #ef4444, #ec4899); }
        .diss-step-submitted   { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
        .diss-step-not-submitted { background: linear-gradient(135deg, #ef4444, #f97316); }
        .diss-step-pending     { background: linear-gradient(135deg, #94a3b8, #64748b); }

        .lp-step-num { font-size: 13px; font-weight: 800; }

        .lp-step-label {
          font-size: 12px; font-weight: 700;
          color: var(--text-primary);
          text-align: center;
          margin-top: 10px;
        }
        .lp-step-status {
          font-size: 10.5px;
          text-align: center;
          margin-top: 3px;
          font-weight: 600;
        }
        .diss-step-approved    ~ .lp-step-label + .lp-step-status,
        .status-approved    { color: #059669; }
        .status-not-approved { color: #dc2626; }
        .status-submitted   { color: #d97706; }
        .status-not-submitted { color: #ea580c; }
        .status-pending     { color: var(--text-muted); }

        /* Connector line */
        .lp-step-line {
          flex: 1;
          height: 2px;
          margin: 0 0.75rem;
          border-radius: 1px;
          margin-bottom: 28px; /* align with circle center */
        }
        .diss-line-approved      { background: linear-gradient(90deg, #22c55e, #10b981); }
        .diss-line-not-approved  { background: linear-gradient(90deg, #ef4444, #ec4899); }
        .diss-line-submitted     { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
        .diss-line-not-submitted { background: linear-gradient(90deg, #ef4444, #f97316); }
        .diss-line-pending       { background: var(--border-color); }

        /* Status summary bar */
        .lp-diss-summary {
          margin-top: 1.5rem;
          padding: 1rem 1.25rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        @media (min-width: 640px) {
          .lp-diss-summary { flex-direction: row; align-items: center; justify-content: space-between; }
        }

        .lp-diss-remarks {
          font-size: 12.5px;
          color: var(--text-secondary);
        }
        .lp-diss-remarks strong { color: var(--text-primary); margin-right: 4px; }

        .lp-diss-legend {
          display: flex; flex-wrap: wrap; gap: 12px;
        }
        .lp-legend-item {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; color: var(--text-muted); font-weight: 500;
        }
        .lp-legend-dot {
          width: 10px; height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .legend-approved    { background: #22c55e; }
        .legend-not-approved { background: #ef4444; }
        .legend-submitted   { background: #f59e0b; }
        .legend-pending     { background: #94a3b8; }

        /* ─── Academic Review Cards ─── */
        .ar-summary-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.25rem;
          margin-top: 1.5rem;
        }
        @media (min-width: 1024px) {
           .ar-summary-grid { grid-template-columns: repeat(3, 1fr); }
        }

        .ar-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-2xl);
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
        }
        .ar-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); border-color: var(--accent-blue); }
        
        .ar-card-header {
           display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.25rem;
        }

        .ar-card-icon {
          width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;
        }
        .ar-card-ar1 .ar-card-icon { background: rgba(59,108,246,0.1); color: var(--accent-blue); }
        .ar-card-ar2 .ar-card-icon { background: rgba(139,92,246,0.1); color: #8b5cf6; }
        .ar-card-final .ar-card-icon { background: rgba(236,72,153,0.1); color: #ec4899; }

        .ar-card-body { flex: 1; }
        
        .ar-title { font-size: 13px; font-weight: 800; color: var(--text-primary); margin-bottom: 2px; }
        .ar-subtitle { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        
        .ar-status-container { margin: 1rem 0; }

        .ar-detail-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--border-color); }
        .ar-detail-label { color: var(--text-muted); font-weight: 500; }
        .ar-detail-value { font-weight: 700; color: var(--text-primary); font-family: 'JetBrains Mono', monospace; }

        .ar-badge {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 700;
          background: rgba(148,163,184,0.1); color: #64748b;
          border: 1px solid rgba(148,163,184,0.2);
        }
        .ar-badge-good { background: rgba(16,185,129,0.1); color: #059669; border-color: rgba(16,185,129,0.2); }
        .ar-badge-probation { background: rgba(245,158,11,0.1); color: #d97706; border-color: rgba(245,158,11,0.2); }
        .ar-badge-disqualified { background: rgba(239,68,68,0.1); color: #dc2626; border-color: rgba(239,68,68,0.2); }
        
        .ar-badge i { font-size: 10px; }
      `}</style>

      <div className="lp-page">
        {/* Back link */}
        <Link to={`/${programId}/learners?view=learners`} className="lp-back-link">
          <i className="fas fa-arrow-left" /> Back to Learners
        </Link>

        {loading ? (
          <div className="lp-state-card">
            <i className="fas fa-spinner fa-spin mr-2 text-blue-500" /> Loading learner data…
          </div>
        ) : error ? (
          <div className="lp-state-card" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
            <div style={{ color: '#dc2626', fontWeight: 700 }}>Failed to load sheet data</div>
            <div style={{ color: '#ef4444', fontSize: 12, marginTop: 4 }}>{error}</div>
          </div>
        ) : !decodedUserId ? (
          <div className="lp-state-card">Missing user ID</div>
        ) : !learnerInfo ? (
          <div className="lp-state-card">Learner not found</div>
        ) : (
          <>
            {/* ───────────── Profile Header ───────────── */}
            <div className="lp-header">
              <div className="lp-avatar">{initials}</div>

              <div className="lp-header-info">
                <div className="lp-header-name">
                  {learnerInfo.firstName} {learnerInfo.lastName}
                </div>
                <div className="lp-header-ids">
                  User ID: <span>{decodedUserId}</span>
                  {' · '}
                  GGU ID: <span>{learnerInfo.gguId ?? 'N/A'}</span>
                </div>
                {latestCohort && (
                  <div className="lp-cohort-badge">
                    <i className="fas fa-graduation-cap" style={{ marginRight: 5 }} />
                    Cohort {latestCohort.cohort ?? ''}: {latestCohort.status ?? ''}
                  </div>
                )}
              </div>

              <div className="lp-header-contact">
                <div className="lp-contact-item">
                  <i className="fas fa-envelope" />
                  <span>{learnerInfo.email}</span>
                </div>
                {learnerInfo.contact && learnerInfo.contact !== '0' && (
                  <div className="lp-contact-item">
                    <i className="fas fa-phone" />
                    <span>{learnerInfo.contact}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ───────────── Timeline ───────────── */}
            <div className="lp-timeline">
              {/* ── Professional Background ── */}
              <div className="lp-tl-section">
                <div className="lp-tl-icon lp-tl-icon-prof">
                  <i className="fas fa-user-tie" />
                </div>
                <div className="lp-card">
                  <div className="lp-card-body">
                    <div className="lp-section-title">Professional Background</div>
                    <div className="lp-prof-grid">
                      <div className="lp-prof-box">
                        <div className="lp-prof-box-title">Demographics</div>
                        <div className="lp-prof-item">
                          <i className="fas fa-flag" style={{ color: 'var(--accent-blue)' }} />
                          Country of Origin: <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>{learnerInfo.countryOfOrigin ?? 'N/A'}</strong>
                        </div>
                        <div className="lp-prof-item">
                          <i className="fas fa-map-marker-alt" style={{ color: 'var(--accent-blue)' }} />
                          Country of Residence: <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>{learnerInfo.countryOfResidence ?? 'N/A'}</strong>
                        </div>
                      </div>
                      <div className="lp-prof-box">
                        <div className="lp-prof-box-title">Professional Info</div>
                        <div className="lp-prof-item">
                          <i className="fas fa-building" style={{ color: 'var(--accent-emerald)' }} />
                          Company: <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>{learnerInfo.company ?? 'N/A'}</strong>
                        </div>
                        <div className="lp-prof-item">
                          <i className="fas fa-briefcase" style={{ color: 'var(--accent-emerald)' }} />
                          Industry: <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>{learnerInfo.industry ?? 'N/A'}</strong>
                        </div>
                      </div>
                      <div className="lp-prof-box">
                        <div className="lp-prof-box-title">Additional Info</div>
                        <div className="lp-prof-item">
                          <i className="fas fa-user-tag" style={{ color: 'var(--accent-purple)' }} />
                          Designation: <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>{learnerInfo.designation ?? 'N/A'}</strong>
                        </div>
                        <div className="lp-prof-item">
                          <i className="fas fa-chart-line" style={{ color: 'var(--accent-purple)' }} />
                          Seniority: <strong style={{ color: 'var(--text-primary)', marginLeft: 4 }}>{learnerInfo.seniority ?? 'N/A'}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Cohort Journey sections ── */}
              {cohorts.map((cohort) => {
                const statusText = (cohort.status ?? '').trim();
                const coursesCompleted = parseNumber(cohort.coursesCompleted) ?? 0;
                const coursesIncomplete = parseNumber(cohort.coursesIncomplete) ?? 0;
                const netCompleted = Math.max(0, Math.round(coursesCompleted - coursesIncomplete));
                const badgeStyle = statusBadgeStyle(statusText);

                return (
                  <div key={`${cohort.email}-${cohort.cohortId ?? ''}`} className="lp-tl-section">
                    <div className="lp-tl-icon lp-tl-icon-cohort">
                      <i className="fas fa-graduation-cap" />
                    </div>
                    <div className="lp-card">
                      {/* Header strip */}
                      <div className="lp-cohort-header">
                        <div className="lp-cohort-title">Cohort {cohort.cohort ?? ''} Journey</div>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 100,
                          fontSize: 11,
                          fontWeight: 700,
                          background: badgeStyle.bg,
                          color: badgeStyle.color,
                          border: badgeStyle.border,
                        }}>
                          {statusText || 'N/A'}
                        </span>
                      </div>

                      <div className="lp-card-body">
                        {/* KPI row */}
                        <div className="lp-stat-grid">
                          <div className="lp-stat-card lp-stat-card-blue">
                            <div className="lp-stat-label">Program Slot</div>
                            <div className="lp-stat-value">{(cohort.slot ?? '').slice(0, 6) || 'N/A'}</div>
                          </div>
                          <div className="lp-stat-card lp-stat-card-green">
                            <div className="lp-stat-label">Learner Type</div>
                            <div className="lp-stat-value">
                              {(students.find((s) => (s['User ID'] ?? '').trim() === decodedUserId)?.['Learner type']
                                ?? students.find((s) => (s['User ID'] ?? '').trim() === decodedUserId)?.['Learner Type']
                                ?? students.find((s) => (s['User ID'] ?? '').trim() === decodedUserId)?.['Batch']
                                ?? 'N/A') as string}
                            </div>
                          </div>
                          {programId !== 'mba' && (
                            <>
                              <div className="lp-stat-card lp-stat-card-purple">
                                <div className="lp-stat-label">Courses Completed</div>
                                <div className="lp-stat-value">
                                  <AnimatedNumber value={netCompleted} />/{config.totalCourses || 7}
                                </div>
                              </div>
                              <div className="lp-stat-card lp-stat-card-amber">
                                <div className="lp-stat-label">Overall CGPA</div>
                                <div className="lp-stat-value">
                                  {parseNumber(cohort.overallCgpa) !== null ? (
                                    <AnimatedNumber value={parseNumber(cohort.overallCgpa) as number} formatter={(v) => v.toFixed(2)} />
                                  ) : (cohort.overallCgpa ?? 'N/A')}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Academic Performance */}
                        {programId !== 'mba' && (
                          <>
                            <div className="lp-section-title" style={{ fontSize: 13 }}>Academic Performance</div>
                            <div className="lp-table-wrap">
                              <table className="lp-table">
                                <thead>
                                  <tr>
                                    <th>Course</th>
                                    <th>Grade</th>
                                    <th>Credit</th>
                                    <th>Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {config.coursework?.map((phase) => (
                                    <Fragment key={phase.phase}>
                                      {programId !== 'dba-et' && (
                                        <tr className="bg-gray-50/50">
                                          <td colSpan={4} className="px-4 py-2 text-[10px] font-black text-gray-500 uppercase tracking-widest border-y border-gray-100">
                                            {phase.phase}
                                          </td>
                                        </tr>
                                      )}
                                      {phase.courses.map((course) => {
                                        const gradeValue = cohort.coursework[course.gradeCol];
                                        const gpaValue = cohort.courseGpa[course.gpaCol];
                                        const grade = (gradeValue ?? '').trim();
                                        const credit = parseNumber((gpaValue ?? '').trim());
                                        const cat = gradeCategory(grade, credit);
                                        if (grade === '' && statusText === 'Deferred Out') return null;
                                        if (statusText === 'Deferred Out' && grade === 'I') return null;

                                        const gradeColor =
                                          cat === 'excellent' ? '#059669' :
                                            cat === 'good' ? '#d97706' :
                                              cat === 'satisfactory' ? 'var(--accent-blue)' :
                                                cat === 'pending' ? '#64748b' : '#dc2626';
                                        return (
                                          <tr key={course.gradeCol}>
                                            <td style={{ fontWeight: 600 }}>{course.name}</td>
                                            <td style={{ color: gradeColor, fontWeight: 700 }}>{grade || '-'}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>
                                              {credit !== null ? credit.toFixed(1) : (cohort.courseGpa[course.gpaCol] || '-')}
                                            </td>
                                            <td>
                                              <span className={`grade-badge grade-${cat}`}>
                                                {cat === 'excellent' ? 'Excellent' :
                                                  cat === 'good' ? 'Good' :
                                                    cat === 'satisfactory' ? 'Satisfactory' :
                                                      cat === 'pending' ? 'Pending' : 'Low Grade'}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </Fragment>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Academic Review Summary */}
                            {(programId === 'dba-et' || programId === 'dba') && (() => {
                              const learnerEmail = learnerInfo?.email ? normEmail(learnerInfo.email) : '';
                              const cohortId = digitsOnly(cohort.cohortId || cohort.cohort || '');

                              const arRow = arRows.find(r => {
                                const rowEmail = normEmail(getARField(r, 'Email ID', 'GGU Student Email ID', 'Email'));
                                const rowCohort = digitsOnly(getARField(r, 'Cohort ID', 'Cohort'));
                                return rowEmail === learnerEmail && (rowCohort === cohortId || !cohortId);
                              });

                              if (!arRow) return null;

                              const ar1Status = getARField(arRow, '1st Academic Review Status', '1st Academic Review');
                              const ar1Cgpa = getARField(arRow, '1st Academic Review CGPA');
                              const ar1Date = getARField(arRow, 'Academic Review 1 Date', '1st Academic Review Date', 'AR1 Date');

                              const ar2Status = getARField(arRow, '2nd Academic Review Status', '2nd Academic Review');
                              const ar2Cgpa = getARField(arRow, '2nd Academic Review CGPA');
                              const ar2Date = getARField(arRow, 'Academic Review 2 Date', '2nd Academic Review Date', 'AR2 Date');

                              const finalStatus = getARField(arRow, 'Final Academic Review Status', 'Final Academic Review');
                              const overallCgpa = getARField(arRow, 'Overall CGPA');


                              return (
                                <div style={{ marginTop: '2rem' }}>
                                  <div className="lp-section-title" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <i className="fas fa-clipboard-check text-indigo-500" />
                                    Academic Review Outcomes
                                  </div>
                                  <div className="ar-summary-grid">
                                    {/* AR1 */}
                                    <div className="ar-card ar-card-ar1">
                                      <div className="ar-card-header">
                                        <div className="ar-card-icon">
                                          <i className="fas fa-chart-line" />
                                        </div>
                                        <div className="ar-card-info" style={{ textAlign: 'right' }}>
                                          <div className="ar-title">Review Phase 1</div>
                                          <div className="ar-subtitle">Academic Review 1</div>
                                        </div>
                                      </div>
                                      <div className="ar-card-body">
                                        <ARStatusBadge status={ar1Status} />
                                        <div className="ar-detail-row">
                                          <span className="ar-detail-label">CGPA</span>
                                          <span className="ar-detail-value">{formatGPA(ar1Cgpa)}</span>
                                        </div>
                                        <div className="ar-detail-row">
                                          <span className="ar-detail-label">Review Date</span>
                                          <span className="ar-detail-value">{parseARDate(ar1Date)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* AR2 */}
                                    <div className="ar-card ar-card-ar2">
                                      <div className="ar-card-header">
                                        <div className="ar-card-icon">
                                          <i className="fas fa-chart-bar" />
                                        </div>
                                        <div className="ar-card-info" style={{ textAlign: 'right' }}>
                                          <div className="ar-title">Review Phase 2</div>
                                          <div className="ar-subtitle">Academic Review 2</div>
                                        </div>
                                      </div>
                                      <div className="ar-card-body">
                                        <ARStatusBadge status={ar2Status} />
                                        <div className="ar-detail-row">
                                          <span className="ar-detail-label">CGPA</span>
                                          <span className="ar-detail-value">{formatGPA(ar2Cgpa)}</span>
                                        </div>
                                        <div className="ar-detail-row">
                                          <span className="ar-detail-label">Review Date</span>
                                          <span className="ar-detail-value">{parseARDate(ar2Date)}</span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Final */}
                                    <div className="ar-card ar-card-final">
                                      <div className="ar-card-header">
                                        <div className="ar-card-icon">
                                          <i className="fas fa-flag-checkered" />
                                        </div>
                                        <div className="ar-card-info" style={{ textAlign: 'right' }}>
                                          <div className="ar-title">Final Verdict</div>
                                          <div className="ar-subtitle">Final Academic Review</div>
                                        </div>
                                      </div>
                                      <div className="ar-card-body">
                                        <ARStatusBadge status={finalStatus} />
                                        <div className="ar-detail-row">
                                          <span className="ar-detail-label">Overall GPA</span>
                                          <span className="ar-detail-value">{formatGPA(overallCgpa)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* ── Dissertation Progress ── */}
              {programId === 'mba' ? null : (dissertationRow && (() => {
                const topic = topicProposalStatus(dissertationRow as Record<string, string>, programId);
                const irb = irbStatus(dissertationRow as Record<string, string>, programId);
                const research = researchProposalStatus(dissertationRow as Record<string, string>, programId);
                const finalDef = finalDefenseStatus(dissertationRow as Record<string, string>, programId);

                const steps: Array<{ label: string; status: StatusLabel; stepNum: number }> = programId === 'dba' ? [
                  { label: 'Topic Proposal', status: topic, stepNum: 1 },
                  { label: 'Research Proposal', status: research, stepNum: 2 },
                  { label: 'Final Dissertation', status: finalDef, stepNum: 3 },
                ] : [
                  { label: 'Topic Proposal', status: topic, stepNum: 1 },
                  { label: 'IRB', status: irb, stepNum: 2 },
                  { label: 'Research Proposal', status: research, stepNum: 3 },
                  { label: 'Final Defense', status: finalDef, stepNum: 4 },
                ];

                const remarks = (dissertationRow['Remarks'] ?? '').trim();
                const hasRemarks = remarks && remarks !== '0';

                const statusColor = (s: StatusLabel) => {
                  if (s === 'Approved') return 'status-approved';
                  if (s === 'Not Approved') return 'status-not-approved';
                  if (s === 'Submitted') return 'status-submitted';
                  if (s === 'Not Submitted') return 'status-not-submitted';
                  return 'status-pending';
                };

                return (
                  <div className="lp-tl-section">
                    <div className="lp-tl-icon lp-tl-icon-diss">
                      <i className="fas fa-file-alt" />
                    </div>
                    <div className="lp-card">
                      {/* Header */}
                      <div className="lp-diss-header">
                        <div>
                          <div className="lp-diss-header-title">Dissertation Progress</div>
                          <div className="lp-diss-header-sub">Milestone journey for the latest cohort</div>
                        </div>
                        <span className="lp-diss-journey-badge">
                          <i className="fas fa-file-alt" /> Journey
                        </span>
                      </div>

                      <div className="lp-card-body">
                        {/* Cohort label */}
                        <div className="lp-diss-cohort-label">
                          Cohort {digitsOnly(String(latestCohort?.cohort ?? '')) || String(latestCohort?.cohort ?? '')}
                        </div>

                        {/* Mode / Chair / Co-Chair */}
                        <div className={`lp-diss-info-grid ${programId === 'dba' ? 'lp-dba-grid' : ''}`}>
                          {programId !== 'dba' && (
                            <div className="lp-diss-info-card lp-diss-info-purple">
                              <div className="lp-diss-info-label">Dissertation Mode</div>
                              <div className="lp-diss-info-value">
                                {getAnyField(dissertationRow, ['Dissertation mode', 'Dissertation Mode', 'Dissertation']) || 'Not Selected'}
                              </div>
                            </div>
                          )}
                          <div className="lp-diss-info-card lp-diss-info-blue">
                            <div className="lp-diss-info-label">Chair</div>
                            <div className="lp-diss-info-value">
                              {getAnyField(dissertationRow, ['Chair', 'Dissertation Chair', 'Chair Name']) || 'Not Assigned'}
                            </div>
                          </div>
                          <div className="lp-diss-info-card lp-diss-info-indigo">
                            <div className="lp-diss-info-label">Co-Chair</div>
                            <div className="lp-diss-info-value">
                              {getAnyField(dissertationRow, ['Co-chair Name', 'Co-Chair', 'Co Chair', 'Co-chair', 'Dissertation Co-Chair', 'Dissertation Co Chair']) || 'Not Assigned'}
                            </div>
                          </div>
                        </div>

                        {/* Progress Tracker */}
                        <div className="lp-diss-tracker">
                          <div className="lp-diss-tracker-title">
                            <i className="fas fa-tasks" /> Progress Tracker
                          </div>

                          {/* Steps */}
                          <div className="lp-steps-row">
                            {steps.map((s, idx) => {
                              const ss = toStepStatus(s.status);
                              const isLast = idx === steps.length - 1;
                              return (
                                <div key={s.label} className="lp-step-wrapper">
                                  <div className="lp-step-inner">
                                    <StepCircle status={ss} stepNum={s.stepNum} />
                                    <div className="lp-step-label">{s.label}</div>
                                    <div className={`lp-step-status ${statusColor(s.status)}`}>
                                      {s.status}
                                    </div>
                                  </div>
                                  {!isLast && (
                                    <div className={`lp-step-line ${stepLineClass(ss)}`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Status Summary bar — matching Ver16 */}
                          <div className="lp-diss-summary">
                            <div className="lp-diss-remarks">
                              <strong>Latest Update:</strong>
                              {hasRemarks ? remarks : "Track learner's dissertation progress above."}
                            </div>
                            <div className="lp-diss-legend">
                              <div className="lp-legend-item">
                                <div className="lp-legend-dot legend-approved" />
                                <span>Approved</span>
                              </div>
                              <div className="lp-legend-item">
                                <div className="lp-legend-dot legend-not-approved" />
                                <span>Not Approved</span>
                              </div>
                              <div className="lp-legend-item">
                                <div className="lp-legend-dot legend-submitted" />
                                <span>Submitted</span>
                              </div>
                              <div className="lp-legend-item">
                                <div className="lp-legend-dot legend-pending" />
                                <span>Pending</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })())}
            </div>
          </>
        )}
      </div>
    </>
  );
}
