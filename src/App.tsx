import { useMemo, useState } from 'react';
import { recompute } from './engine';
import type {
  CountryState,
  RecomputeResult,
  SliderKey,
  SliderValues,
  YearlySliders,
} from './engine';
import countriesData from './data/countries.json';
import {
  applyFxShareDefault as applyFxShareDefaultToCountry,
  getFxShareDefault,
} from './fxShare';
import { FxShareFootnote } from './components/FxShareFootnote';
import { InputProvenanceNote } from './components/InputProvenanceNote';
import { CountrySelector } from './components/CountrySelector';
import { SliderRow } from './components/SliderRow';
import { FanChart } from './components/FanChart';
import { OutputCards } from './components/OutputCards';
import { Footer } from './components/Footer';
import { MethodologyPage } from './components/MethodologyPage';
import { getWeoDataMapperUrl } from './inputProvenance';
import tealMark from './assets/logos/teal_insights_mark.svg';

/**
 * v2 ships the IMF WEO April 2026 dataset. Growth and primary-balance defaults
 * are published WEO series; `realInterestRate` is back-solved from the WEO debt
 * path; real-FX appreciation is an explicit 0% assumption; and FX-share
 * defaults are added by the provenance-aware DSA adapter below.
 *
 * Some countries arrive from WEO with missing inputs (e.g. Afghanistan,
 * Lebanon, Venezuela) — filter them at load time so the dropdown only shows
 * countries the engine can project cleanly.
 */
type RawCountry = Omit<CountryState, 'defaults' | 'yearlyDefaults'> & {
  defaults: { [K in keyof SliderValues]: number | null };
  yearlyDefaults?: { [K in keyof YearlySliders]: Array<number | null> };
};
type CountriesFile = {
  _meta?: unknown;
  countries: RawCountry[];
};

const HORIZON_YEARS = 6;
// WEO April 2026 publishes annual projections through 2031, so baselineYear
// (2026) + 6 horizon years lands exactly on the last published WEO year.

/**
 * v2 ships per-year defaults sourced verbatim from WEO. To keep the dropdown
 * clean, filter out countries where any year's input is null (engine would
 * project NaN). This is stricter than the scalar-defaults filter v1 used.
 */
function isFullyPopulated(c: RawCountry): c is RawCountry & { yearlyDefaults: YearlySliders } {
  const yd = c.yearlyDefaults;
  if (!yd) return false;
  if ((c.baselineProjection?.length ?? 0) < HORIZON_YEARS) return false;
  const keys: (keyof YearlySliders)[] = [
    'realGdpGrowth',
    'realInterestRate',
    'primaryBalance',
    'realFxAppreciation',
    'fcuShare',
  ];
  return keys.every(k => {
    const arr = yd[k];
    return Array.isArray(arr) && arr.length === HORIZON_YEARS && arr.every(v => v !== null);
  });
}

/**
 * TEA-880: resolve source coverage separately from the numerical model
 * default. Observations, including observed 0 percent values, retain their
 * provenance. Missing coverage stays null at the source boundary, then a
 * tagged 0 percent calculation fallback is applied to the scalar default,
 * per-year path, and opening stock so the engine can run.
 */
function applyFxShareDefault(c: CountryState): CountryState {
  return applyFxShareDefaultToCountry(c, getFxShareDefault(c.iso));
}

const COUNTRIES: CountryState[] = (
  (countriesData as CountriesFile).countries.filter(
    isFullyPopulated,
  ) as unknown as CountryState[]
).map(applyFxShareDefault);

/**
 * Build the initial YearlySliders for a country. Prefer the WEO-sourced
 * per-year defaults (so the engine's path matches WEO exactly at defaults);
 * fall back to expanding the scalar defaults uniformly for countries that
 * don't have yearlyDefaults (none in v2's filtered set, but defensive).
 */
