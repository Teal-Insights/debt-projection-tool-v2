import tealInsightsLogo from '../assets/logos/teal_insights_logo_transparent.svg';

interface Props {
  /** Click handler for the "Methodology" link — switches App's view to methodology. */
  onOpenMethodology?: () => void;
}

/**
 * Footer with organisational attribution (Teal Insights + Nature Finance) and
 * author credits (Reuben Opondo + Aniekpeno Ifeh). The "Methodology" link in
 * the footer is one of the entry points to the methodology view.
 *
 * Teal Insights logo is the real SVG (white text on transparent BG), so we
 * wrap it in a dark navy pill for legibility. Nature Finance ships as a
 * styled wordmark until an SVG arrives in `www/logos/`.
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
          className="app__logo app__logo--teal-bg"
          href="https://tealinsights.com"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Teal Insights"
        >
          <img
            src={tealInsightsLogo}
            alt="Teal Insights"
            className="app__logo-img"
          />
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
