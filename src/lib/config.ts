export interface CourseworkCourse {
  name: string;
  gpaCol: string;
  gradeCol: string;
}

export interface CourseworkPhase {
  phase: string;
  courses: CourseworkCourse[];
}

export interface ProgramConfig {
  sheetId: string;
  name: string;
  totalCourses: number;
  coursework?: CourseworkPhase[];
}

export const PROGRAMS: Record<string, ProgramConfig> = {
  'dba-et': {
    sheetId: '1uRMte-I2N6B_VhYSZFw4zRf5QDchHXBNK1ZGM38l8LY',
    name: 'DBA ET',
    totalCourses: 7,
    coursework: [
      {
        phase: 'Foundation', courses: [
          { name: 'DBA 805', gpaCol: 'DBA 805 GPA', gradeCol: 'DBA 805 Grade' },
          { name: 'DBA 806 / 808', gpaCol: 'DBA 806 / DBA 808 GPA', gradeCol: 'DBA 806 / DBA 808 Grade' },
        ]
      },
      {
        phase: 'Core', courses: [
          { name: 'DBA 863', gpaCol: 'DBA 863 GPA', gradeCol: 'DBA 863 Grade' },
          { name: 'DBA 860', gpaCol: 'DBA 860 GPA', gradeCol: 'DBA 860 Grade' },
          { name: 'DBA 861', gpaCol: 'DBA 861 GPA', gradeCol: 'DBA 861 Grade' },
        ]
      },
      {
        phase: 'Concentration', courses: [
          { name: 'DBA 862', gpaCol: 'DBA 862 GPA', gradeCol: 'DBA 862 Grade' },
          { name: 'DBA 864', gpaCol: 'DBA 864 GPA', gradeCol: 'DBA 864 Grade' },
        ]
      }
    ]
  },
  'dba': {
    sheetId: '13GFW9_aT1bKUp26B_1Db72QB7ZPUwm4DzmdMHXDY-98',
    name: 'DBA',
    totalCourses: 7,
    coursework: [
      {
        phase: 'Foundation Phase', courses: [
          { name: 'DBA 800', gpaCol: 'DBA 800 GPA', gradeCol: 'DBA 800 Grade' },
          { name: 'DBA 801', gpaCol: 'DBA 801 GPA', gradeCol: 'DBA 801 Grade' },
          { name: 'DBA 802', gpaCol: 'DBA 802 GPA', gradeCol: 'DBA 802 Grade' },
        ]
      },
      {
        phase: 'Qualifying Exam', courses: [
          { name: 'Qualifying Exam', gpaCol: 'Qualifying Exam GPA', gradeCol: 'Qualifying Exam Grade' },
        ]
      },
      {
        phase: 'Concentration Phase', courses: [
          { name: 'Concentration 1', gpaCol: 'Concentration 1 GPA', gradeCol: 'Concentration 1 Grade' },
          { name: 'Concentration 2', gpaCol: 'Concentration 2 GPA', gradeCol: 'Concentration 2 Grade' },
          { name: 'Concentration 3', gpaCol: 'Concentration 3 GPA', gradeCol: 'Concentration 3 Grade' },
        ]
      }
    ]
  },
  'dba-dl': {
    sheetId: '184gFR_9JBauSd3XgsYYoYUzLGCG9BbXAcJC96gWCck4',
    name: 'DBA DL',
    totalCourses: 7,
    coursework: [
      {
        phase: 'Foundation', courses: [
          { name: 'DBA 805', gpaCol: 'DBA 805 GPA', gradeCol: 'DBA 805 Grade' },
        ]
      },
      {
        phase: 'Core', courses: [
          { name: 'DBA 830', gpaCol: 'DBA 830 GPA', gradeCol: 'DBA 830 Grade' },
          { name: 'DBA 831', gpaCol: 'DBA 831 GPA', gradeCol: 'DBA 831 Grade' },
          { name: 'DBA 832', gpaCol: 'DBA 832 GPA', gradeCol: 'DBA 832 Grade' },
          { name: 'DBA 833', gpaCol: 'DBA 833 GPA', gradeCol: 'DBA 833 Grade' },
        ]
      },
      {
        phase: 'Advanced', courses: [
          { name: 'DBA 834', gpaCol: 'DBA 834 GPA', gradeCol: 'DBA 834 Grade' },
          { name: 'DBA 835', gpaCol: 'DBA 835 GPA', gradeCol: 'DBA 835 Grade' },
        ]
      }
    ]
  },
  'mba': {
    sheetId: '19yCBp1fBmmy32M8HV4qDSCsE3fG1JnPgMHJUuHnuv7M',
    name: 'MBA',
    totalCourses: 10,
  },
};

export type ProgramId = keyof typeof PROGRAMS;

export const SHEET_TABS = {
  studentList: 'Student List',
  gradesheet: 'Gradesheet',
  liveSessions: 'Live Sessions',
  immersion: 'Immersion',
  dissertation: 'Dissertation',
} as const;
