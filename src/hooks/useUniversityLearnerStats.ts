import { useMemo } from 'react';
import { useAllLearnerData } from './useAllLearnerData';
import { v, normalizeSecondaryStatus, isLearnerActive } from '../lib/logic';

export function useUniversityLearnerStats(universityId: string) {
  const { students, loading } = useAllLearnerData(universityId);

  const stats = useMemo(() => {
    let total = 0;
    let active = 0;
    let graduated = 0;

    const seenEmails = new Set<string>();
    const filteredStudents = students.filter(s => {
      const email = (
        s['Email ID'] || s['Email'] || s['GGU Email'] || s['GGU Student Email ID'] || ''
      ).trim().toLowerCase();
      if (!email) return false;

      const rawStatus = v(s, 'Learner Status', 'Actual Status', 'Actual status', 'Status Details', 'Secondary Status', 'Status');
      const status = normalizeSecondaryStatus(rawStatus);
      return status !== 'deferred out' && status !== 'withdrawn';
    });

    for (const s of filteredStudents) {
      const email = (
        s['Email ID'] || s['Email'] || s['GGU Email'] || s['GGU Student Email ID'] || ''
      ).trim().toLowerCase();
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);

      total++;
      const rawStatus = v(s, 'Learner Status', 'Actual Status', 'Actual status', 'Status Details', 'Secondary Status', 'Status');
      const status = normalizeSecondaryStatus(rawStatus);

      const isActive = isLearnerActive(rawStatus) || !status;
      const isGraduated = status === 'completed' || status === 'graduated';

      if (isGraduated) {
        graduated++;
      } else if (isActive) {
        active++;
      }
    }

    return { total, active, graduated };
  }, [students]);

  return { loading, ...stats };
}
