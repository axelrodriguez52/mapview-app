export default function Splash() {
  return (
    <div id="intro" role="status" aria-live="polite">
      <div className="splash-bg" aria-hidden="true">
        <span className="splash-orb splash-orb-1" />
        <span className="splash-orb splash-orb-2" />
        <span className="splash-orb splash-orb-3" />
        <span className="splash-grid" />
        <span className="splash-vignette" />
      </div>

      <div className="splash-content">
        <div className="splash-mark">
          <span className="splash-halo" aria-hidden="true" />
          <svg className="splash-logo" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="splashGrad" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#60a5fa" />
                <stop offset="0.55" stopColor="#3b82f6" />
                <stop offset="1" stopColor="#14b8a6" />
              </linearGradient>
            </defs>
            <path
              className="splash-logo-ring"
              d="M32 5.5 53 17.8v23.4L32 53.5 11 41.2V17.8L32 5.5Z"
              stroke="url(#splashGrad)"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              className="splash-logo-grid"
              d="M11 17.8 32 30l21-12.2M32 30v23.5M21.5 11.6v23.2M42.5 11.6v23.2"
              stroke="rgba(148,163,184,0.28)"
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
            <path
              className="splash-logo-path"
              d="M21 37.5l7.2-9.3 6.1 5.2L42.5 22"
              stroke="#e2e8f0"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle className="splash-logo-pin" cx="42.5" cy="22" r="3.4" fill="#10b981" />
            <circle className="splash-logo-pin-ring" cx="42.5" cy="22" r="6.2" stroke="#10b981" strokeOpacity="0.45" strokeWidth="1.4" />
          </svg>
        </div>

        <h1 className="splash-title" aria-label="MAPVIEW">
          {'MAPVIEW'.split('').map((ch, i) => (
            <span className="splash-letter" key={ch + i} style={{ animationDelay: `${0.32 + i * 0.055}s` }}>
              {ch}
            </span>
          ))}
        </h1>
        <p className="splash-tagline">Visualiza y gestiona tus territorios KML</p>

        <div className="splash-progress">
          <div className="bar-track">
            <div className="bar-fill" id="bar-fill" />
          </div>
          <div className="splash-meta">
            <span id="splash-status">Iniciando…</span>
            <span id="bar-pct">0%</span>
          </div>
        </div>
      </div>

      <div className="splash-foot">
        <span className="splash-dot" aria-hidden="true" />
        CENOVI · MapView
      </div>
    </div>
  );
}
