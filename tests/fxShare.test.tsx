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
