/**
 * Public ES-module API for the DDT Explorer engine.
 *
 * Usage:
 *   import { recompute, type RecomputeInput, type RecomputeResult } from './engine';
 *
 * Methodology reference: IMF Technical Notes 2021/005 (Debt Dynamics Tool Guide).
 */

export { recompute } from './recompute';
export type {
  CountryIso,
  Year,
  SliderValues,
  YearlySliders,
  SliderKey,
  CountryState,
  RecomputeInput,
  RecomputeResult,
  YearDecomposition,
  FanBand,
  FanBands,
} from '../types';
