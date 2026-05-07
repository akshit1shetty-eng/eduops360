import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    return (
        <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
        >
            <div className={`theme-toggle-track ${isDark ? 'theme-toggle-dark' : ''}`}>
                <span className="theme-toggle-icon theme-toggle-sun">
                    <i className="fas fa-sun" />
                </span>
                <span className="theme-toggle-icon theme-toggle-moon">
                    <i className="fas fa-moon" />
                </span>
                <div className="theme-toggle-thumb" />
            </div>
        </button>
    );
}
