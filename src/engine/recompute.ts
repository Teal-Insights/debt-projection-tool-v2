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
 * data layer supplies an explicit historical anchor plus fxShareDefault state.
 * The numeric anchor may be an observation or a tagged model fallback; callers
 * must use the attached state rather than infer provenance from the number.
 *
 * All inputs are entered as percent (e.g. 2.5 for 2.5%); the function converts
 * to decimal internally.
 *
 * Pure function — no side effects, no I/O.
 */

import type {
  RecomputeInput,
  RecomputeResult,
  YearDecomposition,
} from '../types';

const PCT_TO_DEC = 0.01;

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
    // prefer the explicit historical anchor. Adapted countries attach source
    // state separately, so a numerical 0 here does not imply an observed zero.
    // Fall back to defaults.fcuShare only for legacy callers.
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
    // FLOOR AT 0: debt-to-GDP cannot be negative — that would imply the
    // sovereign holds net financial claims (creditor regime), which is a
    // different model. At extreme favourable inputs (large surplus + high
    // growth + low rates) the unclamped identity drifts below zero; we
    // truncate at the floor and absorb the truncation into deltaPb so the
    // sum of channel deltas continues to equal (dThisYear − dPrev).
    const dRaw = dAfterFx - pb;
    const dThisYear = Math.max(0, dRaw);
    const truncated = dThisYear - dRaw; // ≥ 0; >0 only when clamped this year

    // Decomposition of Δd_t = d_t − d_{t-1} across channels (TN 2021/005 §III + §VII
    // table conventions). Each Δ is in percentage-points of GDP.
    const deltaRG = dPrev * (seesaw - 1);                // r-g channel
    const deltaFx = dAfterSeesaw * (fxMultiplier - 1);   // FX revaluation channel
    // The truncation lives in the primary-balance channel because pb is the
    // only purely additive term; r-g and FX are multiplicative on dPrev and
    // naturally collapse to 0 once dPrev hits the floor.
    const deltaPb = -pb + truncated;                      // primary balance channel
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

  return {
    path,
    decomposition,
    peak,
    endOfHorizon,
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
