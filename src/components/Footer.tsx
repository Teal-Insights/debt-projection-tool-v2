import tealInsightsLogo from '../assets/logos/teal_insights_logo_transparent.svg';
import natureFinanceLogo from '../assets/logos/nature_finance_logo.svg';

/**
 * Footer with organisational attribution (Teal Insights + Nature Finance) on
 * the right and a single data-source line on the left. Author credits and
 * the Methodology link both live on the Methodology tab now, not here.
 *
 * Both logos are SVGs with white-only fills (designed for dark backgrounds),
 * so each is wrapped in a dark navy pill for legibility. Teal Insights links
 * to its LinkedIn company page; Nature Finance links to its homepage.
 */
export function Footer() {
  return (
    <footer className="app__footer">
      <div className="app__footer-left">
        <span className="app__footer-data">
          Data: IMF World Economic Outlook
        </span>
      </div>
      <div className="app__footer-right">
        <a
          className="app__logo app__logo--dark-bg"
          href="https://www.linkedin.com/company/teal-insights/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Teal Insights on LinkedIn"
        >
          <img
            src={tealInsightsLogo}
            alt="Teal Insights"
            className="app__logo-img"
          />
        </a>
        <a
          className="app__logo app__logo--dark-bg"
          href="https://www.naturefinance.net"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Nature Finance"
        >
          <img
            src={natureFinanceLogo}
            alt="Nature Finance"
            className="app__logo-img"
          />
        </a>
      </div>
    </footer>
  );
}
