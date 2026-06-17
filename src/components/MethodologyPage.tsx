import reubenPhoto from '../assets/profiles/reuben_ti.jpeg';
import ltePhoto from '../assets/profiles/teal_ti.jpeg';

interface Props {
  /** Switch back to the tool view (called by the "Back to the tool" button). */
  onReturnToTool: () => void;
}

interface Author {
  name: string;
  org: string;
  photo?: string;
  /** Two-letter initials used when no photo is available. */
  initials?: string;
  linkedin?: string;
  email: string;
}

/**
 * Inline SVG icons for the author contact links. Simple geometric primitives
 * — a stroked envelope for email and a generic "in"-style square for the
 * LinkedIn link. Sized via the parent's font-size + currentColor so they
 * inherit theme colours and scale with text.
 */
function LinkedInIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2" y="2" width="20" height="20" rx="3" fill="currentColor" />
      <rect x="6" y="10" width="2.6" height="8" fill="white" />
      <circle cx="7.3" cy="7" r="1.4" fill="white" />
      <path
        d="M11 18v-8h2.5v1.1h.04c.35-.62 1.2-1.27 2.46-1.27 2.63 0 3.12 1.6 3.12 3.7V18h-2.6v-3.7c0-.88-.02-2-1.25-2-1.25 0-1.44.94-1.44 1.93V18H11z"
        fill="white"
      />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 6 9 6.5L21 6" />
    </svg>
  );
}

const AUTHORS: Author[] = [
  {
    name: 'Reuben Opondo',
    org: 'Teal Insights',
    photo: reubenPhoto,
    linkedin: 'https://ke.linkedin.com/in/reuben-opondo-ab8156a6',
    email: 'reuben.opondo@tealinsights.com',
  },
  {
    name: 'Teal Emery',
    org: 'Teal Insights',
    photo: ltePhoto,
    linkedin: 'https://www.linkedin.com/in/ltealemery',
    email: 'lte@tealinsights.com',
  },
  {
    name: 'Aniekpeno Ifeh',
    org: 'Teal Insights',
    initials: 'AI',
    email: 'aniekpeno.ifeh@tealinsights.com',
  },
];

/**
 * Methodology page — rendered inline as a sibling view to the tool (NOT a
 * modal overlay). App.tsx maintains a `view: 'tool' | 'methodology'` state
 * and swaps which page is mounted; the tab bar in the header is the primary
 * way to navigate between the two.
 *
 * Reads in <3 minutes and tells a stakeholder everything they need to
 * evaluate the tool: purpose, FT origin, the math, data sources, assumptions
 * (honest about the illustrative fan bands), and credits.
 */