function buildInitialSliders(country: CountryState): YearlySliders {
  if (country.yearlyDefaults) {
    return {
      realGdpGrowth: [...country.yearlyDefaults.realGdpGrowth],
      realInterestRate: [...country.yearlyDefaults.realInterestRate],
      primaryBalance: [...country.yearlyDefaults.primaryBalance],
      realFxAppreciation: [...country.yearlyDefaults.realFxAppreciation],
      fcuShare: [...country.yearlyDefaults.fcuShare],
    };
  }
  const fill = (v: number) => Array.from({ length: HORIZON_YEARS }, () => v);
  return {
    realGdpGrowth: fill(country.defaults.realGdpGrowth),
    realInterestRate: fill(country.defaults.realInterestRate),
    primaryBalance: fill(country.defaults.primaryBalance),
    realFxAppreciation: fill(country.defaults.realFxAppreciation),
    fcuShare: fill(country.defaults.fcuShare),
  };
}

/**
 * v2-specific baseline: the chart's "baseline" line is WEO's own published
 * debt-to-GDP path (`country.baselineProjection`), NOT an engine projection
 * from defaults. The user's projection line is still engine output, so the
 * two lines overlap at defaults and diverge as the user moves sliders.
 *
 * Synthesise a RecomputeResult-shaped object so the chart and output cards
 * can consume the published WEO path through the same interface.
 */
function buildWeoBaselineResult(country: CountryState): RecomputeResult {
  const histPath = [...country.historical];
  const lastHist = histPath[histPath.length - 1];
  if (!lastHist || lastHist.year !== country.baselineYear - 1) {
    histPath.push({
      year: country.baselineYear - 1,
      debtPct: country.startingDebtPct,
    });
  }
  const projPath = country.baselineProjection ?? [];
  const path = [...histPath, ...projPath];
  const peak = path.reduce(
    (best, p) => (p.debtPct > best.debtPct ? p : best),
    path[0],
  );
  const endOfHorizon = projPath[projPath.length - 1] ?? {
    year: country.baselineYear - 1,
    debtPct: country.startingDebtPct,
  };
  return {
    path,
    decomposition: [],
    peak,
    endOfHorizon,
    methodology: 'fc2012',
  };
}

