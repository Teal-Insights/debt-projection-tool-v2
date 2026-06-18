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
import { CountrySelector } from './components/CountrySelector';
import { SliderRow } from './components/SliderRow';
import { FanChart } from './components/FanChart';
import { OutputCards } from './components/OutputCards';
import { Footer } from './components/Footer';
import { MethodologyPage } from './components/MethodologyPage';
import tealMark from './assets/logos/teal_insights_mark.svg';

/**
 * v2 ships the IMF WEO April 2026 dataset. Per-country defaults are sourced
 * verbatim from WEO except `realInterestRate`, which is back-solved from the
 * debt-dynamics identity using WEO's own published debt path (the standup's
 * "implicit effective real rate from WEO" approach).
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

const COUNTRIES: CountryState[] = (countriesData as CountriesFile).countries
  .filter(isFullyPopulated) as unknown as CountryState[];

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
 * Synthesise a RecomputeResult-shaped object so the existing FanChart and
 * OutputCards components can consume it without modification.
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
    fanBands: { innerBand: [], outerBand: [] }, // FanChart uses result.fanBands, not baseline's.
    methodology: 'fc2012',
  };
}

export default function App() {
  const [countryIso, setCountryIso] = useState<string>(COUNTRIES[0].iso);
  const country = useMemo<CountryState>(
    () => COUNTRIES.find(c => c.iso === countryIso) ?? COUNTRIES[0],
    [countryIso],
  );

  const [sliders, setSliders] = useState<YearlySliders>(
    buildInitialSliders(country),
  );

  // Reset sliders to defaults whenever the country changes.
  const [prevIso, setPrevIso] = useState<string>(country.iso);
  if (prevIso !== country.iso) {
    setSliders(buildInitialSliders(country));
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

  const resetSliders = () => setSliders(buildInitialSliders(country));

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
              not a separate row. Tool / Methodology are siblings here, not a
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
              Tool
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
            Sovereign Debt to GDP ratio (%) under user-defined macro
            assumptions · Based on the{' '}
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
                baselineValues={country.yearlyDefaults?.realGdpGrowth}
                min={-10}
                max={12}
                step={0.1}
                onChange={(i, v) => updateSlider('realGdpGrowth', i, v)}
              />
              <SliderRow
                key={`r-${countryIso}`}
                label="Effective real interest rate"
                years={projectionYears}
                values={sliders.realInterestRate}
                baselineValues={country.yearlyDefaults?.realInterestRate}
                min={-10}
                max={15}
                step={0.1}
                onChange={(i, v) => updateSlider('realInterestRate', i, v)}
              />
              <SliderRow
                key={`pb-${countryIso}`}
                label="Primary budget balance"
                years={projectionYears}
                values={sliders.primaryBalance}
                baselineValues={country.yearlyDefaults?.primaryBalance}
                min={-10}
                max={8}
                step={0.1}
                unit="% of GDP"
                onChange={(i, v) => updateSlider('primaryBalance', i, v)}
              />
              <SliderRow
                key={`z-${countryIso}`}
                label="Real exchange rate appreciation"
                years={projectionYears}
                values={sliders.realFxAppreciation}
                baselineValues={country.yearlyDefaults?.realFxAppreciation}
                min={-15}
                max={15}
                step={0.1}
                onChange={(i, v) => updateSlider('realFxAppreciation', i, v)}
              />
              <SliderRow
                key={`s-${countryIso}`}
                label="Foreign currency debt share"
                years={projectionYears}
                values={sliders.fcuShare}
                baselineValues={country.yearlyDefaults?.fcuShare}
                min={0}
                max={100}
                step={0.1}
                onChange={(i, v) => updateSlider('fcuShare', i, v)}
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
