export interface ProgramStatusRow {
  program: string;
  active: number;
  exit: number;
  inactive: number;
  total: number;
}

export interface RetentionRow {
  program: string;
  totalEnrolment: number;
  disqualifiedDropout: number;
  total: number;
  retentionPct: number;
}

export interface GraduationRow {
  program: string;
  totalEnrolment: number;
  graduatedLearners: number;
  graduationPct: number | null;
}

export interface CohortCountRow {
  program: string;
  allTimeCohorts: number;
  liveCohorts: number;
  closedCohorts: number;
}

export interface TermActiveRow {
  term: string;
  dba: number;
  mba: number;
  dbaEt: number;
  mPsych: number;
  dbaDl: number;
  sjd: number;
  mbaSa: number;
  bachelorsSa: number;
  grandTotal: number;
}

// 1. Status Level Details
export const STATUS_LEVEL_DETAILS: ProgramStatusRow[] = [
  { program: 'GGU DBA', active: 1114, exit: 285, inactive: 84, total: 1483 },
  { program: 'GGU MBA', active: 611, exit: 1314, inactive: 79, total: 2004 },
  { program: 'GGU DBA ET', active: 887, exit: 53, inactive: 46, total: 986 },
  { program: 'GGU MPsych', active: 57, exit: 1, inactive: 3, total: 61 },
  { program: 'GGU DBA DL', active: 41, exit: 19, inactive: 1, total: 61 },
  { program: 'GGU SJD', active: 45, exit: 0, inactive: 4, total: 49 },
  { program: 'GGU MBA SA', active: 73, exit: 684, inactive: 0, total: 757 },
  { program: 'GGU Bachelors SA', active: 330, exit: 455, inactive: 2, total: 787 },
];

export const STATUS_LEVEL_TOTALS = {
  active: 3158,
  exit: 2811,
  inactive: 219,
  grandTotal: 6188,
};

// 2. Retention Active Cohort
export const RETENTION_ACTIVE_COHORT: RetentionRow[] = [
  { program: 'GGU DBA', totalEnrolment: 1483, disqualifiedDropout: 222, total: 1705, retentionPct: 86.98 },
  { program: 'GGU MBA', totalEnrolment: 679, disqualifiedDropout: 2, total: 681, retentionPct: 99.71 },
  { program: 'GGU DBA ET', totalEnrolment: 986, disqualifiedDropout: 36, total: 1022, retentionPct: 96.48 },
  { program: 'GGU MPsych', totalEnrolment: 61, disqualifiedDropout: 1, total: 62, retentionPct: 98.39 },
  { program: 'GGU DBA DL', totalEnrolment: 61, disqualifiedDropout: 3, total: 64, retentionPct: 95.31 },
  { program: 'GGU SJD', totalEnrolment: 0, disqualifiedDropout: 0, total: 0, retentionPct: 0 },
  { program: 'GGU MBA SA', totalEnrolment: 137, disqualifiedDropout: 14, total: 151, retentionPct: 90.73 },
  { program: 'GGU Bachelors SA', totalEnrolment: 337, disqualifiedDropout: 7, total: 344, retentionPct: 97.97 },
];

export const RETENTION_ACTIVE_TOTAL = {
  totalEnrolment: 3744,
  disqualifiedDropout: 285,
  total: 4029,
  retentionPct: 92.93,
};

// 3. Historical Retention
export const HISTORICAL_RETENTION: RetentionRow[] = [
  { program: 'GGU DBA', totalEnrolment: 1483, disqualifiedDropout: 222, total: 1705, retentionPct: 86.98 },
  { program: 'GGU MBA', totalEnrolment: 2004, disqualifiedDropout: 246, total: 2250, retentionPct: 89.07 },
  { program: 'GGU DBA ET', totalEnrolment: 986, disqualifiedDropout: 36, total: 1022, retentionPct: 96.48 },
  { program: 'GGU MPsych', totalEnrolment: 61, disqualifiedDropout: 1, total: 62, retentionPct: 98.39 },
  { program: 'GGU DBA DL', totalEnrolment: 61, disqualifiedDropout: 3, total: 64, retentionPct: 95.31 },
  { program: 'GGU SJD', totalEnrolment: 49, disqualifiedDropout: 0, total: 49, retentionPct: 100.00 },
  { program: 'GGU MBA SA', totalEnrolment: 757, disqualifiedDropout: 204, total: 961, retentionPct: 78.77 },
  { program: 'GGU Bachelors SA', totalEnrolment: 787, disqualifiedDropout: 124, total: 911, retentionPct: 86.39 },
];

