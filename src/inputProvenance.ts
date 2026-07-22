export type InputDefaultKind = 'published' | 'derived' | 'assumption';

export type InputScenarioState =
  | { kind: 'default' }
  | { kind: 'user_defined' };

/**
 * Keep scenario edits separate from the origin of the reset values. A user
 * edit changes the scenario state, but it never rewrites published, derived,
 * or assumed provenance.
 */
export function getInputScenarioState(
  values: number[],
  defaultValues: number[],
): InputScenarioState {
  const unchanged =
    values.length === defaultValues.length &&
    values.every((value, index) =>
      Math.abs(value - defaultValues[index]) < Number.EPSILON,
    );
  return unchanged ? { kind: 'default' } : { kind: 'user_defined' };
}

/** Country and indicator-specific IMF DataMapper route. */
export function getWeoDataMapperUrl(
  indicator: 'GGXWDG_NGDP' | 'GGXONLB_NGDP' | 'NGDP_RPCH',
  countryIso: string,
): string {
  return `https://www.imf.org/external/datamapper/${indicator}@WEO/${countryIso.toUpperCase()}`;
}
