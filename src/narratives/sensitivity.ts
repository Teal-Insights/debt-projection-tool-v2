/**
 * sensitivity.ts — what-if engine for the "What if you adjusted…" card.
 *
 * For a given country + slider state, computes how much end-of-horizon debt
 * moves per +1pp uniform shift in each slider. The narrative picks the most
 * impactful lever and presents two anchored counterfactuals.
 *
 * Pure function — no side effects, no React. Calls `recompute` only.
 */

import { recompute } from '../engine';
import type { CountryState, SliderKey, YearlySliders } from '../types';

const HORIZON_YEARS = 6;

/**
 * Slider ranges (must mirror the bounds set on each <SliderRow/> in App.tsx).
 * Used to clamp counterfactual proposals so we never suggest a value outside
 * what the user could actually drag to.
 */
export const SLIDER_RANGE: Record<SliderKey, { min: number; max: number }> = {
  realGdpGrowth: { min: -15, max: 15 },
  realInterestRate: { min: -10, max: 20 },
  primaryBalance: { min: -15, max: 15 },
  realFxAppreciation: { min: -50, max: 50 },
  fcuShare: { min: 0, max: 100 },
};

/** Human-readable name for each slider — used in narrative prose. */
export const SLIDER_LABEL: Record<SliderKey, string> = {
  realGdpGrowth: 'real GDP growth rate',
  realInterestRate: 'effective real interest rate',
  primaryBalance: 'primary balance',
  realFxAppreciation: 'real exchange-rate appreciation',
  fcuShare: 'foreign-currency debt share',
};

/** Unit suffix to display after slider values in prose (e.g. "−2.5%"). */
export const SLIDER_SUFFIX: Record<SliderKey, string> = {
  realGdpGrowth: '%',
  realInterestRate: '%',
  primaryBalance: '% of GDP',
  realFxAppreciation: '%',
  fcuShare: '%',
};

const ALL_KEYS: SliderKey[] = [
  'primaryBalance',
  'realGdpGrowth',
  'realInterestRate',
  'realFxAppreciation',
  'fcuShare',
];

export interface Sensitivity {
  key: SliderKey;
  /** End-of-horizon debt change per +1pp uniform shift. Signed. */
  perPp: number;
  /** Current value (first projection year — sliders are constant at defaults until edited). */
  currentValue: number;
}

/** Uniform shift across all projection years for one slider. */
function shiftSlider(
  sliders: YearlySliders,
  key: SliderKey,
  shift: number,
): YearlySliders {
  return { ...sliders, [key]: sliders[key].map(v => v + shift) };
}

/** Compute end-of-horizon debt for a scenario. Memoised by callers via useMemo. */
export function endOfHorizonDebt(
  country: CountryState,
  sliders: YearlySliders,
): number {
  return recompute({ country, sliders, horizonYears: HORIZON_YEARS }).endOfHorizon
    .debtPct;
}

/**
 * For every slider, measure end-of-horizon debt change from a ±1pp uniform
 * shift (centred difference). Returns one Sensitivity per slider.
 */
export function computeSensitivities(
  country: CountryState,
  sliders: YearlySliders,
): Sensitivity[] {
  return ALL_KEYS.map(key => {
    const up = endOfHorizonDebt(country, shiftSlider(sliders, key, +1));
    const down = endOfHorizonDebt(country, shiftSlider(sliders, key, -1));
    const perPp = (up - down) / 2;
    return { key, perPp, currentValue: sliders[key][0] };
  });
}

/**
 * Pick the slider with the largest absolute sensitivity. Ties broken by the
 * priority order in ALL_KEYS (primary balance first — the usual policy lever).
 */
export function dominantSlider(sens: Sensitivity[]): Sensitivity {
  return sens.reduce((best, s) =>
    Math.abs(s.perPp) > Math.abs(best.perPp) ? s : best,
  );
}

/**
 * Counterfactual at `currentValue + shift`, clamped to the slider's range.
 * Returns the proposed value AND the resulting end-of-horizon debt.
 */
export function counterfactual(
  country: CountryState,
  sliders: YearlySliders,
  key: SliderKey,
  shift: number,
): { proposedValue: number; endDebt: number; clamped: boolean } {
  const range = SLIDER_RANGE[key];
  const raw = sliders[key][0] + shift;
  const proposedValue = Math.max(range.min, Math.min(range.max, raw));
  const clamped = proposedValue !== raw;
  const endDebt = endOfHorizonDebt(
    country,
    shiftSlider(sliders, key, proposedValue - sliders[key][0]),
  );
  return { proposedValue, endDebt, clamped };
}
