import { useEffect, useState } from "react";
import LogoMark from "./LogoMark";

type DashTopbarProps = {
  onOpenMenu: () => void;
  gradientId?: string;
  /** Si se define, muestra flecha de volver a la izquierda del logo. */
  onBack?: () => void;
};

export default function DashTopbar({
  onOpenMenu,
  gradientId = "dash-mark",
  onBack,
}: DashTopbarProps) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    function readY(): number {
      const scrollingEl = document.scrollingElement;
      return Math.max(
        window.scrollY || 0,
        scrollingEl?.scrollTop || 0,
        document.documentElement.scrollTop || 0,
        document.body.scrollTop || 0,
      );
    }

    function onScroll() {
      setCompact(readY() > 12);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  return (
    <>
      <header
        className={`dash-topbar${compact ? " is-compact" : ""}`}
        data-compact={compact ? "true" : "false"}
      >
        <div className="dash-brand">
          {onBack && (
            <button
              type="button"
              className="pdet-back"
              onClick={onBack}
              aria-label="Volver"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                <path
                  d="M15 6l-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          <LogoMark className="dash-logo" gradientId={gradientId} />
          <span className="dash-brand-name">ScaleUpp</span>
        </div>
        <button
          type="button"
          className="dash-menu-btn"
          onClick={onOpenMenu}
          aria-label="Abrir menú"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>
      <div className="dash-topbar-spacer" aria-hidden="true" />
    </>
  );
}
