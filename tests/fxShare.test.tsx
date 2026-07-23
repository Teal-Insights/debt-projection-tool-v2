import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  applyFxShareDefault,
  getFxShareCoverage,
  getFxShareDefault,
  getFxShareScenarioState,
  resolveFxShareDefault,
} from '../src/fxShare';
import { FxShareFootnote } from '../src/components/FxShareFootnote';
import { recompute } from '../src/engine';
import { whatsMovingTheDebt } from '../src/narratives';
import type { CountryState, YearlySliders } from '../src/types';

function makeCountry(iso = 'ago'): CountryState {
  return {
    iso,
    name: iso === 'chn' ? 'China' : iso === 'usa' ? 'United States' : 'Angola',
    baselineYear: 2026,
    startingDebtPct: 50,
    historical: [{ year: 2025, debtPct: 50 }],
    historicalFcuShare: 44,
    defaults: {
      realGdpGrowth: 3,
      realInterestRate: 4,
      primaryBalance: 0,
      realFxAppreciation: 0,
      fcuShare: 37,
    },
    yearlyDefaults: {
      realGdpGrowth: [3, 3],
      realInterestRate: [4, 4],
      primaryBalance: [0, 0],
      realFxAppreciation: [0, 0],
      fcuShare: [55, 66],
    },
  };
}

function slidersFor(country: CountryState): YearlySliders {
  const defaults = country.yearlyDefaults;
  if (!defaults) throw new Error('Test country requires yearly defaults');
  return {
    realGdpGrowth: [...defaults.realGdpGrowth],
    realInterestRate: [...defaults.realInterestRate],
    primaryBalance: [...defaults.primaryBalance],
    realFxAppreciation: [...defaults.realFxAppreciation],
    fcuShare: [...defaults.fcuShare],
  };
}

describe('FX-share coverage and default states', () => {
  it('keeps missing coverage null at the data boundary', () => {
    const coverage = getFxShareCoverage('CHN');

    expect(coverage).toMatchObject({
      kind: 'missing',
      iso: 'chn',
      sourceValuePct: null,
      reason: 'missing_source_coverage',
    });
  });

  it('keeps a sourced observed zero distinct from missing coverage', () => {
    const coverage = getFxShareCoverage('USA');
    expect(coverage.kind).toBe('observed');
    expect(coverage.sourceValuePct).toBe(0);

    const defaultState = resolveFxShareDefault(coverage);
    expect(defaultState).toMatchObject({
      kind: 'observed',
      sourceValuePct: 0,
      modelValuePct: 0,
      observedZero: true,
      usesFallback: false,
    });
  });

  it('creates a separate tagged model fallback for missing coverage', () => {
    const defaultState = getFxShareDefault('CHN');

    expect(defaultState).toEqual({
      kind: 'fallback',
      iso: 'chn',
      sourceValuePct: null,
      modelValuePct: 0,
      observedZero: false,
      usesFallback: true,
      reason: 'missing_source_coverage',
    });
  });

  it.each([
    ['AGO', 'observed', 70, false],
    ['USA', 'observed', 0, true],
    ['CHN', 'fallback', 0, false],
  ] as const)(
    'carries %s through scalar, opening-stock, and yearly defaults',
    (iso, kind, modelValuePct, observedZero) => {
      const adapted = applyFxShareDefault(
        makeCountry(iso.toLowerCase()),
        getFxShareDefault(iso),
      );

      expect(adapted.fxShareDefault?.kind).toBe(kind);
      expect(adapted.fxShareDefault?.observedZero).toBe(observedZero);
      expect(adapted.defaults.fcuShare).toBe(modelValuePct);
      expect(adapted.historicalFcuShare).toBe(modelValuePct);
      expect(adapted.yearlyDefaults?.fcuShare).toEqual([
        modelValuePct,
        modelValuePct,
      ]);
    },
  );

  it('distinguishes reset fallback, observed zero, and a user edit', () => {
    const fallback = getFxShareDefault('CHN');
    const observedZero = getFxShareDefault('USA');

    expect(getFxShareScenarioState(fallback, [0, 0]).kind).toBe(
      'fallback_default',
    );
    expect(getFxShareScenarioState(observedZero, [0, 0]).kind).toBe(
      'observed_zero_default',
    );
    expect(getFxShareScenarioState(fallback, [25, 25])).toMatchObject({
      kind: 'user_defined',
      allValuesZero: false,
    });
  });
});

