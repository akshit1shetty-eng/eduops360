export interface Program {
  id: string;
  name: string;
  fullName: string;
  description: string;
  icon: string;
  gradient: string;
  available: boolean;
}

export interface University {
  id: string;
  name: string;
  fullName: string;
  location: string;
  accentColor: string;
  programs: Program[];
}

/**
 * EduOps360 is dedicated to Golden Gate University (GGU). Other partner universities
 * (PSB, ESGCI, Edgewood) were removed; add an entry here to bring one back.
 */
export const UNIVERSITIES: University[] = [
  {
    id: 'ggu',
    name: 'Golden Gate University',
    fullName: 'Golden Gate University',
    location: 'San Francisco, USA',
    accentColor: '#0C2340',
    programs: [
      {
        id: 'dba-taught',
        name: 'Doctor of Business Administration & DBA ET - Taught Phase',
        fullName: 'Doctor of Business Administration & DBA ET - Taught Phase',
        description: 'Coursework, foundation modules, live sessions, and qualifying exams for DBA & DBA ET.',
        icon: 'fas fa-book-reader',
        gradient: 'from-blue-600 to-indigo-600',
        available: true,
      },
      {
        id: 'dba-dissertation',
        name: 'Doctor of Business Administration & DBA ET - Dissertation Phase',
        fullName: 'Doctor of Business Administration & DBA ET - Dissertation Phase',
        description: 'Advanced dissertation research, topic & proposal defense, and final doctoral review.',
        icon: 'fas fa-graduation-cap',
        gradient: 'from-purple-600 to-indigo-700',
        available: true,
      },
      {
        id: 'mba',
        name: 'Master of Business Administration',
        fullName: 'Master of Business Administration',
        description: 'Strategic management and operational excellence.',
        icon: 'fas fa-briefcase',
        gradient: 'from-emerald-600 to-emerald-800',
        available: true,
      },
      {
        id: 'm-psych',
        name: 'Master in Psychology',
        fullName: 'Master in Psychology',
        description: 'Advanced study in psychological science and human behavior.',
        icon: 'fas fa-brain',
        gradient: 'from-fuchsia-600 to-pink-600',
        available: true,
      },
    ]
  }
];

export function getAssignedUniversityId(role: string | undefined): string | null {
  if (!role) return null;
  return role.toLowerCase().includes('ggu') ? 'ggu' : null;
}

export const PRIMARY_UNIVERSITY_ID = 'ggu';
export const PRIMARY_UNIVERSITY = UNIVERSITIES.find(u => u.id === PRIMARY_UNIVERSITY_ID)!;

export function hasUniversityAccess(permissions: string[] | undefined, uniId: string): boolean {
  if (!permissions) return false;
  if (permissions.includes('page_admin') || permissions.includes('uni_all')) {
    return true;
  }
  return permissions.includes(`uni_${uniId}`);
}

export function hasProgramAccess(permissions: string[] | undefined, programId: string, programUniId: string): boolean {
  if (!permissions) return false;
  if (permissions.includes('page_admin') || permissions.includes('uni_all')) {
    return true;
  }
  if (permissions.includes(`uni_${programUniId}`)) {
    return true;
  }
  return permissions.includes(`prog_${programId}`);
}
