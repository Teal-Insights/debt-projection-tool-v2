import { useEffect, useState } from 'react';
import reubenPhoto from '../assets/profiles/reuben_ti.jpeg';
import ltePhoto from '../assets/profiles/teal_ti.jpeg';
import ifehPhoto from '../assets/profiles/Ifeh_ti.jpg';

// KaTeX is loaded entirely from CDN via <link> + <script> tags in index.html
// (not as an npm import) because v1/v2 share a hoisted node_modules tree in
// this repo and the `katex` package isn't always resolvable from v2's source
// files. The global is typed here so we don't need a separate .d.ts.
declare global {
  interface Window {
    katex?: {
      renderToString: (
        tex: string,
        options?: {
          displayMode?: boolean;
          throwOnError?: boolean;
          strict?: 'error' | 'warn' | 'ignore';
        },
      ) => string;
    };
  }
}

/** Try to render via window.katex; if the script hasn't loaded yet, poll. */
function useKatexHtml(tex: string, displayMode: boolean): string {
  const [html, setHtml] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    const attempt = () => {
      if (cancelled) return;
      const k = window.katex;
      if (k) {
        try {
          const rendered = k.renderToString(tex, {
            displayMode,
            throwOnError: false,
            strict: 'ignore',
          });
          if (!cancelled) setHtml(rendered);
        } catch {
          // Fall back to raw TeX text; nothing to do here.
        }
        return;
      }
      // Script not loaded yet — try again on the next macrotask.
      setTimeout(attempt, 50);
    };
    attempt();
    return () => {
      cancelled = true;
    };
  }, [tex, displayMode]);
  return html;
}

/**
 * Render a TeX expression in display (block) mode. Returns a styled card with
 * the KaTeX HTML inside; while waiting for the CDN script we show a quiet
 * monospace fallback so the section still renders text immediately.
 */
