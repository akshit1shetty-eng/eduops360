export default function LexAcademicReviewDashboard() {
  return (
    <div className="max-w-4xl mx-auto py-2">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-1">Academic Review <span className="text-emerald-700">Dashboard</span></h1>
        <p className="text-slate-600 text-base font-medium opacity-80">Cross-program performance and grades overview.</p>
      </div>

      <div className="relative overflow-hidden bg-white rounded-[2rem] border border-slate-100 shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/20 to-transparent pointer-events-none" />
        
        <div className="relative z-10 w-20 h-20 bg-emerald-50 rounded-2xl flex items-center justify-center mb-8 shadow-md shadow-emerald-100 border border-emerald-100 transform rotate-3">
          <i className="fas fa-book-open text-4xl text-emerald-700 -rotate-3" />
        </div>
        <h2 className="relative z-10 text-2xl font-black text-slate-900 mb-4 tracking-tight">System Module Pending</h2>
        <p className="relative z-10 text-slate-600 max-w-md text-sm font-medium leading-relaxed opacity-80">
          Global academic analytics are being developed to give you a unified view of learner performance across all cohorts. High-level performance tracking will be available soon.
        </p>
      </div>
    </div>
  );
}