export const HISTORICAL_RETENTION_TOTAL = {
  totalEnrolment: 6188,
  disqualifiedDropout: 836,
  total: 7024,
  retentionPct: 88.10,
};

// 4. Closed Cohort Graduation
export const CLOSED_COHORT_GRADUATION: GraduationRow[] = [
  { program: 'GGU DBA', totalEnrolment: 0, graduatedLearners: 0, graduationPct: null },
  { program: 'GGU MBA', totalEnrolment: 1311, graduatedLearners: 1067, graduationPct: 81.39 },
  { program: 'GGU DBA ET', totalEnrolment: 0, graduatedLearners: 0, graduationPct: null },
  { program: 'GGU MPsych', totalEnrolment: 0, graduatedLearners: 0, graduationPct: null },
  { program: 'GGU DBA DL', totalEnrolment: 0, graduatedLearners: 0, graduationPct: null },
  { program: 'GGU SJD', totalEnrolment: 45, graduatedLearners: 0, graduationPct: 0.00 },
  { program: 'GGU MBA SA', totalEnrolment: 620, graduatedLearners: 426, graduationPct: 68.71 },
  { program: 'GGU Bachelors SA', totalEnrolment: 448, graduatedLearners: 316, graduationPct: 70.54 },
];

export const CLOSED_COHORT_TOTAL = {
  totalEnrolment: 2424,
  graduatedLearners: 1809,
  graduationPct: 74.63,
};

// 5. Active Cohort Graduation
export const ACTIVE_COHORT_GRADUATION: GraduationRow[] = [
  { program: 'GGU DBA', totalEnrolment: 1399, graduatedLearners: 63, graduationPct: 4.50 },
  { program: 'GGU MBA', totalEnrolment: 614, graduatedLearners: 1, graduationPct: 0.16 },
  { program: 'GGU DBA ET', totalEnrolment: 940, graduatedLearners: 16, graduationPct: 1.70 },
  { program: 'GGU MPsych', totalEnrolment: 58, graduatedLearners: 0, graduationPct: 0.00 },
  { program: 'GGU DBA DL', totalEnrolment: 60, graduatedLearners: 4, graduationPct: 6.67 },
  { program: 'GGU SJD', totalEnrolment: 0, graduatedLearners: 0, graduationPct: null },
  { program: 'GGU MBA SA', totalEnrolment: 137, graduatedLearners: 54, graduationPct: 39.42 },
  { program: 'GGU Bachelors SA', totalEnrolment: 337, graduatedLearners: 0, graduationPct: 0.00 },
];

export const ACTIVE_COHORT_GRADUATION_TOTAL = {
  totalEnrolment: 3545,
  graduatedLearners: 138,
  graduationPct: 3.89,
};

// 6. Number of Cohorts
export const COHORT_COUNTS: CohortCountRow[] = [
  { program: 'GGU DBA', allTimeCohorts: 40, liveCohorts: 40, closedCohorts: 0 },
  { program: 'GGU MBA', allTimeCohorts: 32, liveCohorts: 11, closedCohorts: 21 },
  { program: 'GGU DBA ET', allTimeCohorts: 14, liveCohorts: 14, closedCohorts: 0 },
  { program: 'GGU MPsych', allTimeCohorts: 3, liveCohorts: 3, closedCohorts: 0 },
  { program: 'GGU DBA DL', allTimeCohorts: 2, liveCohorts: 2, closedCohorts: 0 },
  { program: 'GGU SJD', allTimeCohorts: 4, liveCohorts: 0, closedCohorts: 4 },
  { program: 'GGU MBA SA', allTimeCohorts: 38, liveCohorts: 11, closedCohorts: 27 },
  { program: 'GGU Bachelors SA', allTimeCohorts: 49, liveCohorts: 37, closedCohorts: 12 },
];

export const COHORT_COUNTS_TOTAL = {
  allTimeCohorts: 182,
  liveCohorts: 118,
  closedCohorts: 64,
};

