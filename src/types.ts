/**
 * Shared types for the DDT Explorer.
 *
 * Methodology reference: IMF Technical Notes 2021/005 (Debt Dynamics Tool Guide).
 * The 2012 simplified shorthand used by default mirrors the FT Tool's displayed identity.
 */

/** ISO-3 country code, lowercase (e.g. "gbr", "usa"). */
export type CountryIso = string;

/** Calendar year (e.g. 2014). */
export type Year = number;

/** The five user-controllable macro inputs as scalars (used in country defaults). */
export interface SliderValues {
  /** Real GDP growth rate, percent. Slider variable `g`. */
  realGdpGrowth: number;
  /** Effective real interest rate, percent. Slider variable `r`. */
  realInterestRate: number;
  /** Primary budget balance, percent of GDP. Slider variable `pb`. */
  primaryBalance: number;
  /** Real exchange-rate appreciation, percent. Slider variable `z`. */
  realFxAppreciation: number;
  /** Foreign-currency debt share, percent of total. Slider variable `s`. */
  fcuShare: number;
}

/**
 * Per-year values for each slider. Each array has length = horizonYears.
 * Element i corresponds to projection year baselineYear + i.
 * This is the shape the engine consumes.
 */
export interface YearlySliders {
  realGdpGrowth: number[];
  realInterestRate: number[];
  primaryBalance: number[];
  realFxAppreciation: number[];
  fcuShare: number[];
}

/** Keys of YearlySliders. */
export type SliderKey = keyof YearlySliders;

/** Per-country starting state required to run the projection. */
export interface CountryState {
  iso: CountryIso;
  name: string;
  /** First year of the projection (e.g. 2014). */
  baselineYear: Year;
  /** Debt-to-GDP at the end of the year before baselineYear (i.e. d_{t-1} for the first step). */
  startingDebtPct: number;
  /** Historical debt-to-GDP series, ordered by year, ending at year (baselineYear − 1). */
  historical: Array<{ year: Year; debtPct: number }>;
  /** Default slider values at the baseline year (WEO projections). */
  defaults: SliderValues;
  /**
   * Foreign-currency debt share at the end of (baselineYear − 1), percent.
   * This is s_{t-1} for the first projection step — the composition of the debt
   * stock the year-t FX move revalues. Optional: when absent, the engine falls
   * back to `defaults.fcuShare` as a proxy. To be populated from authoritative
   * data in the WEO populate task.
   */
  historicalFcuShare?: number;
  /**
   * Year-by-year debt-to-GDP projection published by the WEO, from baselineYear
   * through the last projection year (e.g., 2026–2031 for WEO April 2026). v2
   * draws this as the chart's baseline line directly — the user's projection
   * line (engine output) is then compared against this WEO-published path.
   */
  baselineProjection?: Array<{ year: Year; debtPct: number }>;
  /**
   * Per-year slider defaults across the projection horizon (length = horizonYears).
   * Each indicator carries an array of values, one per projection year. When
   * provided, the app uses these directly as the initial slider state rather
   * than expanding the scalar `defaults` into flat arrays. This is what makes
   * the engine's projection at defaults match the WEO baselineProjection exactly
   * across every year — `realInterestRate[i]` is back-solved per year against
   * WEO's own published d_t.
   */
  yearlyDefaults?: YearlySliders;
}

/** Full engine input. */
export interface RecomputeInput {
  country: CountryState;
  /** Per-year slider values (arrays of length horizonYears). */
  sliders: YearlySliders;
  /** How many years to project forward from baselineYear (inclusive). Defaults to 6. */
  horizonYears?: number;
  /** Which version of the identity to apply. Defaults to "2012". */
  methodology?: 'fc2012' | 'imf2021';
}

/** Per-year decomposition of the debt change. All numbers are percentage-point contributions. */
export interface YearDecomposition {
  year: Year;
  debtPct: number;
  /** Contribution from the (r − g) seesaw. */
  deltaRG: number;
  /** Contribution from the foreign-currency exchange-rate channel. */
  deltaFx: number;
  /** Contribution from the primary balance. */
  deltaPb: number;
  /** Residual contribution from `other debt-creating flows` (zero in the 2012 shorthand). */
  deltaOther: number;
}

/** A single fan band: per-year lower/upper bounds. */
export type FanBand = Array<{ year: Year; lower: number; upper: number }>;

/**
 * Two nested fan bands derived from a deterministic shock envelope. Both
 * are anchored at baselineYear − 1 (zero width) and widen forward.
 *
 * Width calibration: the identity is re-run on WEO's own baseline inputs
 * (`yearlyDefaults`) with adverse and favorable shifts applied to g, r, and
 * pb simultaneously. The deltas between the shifted runs and the baseline
 * run become the per-year widths — and those widths are then applied as
 * **parallel shifts** to the user's central path. So as the user moves
 * sliders, the bands translate with the central line by the same Δ; the
 * band width itself is invariant to slider state. This mirrors how the
 * FT 2014 visualization renders its precomputed percentile bands.
 */
export interface FanBands {
  /** Moderate stress envelope (±1 pp / ±1 % of GDP shifts to g, r, pb). */
  innerBand: FanBand;
  /** Severe stress envelope (±2 pp / ±2 % of GDP shifts to g, r, pb). */
  outerBand: FanBand;
}

/** Engine output. */
export interface RecomputeResult {
  /** Year-by-year projection (length = historical.length + horizonYears, starting at the earliest historical year). */
  path: Array<{ year: Year; debtPct: number }>;
  /** Year-by-year decomposition (projection years only). */
  decomposition: YearDecomposition[];
  /** Peak point of the projected path (excluding the historical anchor). */
  peak: { year: Year; debtPct: number };
  /** End-of-horizon point. */
  endOfHorizon: { year: Year; debtPct: number };
  /** Two nested fan bands (95% and 90%). Both anchored at baselineYear − 1 with zero width. */
  fanBands: FanBands;
  /** Methodology used. */
  methodology: 'fc2012' | 'imf2021';
}
