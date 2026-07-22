import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from '../src/App';
import { FanChart } from '../src/components/FanChart';
import { InputProvenanceNote } from '../src/components/InputProvenanceNote';
import { MethodologyPage } from '../src/components/MethodologyPage';
import { recompute } from '../src/engine';
import {
  getInputScenarioState,
  getWeoDataMapperUrl,
  type InputDefaultKind,
} from '../src/inputProvenance';
import type { CountryState, YearlySliders } from '../src/types';

const country: CountryState = {
  iso: 'ago',
  name: 'Angola',
  baselineYear: 2026,
  startingDebtPct: 50,
  historical: [
    { year: 2024, debtPct: 52 },
    { year: 2025, debtPct: 50 },
  ],
  baselineProjection: [
    { year: 2026, debtPct: 49 },
    { year: 2027, debtPct: 48 },
  ],
  historicalFcuShare: 70,
  defaults: {
    realGdpGrowth: 3,
    realInterestRate: 1,
    primaryBalance: 1,
    realFxAppreciation: 0,
    fcuShare: 70,
  },
  yearlyDefaults: {
    realGdpGrowth: [3, 3],
    realInterestRate: [1, 1],
    primaryBalance: [1, 1],
    realFxAppreciation: [0, 0],
    fcuShare: [70, 70],
  },
};

const sliders: YearlySliders = {
  realGdpGrowth: [3, 3],
  realInterestRate: [1, 1],
  primaryBalance: [1, 1],
  realFxAppreciation: [0, 0],
  fcuShare: [70, 70],
};

function renderNote(
  kind: InputDefaultKind,
  values = [3, 3],
  defaultValues = [3, 3],
) {
  return renderToStaticMarkup(
    <InputProvenanceNote
      kind={kind}
      defaultTitle={
        kind === 'published'
          ? 'Published WEO default'
          : kind === 'derived'
            ? 'WEO-derived default'
            : 'Explicit calculation assumption: 0.0%'
      }
      defaultDetail={
        kind === 'published'
          ? 'IMF WEO April 2026 real GDP growth (NGDP_RPCH), 2026–2031.'
          : kind === 'derived'
            ? 'Calculated from WEO debt, growth, and primary balance; this is not a published WEO series.'
            : 'WEO does not publish the forward real-exchange-rate series required for this input.'
      }
      values={values}
      defaultValues={defaultValues}
      sourceUrl={
        kind === 'assumption'
          ? undefined
          : getWeoDataMapperUrl(
              kind === 'published' ? 'NGDP_RPCH' : 'GGXWDG_NGDP',
              'ago',
            )
      }
      onMethodology={() => undefined}
    />,
  );
}

describe('deterministic chart contract', () => {
  it('returns no unsupported band output from the engine', () => {
    const result = recompute({ country, sliders, horizonYears: 2 });

    expect(result).not.toHaveProperty('fanBands');
    expect(result.path).toHaveLength(4);
    expect(result.decomposition).toHaveLength(2);
  });

  it('shows only historical, WEO baseline, and user scenario legend states', () => {
    const result = recompute({ country, sliders, horizonYears: 2 });
    const html = renderToStaticMarkup(
      <FanChart result={result} baselineResult={result} country={country} />,
    );

    expect(html).toContain('Pre-2026 WEO path');
    expect(html).toContain('IMF WEO baseline');
    expect(html).toContain('Your scenario');
    expect(html).not.toContain('Moderate stress');
    expect(html).not.toContain('Severe stress');
  });
});

describe('input provenance states', () => {
  it('links a published default to the selected country and exact WEO series', () => {
    const html = renderNote('published');

    expect(html).toContain('Published WEO default');
    expect(html).toContain('IMF WEO April 2026');
    expect(html).toContain('NGDP_RPCH');
    expect(html).toContain('NGDP_RPCH@WEO/AGO');
    expect(html).toContain('data-input-default-kind="published"');
    expect(html).toContain('data-input-scenario-state="default"');
  });

  it('labels the effective rate as derived rather than published', () => {
    const html = renderNote('derived');

    expect(html).toContain('WEO-derived default');
    expect(html).toContain('not a published WEO series');
    expect(html).toContain('GGXWDG_NGDP@WEO/AGO');
    expect(html).toContain('data-input-default-kind="derived"');
  });

  it('labels real-FX zero as an explicit assumption with no source claim', () => {
    const html = renderNote('assumption', [0, 0], [0, 0]);

    expect(html).toContain('Explicit calculation assumption: 0.0%');
    expect(html).toContain('does not publish');
    expect(html).toContain('data-input-default-kind="assumption"');
    expect(html).not.toContain('Open source');
  });

  it.each(['published', 'derived', 'assumption'] as const)(
    'keeps %s reset provenance visible after an edit and restores the default state on reset',
    kind => {
      const editedHtml = renderNote(kind, [3, 4], [3, 3]);
      const resetHtml = renderNote(kind, [3, 3], [3, 3]);

      expect(editedHtml).toContain('User-defined scenario');
      expect(editedHtml).toContain(`data-input-default-kind="${kind}"`);
      expect(editedHtml).toContain('Reset provenance');
      expect(editedHtml).toContain('data-input-scenario-state="user_defined"');
      expect(resetHtml).toContain('data-input-scenario-state="default"');
      expect(resetHtml).not.toContain('User-defined scenario');
    },
  );

  it('keeps Kosovo on the IMF country route used by DataMapper', () => {
    expect(getWeoDataMapperUrl('NGDP_RPCH', 'kos')).toBe(
      'https://www.imf.org/external/datamapper/NGDP_RPCH@WEO/KOS',
    );
  });

  it('builds the selected-country route for the published primary-balance series', () => {
    expect(getWeoDataMapperUrl('GGXONLB_NGDP', 'ago')).toBe(
      'https://www.imf.org/external/datamapper/GGXONLB_NGDP@WEO/AGO',
    );
  });

  it('does not infer a default from arrays of different lengths', () => {
    expect(getInputScenarioState([3], [3, 3]).kind).toBe('user_defined');
  });
});

describe('scenario-screen provenance wiring', () => {
  it('shows the theory of change and a provenance state for every input class', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('reasonable, adjustable defaults');
    expect(html).toContain('starting points, not recommended forecasts');
    expect(html.match(/Published WEO default/g)).toHaveLength(2);
    expect(html).toContain('WEO-derived default');
    expect(html).toContain('Explicit calculation assumption: 0.0%');
    expect(html).toContain('Sourced DSA default');
    expect(html).toContain('No probability or');
    expect(html).toContain('forecast-uncertainty bands');
  });
});

describe('methodology transparency', () => {
  it('distinguishes published, derived, assumed, and missing-coverage behavior', () => {
    const html = renderToStaticMarkup(
      <MethodologyPage onReturnToTool={() => undefined} />,
    );

    expect(html).toContain('Published WEO series');
    expect(html).toContain('Effective real interest rate is derived');
    expect(html).toContain('Real exchange-rate appreciation is assumed');
    expect(html).toContain('source value remains missing');
    expect(html).toContain('does not establish');
    expect(html).toContain('exact April 2026 workbook');
    expect(html).not.toContain('Moderate stress');
    expect(html).not.toContain('Severe stress');
  });
});
