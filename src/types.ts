export type StudentListRow = Record<string, string>;
export type GradesheetRow = Record<string, string>;
export type LiveSessionsRow = Record<string, string>;

export type LearnerMerged = {
  firstName: string;
  lastName: string;
  email: string;
  userId?: string;
  batch?: string;
  learnerType?: string;
  country?: string;
  cohort?: string;
  cohortId?: string;
  status?: string;
  secondaryStatus?: string;
  packageKey?: string;
  term?: string;
  aging?: number;
  launchMonth?: string;
  concentration?: string;
  statusDetails?: string;
  slot?: string;
  overallCgpa?: string;
  coursesCompleted?: string;
  coursesIncomplete?: string;
  region?: string;
  immersion?: string;
  spoc?: string;
  coursework: Record<string, string | undefined>;
  courseGpa: Record<string, string | undefined>;
};

export type NeedsAttentionLearner = {
  name: string;
  email: string;
  userId?: string;
  cohort?: string;
  cohortId?: string;
  status?: string;
  secondaryStatus?: string;
  slot?: string;
  lowGpaCourses: string[];
  lowGpaDetails?: Array<{ course: string; grade?: string; gpa: number }>;
  initials: string;
  coursesCompleted?: string;
};
