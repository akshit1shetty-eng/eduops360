import { useSearchParams } from 'react-router-dom';

export default function DissertationPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Active program tab mode: 'overall' | 'dba' | 'dba-et' | 'dba-dl'
  const rawTabParam = (searchParams.get('program') || 'overall').toLowerCase();
  const activeTab: 'overall' | 'dba' | 'dba-et' | 'dba-dl' =
    rawTabParam === 'dba' || rawTabParam === 'dba-et' || rawTabParam === 'dba-dl' ? rawTabParam : 'overall';

  const handleTabChange = (newTab: 'overall' | 'dba' | 'dba-et' | 'dba-dl') => {
    setSearchParams({ program: newTab });
  };

  const activeTabTitles: Record<string, { title: string; subtitle: string; icon: string }> = {
    overall: {
      title: 'Overall Dissertation Phase',
      subtitle: 'Master workspace combining DBA, DBA ET & DBA DL dissertation research analytics.',
      icon: 'fas fa-globe',
    },
    dba: {
      title: 'DBA Dissertation Phase',
      subtitle: 'Workspace for Doctor of Business Administration dissertation research.',
      icon: 'fas fa-graduation-cap',
    },
    'dba-et': {
      title: 'DBA ET Dissertation Phase',
      subtitle: 'Workspace for DBA Emerging Technologies dissertation research.',
      icon: 'fas fa-microchip',
    },
    'dba-dl': {
      title: 'DBA DL Dissertation Phase',
      subtitle: 'Workspace for DBA Leadership / Direct Entry dissertation research.',
      icon: 'fas fa-award',
    },
  };

  const currentMeta = activeTabTitles[activeTab];

  return (
    <div className="min-h-screen pb-16">
      {/* ═══ Header Section ═══ */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase tracking-wider">
                Doctoral Research Phase
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-purple-50 text-purple-700 border border-purple-100 uppercase tracking-wider">
                {activeTab === 'overall' ? 'All Doctoral Programs' : activeTab.toUpperCase()}
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {currentMeta.title}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm mt-1 font-medium max-w-3xl leading-relaxed">
              {currentMeta.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ Top Program Navigation Tabs ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-xs mb-8 flex flex-wrap items-center gap-2">
        <button
          onClick={() => handleTabChange('overall')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'overall'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <i className="fas fa-globe text-sm" />
          <span>Overall (All Programs)</span>
        </button>

        <button
          onClick={() => handleTabChange('dba')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'dba'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <i className="fas fa-graduation-cap text-sm" />
          <span>DBA</span>
        </button>

        <button
          onClick={() => handleTabChange('dba-et')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'dba-et'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <i className="fas fa-microchip text-sm" />
          <span>DBA ET</span>
        </button>

        <button
          onClick={() => handleTabChange('dba-dl')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            activeTab === 'dba-dl'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <i className="fas fa-award text-sm" />
          <span>DBA DL</span>
        </button>
      </div>

      {/* ═══ Clean Workspace Ready Container ═══ */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4 text-2xl shadow-sm">
          <i className={currentMeta.icon} />
        </div>
        <h3 className="text-xl font-black text-slate-900 mb-2">
          {activeTab === 'overall' ? 'Overall Dissertation View Ready' : `${activeTab.toUpperCase()} Dissertation View Ready`}
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto font-medium leading-relaxed">
          The left layout and program navigation structure are active. Custom visuals, dashboards, and metrics can be added here once data is ready.
        </p>
      </div>
    </div>
  );
}
