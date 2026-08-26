import { useNavigate, useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';

export default function ErrorPage() {
    const error = useRouteError();
    const navigate = useNavigate();

    console.error('[ErrorPage caught error]:', error);

    let title = "Something went wrong";
    let message = "An unexpected error occurred: " + (error instanceof Error ? error.message : (error as any)?.statusText || JSON.stringify(error));

    if (isRouteErrorResponse(error)) {
        if (error.status === 404) {
            title = "404 - Page Not Found";
            message = "Oops! The page you're looking for doesn't exist or has been moved.";
        } else if (error.status === 401) {
            title = "401 - Unauthorized";
            message = "You don't have permission to view this page.";
        } else if (error.status === 503) {
            title = "503 - Service Unavailable";
            message = "Looks like our API is down. We'll be back soon!";
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-8 border border-gray-100 text-center relative overflow-hidden">
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 opacity-50" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-50 rounded-full -ml-16 -mb-16 opacity-50" />

                <div className="relative z-10">
                    <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <i className={`fas ${isRouteErrorResponse(error) && error.status === 404 ? 'fa-search' : 'fa-exclamation-triangle'} text-3xl text-indigo-600`} />
                    </div>

                    <h1 className="text-3xl font-black text-gray-800 mb-3 tracking-tight">
                        {title}
                    </h1>

                    <p className="text-gray-500 mb-4 leading-relaxed font-medium">
                        {message}
                    </p>

                    {error instanceof Error && error.stack && (
                        <div className="bg-slate-900 text-rose-300 p-3 rounded-xl text-[10px] font-mono text-left overflow-auto max-h-40 mb-6">
                            {error.stack}
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full py-4 bg-gray-800 hover:bg-gray-900 text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-arrow-left" />
                            Go Back
                        </button>
                        <Link
                            to="/"
                            className="w-full py-4 bg-white border-2 border-gray-100 hover:border-indigo-200 hover:bg-indigo-50 text-gray-700 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                        >
                            <i className="fas fa-home" />
                            Return to Safety
                        </Link>
                    </div>

                    <div className="mt-8 pt-6 border-t border-gray-50">
                        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">
                            EduOps360 Core Engine
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
