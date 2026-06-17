import tealInsightsLogo from '../assets/logos/teal_insights_logo_transparent.svg';
import natureFinanceLogo from '../assets/logos/nature_finance_logo.svg';

/**
 * Stakeholder-grade footer.
 *
 * Layout (single row on desktop, stacks on narrow viewports):
 * - LEFT  · brand block — amber uppercase eyebrow ("SOVEREIGN DEBT TOOLKIT")
 *           that frames the tool as part of a larger product line, plus a
 *           one-line data attribution underneath.
 * - RIGHT · partner block — small "In partnership with" eyebrow followed by
 *           the Teal Insights and Nature Finance logos.
 *
 * Visual treatment: dark navy gradient band with a 2px amber accent at the
 * top edge. Both partner logos are all-white SVGs designed for dark
 * backgrounds, so the band itself is the contrast surface — no per-logo
 * pills needed. Negative horizontal/bottom margins on the band cancel the
 * parent `.app` container's padding so the footer reads as a true
 * edge-to-edge band beneath the chart.
 */
export function Footer() {
  return (
    <footer className="app__footer">
      <div className="app__footer-brand">
        <span className="app__footer-tagline">Sovereign Debt Toolkit</span>
        <span className="app__footer-data">
          Data · IMF World Economic Outlook · April 2026
        </span>
      </div>
      <div className="app__footer-partners">
        <span className="app__footer-partners-label">
          In partnership with
        </span>
        <div className="app__footer-partners-logos">
          <a
            className="app__footer-logo"
            href="https://www.linkedin.com/company/teal-insights/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Teal Insights on LinkedIn"
          >
            <img
              src={tealInsightsLogo}
              alt="Teal Insights"
              className="app__footer-logo-img"
            />
          </a>
          <a
            className="app__footer-logo"
            href="https://www.naturefinance.net"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Nature Finance"
          >
            <img
              src={natureFinanceLogo}
              alt="Nature Finance"
              className="app__footer-logo-img"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
