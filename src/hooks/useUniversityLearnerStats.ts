import { useMemo } from 'react';
import { useAllLearnerData } from './useAllLearnerData';
import { useGGUStudentList } from './useGGUStudentList';
import { useGGUOverviewAnalytics } from './useGGUOverviewAnalytics';
import { v, isLearnerActive, isLearnerGraduated } from '../lib/logic';

export function useUniversityLearnerStats(universityId: string) {
  const { students, loading: allLoading } = useAllLearnerData(universityId);
  const { rows: gguRows } = useGGUStudentList();
  const { statusTotals, loading: gguLoading } = useGGUOverviewAnalytics();

  const isGGU = universityId === 'ggu';
  const loading = isGGU ? gguLoading : allLoading;

  const stats = useMemo(() => {
    if (isGGU) {
      let graduatedFromColR = 0;
      const targetRows = gguRows && gguRows.length > 0 ? gguRows : students;

      targetRows.forEach(s => {
        const rawColR = (
          s['Actual Status'] ||
          s['Actual status'] ||
          s['actual_status'] ||
          v(s, 'Actual Status', 'actual_status', 'Learner Status', 'Secondary Status', 'Status') ||
          ''
        ).replace(/\u00a0/g, ' ').trim().toLowerCase();

        if (
          rawColR.includes('graduat') ||
          rawColR.includes('complet') ||
          rawColR.includes('alumni') ||
          rawColR.includes('passed') ||
          rawColR.startsWith('grad')
        ) {
          graduatedFromColR += 1;
        }
      });

      return {
        total: statusTotals?.grandTotal ?? 0,
        active: statusTotals?.active ?? 0,
        graduated: graduatedFromColR,
      };
    }

    const total = students.length;
    let active = 0;
    let graduated = 0;

    students.forEach(s => {
      const rawStatus = (v(s, 'Actual Status', 'Learner Status', 'Secondary Status', 'Status Details', 'Status') || '').trim();

      if (isLearnerActive(rawStatus, s)) {
        active += 1;
      }
      if (isLearnerGraduated(rawStatus)) {
        graduated += 1;
      }
    });

    return { total, active, graduated };
  }, [students, gguRows, universityId, isGGU, statusTotals]);

  return { loading, ...stats };
}