describe('FX-share UI states', () => {
  it('labels a sourced nonzero default and retains its provenance', () => {
    const defaultState = getFxShareDefault('AGO');
    const html = renderToStaticMarkup(
      <FxShareFootnote
        defaultState={defaultState}
        countryName="Angola"
        values={[70, 70]}
      />,
    );

    expect(html).toContain('Sourced DSA default: 70.0%');
    expect(html).toContain('data-fx-share-state="source"');
    expect(html).toContain('IMF report');
  });

  it('labels missing coverage without making an economic-zero claim', () => {
    const defaultState = getFxShareDefault('CHN');
    const html = renderToStaticMarkup(
      <FxShareFootnote
        defaultState={defaultState}
        countryName="China"
        values={[0, 0]}
      />,
    );

    expect(html).toContain('FX-share coverage unavailable');
    expect(html).toContain('0% calculation fallback');
    expect(html).toContain('data-fx-share-state="fallback"');
    expect(html).toContain('actual foreign-currency debt share');
    expect(html).not.toContain('no foreign-currency debt');
  });

  it('labels a sourced zero as observed and retains its source link', () => {
    const defaultState = getFxShareDefault('USA');
    const html = renderToStaticMarkup(
      <FxShareFootnote
        defaultState={defaultState}
        countryName="United States"
        values={[0, 0]}
      />,
    );

    expect(html).toContain('Observed DSA value: 0.0%');
    expect(html).toContain('sourced observation');
    expect(html).toContain('IMF report');
    expect(html).toContain('data-fx-share-state="observed-zero"');
  });

  it('labels an edit on a missing country as user-defined', () => {
    const defaultState = getFxShareDefault('CHN');
    const html = renderToStaticMarkup(
      <FxShareFootnote
        defaultState={defaultState}
        countryName="China"
        values={[20, 20]}
      />,
    );

    expect(html).toContain('User-defined FX-share scenario');
    expect(html).toContain('data-fx-share-state="user-defined"');
    expect(html).toContain('source coverage gap remains');
  });

  it('keeps fallback and observed-zero explanations distinct downstream', () => {
    const fallbackCountry = applyFxShareDefault(
      makeCountry('chn'),
      getFxShareDefault('CHN'),
    );
    const observedZeroCountry = applyFxShareDefault(
      makeCountry('usa'),
      getFxShareDefault('USA'),
    );
    const fallbackSliders = slidersFor(fallbackCountry);
    const observedZeroSliders = slidersFor(observedZeroCountry);
    const fallbackResult = recompute({
      country: fallbackCountry,
      sliders: fallbackSliders,
      horizonYears: 2,
    });
    const observedZeroResult = recompute({
      country: observedZeroCountry,
      sliders: observedZeroSliders,
      horizonYears: 2,
    });
    const fallbackHtml = renderToStaticMarkup(
      whatsMovingTheDebt(fallbackResult, fallbackCountry, fallbackSliders),
    );
    const observedZeroHtml = renderToStaticMarkup(
      whatsMovingTheDebt(
        observedZeroResult,
        observedZeroCountry,
        observedZeroSliders,
      ),
    );

    expect(fallbackHtml).toContain('no reviewed FX-share observation');
    expect(fallbackHtml).toContain('tagged 0% model fallback');
    expect(fallbackHtml).not.toContain('no foreign-currency debt');
    expect(observedZeroHtml).toContain('observed 0% foreign-currency share');
    expect(observedZeroHtml).not.toContain('model fallback');
  });
});

describe('FX-share derivation transparency (v0.1.2)', () => {
  it('shows the exact ratio arithmetic and estimate-year status for Nigeria', () => {
    const defaultState = getFxShareDefault('NGA');
    const html = renderToStaticMarkup(
      <FxShareFootnote
        defaultState={defaultState}
        countryName="Nigeria"
        values={[46.8, 46.8]}
      />,
    );

    expect(html).toContain('Sourced DSA default: 46.8%');
    expect(html).toContain('Derivation: FX-denominated debt 16.9');
    expect(html).toContain('total public debt 36.1');
    expect(html).toContain('staff estimate');
    expect(html).toContain('48.3%'); // latest hard-actual alternative
    expect(html).toContain('Source: 2025 (staff estimate)');
    expect(html).toContain('July 2026 audit');
  });

  it('displays chart-derived values as approximate integers with components', () => {
    const defaultState = getFxShareDefault('ALB');
    const html = renderToStaticMarkup(
      <FxShareFootnote
        defaultState={defaultState}
        countryName="Albania"
        values={[42.2, 42.2]}
      />,
    );

    expect(html).toContain('Sourced DSA default: ≈42% (chart-derived)');
    expect(html).toContain('Debt-by-Currency chart');
    expect(html).toContain('chart-derived estimate');
    expect(html).toContain('Source: 2024 (actual)');
  });

  it('discloses audit corrections on corrected rows', () => {
    const defaultState = getFxShareDefault('KWT');
    const html = renderToStaticMarkup(
      <FxShareFootnote
        defaultState={defaultState}
        countryName="Kuwait"
        values={[97.9, 97.9]}
      />,
    );

    expect(html).toContain('Sourced DSA default: ≈98% (chart-derived)');
    expect(html).toContain('Corrected in the July 2026 independent audit');
  });

  it('every sourced entry carries year status, derivation, and audit fields', () => {
    // The build script enforces this at generation time; this guards the
    // bundled artifact against manual edits.
    /* eslint-disable @typescript-eslint/no-var-requires */
    const data = require('../src/data/fx-share.json') as {
      countries: Record<
        string,
        {
          valuePct: number;
          yearStatus: string;
          extractionMethod: string;
          derivation: {
            kind: string;
            numeratorPctGdp: number | null;
            denominatorPctGdp: number | null;
            printedSharePct: number | null;
          };
          audit: { outcome: string; date: string };
        }
      >;
    };
    const entries = Object.entries(data.countries);
    expect(entries.length).toBe(167);
    for (const [iso, c] of entries) {
      expect(['actual', 'estimate'], iso).toContain(c.yearStatus);
      expect(['table', 'text', 'figure'], iso).toContain(c.extractionMethod);
      expect(['ratio', 'figure', 'direct'], iso).toContain(c.derivation.kind);
      expect(['CONFIRMED', 'CONFIRMED_APPROX', 'CORRECTED'], iso).toContain(
        c.audit.outcome,
      );
      if (c.derivation.kind === 'ratio') {
        const { numeratorPctGdp: n, denominatorPctGdp: d } = c.derivation;
        expect(n, iso).not.toBeNull();
        expect(d, iso).not.toBeNull();
        const recomputed = ((n as number) / (d as number)) * 100;
        expect(Math.abs(recomputed - c.valuePct), iso).toBeLessThan(0.35);
      }
    }
  });
});
