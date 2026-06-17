import tealInsightsLogo from '../assets/logos/teal_insights_logo_transparent.svg';
import natureFinanceLogo from '../assets/logos/nature_finance_logo.svg';

/**
 * Stakeholder-grade footer.
 *
 * The relationship surfaced here is: Teal Insights is the maker of the
 * tool; Nature Finance is the partner organisation. So the layout puts
 * Teal Insights forward as the primary brand mark on the left (with the
 * "Sovereign Debt Toolkit" tagline + dataset attribution stacked next
 * to it), and the Nature Finance logo on the right behind an "In
 * partnership with" eyebrow.
 *
 * Visual treatment: dark navy gradient band with a 2px amber accent at
 * the top edge. Both partner logos are all-white SVGs designed for
 * dark backgrounds, so the band itself is the contrast surface — no
 * per-logo pills needed. Negative horizontal/bottom margins on the
 * band cancel the parent `.app` container's padding so the footer
 * reads as a true edge-to-edge strip beneath the chart.
 *
 * The Teal Insights mark is rendered slightly larger than the Nature
 * Finance mark to reinforce the brand hierarchy (maker > partner).
 */
export function Footer() {
  return (
    <footer className="app__footer">
      <div className="app__footer-brand">
        <a
          className="app__footer-brand-logo"
          href="https://www.linkedin.com/company/teal-insights/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Teal Insights on LinkedIn"
        >
          <img
            src={tealInsightsLogo}
            alt="Teal Insights"
            className="app__footer-brand-img"
          />
        </a>
        <div className="app__footer-brand-meta">
          <span className="app__footer-tagline">Sovereign Debt Toolkit</span>
          <span className="app__footer-data">
            Data · IMF World Economic Outlook · April 2026
          </span>
        </div>
      </div>

      <div className="app__footer-partnership">
        <span className="app__footer-partnership-label">
          In partnership with
        </span>
        <a
          className="app__footer-partnership-logo"
          href="https://www.naturefinance.net"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Nature Finance"
        >
          <img
            src={natureFinanceLogo}
            alt="Nature Finance"
            className="app__footer-partnership-img"
          />
        </a>
      </div>
    </footer>
  );
}