// 7. Term Level Active Matrix
export const TERM_LEVEL_ACTIVE: TermActiveRow[] = [
  { term: '22/FU', dba: 40, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 40 },
  { term: '22/UU', dba: 28, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 28 },
  { term: '23/07', dba: 48, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 15, mbaSa: 0, bachelorsSa: 0, grandTotal: 63 },
  { term: '23/08', dba: 31, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 31 },
  { term: '23/10', dba: 46, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 46 },
  { term: '23/10 (b)', dba: 0, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 1, mbaSa: 0, bachelorsSa: 0, grandTotal: 1 },
  { term: '23/11', dba: 15, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 15 },
  { term: '23/FC', dba: 0, mba: 0, dbaEt: 35, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 35 },
  { term: '23/SU', dba: 50, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 21, mbaSa: 0, bachelorsSa: 0, grandTotal: 71 },
  { term: '23/TU', dba: 5, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 5 },
  { term: '23/WU', dba: 63, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 63 },
  { term: '23/XU', dba: 12, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 12 },
  { term: '24/01', dba: 35, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 35 },
  { term: '24/01 (b)', dba: 0, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 8, mbaSa: 0, bachelorsSa: 0, grandTotal: 8 },
  { term: '24/02', dba: 26, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 26 },
  { term: '24/03', dba: 0, mba: 0, dbaEt: 78, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 78 },
  { term: '24/04', dba: 31, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 2, bachelorsSa: 0, grandTotal: 33 },
  { term: '24/05', dba: 15, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 15 },
  { term: '24/07', dba: 28, mba: 0, dbaEt: 94, mPsych: 0, dbaDl: 21, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 143 },
  { term: '24/08', dba: 12, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 12 },
  { term: '24/10', dba: 63, mba: 0, dbaEt: 75, mPsych: 0, dbaDl: 20, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 158 },
  { term: '24/11', dba: 7, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 7 },
  { term: '24/SA', dba: 0, mba: 0, dbaEt: 62, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 62 },
  { term: '25/01', dba: 37, mba: 0, dbaEt: 69, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 1, bachelorsSa: 0, grandTotal: 107 },
  { term: '25/02', dba: 10, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 1, bachelorsSa: 0, grandTotal: 11 },
  { term: '25/04', dba: 45, mba: 0, dbaEt: 90, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 1, bachelorsSa: 0, grandTotal: 136 },
  { term: '25/05', dba: 0, mba: 30, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 30 },
  { term: '25/07', dba: 67, mba: 57, dbaEt: 79, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 7, bachelorsSa: 0, grandTotal: 210 },
  { term: '25/08', dba: 0, mba: 40, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 11, bachelorsSa: 0, grandTotal: 51 },
  { term: '25/10', dba: 81, mba: 74, dbaEt: 95, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 9, bachelorsSa: 0, grandTotal: 259 },
  { term: '25/11', dba: 0, mba: 37, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 9, bachelorsSa: 0, grandTotal: 46 },
  { term: '25/FA', dba: 0, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 9, grandTotal: 9 },
  { term: '25/FC', dba: 0, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 45, grandTotal: 45 },
  { term: '25/UC', dba: 0, mba: 0, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 14, grandTotal: 14 },
  { term: '26/01', dba: 0, mba: 75, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 9, bachelorsSa: 0, grandTotal: 84 },
  { term: '26/02', dba: 0, mba: 50, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 6, bachelorsSa: 0, grandTotal: 56 },
  { term: '26/04', dba: 0, mba: 90, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 10, bachelorsSa: 0, grandTotal: 100 },
  { term: '26/05', dba: 0, mba: 28, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 4, bachelorsSa: 0, grandTotal: 32 },
  { term: '26/07', dba: 0, mba: 129, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 3, bachelorsSa: 0, grandTotal: 132 },
  { term: '26/10', dba: 0, mba: 1, dbaEt: 0, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 1 },
  { term: '26/FA', dba: 119, mba: 0, dbaEt: 0, mPsych: 17, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 136 },
  { term: '26/FB', dba: 0, mba: 0, dbaEt: 3, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 0, grandTotal: 3 },
  { term: '26/SA', dba: 65, mba: 0, dbaEt: 67, mPsych: 15, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 42, grandTotal: 189 },
  { term: '26/SC', dba: 43, mba: 0, dbaEt: 32, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 26, grandTotal: 101 },
  { term: '26/UA', dba: 92, mba: 0, dbaEt: 61, mPsych: 25, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 28, grandTotal: 206 },
  { term: '26/UC', dba: 0, mba: 0, dbaEt: 47, mPsych: 0, dbaDl: 0, sjd: 0, mbaSa: 0, bachelorsSa: 166, grandTotal: 213 },
];
