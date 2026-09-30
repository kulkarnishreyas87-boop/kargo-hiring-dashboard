/**
 * Original flat-style illustration (hiring/recruitment themed), hand-drawn as SVG.
 * Not derived from any stock asset — safe to ship. Floating pieces animate via CSS
 * classes defined in globals.css (float-slow / float-med / float-fast / spin-slow).
 */
export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 440" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} role="img" aria-label="Illustration of a hiring team reviewing candidate profiles">
      {/* soft background blobs */}
      <ellipse cx="150" cy="360" rx="140" ry="28" fill="#e2e8f0" opacity="0.6" />
      <path d="M40 320 C 20 260, 60 190, 120 180 C 150 130, 220 140, 230 200 C 280 210, 270 280, 220 300 C 200 340, 100 350, 40 320 Z" fill="#eef2ff" />
      <path d="M480 120 C 520 100, 560 130, 550 170 C 590 190, 575 240, 530 235 C 520 270, 460 265, 455 230 C 415 220, 425 160, 470 155 C 468 135, 470 125, 480 120 Z" fill="#fef3c7" opacity="0.7" />

      {/* decorative dot-network, top left */}
      <g className="float-med" style={{ transformOrigin: "95px 90px" }}>
        <line x1="70" y1="100" x2="95" y2="70" stroke="#a5b4fc" strokeWidth="2" />
        <line x1="95" y1="70" x2="125" y2="85" stroke="#a5b4fc" strokeWidth="2" />
        <circle cx="70" cy="100" r="5" fill="#818cf8" />
        <circle cx="95" cy="70" r="5" fill="#818cf8" />
        <circle cx="125" cy="85" r="5" fill="#818cf8" />
      </g>

      {/* hexagon + triangle accents */}
      <polygon
        points="540,300 558,311 558,333 540,344 522,333 522,311"
        fill="none"
        stroke="#c7d2fe"
        strokeWidth="3"
        className="spin-slow"
        style={{ transformOrigin: "540px 322px" }}
      />
      <polygon points="300,55 312,75 288,75" fill="#818cf8" className="float-fast" style={{ transformOrigin: "300px 65px" }} />

      {/* three people, simplified flat style */}
      {/* person 1 */}
      <g transform="translate(150,190)">
        <rect x="-28" y="70" width="24" height="90" rx="10" fill="#3730a3" />
        <rect x="4" y="70" width="24" height="90" rx="10" fill="#3730a3" />
        <path d="M-38 20 C -38 0, -18 -14, 0 -14 C 18 -14, 38 0, 38 20 L 38 78 C 38 92, 24 100, 0 100 C -24 100, -38 92, -38 78 Z" fill="#f59e0b" />
        <circle cx="0" cy="-30" r="26" fill="#fcd9b8" />
        <path d="M-26 -34 C -26 -58, 26 -58, 26 -34 C 26 -44, 14 -50, 0 -50 C -14 -50, -26 -44, -26 -34 Z" fill="#2d1b0e" />
        <rect x="-40" y="30" width="16" height="46" rx="8" fill="#f59e0b" transform="rotate(18 -32 30)" />
        <rect x="24" y="30" width="16" height="46" rx="8" fill="#f59e0b" transform="rotate(-18 32 30)" />
      </g>

      {/* person 2 (center, taller) */}
      <g transform="translate(230,170)">
        <rect x="-30" y="86" width="26" height="100" rx="10" fill="#312e81" />
        <rect x="4" y="86" width="26" height="100" rx="10" fill="#312e81" />
        <path d="M-42 24 C -42 2, -20 -16, 0 -16 C 20 -16, 42 2, 42 24 L 42 94 C 42 110, 26 118, 0 118 C -26 118, -42 110, -42 94 Z" fill="#f8fafc" />
        <rect x="-6" y="6" width="12" height="70" fill="#312e81" opacity="0.85" />
        <circle cx="0" cy="-34" r="28" fill="#fcd9b8" />
        <path d="M-28 -38 C -28 -64, 28 -64, 28 -38 C 28 -50, 14 -56, 0 -56 C -14 -56, -28 -50, -28 -38 Z" fill="#1e1b4b" />
        <rect x="-46" y="34" width="17" height="50" rx="8" fill="#f8fafc" transform="rotate(16 -37 34)" />
        <rect x="29" y="34" width="17" height="50" rx="8" fill="#f8fafc" transform="rotate(-16 38 34)" />
      </g>

      {/* person 3 */}
      <g transform="translate(305,196)">
        <rect x="-26" y="66" width="22" height="86" rx="10" fill="#3730a3" />
        <rect x="4" y="66" width="22" height="86" rx="10" fill="#3730a3" />
        <path d="M-34 18 C -34 -2, -16 -14, 0 -14 C 16 -14, 34 -2, 34 18 L 34 74 C 34 88, 20 94, 0 94 C -20 94, -34 88, -34 74 Z" fill="#f59e0b" />
        <circle cx="0" cy="-28" r="24" fill="#fcd9b8" />
        <path d="M-24 -20 C -30 -50, -6 -58, 6 -54 C 24 -50, 26 -28, 20 -14 C 24 -30, 14 -42, 0 -42 C -10 -42, -20 -36, -22 -24 Z" fill="#451a03" />
        <rect x="16" y="26" width="15" height="42" rx="7" fill="#fcd9b8" transform="rotate(-40 24 26)" />
      </g>

      {/* floating candidate cards, right side */}
      <g className="float-slow" style={{ transformOrigin: "500px 150px" }}>
        <rect x="420" y="120" width="160" height="56" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="446" cy="148" r="14" fill="#c7d2fe" />
        <rect x="470" y="139" width="90" height="7" rx="3.5" fill="#c7d2fe" />
        <rect x="470" y="153" width="60" height="6" rx="3" fill="#e2e8f0" />
      </g>
      <g className="float-med" style={{ transformOrigin: "500px 210px", animationDelay: "0.4s" }}>
        <rect x="420" y="188" width="160" height="56" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="446" cy="216" r="14" fill="#bbf7d0" />
        <rect x="470" y="207" width="90" height="7" rx="3.5" fill="#bbf7d0" />
        <rect x="470" y="221" width="60" height="6" rx="3" fill="#e2e8f0" />
      </g>
      <g className="float-fast" style={{ transformOrigin: "500px 270px", animationDelay: "0.8s" }}>
        <rect x="420" y="256" width="160" height="56" rx="12" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="446" cy="284" r="14" fill="#fde68a" />
        <rect x="470" y="275" width="90" height="7" rx="3.5" fill="#fde68a" />
        <rect x="470" y="289" width="60" height="6" rx="3" fill="#e2e8f0" />
      </g>

      {/* small chat bubbles top-left, echo of dollar/heart bubbles */}
      <g className="float-med" style={{ transformOrigin: "130px 130px" }}>
        <rect x="60" y="118" width="92" height="30" rx="15" fill="white" stroke="#e2e8f0" strokeWidth="1.5" />
        <circle cx="78" cy="133" r="7" fill="#fda4af" />
        <path d="M75 133 c0 -3 5 -3 3 0.5 c-2 2.5 -3 3.5 -3 3.5 s-1 -1 -3 -3.5 c-2 -3.5 3 -3.5 3 0.5" fill="white" />
        <rect x="96" y="129" width="40" height="7" rx="3.5" fill="#e2e8f0" />
      </g>

      {/* ground shadow ellipses */}
      <ellipse cx="230" cy="392" rx="160" ry="14" fill="#e2e8f0" opacity="0.7" />
    </svg>
  );
}
