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

export const UNIVERSITIES: University[] = [
  {
    id: 'ggu',
    name: 'Golden Gate University',
    fullName: 'Golden Gate University',
    location: 'San Francisco, USA',
    accentColor: '#6366f1',
    programs: [
      {
        id: 'dba-et',
        name: 'Doctor of Business Administration in Emerging Technologies',
        fullName: 'Doctor of Business Administration in Emerging Technologies',
        description: 'Research at the intersection of leadership and disruptive innovation.',
        icon: 'fas fa-microchip',
        gradient: 'from-blue-600 to-indigo-600',
        available: true,
      },
      {
        id: 'dba',
        name: 'Doctor of Business Administration',
        fullName: 'Doctor of Business Administration',
        description: 'Elite executive practice through rigorous applied research.',
        icon: 'fas fa-user-graduate',
        gradient: 'from-rose-500 to-orange-600',
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
        id: 'dba-dl',
        name: 'Doctor of Business Administration in Digital Leadership',
        fullName: 'Doctor of Business Administration in Digital Leadership',
        description: 'Transformative leadership at the intersection of digital strategy and organizational impact.',
        icon: 'fas fa-rocket',
        gradient: 'from-violet-500 to-purple-700',
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
  },
  {
    id: 'psb',
    name: 'Paris School of Business',
    fullName: 'Paris School of Business',
    location: 'Paris, France',
    accentColor: '#ef4444',
    programs: [
      {
        id: 'psb-mba',
        name: 'Master of Business Administration',
        fullName: 'Master of Business Administration',
        description: 'Advanced global management insights from a European perspective.',
        icon: 'fas fa-graduation-cap',
        gradient: 'from-slate-700 to-slate-800',
        available: false,
      },
      {
        id: 'psb-mbmt',
        name: 'Master of Business Management & Technology',
        fullName: 'Master of Business Management & Technology',
        description: 'Bridging technical expertise with strategic business leadership.',
        icon: 'fas fa-network-wired',
        gradient: 'from-slate-700 to-slate-800',
        available: false,
      },
    ]
  },
  {
    id: 'esgci',
    name: 'ESGCI',
    fullName: 'École Supérieure de Gestion et de Commerce International',
    location: 'Paris, France',
    accentColor: '#10b981',
    programs: [
      {
        id: 'esgci-dba',
        name: 'Doctor of Business Administration',
        fullName: 'Doctor of Business Administration',
        description: 'Doctoral excellence in international commerce and management.',
        icon: 'fas fa-award',
        gradient: 'from-slate-700 to-slate-800',
        available: false,
      },
    ]
  },
  {
    id: 'edgewood',
    name: 'Edgewood University',
    fullName: 'Edgewood University',
    location: 'Madison, Wisconsin, USA',
    accentColor: '#f59e0b',
    programs: [
      {
        id: 'edgewood-dba',
        name: 'Doctor of Business Administration',
        fullName: 'Doctor of Business Administration',
        description: 'Focused on organizational leadership and professional advancement.',
        icon: 'fas fa-chart-line',
        gradient: 'from-slate-700 to-slate-800',
        available: false,
      },
      {
        id: 'edgewood-edd',
        name: 'Doctor of Education',
        fullName: 'Doctor of Education',
        description: 'Transformative leadership for educational institutions and systems.',
        icon: 'fas fa-chalkboard-teacher',
        gradient: 'from-slate-700 to-slate-800',
        available: false,
      },
    ]
  }
];

export function getAssignedUniversityId(role: string | undefined): string | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r.includes('ggu')) return 'ggu';
  if (r.includes('psb')) return 'psb';
  if (r.includes('esgci')) return 'esgci';
  if (r.includes('edgewood')) return 'edgewood';
  return null;
}

export function hasUniversityAccess(permissions: string[] | undefined, uniId: string): boolean {
  if (!permissions) return false;
  if (permissions.includes('page_admin') || permissions.includes('page_home')) {
    return true;
  }
  return permissions.includes(`uni_${uniId}`);
}

export function hasProgramAccess(permissions: string[] | undefined, programId: string, programUniId: string): boolean {
  if (!permissions) return false;
  if (permissions.includes('page_admin') || permissions.includes('page_home')) {
    return true;
  }
  if (permissions.includes(`uni_${programUniId}`)) {
    return true;
  }
  return permissions.includes(`prog_${programId}`);
}
