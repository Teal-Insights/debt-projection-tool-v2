/**
 * narratives.tsx — prose generators for the three Output cards.
 *
 * Each generator is a pure function from engine state → React node. Numbers
 * appear inside the prose (wrapped in <strong>) rather than as separate
 * captions, so the narrative reads as a sentence not a table.
 *
 * All three update reactively when sliders move (App.tsx wraps each call in
 * useMemo keyed on the relevant inputs).
 */

import type { ReactNode } from 'react';
import type { CountryState, RecomputeResult, YearlySliders } from '../types';
import {
  computeSensitivities,
  counterfactual,
  dominantSlider,
  SLIDER_LABEL,
  SLIDER_SUFFIX,
} from './sensitivity';

const fmt1 = (n: number) => n.toFixed(1);
const signed1 = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}`;

/* ============================================================================
 * Card 1 — Where this scenario lands
 *   Compares the user scenario's terminal debt to the baseline; describes the
 *   trajectory shape (rising / peaking mid-horizon / falling); concludes with
 *   a one-line regime call (stabilises / does not stabilise / falls).
 * ============================================================================ */
export function whereScenarioLands(
  result: RecomputeResult,
  baselineResult: RecomputeResult,
  country: CountryState,
): ReactNode {
  const startYear = country.baselineYear - 1;
  const start = country.startingDebtPct;
  const end = result.endOfHorizon.debtPct;
  const endYear = result.endOfHorizon.year;
  const peak = result.peak;
  const baselineEnd = baselineResult.endOfHorizon.debtPct;
  const deltaVsBaseline = end - baselineEnd;

  // If the projection crosses zero, the implied scenario is full repayment.
  // Surface that explicitly rather than letting the rest of the prose talk
  // about a "peak" and "trajectory" of a debt that mathematically went negative.
  const projection = result.path.filter(p => p.year >= country.baselineYear);
  const crossedZero = projection.some(p => p.debtPct <= 0);
  if (crossedZero) {
    const yearCrossed = projection.find(p => p.debtPct <= 0)?.year ?? endYear;
    return (
      <>
        Under these inputs the model implies <strong>full repayment by {yearCrossed}</strong> —
        the projected debt-to-GDP crosses zero within the horizon. Real-world fiscal
        dynamics would diverge from the identity well before this point.
      </>
    );
  }

  const verb = end >= start ? 'rises' : 'falls';

  // Sentence 1: where it goes + how it compares to baseline.
  let comparison: ReactNode;
  if (Math.abs(deltaVsBaseline) < 0.5) {
    comparison = <>matching the baseline projection</>;
  } else if (deltaVsBaseline > 0) {
    comparison = (
      <>
        <strong>{fmt1(deltaVsBaseline)}pp higher</strong> than the baseline of{' '}
        <strong>{fmt1(baselineEnd)}%</strong>
      </>
    );
  } else {
    comparison = (
      <>
        <strong>{fmt1(Math.abs(deltaVsBaseline))}pp lower</strong> than the baseline of{' '}
        <strong>{fmt1(baselineEnd)}%</strong>
      </>
    );
  }

  // Sentence 2: trajectory shape — described in terms of where the peak sits.
  const peakIsAtEnd = peak.year === endYear;
  const peakIsAtStart = peak.year === country.baselineYear;
  let shape: ReactNode;
  if (peakIsAtEnd) {
    shape = (
      <>
        Debt is still climbing at the end of the horizon, with the peak of{' '}
        <strong>{fmt1(peak.debtPct)}%</strong> in {peak.year}.
      </>
    );
  } else if (peakIsAtStart) {
    shape = (
      <>
        Debt peaks early at <strong>{fmt1(peak.debtPct)}%</strong> in {peak.year} and eases from there.
      </>
    );
  } else {
    shape = (
      <>
        Debt peaks mid-horizon at <strong>{fmt1(peak.debtPct)}%</strong> in {peak.year}, then declines.
      </>
    );
  }

  // Sentence 3: regime call based on net change over the projection.
  const firstProj = result.path.find(p => p.year === country.baselineYear)?.debtPct ?? start;
  const projChange = end - firstProj;
  let regime: string;
  if (projChange > 5) {
    regime = 'Under these inputs, debt does not stabilise within the horizon.';
  } else if (projChange > 2) {
    regime = 'Debt is still rising, but only mildly.';
  } else if (projChange < -5) {
    regime = 'Debt declines materially over the horizon.';
  } else if (projChange < -2) {
    regime = 'Debt is on a gentle downward path.';
  } else {
    regime = 'Debt stabilises near current levels.';
  }

  return (
    <>
      Debt {verb} from <strong>{fmt1(start)}%</strong> in {startYear} to{' '}
      <strong>{fmt1(end)}%</strong> by {endYear} — {comparison}.{' '}
      {shape} {regime}
    </>
  );
}

/* ============================================================================
 * Card 2 — What's moving the debt
 *   Sums the three decomposition channels over the horizon, names the dominant
 *   one, and reports the net change vs the anchor year.
 * ============================================================================ */
export function whatsMovingTheDebt(
  result: RecomputeResult,
  country: CountryState,
): ReactNode {
  const sums = result.decomposition.reduce(
    (acc, d) => ({
      rg: acc.rg + d.deltaRG,
      fx: acc.fx + d.deltaFx,
      pb: acc.pb + d.deltaPb,
    }),
    { rg: 0, fx: 0, pb: 0 },
  );

  const net = sums.rg + sums.fx + sums.pb;

  // Order channels by absolute contribution.
  const channels = [
    { name: 'interest-growth (r-g) channel', value: sums.rg, key: 'rg' },
    { name: 'FX revaluation', value: sums.fx, key: 'fx' },
    { name: 'primary balance', value: sums.pb, key: 'pb' },
  ];
  const ranked = [...channels].sort(
    (a, b) => Math.abs(b.value) - Math.abs(a.value),
  );
  const dom = ranked[0];
  const second = ranked[1];
  const third = ranked[2];

  // Dominant channel sentence.
  const domAction = dom.value >= 0 ? 'adds' : 'subtracts';
  const domSentence = (
    <>
      Over the projection horizon, the <strong>{dom.name}</strong> {domAction}{' '}
      <strong>{fmt1(Math.abs(dom.value))}pp</strong> cumulatively — the dominant force.
    </>
  );

  // Second channel: render with offsetting/compounding context if non-trivial.
  let secondSentence: ReactNode = null;
  if (Math.abs(second.value) >= 0.3) {
    const compounds = Math.sign(second.value) === Math.sign(dom.value);
    const secondAction = second.value >= 0 ? 'adds' : 'subtracts';
    secondSentence = (
      <>
        {' '}
        The <strong>{second.name}</strong> {secondAction}{' '}
        <strong>{fmt1(Math.abs(second.value))}pp</strong>
        {compounds ? ', compounding the move' : ', partially offsetting'}.
      </>
    );
  }

  // Third channel: render only if non-trivial AND not already covered above.
  let thirdSentence: ReactNode = null;
  if (Math.abs(third.value) >= 0.3) {
    const thirdAction = third.value >= 0 ? 'adds' : 'subtracts';
    thirdSentence = (
      <>
        {' '}
        The <strong>{third.name}</strong> {thirdAction}{' '}
        <strong>{fmt1(Math.abs(third.value))}pp</strong>.
      </>
    );
  }

  // FX-specific neutral note — fires when FX is negligible, so the user always
  // sees the FX-channel intuition even when FX is the smallest contributor.
  // Guard: skip if FX was already named as the dominant channel (rare edge case
  // where all channels are very small and FX happens to top the ranking).
  let fxNote: ReactNode = null;
  if (Math.abs(sums.fx) < 0.3 && dom.key !== 'fx') {
    const reason =
      country.defaults.fcuShare === 0
        ? 'no foreign-currency debt'
        : 'the FX move is small';
    fxNote = (
      <>
        {' '}
        <strong>FX revaluation is neutral</strong> ({reason}).
      </>
    );
  }

  return (
    <>
      {domSentence}
      {secondSentence}
      {thirdSentence}
      {fxNote} Net change: <strong>{signed1(net)}pp</strong> from the{' '}
      {country.baselineYear - 1} starting level.
    </>
  );
}

/* ============================================================================
 * Card 3 — What if you adjusted…
 *   Detects the slider with the highest end-of-horizon sensitivity (centred
 *   ±1pp difference), then presents two anchored counterfactuals at ±1.5pp,
 *   clamped to the slider's valid range.
 * ============================================================================ */
export function whatIfYouAdjusted(
  country: CountryState,
  sliders: YearlySliders,
  result: RecomputeResult,
): ReactNode {
  // At-the-floor guard. When the engine clamps end-of-horizon debt at 0,
  // ±1pp sensitivity measurements collapse to ~0 on the downside (debt
  // can't go below the floor), and the "robust" branch below would fire
  // with misleading framing ("your scenario is robust"). The honest read
  // is: the projection has bottomed out under these assumptions; further
  // surplus or growth doesn't move it.
  if (result.endOfHorizon.debtPct <= 0.01) {
    return (
      <>
        Debt has reached <strong>zero</strong> under these inputs — the model
        has no further downside lever. Loosen the surplus, lower the growth
        rate, or raise the interest rate to explore paths that keep debt
        above the floor.
      </>
    );
  }

  const sens = computeSensitivities(country, sliders);
  const dom = dominantSlider(sens);

  // Detect whether the user has edited any year of the dominant slider away
  // from a flat profile. If so, the "currently at X" framing in the prose
  // should clarify which year's value we're naming.
  const yearValues = sliders[dom.key];
  const isUniform = yearValues.every(v => v === yearValues[0]);
  const valueLabel = isUniform ? 'currently at' : 'in the first projection year at';

  // If the entire scenario is insensitive, point that out instead of fabricating
  // a recommendation around a slider that barely moves the projection.
  if (Math.abs(dom.perPp) < 0.5) {
    return (
      <>
        Your scenario is <strong>robust</strong> to ±1pp shifts in any single
        slider. To see meaningful changes, move multiple sliders together — or
        push individual sliders further from their defaults.
      </>
    );
  }

  const up = counterfactual(country, sliders, dom.key, +1.5);
  const down = counterfactual(country, sliders, dom.key, -1.5);

  const valFmt = (v: number) =>
    `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(1)}${SLIDER_SUFFIX[dom.key]}`;

  // If both counterfactuals clamp to the same value (current is at slider edge),
  // step back gracefully.
  if (up.proposedValue === down.proposedValue) {
    return (
      <>
        The <strong>{SLIDER_LABEL[dom.key]}</strong> is at the edge of its slider
        range. Reset the country or adjust other sliders to explore counterfactuals.
      </>
    );
  }

  return (
    <>
      Your most impactful lever is the <strong>{SLIDER_LABEL[dom.key]}</strong>,
      {' '}{valueLabel} <strong>{valFmt(dom.currentValue)}</strong>.{' '}
      Raising it to <strong>{valFmt(up.proposedValue)}</strong> would end debt
      near <strong>{fmt1(up.endDebt)}%</strong>; lowering to{' '}
      <strong>{valFmt(down.proposedValue)}</strong> would end debt near{' '}
      <strong>{fmt1(down.endDebt)}%</strong>. Each 1pp shift moves end-of-horizon
      debt by about <strong>{fmt1(Math.abs(dom.perPp))}pp</strong>.
    </>
  );
}
