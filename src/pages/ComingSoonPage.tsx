import { useNavigate, useLocation } from 'react-router-dom';

const programInfo: Record<string, { name: string; fullName: string; icon: string; gradient: string }> = {
    dba: {
        name: 'DBA',
        fullName: 'Doctor of Business Administration',
        icon: 'fas fa-briefcase',
        gradient: 'from-amber-500 via-orange-600 to-red-600',
    },
    mba: {
        name: 'MBA',
        fullName: 'Master of Business Administration',
        icon: 'fas fa-chart-pie',
        gradient: 'from-emerald-500 via-teal-600 to-cyan-600',
    },
};

export default function ComingSoonPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const segment = location.pathname.split('/')[1] ?? 'dba';
    const info = programInfo[segment] ?? programInfo['dba'];

    return (
        <div className="cs-page">
            {/* Animated bg */}
            <div className="ps-bg-orb ps-bg-orb-1" />
            <div className="ps-bg-orb ps-bg-orb-2" />
            <div className="ps-bg-grid" />

            <div className="cs-container">
                {/* Icon */}
                <div className={`cs-icon-wrap bg-gradient-to-br ${info.gradient}`}>
                    <i className={info.icon} />
                </div>

                {/* Animated construction icon */}
                <div className="cs-construction-icon">
                    <i className="fas fa-hard-hat" />
                </div>

                <h1 className="cs-title">{info.name}</h1>
                <p className="cs-fullname">{info.fullName}</p>

                <div className="cs-divider" />

                <div className="cs-badge">
                    <i className="fas fa-tools" style={{ marginRight: 8 }} />
                    Under Construction
                </div>

                <p className="cs-desc">
                    We're building something amazing for the <strong>{info.name}</strong> program.
                    The dashboard, analytics, and learner management tools are currently being developed
                    and will be available soon.
                </p>

                {/* Progress */}
                <div className="cs-progress-wrap">
                    <div className="cs-progress-header">
                        <span>Development Progress</span>
                        <span className="cs-progress-pct">In Progress</span>
                    </div>
                    <div className="cs-progress-track">
                        <div className="cs-progress-bar" />
                    </div>
                </div>

                {/* Features coming */}
                <div className="cs-features">
                    <h3 className="cs-features-title">What's Coming</h3>
                    <div className="cs-features-grid">
                        {[
                            { icon: 'fas fa-chart-line', label: 'Analytics Dashboard' },
                            { icon: 'fas fa-users', label: 'Learner Management' },
                            { icon: 'fas fa-video', label: 'Live Sessions Tracker' },
                            { icon: 'fas fa-map-marked-alt', label: 'Immersion Insights' },
                        ].map((f) => (
                            <div key={f.label} className="cs-feature-item">
                                <i className={f.icon} />
                                <span>{f.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Back */}
                <button className="cs-back-btn" onClick={() => navigate('/')}>
                    <i className="fas fa-arrow-left" style={{ marginRight: 8 }} />
                    Back to Programs
                </button>
            </div>
        </div>
    );
}