function BlockMath({ tex }: { tex: string }) {
  const html = useKatexHtml(tex, true);
  if (!html) {
    return (
      <pre className="methodology-page__math methodology-page__math--fallback">
        {tex.trim()}
      </pre>
    );
  }
  return (
    <div
      className="methodology-page__math"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function InlineMath({ tex }: { tex: string }) {
  const html = useKatexHtml(tex, false);
  if (!html) {
    return (
      <code className="methodology-page__math--inline-fallback">{tex}</code>
    );
  }
  return (
    <span
      className="methodology-page__math methodology-page__math--inline"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * The IMF debt-accumulation identity (2012 real-terms shorthand, per
 * Technical Notes 2021/005 §III). Each term is defined in the variable
 * list below the equation.
 */
const DEBT_IDENTITY_TEX = String.raw`
  d_t \;=\; d_{t-1}\,\frac{1 + r_t}{1 + g_t}\,
  \left[(1 - s_{t-1}) + \frac{s_{t-1}}{1 + z_t}\right] \;-\; pb_t
`;

interface Props {
  /** Switch back to the Scenarios view (called by the "Back to Scenarios" button). */
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
    name: 'Aniekpeno Ifeh',
    org: 'Teal Insights',
    photo: ifehPhoto,
    linkedin: 'https://ng.linkedin.com/in/aniekpenoifeh-22011996',
    email: 'aniekpeno.ifeh@tealinsights.com',
  },
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
];

/**
 * Methodology page — rendered inline as a sibling view to the tool (NOT a
 * modal overlay). App.tsx maintains a `view: 'tool' | 'methodology'` state
 * and swaps which page is mounted; the tab bar in the header is the primary
 * way to navigate between the two.
 *
 * Reads in <3 minutes and tells a stakeholder everything they need to
 * evaluate the tool: purpose, FT origin, the math, data sources, assumptions,
 * model limits, and credits.
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
          This tool provides an auditable starting point for exploring
          sovereign debt-to-GDP dynamics. It loads reasonable defaults from
          published IMF material, labels each input as published, derived,
          assumed, DSA-sourced, or a missing-coverage calculation fallback,
          and lets the user change every projection year. The defaults are
          starting points for scenario analysis, not recommended forecasts.
          Users should review and adjust them for the question at hand.
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
          October 2014 data. v2 retains the same core debt-dynamics identity,
          uses the fixed IMF WEO April 2026 vintage, and displays the 170
          economies with complete six-year inputs and debt paths from the 189
          economies in the extract.
        </p>
      </section>

      <section className="methodology-page__section">
        <h2>What the chart shows</h2>
        <p>
          The chart shows WEO's pre-2026 debt path, WEO's published 2026–2031
          debt path, and the deterministic scenario generated by the inputs.
          Pre-2026 observations, estimates, and projections are not separately
          tagged in this interface; their status varies by country, and 2025
          can be a WEO projection when the latest actual year is earlier. The
          chart does not display probability, confidence, or
          forecast-uncertainty bands. The
          forecast-error or variance-covariance evidence needed to support
          those bands is not included in this prototype.
        </p>
      </section>

      <section className="methodology-page__section">
        <h2>The math</h2>
        <p>
          The engine implements the IMF debt-accumulation identity from{' '}
          <em>Technical Notes 2021/005</em>, Section III, in its 2012
          real-terms shorthand:
        </p>
        <BlockMath tex={DEBT_IDENTITY_TEX} />
        <p>Where every symbol is defined as follows:</p>
        <ul className="methodology-page__defs">
          <li>
            <InlineMath tex="t" /> — the year index. Subscripts denote the
            year a quantity refers to:{' '}
            <InlineMath tex="t" /> is the projection year being computed,{' '}
            <InlineMath tex="t-1" /> is the immediately preceding year.
          </li>
          <li>
            <InlineMath tex="d_t" /> — gross general-government debt at the
            end of year <InlineMath tex="t" />, expressed as a percentage of
            nominal GDP (% of GDP). <InlineMath tex="d_{t-1}" /> is the same
            ratio at the end of the previous year and is the engine's
            starting point for the period.
          </li>
          <li>
            <InlineMath tex="g_t" /> — real GDP growth rate over year{' '}
            <InlineMath tex="t" />, in percent. Entered as a decimal in the
            formula (e.g. 3% = 0.03).
          </li>
          <li>
            <InlineMath tex="r_t" /> — effective real interest rate paid on
            the outstanding debt stock during year <InlineMath tex="t" />, in
            percent. "Effective" because it is the weighted average across
            all instruments in the debt portfolio; "real" because inflation
            has already been netted out.
          </li>
          <li>
            <InlineMath tex="pb_t" /> — primary budget balance over year{' '}
            <InlineMath tex="t" />, as a percentage of GDP. Positive values
            are surpluses (which reduce debt); negative values are deficits
            (which add to it). The primary balance excludes interest payments
            on debt — those are captured by <InlineMath tex="r_t" />.
          </li>
          <li>
            <InlineMath tex="s_{t-1}" /> — share of total debt that is
            denominated in foreign currency, measured at the end of year{' '}
            <InlineMath tex="t-1" /> (the beginning of the period). Used with
            a one-year lag because revaluation operates on debt that already
            existed when the period began.
          </li>
          <li>
            <InlineMath tex="z_t" /> — real exchange-rate appreciation
            against the basket of trading partners over year{' '}
            <InlineMath tex="t" />, in percent. Positive values are
            appreciations (which shrink the GDP value of foreign-currency
            debt); negative values are depreciations (which inflate it).
          </li>
        </ul>
        <p>
          The dynamics fall out of the identity directly: debt grows when the
          effective real interest rate exceeds real GDP growth (the{' '}
          <InlineMath tex="r_t - g_t" /> channel); shrinks when the primary
          balance is in surplus; and is revalued by real exchange-rate moves
          on the portion of debt held in foreign currency.
        </p>
      </section>

      <section className="methodology-page__section">
        <h2>Data sources</h2>
        <ul>
          <li>
            <strong>Fixed WEO vintage.</strong> v2 uses IMF World Economic
            Outlook April 2026 data. For reproducibility, the build retains the{' '}
            <a
              href="https://data.imf.org/-/media/iData/External-Storage/Documents/2F78EE59F79143A7921E5E203D3AAA80/en/WEOApr2026all.xlsx"
              target="_blank"
              rel="noopener noreferrer"
            >
              exact April 2026 workbook
            </a>
            . The interface links each published default to the selected
            country's IMF DataMapper page.
          </li>
          <li>
            <strong>Published WEO series.</strong> Pre-2026 and baseline
            general-government gross debt values come from{' '}
            <a
              href="https://www.imf.org/external/datamapper/GGXWDG_NGDP@WEO/OEMDC/ADVEC/WEOWORLD"
              target="_blank"
              rel="noopener noreferrer"
            >
              <code>GGXWDG_NGDP</code>
            </a>
            . Real GDP growth defaults come directly from{' '}
            <a
              href="https://www.imf.org/external/datamapper/NGDP_RPCH@WEO/OEMDC/ADVEC/WEOWORLD"
              target="_blank"
              rel="noopener noreferrer"
            >
              <code>NGDP_RPCH</code>
            </a>
            , and general-government primary net lending or borrowing defaults
            come directly from{' '}
            <a
              href="https://www.imf.org/external/datamapper/GGXONLB_NGDP@WEO/OEMDC/ADVEC/WEOWORLD"
              target="_blank"
              rel="noopener noreferrer"
            >
              <code>GGXONLB_NGDP</code>
            </a>
            . The historical window is 2022–2025 and the projection horizon is
            2026–2031. Countries missing any required six-year WEO input or
            debt-path value are excluded from the selector.
          </li>
          <li>
            <strong>Foreign-currency debt share</strong>: when available, the
            latest eligible actual observation in a published IMF debt
            sustainability analysis (DSA). Eligible sources are DSAs produced
            under the Low-Income Country Debt Sustainability Framework (LIC
            DSF) and the Sovereign Risk and Debt Sustainability Framework for
            Market Access Countries (MAC SRDSF). The 21 July 2026 v0.1.1
            snapshot contains 167 reviewed values: 64 of 68 LIC DSF countries
            and 103 of 123 MAC SRDSF countries. Among the 170 economies shown
            in this tool, 152 have a reviewed value and 18 have missing source
            coverage. Every sourced value carries its IMF report URL, page,
            table or figure, reference year, definition basis, and debt
            perimeter. Those details appear under the slider.
          </li>
        </ul>
      </section>

      <section className="methodology-page__section">
        <h2>Assumptions</h2>
        <ul>
          <li>
            <strong>Effective real interest rate is derived.</strong> WEO does
            not publish this series. For each projection year, the tool solves
            the simplified debt-dynamics identity for the rate that reproduces
            WEO's debt path, using WEO real GDP growth and primary balance and
            the explicit 0% real-exchange-rate assumption. This is a
            model-implied calibration value, not a published WEO observation.
            It can absorb stock-flow adjustments and other movements that the
            simplified identity does not model separately.
          </li>
          <li>
            <strong>Real exchange-rate appreciation is assumed.</strong> WEO
            does not publish the forward real-exchange-rate series required by
            this model. The tool therefore starts every projection year at 0%
            as an adjustable calculation assumption. The value is neither an
            observation nor an IMF forecast.
          </li>
          <li>
            <strong>Source value and calculation fallback remain separate.</strong>{' '}
            A reviewed DSA value becomes the opening stock share and is held
            constant across the projection horizon until the user changes it.
            A source-reported 0% remains an observed zero. When coverage is
            missing, the source value remains missing; the calculator applies
            a separately tagged 0% fallback at load and reset solely so the
            projection can run. That fallback does not establish the country's
            actual foreign-currency debt share. If the user moves the slider, the
            resulting path is labeled as a user-defined scenario while the
            coverage gap remains disclosed.
          </li>
          <li>
            <strong>Residency vs currency (the LIC-DSF caveat).</strong> The
            economically correct input for the FX-revaluation channel is the
            share of debt denominated in foreign currency. Many LIC-DSF
            tables split debt by residency (external vs domestic) rather
            than by currency. Where a report states its external/domestic
            definition is currency-based, we use the external-debt share
            directly. Where only a residency-based split is published, we
            use it as a proxy and flag it: those countries show "residency
            basis (external debt used as a proxy)" under the slider. The
            proxy overstates the FX share where external debt includes
            local-currency instruments held by non-residents, and
            understates it where residents hold FX-denominated domestic
            debt. 134 of the 167 values are currency-based; 33 are residency
            proxies.
          </li>
          <li>
            <strong>Debt perimeters differ across countries.</strong> Each
            DSA defines its own public-debt coverage (central government,
            general government, public sector, or non-financial public
            sector, with varying treatment of the central bank, guarantees,
            and SOE debt). The FX share we carry is the share within that
            report's perimeter, which may differ from the WEO
            general-government debt stock the projection runs on. The
            perimeter is disclosed per country under the slider.
          </li>
          <li>
            <strong>Reset defaults are year-varying.</strong> Growth and primary
            balance are read directly from WEO for each year from 2026 through
            2031. Only the effective real interest rate is derived year by
            year. With the other documented reset values, the engine path
            reproduces WEO's published debt path to floating-point precision.
            Changing any slider creates a user-defined scenario while leaving
            the reset provenance visible.
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
          ← Back to Scenarios
        </button>
      </footer>
    </article>
  );
}
