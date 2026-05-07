import { useMemo, useState } from 'react';
import { useLearnerData } from '../hooks/useLearnerData';
import { useProgramConfig } from '../hooks/useProgramConfig';

export default function StudentListPage() {
  const { config } = useProgramConfig();
  const { loading, error, students } = useLearnerData();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return students;

    return students.filter((s) => {
      const name = `${s['First Name'] ?? ''} ${s['Last Name'] ?? ''}`.toLowerCase();
      const email = (s['Email ID'] ?? '').toLowerCase();
      const cohort = (s['Cohort #'] ?? '').toLowerCase();
      const userId = (s['User ID'] ?? '').toLowerCase();
      return name.includes(term) || email.includes(term) || cohort.includes(term) || userId.includes(term);
    });
  }, [q, students]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{config.name} Student List</span>
        </h1>
        <p className="text-gray-600">Data fetched live from Google Sheets</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-6 p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, email, cohort, user ID..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <i className="fas fa-search absolute left-3 top-3.5 text-gray-400" />
          </div>

          <div className="text-sm text-gray-600">Rows: {filtered.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-gray-700">Loading...</div>
      ) : error ? (
        <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-6">
          <div className="text-red-700 font-semibold">Failed to load sheet data</div>
          <div className="text-red-600 text-sm mt-1">{error}</div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">User ID</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Cohort</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Slot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((s, idx) => (
                  <tr key={`${s['Email ID'] ?? idx}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-800 font-semibold">
                      {(s['First Name'] ?? '').trim()} {(s['Last Name'] ?? '').trim()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{s['Email ID']}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{s['User ID']}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{s['Cohort #']}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{s['Status']}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{s['Slot']}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
