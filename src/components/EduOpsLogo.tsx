

export default function EduOpsLogo({ className = "w-full h-full", fillColor = "currentColor" }: { className?: string, fillColor?: string }) {
    return (
        <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Outer 360 degree operational loop */}
            <circle cx="50" cy="50" r="42" stroke={fillColor} strokeWidth="6" strokeDasharray="50 30" strokeLinecap="round" strokeOpacity="0.2">
                <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="15s" repeatCount="indefinite" />
            </circle>
            <circle cx="50" cy="50" r="42" stroke={fillColor} strokeWidth="6" strokeDasharray="10 90" strokeLinecap="round" strokeOpacity="0.8">
                <animateTransform attributeName="transform" type="rotate" from="360 50 50" to="0 50 50" dur="8s" repeatCount="indefinite" />
            </circle>
            
            {/* Inner layered isometric tech/education shape */}
            <g transform="translate(0, -2)">
                <path d="M50 32 L72 45 L50 58 L28 45 Z" fill={fillColor} />
                <path d="M28 50 L50 63 L50 82 L28 69 Z" fill={fillColor} fillOpacity="0.75" />
                <path d="M72 50 L50 63 L50 82 L72 69 Z" fill={fillColor} fillOpacity="0.4" />
                
                {/* Spark of knowledge */}
                <circle cx="50" cy="51" r="5" fill="#ffffff" fillOpacity="0.95" />
            </g>
        </svg>
    );
}
