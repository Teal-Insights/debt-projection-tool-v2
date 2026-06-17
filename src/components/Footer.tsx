interface Props {
  /** Click handler for the "Methodology" link — opens the methodology view in App.tsx. */
  onOpenMethodology?: () => void;
}

/**
 * Footer with organisational attribution (Teal Insights + Nature Finance) and
 * author credits (Reuben Opondo + Aniekpeno Ifeh). The "Methodology" link in
 * the footer is one of the two entry points to the methodology page (the
 * other is the description block at the top of the app).
 *
 * Logos are wordmarks rendered in styled type — they read cleanly without
 * needing SVG assets that the orgs may not have supplied yet. Easy to swap
 * for real logos later by replacing the `.app__logo-text` blocks with `<img>`
 * or inline `<svg>` elements.
 */
export function Footer({ onOpenMethodology }: Props) {
  return (
    <footer className="app__footer">
      <div className="app__footer-left">
        <span className="app__footer-credit">
          Built by <strong>Reuben Opondo</strong> and{' '}
          <strong>Aniekpeno Ifeh</strong>
        </span>
        <span className="app__footer-sep" aria-hidden="true">
          ·
        </span>
        <span className="app__footer-data">
          Data: IMF World Economic Outlook
        </span>
        {onOpenMethodology && (
          <>
            <span className="app__footer-sep" aria-hidden="true">
              ·
            </span>
            <button
              type="button"
              className="app__footer-link"
              onClick={onOpenMethodology}
            >
              Methodology
            </button>
          </>
        )}
      </div>
      <div className="app__footer-right">
        <a
          className="app__logo"
          href="https://tealinsights.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Teal Insights"
        >
          <span className="app__logo-text app__logo-text--teal">
            Teal Insights
          </span>
        </a>
        <a
          className="app__logo"
          href="https://www.naturefinance.net"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Nature Finance"
        >
          <span className="app__logo-text app__logo-text--nature">
            Nature Finance
          </span>
        </a>
      </div>
    </footer>
  );
}
