/**
 * recompute.ts — debt-dynamics projection engine.
 *
 * Implements the debt-accumulation identity per IMF Technical Notes 2021/005,
 * Section III, in its 2012 real-terms shorthand:
 *
 *   d_t = d_{t-1} × (1 + r_t) / (1 + g_t) × ((1 − s_{t-1}) + s_{t-1} / (1 + z_t)) − pb_t
 *
 * Note the subscripts: r, g, z, and pb are at time t (current year). The FCU
 * share s appears as s_{t-1} — the **end-of-prior-year** share, which is the
 * composition of the debt stock that the year-t exchange-rate change revalues.
 *
 * Year-by-year inputs: the engine reads sliders.<key>[i] for each projection
 * step i (i = 0 corresponds to baselineYear). For s_{t-1} at i = 0, the
 * historical anchor (country.defaults.fcuShare) is used as a proxy until the
 * data layer provides a separate historical s field.
 *
 * All inputs are entered as percent (e.g. 2.5 for 2.5%); the function converts
 * to decimal internally.
 *
 * Pure function — no side effects, no I/O.
 */

import type {
  FanBand,
  RecomputeInput,
  RecomputeResult,
  YearDecomposition,
} from '../types';

const PCT_TO_DEC = 0.01;

/** Standard normal z-scores for two-sided confidence intervals. */
const Z_95 = 1.96;
const Z_90 = 1.645;

export function recompute(input: RecomputeInput): RecomputeResult {
  const { country, sliders } = input;
  const horizonYears = input.horizonYears ?? 6;
  const methodology = input.methodology ?? 'fc2012';

  // Historical points, ordered chronologically and ending at baselineYear − 1.
  const historical = [...country.historical].sort((a, b) => a.year - b.year);

  const path: Array<{ year: number; debtPct: number }> = historical.map(p => ({
    year: p.year,
    debtPct: p.debtPct,
  }));
  // Anchor: starting d_{t-1} for the first projected step is country.startingDebtPct.
  const anchorYear = country.baselineYear - 1;
  if (path.length === 0 || path[path.length - 1].year !== anchorYear) {
    path.push({ year: anchorYear, debtPct: country.startingDebtPct });
  }

  const decomposition: YearDecomposition[] = [];

  let dPrev = country.startingDebtPct;
  for (let i = 0; i < horizonYears; i += 1) {
    const year = country.baselineYear + i;

    // Year-t inputs: r, g, z, pb at the current year.
    const r = readYear(sliders.realInterestRate, i) * PCT_TO_DEC;
    const g = readYear(sliders.realGdpGrowth, i) * PCT_TO_DEC;
    const z = readYear(sliders.realFxAppreciation, i) * PCT_TO_DEC;
    const pb = readYear(sliders.primaryBalance, i); // remains in pp of GDP

    // s_{t-1}: prior-year FCU share — the composition of the debt stock that
    // year-t exchange-rate movement revalues. For i = 0 (first projection year),
    // prefer the explicit historical anchor; fall back to defaults.fcuShare as
    // a proxy when historicalFcuShare is not provided.
    const sPrev =
      (i === 0
        ? (country.historicalFcuShare ?? country.defaults.fcuShare)
        : readYear(sliders.fcuShare, i - 1)) * PCT_TO_DEC;

    // Apply the identity per IMF Technical Notes 2021/005 §III, 2012 shorthand.

    // r-g seesaw: (1 + r_t) / (1 + g_t). TN 2021/005 §III, the "automatic" debt
    // dynamics multiplier capturing the interest–growth differential.
    const seesaw = (1 + r) / (1 + g);

    // FX revaluation multiplier: (1 − s_{t-1}) + s_{t-1} / (1 + z_t). TN 2021/005 §III;
    // s_{t-1} is the end-of-prior-year FCU share — the composition of the debt stock
    // that year-t exchange-rate movement revalues.
    const fxMultiplier = (1 - sPrev) + sPrev / (1 + z);

    const dAfterSeesaw = dPrev * seesaw;
    const dAfterFx = dAfterSeesaw * fxMultiplier;

    // Primary balance subtracts directly in percent-of-GDP terms (TN 2021/005 §III).
    const dThisYear = dAfterFx - pb;

    // Decomposition of Δd_t = d_t − d_{t-1} across channels (TN 2021/005 §III + §VII
    // table conventions). Each Δ is in percentage-points of GDP.
    const deltaRG = dPrev * (seesaw - 1);                // r-g channel
    const deltaFx = dAfterSeesaw * (fxMultiplier - 1);   // FX revaluation channel
    const deltaPb = -pb;                                  // primary balance channel
    // deltaOther: TN 2021/005 §III "other identified debt-creating flows" residual.
    // Hard-coded to 0 in both methodology branches today — the LCU/FCU rate split
    // and stock-flow residual from the 2021 full identity are iteration-2 work.
    const deltaOther = methodology === 'imf2021' ? 0 : 0;

    path.push({ year, debtPct: dThisYear });
    decomposition.push({
      year,
      debtPct: dThisYear,
      deltaRG,
      deltaFx,
      deltaPb,
      deltaOther,
    });

    dPrev = dThisYear;
  }

  // Identify peak (within projection, excluding the historical anchor).
  const projected = path.filter(p => p.year >= country.baselineYear);
  const peak = projected.reduce(
    (best, p) => (p.debtPct > best.debtPct ? p : best),
    projected[0],
  );
  const endOfHorizon = projected[projected.length - 1];

  // Fan bands: 95% and 90% confidence intervals, anchored at the last historical
  // year (baselineYear − 1) with zero width, widening across the projection.
  // Width grows as σ × √(years forward from the anchor) — random-walk widening.
  // Placeholder calibration: σ derived from the historical debt-to-GDP series.
  const sigmaPerStep = historicalStdDev(historical.map(p => p.debtPct));

  const anchorPoint = { year: anchorYear, debtPct: country.startingDebtPct };
  const fanPoints = [anchorPoint, ...projected];

  // Fan-band lower bounds are floored at 0: a confidence band on debt-to-GDP
  // shouldn't dip into negative territory (debt cannot be negative as a stock).
  const ci95: FanBand = fanPoints.map((p, idx) => {
    const sigma_t = sigmaPerStep * Math.sqrt(idx);
    return {
      year: p.year,
      lower: Math.max(0, p.debtPct - Z_95 * sigma_t),
      upper: p.debtPct + Z_95 * sigma_t,
    };
  });
  const ci90: FanBand = fanPoints.map((p, idx) => {
    const sigma_t = sigmaPerStep * Math.sqrt(idx);
    return {
      year: p.year,
      lower: Math.max(0, p.debtPct - Z_90 * sigma_t),
      upper: p.debtPct + Z_90 * sigma_t,
    };
  });

  return {
    path,
    decomposition,
    peak,
    endOfHorizon,
    fanBands: { ci95, ci90 },
    methodology,
  };
}

/** Read a year-indexed slider value, with fall-back to last/first when out of range. */
function readYear(arr: number[], i: number): number {
  if (arr.length === 0) return 0;
  if (i < 0) return arr[0];
  if (i >= arr.length) return arr[arr.length - 1];
  return arr[i];
}

/** Sample standard deviation (n−1 denominator). */
function historicalStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sqDiffs = values.map(v => (v - mean) ** 2);
  const variance = sqDiffs.reduce((a, b) => a + b, 0) / (values.length - 1);
  return Math.sqrt(variance);
}