export default function App() {
  const [countryIso, setCountryIso] = useState<string>(COUNTRIES[0].iso);
  const country = useMemo<CountryState>(
    () => COUNTRIES.find(c => c.iso === countryIso) ?? COUNTRIES[0],
    [countryIso],
  );
  const fxShareDefault =
    country.fxShareDefault ?? getFxShareDefault(country.iso);
  const defaultSliders = useMemo(
    () => buildInitialSliders(country),
    [country],
  );

  const [sliders, setSliders] = useState<YearlySliders>(
    buildInitialSliders(country),
  );

  // Reset sliders to defaults whenever the country changes.
  const [prevIso, setPrevIso] = useState<string>(country.iso);
  if (prevIso !== country.iso) {
    setSliders(defaultSliders);
    setPrevIso(country.iso);
  }

  const projectionYears = useMemo(
    () =>
      Array.from(
        { length: HORIZON_YEARS },
        (_, i) => country.baselineYear + i,
      ),
    [country.baselineYear],
  );

  // Baseline (WEO's own published debt path) — independent of slider state.
  const baselineResult = useMemo(
    () => buildWeoBaselineResult(country),
    [country],
  );

  // User scenario — live engine recompute from current sliders.
  const result = useMemo(
    () => recompute({ country, sliders, horizonYears: HORIZON_YEARS }),
    [country, sliders],
  );

  const updateSlider = (key: SliderKey, yearIdx: number, value: number) => {
    setSliders(prev => {
      const next = [...prev[key]];
      next[yearIdx] = value;
      return { ...prev, [key]: next };
    });
  };

  const resetSliders = () => setSliders(defaultSliders);

  // Top-level navigation. The methodology lives as a sibling view to the tool
  // (tab-style), not a modal overlay — a stakeholder can deep-link straight to
  // it later via routing without changing this state machine.
  const [view, setView] = useState<'tool' | 'methodology'>('tool');
  const showTool = view === 'tool';

  return (
    <div className={'app' + (showTool ? '' : ' app--methodology')}>
      <header className="app__header">
        <div className="app__header-left">
          {/* Teal Insights brand — globe mark only (the wordmark is redundant
              with the product title to its right). Renders directly on the
              white navbar; the colored low-poly globe carries enough visual
              identity without needing a pill. Links to the LinkedIn page. */}
          <a
            className="app__brand"
            href="https://www.linkedin.com/company/teal-insights/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Teal Insights on LinkedIn"
          >
            <img
              src={tealMark}
              alt="Teal Insights"
              className="app__brand-mark"
            />
          </a>
          <span className="app__brand-divider" aria-hidden="true" />
          <h1 className="app__title">
            Debt Projection Tool
            <span className="app__version">v2</span>
          </h1>
          {/* Tab strip lives inline with the title — horizontal primary nav,
              not a separate row. Scenarios / Methodology are siblings here, not a
              page + modal. */}
          <nav className="app__tabs" role="tablist" aria-label="Sections">
            <button
              type="button"
              role="tab"
              aria-selected={showTool}
              className={
                'app__tab' + (showTool ? ' app__tab--active' : '')
              }
              onClick={() => setView('tool')}
            >
              Scenarios
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!showTool}
              className={
                'app__tab' + (!showTool ? ' app__tab--active' : '')
              }
              onClick={() => setView('methodology')}
            >
              Methodology
            </button>
          </nav>
        </div>
        {showTool && (
          <p className="app__header-context" aria-label="About this tool">
            Deterministic debt scenarios from adjustable, traceable
            defaults · Based on the{' '}
            <a
              href="https://web.archive.org/web/20160719165542/https://ig.ft.com/sites/2014/debt-to-gdp-ratio/"
              target="_blank"
              rel="noopener noreferrer"
            >
              FT 2014 Debt Dynamics Visualizer
            </a>
          </p>
        )}
        {showTool && (
          <div className="app__header-right">
            <CountrySelector
              countries={COUNTRIES}
              value={countryIso}
              onChange={setCountryIso}
            />
            <button className="app__reset" type="button" onClick={resetSliders}>
              ↺ Reset
            </button>
          </div>
        )}
      </header>

      {/* Prototype callout — Jun 19 standup feedback (Yves). Visible on
          first paint, non-dismissible, shown on both Scenarios and
          Methodology so a forwarded recipient cannot miss it. Frames the
          tool as an early iteration and actively invites feedback. */}
      <aside className="app__callout" role="note" aria-label="About this prototype">
        <span className="app__callout-label">Prototype</span>
        <p className="app__callout-text">
          Start with reasonable, adjustable defaults and clear provenance.
          IMF WEO April 2026 supplies growth and the primary balance; the
          effective real interest rate is derived from its debt path; IMF DSAs
          supply foreign-currency debt shares where available; and real
          exchange-rate appreciation starts from an explicit 0% assumption.
          These are starting points, not recommended forecasts.{' '}
          <button
            type="button"
            className="app__callout-link app__callout-button"
            onClick={() => setView('methodology')}
          >
            Review methodology
          </button>{' '}
          ·{' '}
          <a
            className="app__callout-link"
            href="mailto:reuben.opondo@tealinsights.com,lte@tealinsights.com,aniekpeno.ifeh@tealinsights.com?subject=Debt%20Projection%20Tool%20%E2%80%94%20Feedback"
          >
            Share feedback →
          </a>
        </p>
      </aside>

      {showTool ? (
        <>
          <main className="app__main">
            {/* LEFT COLUMN — chart on top, three narrative cards below */}
            <section className="app__left">
              <div className="app__chart">
                <FanChart
                  result={result}
                  baselineResult={baselineResult}
                  country={country}
                />
                <p className="app__chart-note">
                  Published WEO debt path versus the deterministic scenario
                  generated by the documented inputs. No probability or
                  forecast-uncertainty bands are estimated.
                </p>
              </div>
              <OutputCards
                result={result}
                baselineResult={baselineResult}
                country={country}
                sliders={sliders}
              />
            </section>

            {/* RIGHT COLUMN — scrollable list of slider cards */}
            <section className="app__right" aria-label="Inputs (year-by-year)">
              <h2 className="app__section-title app__section-title--right">
                Inputs · drag any year
              </h2>
              {/* v2 slider ranges tightened around what's realistic for the
                  WEO universe (Jun 2026 standup feedback — Yves: "they're not
                  going to grow 14%"). Ranges now sit roughly at p1/p99 of the
                  observed WEO baseline distribution across 170 economies,
                  plus headroom. Step stays at 0.1pp = 10 basis points,
                  finer than Yves's 25bps target. A handful of exotic
                  outliers (e.g. Suriname growth, Kuwait rates) will have
                  their WEO notch visually clamped to the slider edge — the
                  underlying slider value is preserved, only the notch slides
                  to the boundary. */}
              <SliderRow
                key={`g-${countryIso}`}
                label="Real GDP growth rate"
                years={projectionYears}
                values={sliders.realGdpGrowth}
                defaultValues={defaultSliders.realGdpGrowth}
                min={-10}
                max={12}
                step={0.1}
                onChange={(i, v) => updateSlider('realGdpGrowth', i, v)}
                footnote={
                  <InputProvenanceNote
                    kind="published"
                    defaultTitle="Published WEO default"
                    defaultDetail="IMF WEO April 2026 real GDP growth (NGDP_RPCH), 2026–2031."
                    values={sliders.realGdpGrowth}
                    defaultValues={defaultSliders.realGdpGrowth}
                    sourceUrl={getWeoDataMapperUrl('NGDP_RPCH', country.iso)}
                    onMethodology={() => setView('methodology')}
                  />
                }
              />
              <SliderRow
                key={`r-${countryIso}`}
                label="Effective real interest rate"
                years={projectionYears}
                values={sliders.realInterestRate}
                defaultValues={defaultSliders.realInterestRate}
                min={-10}
                max={15}
                step={0.1}
                onChange={(i, v) => updateSlider('realInterestRate', i, v)}
                footnote={
                  <InputProvenanceNote
                    kind="derived"
                    defaultTitle="WEO-derived default"
                    defaultDetail="Calculated year by year from WEO debt, growth, and primary balance; this is not a published WEO series."
                    values={sliders.realInterestRate}
                    defaultValues={defaultSliders.realInterestRate}
                    sourceUrl={getWeoDataMapperUrl('GGXWDG_NGDP', country.iso)}
                    sourceLabel="Open WEO debt source"
                    methodologyLabel="See derivation"
                    onMethodology={() => setView('methodology')}
                  />
                }
              />
              <SliderRow
                key={`pb-${countryIso}`}
                label="Primary budget balance"
                years={projectionYears}
                values={sliders.primaryBalance}
                defaultValues={defaultSliders.primaryBalance}
                min={-10}
                max={8}
                step={0.1}
                unit="% of GDP"
                onChange={(i, v) => updateSlider('primaryBalance', i, v)}
                footnote={
                  <InputProvenanceNote
                    kind="published"
                    defaultTitle="Published WEO default"
                    defaultDetail="IMF WEO April 2026 general government primary net lending/borrowing (GGXONLB_NGDP), 2026–2031."
                    values={sliders.primaryBalance}
                    defaultValues={defaultSliders.primaryBalance}
                    sourceUrl={getWeoDataMapperUrl(
                      'GGXONLB_NGDP',
                      country.iso,
                    )}
                    onMethodology={() => setView('methodology')}
                  />
                }
              />
              <SliderRow
                key={`z-${countryIso}`}
                label="Real exchange rate appreciation"
                years={projectionYears}
                values={sliders.realFxAppreciation}
                defaultValues={defaultSliders.realFxAppreciation}
                min={-15}
                max={15}
                step={0.1}
                onChange={(i, v) => updateSlider('realFxAppreciation', i, v)}
                footnote={
                  <InputProvenanceNote
                    kind="assumption"
                    defaultTitle="Explicit calculation assumption: 0.0%"
                    defaultDetail="WEO does not publish the forward real-exchange-rate series required for this input."
                    values={sliders.realFxAppreciation}
                    defaultValues={defaultSliders.realFxAppreciation}
                    methodologyLabel="Why this assumption is used"
                    onMethodology={() => setView('methodology')}
                  />
                }
              />
              <SliderRow
                key={`s-${countryIso}`}
                label="Foreign currency debt share"
                years={projectionYears}
                values={sliders.fcuShare}
                defaultValues={defaultSliders.fcuShare}
                min={0}
                max={100}
                step={0.1}
                onChange={(i, v) => updateSlider('fcuShare', i, v)}
                footnote={
                  <FxShareFootnote
                    defaultState={fxShareDefault}
                    countryName={country.name}
                    values={sliders.fcuShare}
                  />
                }
              />
            </section>
          </main>
        </>
      ) : (
        <MethodologyPage onReturnToTool={() => setView('tool')} />
      )}

      <Footer />
    </div>
  );
}