export function MethodologyPage({ onReturnToTool }: Props) {
  return (
    <article className="methodology-page" aria-labelledby="methodology-title">
      <header className="methodology-page__header">
        <h1 id="methodology-title" className="methodology-page__title">
          Methodology
        </h1>
        <p className="methodology-page__lede">
          A short, honest description of what this tool computes, where the
          data comes from, and where it stops short.
        </p>
      </header>

      <section className="methodology-page__section">
        <h2>Purpose</h2>
        <p>
          We're building a <strong>toolkit</strong> of easy-to-use web tools
          that let policymakers explore sovereign debt-to-GDP dynamics. The
          toolkit starts simple and grows in complexity: a user with no prior
          data can use the first tool to see what a recent IMF projection
          looks like; users who bring their own data and assumptions will be
          able to use later versions to push the model further.
        </p>
      </section>

      <section className="methodology-page__section">
        <h2>Origin</h2>
        <p>
          This tool replicates the{' '}
          <a
            href="https://web.archive.org/web/20160719165542/https://ig.ft.com/sites/2014/debt-to-gdp-ratio/"
            target="_blank"
            rel="noopener noreferrer"
          >
            FT 2014 Debt Dynamics Visualizer
          </a>{' '}
          (via Wayback Machine — the live ig.ft.com page is no longer up).
          v1 matches the FT 2014 article exactly using its bundled IMF WEO
          October 2014 data; v2 keeps the same methodology but ships with
          IMF WEO April 2026 data and the full WEO universe (170 economies).
        </p>
      </section>

      <section className="methodology-page__section">
        <h2>The math</h2>
        <p>
          The engine implements the IMF debt-accumulation identity from{' '}
          <em>Technical Notes 2021/005</em>, Section III, in its 2012
          real-terms shorthand:
        </p>
        <pre className="methodology-page__formula">
          d_t = d_(t-1) × (1 + r_t) / (1 + g_t) × ((1 − s_(t-1)) + s_(t-1) /
          (1 + z_t)) − pb_t
        </pre>
        <p>Where, in plain language, at year t:</p>
        <ul>
          <li>
            <code>d</code> — debt-to-GDP, % of GDP
          </li>
          <li>
            <code>g</code> — real GDP growth rate, %
          </li>
          <li>
            <code>r</code> — effective real interest rate on the debt stock, %
          </li>
          <li>
            <code>pb</code> — primary budget balance, % of GDP (negative = deficit)
          </li>
          <li>
            <code>z</code> — real exchange-rate appreciation against trading partners, %
          </li>
          <li>
            <code>s</code> — share of debt issued in foreign currency, %
          </li>
        </ul>
        <p>
          Debt grows when the effective real interest rate exceeds real GDP
          growth (the "r − g" channel); shrinks when the primary balance is in
          surplus; and is revalued by real exchange-rate moves through the
          FCU share.
        </p>
      </section>

      <section className="methodology-page__section">
        <h2>Data sources</h2>
        <ul>
          <li>
            <strong>v1 (FT Tool replica)</strong>: values extracted verbatim
            from the FT's archived JavaScript bundle (which is itself IMF WEO
            October 2014, the vintage contemporaneous with the FT article).
          </li>
          <li>
            <strong>v2 (this tool)</strong>: IMF WEO April 2026 — debt-to-GDP
            from <code>GGXWDG_NGDP</code>, real GDP growth from{' '}
            <code>NGDP_RPCH</code>, primary balance from{' '}
            <code>GGXONLB_NGDP</code>. Historical window 2022–2025; projection
            horizon 2026–2031 (matching the last WEO projection year).
          </li>
        </ul>
      </section>

      <section className="methodology-page__section">
        <h2>Assumptions</h2>
        <ul>
          <li>
            <strong>Implicit effective real interest rate.</strong> WEO does
            not publish an "effective real interest rate" series. v2 derives
            one by back-solving the identity above against WEO's own
            published debt path year by year. The result is the rate that
            would make the engine reproduce WEO's projection exactly at
            defaults — a defensible "what WEO is implying" reading.
          </li>
          <li>
            <strong>FX appreciation and FCU share default to 0.</strong> WEO
            does not publish forward real-FX-appreciation forecasts or
            FCU-share data, so the FX channel is inert at defaults. Users can
            still move both sliders to explore the FX-revaluation channel
            manually.
          </li>
          <li>
            <strong>Fan bands are illustrative, not stochastic-VCV.</strong>{' '}
            For each country we compute σ once from the historical debt-to-GDP
            series, then draw bands as <code>z·σ·√t</code> around the
            projection — a parametric envelope, not a Monte Carlo. The legend
            calls these "Illustrative range" precisely because they aren't
            statistically calibrated. A stochastic-VCV rebuild per TN 2021/005
            §VI.E is queued for a future iteration.
          </li>
          <li>
            <strong>v2 user defaults are year-varying.</strong> Each of g, r,
            and pb is back-solved per year (2026 through 2031), so the engine
            projection at defaults matches WEO's published path to floating-point
            precision across all six years.
          </li>
        </ul>
      </section>

      <section className="methodology-page__section methodology-page__credits">
        <h2>Credits</h2>
        <p>
          Built by <strong>Reuben Opondo</strong>,{' '}
          <strong>Teal Emery</strong>, and{' '}
          <strong>Aniekpeno Ifeh</strong> at{' '}
          <a
            href="https://tealinsights.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Teal Insights
          </a>
          , in partnership with{' '}
          <a
            href="https://www.naturefinance.net"
            target="_blank"
            rel="noopener noreferrer"
          >
            Nature Finance
          </a>
          . Methodology grounded in the FT Debt Dynamics Visualizer (2014)
          and the IMF's <em>Technical Notes 2021/005</em>.
        </p>

        <div className="methodology-page__authors">
          {AUTHORS.map(author => (
            <figure key={author.email} className="methodology-page__author">
              {author.photo ? (
                <img
                  src={author.photo}
                  alt={author.name}
                  className="methodology-page__author-photo"
                  loading="lazy"
                />
              ) : (
                <span
                  className="methodology-page__author-photo methodology-page__author-initials"
                  aria-hidden="true"
                >
                  {author.initials}
                </span>
              )}
              <figcaption className="methodology-page__author-caption">
                <span className="methodology-page__author-name">
                  {author.name}
                </span>
                <span className="methodology-page__author-org">
                  {author.org}
                </span>
                <span className="methodology-page__author-links">
                  {author.linkedin && (
                    <a
                      href={author.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="methodology-page__author-link"
                      aria-label={`${author.name} on LinkedIn`}
                      title="LinkedIn"
                    >
                      <LinkedInIcon />
                    </a>
                  )}
                  <a
                    href={`mailto:${author.email}`}
                    className="methodology-page__author-link"
                    aria-label={`Email ${author.name}`}
                    title="Email"
                  >
                    <EmailIcon />
                  </a>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <footer className="methodology-page__footer">
        <button
          type="button"
          className="methodology-page__close-btn"
          onClick={onReturnToTool}
        >
          ← Back to the tool
        </button>
      </footer>
    </article>
  );
}
