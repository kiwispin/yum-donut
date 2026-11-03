import { useId } from 'react';

// The Verified Badge from the Shop: a blue scalloped seal with a white tick and a
// shine that sweeps across now and then. Styles are in nameEffects.css.
const SEAL_POINTS = Array.from({ length: 24 }, (_, i) => {
    const radius = i % 2 ? 9.4 : 11;
    const angle = (Math.PI * i) / 12 - Math.PI / 2;
    return `${(12 + radius * Math.cos(angle)).toFixed(2)},${(12 + radius * Math.sin(angle)).toFixed(2)}`;
}).join(' ');

// tooltip: show "Verified" on hover or tap. Leave it off inside buttons, where
// the seal can't take focus.
export default function VerifiedSeal({ size = 16, tooltip = true }) {
    const clipId = `seal-${useId()}`;
    return (
        <span
            className="verified-seal"
            role="img"
            aria-label="Verified"
            data-tip={tooltip ? '' : undefined}
            tabIndex={tooltip ? 0 : undefined}
            style={{ width: size, height: size }}
        >
            <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
                <defs>
                    <clipPath id={clipId}>
                        <polygon points={SEAL_POINTS} />
                    </clipPath>
                </defs>
                <polygon points={SEAL_POINTS} fill="#2563eb" stroke="#2563eb" strokeWidth="1.5" strokeLinejoin="round" />
                <g clipPath={`url(#${clipId})`}>
                    <rect className="verified-seal-shine" x="-4" y="-6" width="6" height="36" fill="#fff" opacity="0.55" transform="rotate(25 12 12)" />
                </g>
                <path d="M7.4 12.3l3 3 6.2-6.4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </span>
    );
}
