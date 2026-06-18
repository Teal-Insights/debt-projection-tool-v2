import { useMemo } from 'react';
import type { CountryState, RecomputeResult, YearlySliders } from '../engine';
import {
  whereScenarioLands,
  whatsMovingTheDebt,
  whatIfYouAdjusted,
} from '../narratives';

interface Props {
  result: RecomputeResult;
  baselineResult: RecomputeResult;
  country: CountryState;
  sliders: YearlySliders;
}

/**
 * Three narrative cards that replace the year-by-year decomposition table.
 *
 *   1. Where this scenario lands — diagnosis: terminal debt vs baseline + trajectory shape
 *   2. What's moving the debt   — drivers: cumulative channel contributions (r-g, FX, pb)
 *   3. What if you adjusted…    — levers: dominant slider + two anchored counterfactuals
 *
 * Each body is wrapped in aria-live="polite" so changes announce to screen
 * readers without interrupting other narration.
 */
export function OutputCards({ result, baselineResult, country, sliders }: Props) {
  const card1 = useMemo(
    () => whereScenarioLands(result, baselineResult, country),
    [result, baselineResult, country],
  );
  const card2 = useMemo(
    () => whatsMovingTheDebt(result, country),
    [result, country],
  );
  const card3 = useMemo(
    () => whatIfYouAdjusted(country, sliders, result),
    [country, sliders, result],
  );

  return (
    <div className="output-cards">
      <article className="narrative-card">
        <h3 className="narrative-card__title">Where this scenario lands</h3>
        <p className="narrative-card__body" aria-live="polite">
          {card1}
        </p>
      </article>
      <article className="narrative-card">
        <h3 className="narrative-card__title">What's moving the debt</h3>
        <p className="narrative-card__body" aria-live="polite">
          {card2}
        </p>
      </article>
      <article className="narrative-card">
        <h3 className="narrative-card__title">What if you adjusted…</h3>
        <p className="narrative-card__body" aria-live="polite">
          {card3}
        </p>
      </article>
    </div>
  );
}
