import type { GradesheetRow, LearnerMerged, NeedsAttentionLearner, StudentListRow } from '../types';
import { PROGRAMS, type ProgramId } from './config';

export function normalizeSecondaryStatus(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ACTIVE_SECONDARY_STATUSES_SET = new Set([
  normalizeSecondaryStatus('Active'),
  normalizeSecondaryStatus('Active / Deferred In'),
  normalizeSecondaryStatus('Active & Registered'),
  normalizeSecondaryStatus('Registered'),
  normalizeSecondaryStatus('Coursework Phase'),
  normalizeSecondaryStatus('Active (Prospective Deferral)'),
]);

export function v(row: any, ...possibleKeys: string[]): string {
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

export function isLearnerActive(status: string | undefined): boolean {
  if (!status) return false;
  const s = normalizeSecondaryStatus(status);
  return ACTIVE_SECONDARY_STATUSES_SET.has(s) || s.includes('active') || s.includes('enrolled') || s.includes('coursework');
}

export const NEEDS_ATTENTION_STATUSES = ['Active', 'Active (Prospective Deferral)'] as const;

export function getProgramCourseworkDirectColLists(programId: ProgramId) {
  const config = PROGRAMS[programId];
  if (!config || !('coursework' in config)) return { grades: [], gpas: [] };

  const grades: string[] = [];
  const gpas: string[] = [];

  config.coursework?.forEach(phase => {
    phase.courses.forEach(course => {
      grades.push(course.gradeCol);
      gpas.push(course.gpaCol);
    });
  });

  return { grades, gpas };
}

function normalizeEmail(email: string | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

function getStudentEmail(row: StudentListRow): string {
  return (
    row['Email ID'] ??
    row['Email'] ??
    row['GGU Student Email ID'] ??
    ''
  );
}

function getGradesEmail(row: GradesheetRow): string {
  return (
    row['Email ID'] ??
    row['GGU Email ID'] ??
    row['Email'] ??
    row['GGU Student Email ID'] ??
    ''
  );
}

function mergeCourseGrades(programId: ProgramId, gradesRow?: GradesheetRow): Record<string, string | undefined> {
  const coursework: Record<string, string | undefined> = {};
  const { grades } = getProgramCourseworkDirectColLists(programId);
  for (const col of grades) {
    coursework[col] = gradesRow?.[col];
  }
  return coursework;
}

function mergeCourseGpa(programId: ProgramId, gradesRow?: GradesheetRow): Record<string, string | undefined> {
  const gpa: Record<string, string | undefined> = {};
  const { gpas } = getProgramCourseworkDirectColLists(programId);
  for (const col of gpas) {
    gpa[col] = gradesRow?.[col];
  }
  return gpa;
}

function countCompletedCourses(coursework: Record<string, string | undefined>): number {
  let count = 0;
  for (const val of Object.values(coursework)) {
    const s = (val || '').trim().toUpperCase();
    if (s && s !== 'I' && s !== 'W' && s !== 'NA' && s !== 'N/A' && s !== '0' && s !== '-') {
      count++;
    }
  }
  return count;
}

export function mergeLearners(options: {
  programId: ProgramId;
  students: StudentListRow[];
  grades: GradesheetRow[];
}): LearnerMerged[] {
  const { programId, students, grades } = options;

  const gradeIndex = new Map<string, GradesheetRow>();
  for (const g of grades) {
    const email = getGradesEmail(g);
    const cohortId = ((g['Cohort ID'] ?? g['uG Cohort ID'] ?? '') as string).trim();
    const key = `${normalizeEmail(email)}__${cohortId}`;

    if (normalizeEmail(email)) {
      gradeIndex.set(key, g);
    }
  }

  const result: LearnerMerged[] = [];
  const seenKeys = new Set<string>();

  const studentRows = students
    .filter((s) => normalizeEmail(getStudentEmail(s)))
    .map((s) => {
      const cohortId = (s['Cohort ID'] ?? '').trim();
      const email = (getStudentEmail(s) ?? '').trim();

      const key = `${normalizeEmail(email)}__${cohortId}`;

      const gradeRow =
        gradeIndex.get(key) ??
        grades.find((g) => normalizeEmail(getGradesEmail(g)) === normalizeEmail(email));

      const statusFromStudentList = v(s, 'Actual Status', 'Actual status', 'Status Details', 'Secondary Status', 'Status');
      const statusFromGrades = v(gradeRow, 'upGrad Learner Status', 'GGU Learner Status', 'Status Details', 'Actual Status', 'Secondary Status', 'Status');

      const combinedStatus = statusFromStudentList || statusFromGrades;

      const learnerType = v(s, 'Learner Type', 'Type');

      const merged: LearnerMerged = {
        firstName: (s['First Name'] ?? gradeRow?.['First Name'] ?? '').toString().trim(),
        lastName: (s['Last Name'] ?? gradeRow?.['Last Name'] ?? '').toString().trim(),
        email,
        userId: v(s, 'User ID') || undefined,
        batch: v(s, 'Batch') || undefined,
        learnerType: learnerType || undefined,
        cohort: v(s, 'Cohort #', 'Cohort') || undefined,
        cohortId: v(s, 'Cohort ID') || undefined,
        status: combinedStatus || undefined,
        secondaryStatus: combinedStatus || undefined,
        packageKey: v(s, 'Package Key') || undefined,
        term: v(s, 'Term') || undefined,
        aging: parseNumber(v(s, 'Aging')) ?? undefined,
        launchMonth: v(s, 'Launch Month') || undefined,
        concentration: v(s, 'Concentration') || undefined,
        statusDetails: v(s, 'Status Details') || undefined,
        slot: v(s, 'Slot') || undefined,
        overallCgpa: gradeRow?.['Overall CGPA'] ?? undefined,
        coursesCompleted: gradeRow?.['Courses Completed'] ?? gradeRow?.['Completed Courses'] ?? String(countCompletedCourses(mergeCourseGrades(programId, gradeRow))),
        coursesIncomplete: gradeRow?.['Courses Incomplete'] ?? gradeRow?.['Incomplete Courses'] ?? undefined,
        coursework: mergeCourseGrades(programId, gradeRow),
        courseGpa: mergeCourseGpa(programId, gradeRow),
        country: v(s, 'Country Of Residence', 'Country of  Residence', 'Country of Residence', 'Country') || undefined,
        region: v(s, 'Region') || gradeRow?.['Region'] || undefined,
        immersion: v(s, 'Immersion') || gradeRow?.['Immersion'] || undefined,
        spoc: v(s, 'SPOC') || gradeRow?.['SPOC'] || undefined,
      };

      return { key, merged };
    });

  for (const item of studentRows) {
    const key = item.key;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    result.push(item.merged);
  }

  for (const g of grades) {
    const email = (getGradesEmail(g) ?? '').trim();
    const cohortId = ((g['Cohort ID'] ?? g['uG Cohort ID'] ?? '') as string).trim();
    const key = `${normalizeEmail(email)}__${cohortId}`;
    if (!normalizeEmail(email) || seenKeys.has(key)) continue;

    seenKeys.add(key);

    const gradeStatus = (
      g['Status Details'] ??
      g['Secondary Status'] ??
      g['upGrad Learner Status'] ??
      g['GGU Learner Status'] ??
      g['Status'] ??
      ''
    ).trim();

    result.push({
      firstName: (g['First Name'] ?? '').trim(),
      lastName: (g['Last Name'] ?? '').trim(),
      email,
      userId: ((g['User ID'] ?? g['upGrad ID'] ?? '') as string).trim() || undefined,
      batch: undefined,
      learnerType: (g['Learner Type']?.toString() || '').trim() || undefined,
      cohort: ((g['Cohort #'] ?? g['uG Cohort ID'] ?? '') as string).trim() || undefined,
      cohortId: cohortId || undefined,
      status: gradeStatus || undefined,
      secondaryStatus: gradeStatus || undefined,
      slot: ((g['Slot'] ?? '') as string).trim() || undefined,
      overallCgpa: ((g['Overall CGPA'] ?? '') as string).trim() || undefined,
      coursesCompleted: ((g['Courses Completed'] ?? g['Completed Courses'] ?? '') as string).trim() || String(countCompletedCourses(mergeCourseGrades(programId, g))),
      coursesIncomplete: ((g['Courses Incomplete'] ?? g['Incomplete Courses'] ?? '') as string).trim() || undefined,
      coursework: mergeCourseGrades(programId, g),
      courseGpa: mergeCourseGpa(programId, g),
      region: v(g, 'Region') || undefined,
      immersion: v(g, 'Immersion') || undefined,
      spoc: v(g, 'SPOC') || undefined,
    });
  }

  return result;
}


export type LowGpaCourseDetail = {
  course: string;
  grade?: string;
  gpa: number;
};

export function getLowGpaCourseDetails(programId: ProgramId, learner: LearnerMerged): LowGpaCourseDetail[] {
  const details: LowGpaCourseDetail[] = [];
  const { grades: gradeCols, gpas: gpaCols } = getProgramCourseworkDirectColLists(programId);

  for (let i = 0; i < gpaCols.length; i += 1) {
    const gpaCol = gpaCols[i];
    const gradeCol = gradeCols[i];

    const gpa = parseNumber((learner.courseGpa[gpaCol] ?? '').trim());
    if (gpa !== null && gpa < 2.7) {
      details.push({
        course: (PROGRAMS[programId] as any).coursework?.flatMap((p: any) => p.courses).find((c: any) => c.gpaCol === gpaCol)?.name ?? gpaCol.replace(' GPA', ''),
        grade: (learner.coursework[gradeCol] ?? '').trim() || undefined,
        gpa,
      });
    }
  }

  return details;
}

export function getLearnersNeedingAttentionFromGrades(programId: ProgramId, grades: GradesheetRow[]): NeedsAttentionLearner[] {
  const alerts: NeedsAttentionLearner[] = [];
  const { grades: gradeCols, gpas: gpaCols } = getProgramCourseworkDirectColLists(programId);

  for (const g of grades) {
    const upGradStatus = (g['upGrad Learner Status'] ?? '').trim();
    const gguStatus = (g['GGU Learner Status'] ?? '').trim();
    const statusDetails = (g['Status Details'] ?? '').trim();
    const secondaryStatus = (g['Secondary Status'] ?? '').trim();
    const status = (g['Status'] ?? '').trim();
    const actualStatus = (g['Actual Status'] ?? '').trim();

    const currentStatus = upGradStatus || gguStatus || statusDetails || secondaryStatus || status || actualStatus || '';

    if (programId === 'dba') {
      // Strictly 'Active' for DBA program attention from upGrad Learner Status
      const normalizedUpGradStatus = normalizeSecondaryStatus(upGradStatus);
      if (normalizedUpGradStatus !== 'active') continue;
    } else {
      // Standard active check for other programs
      if (!isLearnerActive(currentStatus)) continue;
    }

    const email = (g['Email ID'] ?? g['GGU Email ID'] ?? g['GGU Student Email ID'] ?? '').trim();
    if (!normalizeEmail(email)) continue;

    const cohortId = ((g['Cohort ID'] ?? g['uG Cohort ID'] ?? '') as string).trim();
    const cohort = (g['Cohort #'] ?? '').trim() || undefined;
    const slot = (g['Slot'] ?? '').trim() || undefined;
    const userId = (g['User ID'] ?? '').trim() || undefined;
    const lowGpaDetails: LowGpaCourseDetail[] = [];

    for (let i = 0; i < gpaCols.length; i += 1) {
      const gpaCol = gpaCols[i];
      const gradeCol = gradeCols[i];
      const gpa = parseNumber((g[gpaCol] ?? '').trim());

      if (gpa !== null && gpa < 2.7) {
        lowGpaDetails.push({
          course: (PROGRAMS[programId] as any).coursework?.flatMap((p: any) => p.courses).find((c: any) => c.gpaCol === gpaCol)?.name ?? gpaCol.replace(' GPA', ''),
          grade: (g[gradeCol] ?? '').trim() || undefined,
          gpa,
        });
      }
    }

    if (lowGpaDetails.length === 0) continue;

    const initials = `${(g['First Name'] ?? '').trim()[0] ?? ''}${(g['Last Name'] ?? '').trim()[0] ?? ''}`.toUpperCase().trim();
    const coursesCompleted = (g['Courses Completed'] ?? '').trim() || undefined;

    alerts.push({
      name: `${(g['First Name'] ?? '').trim()} ${(g['Last Name'] ?? '').trim()}`.trim(),
      email,
      userId,
      cohort,
      cohortId,
      status: secondaryStatus,
      secondaryStatus: 'Learner needs attention',
      slot,
      lowGpaCourses: lowGpaDetails.map((d) => `${d.course}: ${d.gpa.toFixed(2)}`),
      lowGpaDetails,
      initials: initials || '??',
      coursesCompleted,
    });
  }

  return alerts;
}

export function getLearnersNeedingAttention(programId: ProgramId, merged: LearnerMerged[]): NeedsAttentionLearner[] {
  const alerts: NeedsAttentionLearner[] = [];

  for (const learner of merged) {
    const status = (learner.status ?? '').trim();

    if (programId === 'dba') {
      // In mergeLearners, we mapped upGradStatus to learner.secondaryStatus or learner.status
      // But looking at mergeLearners logic, let's ensure we check the specific field or its mapped version
      const normalizedStatus = normalizeSecondaryStatus(status);
      if (normalizedStatus !== 'active') continue;
    } else {
      if (!isLearnerActive(status)) continue;
    }

    const lowGpaDetails = getLowGpaCourseDetails(programId, learner);
    const lowGpaCourses = lowGpaDetails.map((d) => `${d.course}: ${d.gpa.toFixed(2)}`);

    if (lowGpaCourses.length > 0) {
      const initials = `${(learner.firstName ?? '').trim()[0] ?? ''}${(learner.lastName ?? '').trim()[0] ?? ''}`.toUpperCase().trim();
      alerts.push({
        name: `${learner.firstName} ${learner.lastName}`.trim(),
        email: learner.email,
        userId: learner.userId,
        cohort: learner.cohortId || learner.cohort,
        cohortId: learner.cohortId,
        status: learner.status,
        secondaryStatus: 'Learner needs attention',
        slot: learner.slot,
        lowGpaCourses,
        lowGpaDetails,
        initials: initials || '??',
        coursesCompleted: learner.coursesCompleted,
      });
    }
  }

  return alerts;
}

export function parseNumber(value: any): number | null {
  if (!value) return null;
  const s = String(value).trim();
  const n = Number(s);
  if (Number.isFinite(n)) return n;

  // Try extracting first number (e.g., "12 weeks" -> 12)
  const match = s.match(/(\d+)/);
  if (match) return parseInt(match[1]);

  return null;
}
