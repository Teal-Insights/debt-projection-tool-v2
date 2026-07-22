import {
  getInputScenarioState,
  type InputDefaultKind,
} from '../inputProvenance';

interface Props {
  kind: InputDefaultKind;
  defaultTitle: string;
  defaultDetail: string;
  values: number[];
  defaultValues: number[];
  sourceUrl?: string;
  sourceLabel?: string;
  methodologyLabel?: string;
  onMethodology: () => void;
}

/** Visible source and scenario state for a non-FX-share input. */
export function InputProvenanceNote({
  kind,
  defaultTitle,
  defaultDetail,
  values,
  defaultValues,
  sourceUrl,
  sourceLabel = 'Open source',
  methodologyLabel = 'Methodology',
  onMethodology,
}: Props) {
  const scenarioState = getInputScenarioState(values, defaultValues);
  const isEdited = scenarioState.kind === 'user_defined';

  return (
    <p
      className={`slider-card__footnote slider-card__footnote--${
        isEdited ? 'user-defined' : kind
      }`}
      data-input-default-kind={kind}
      data-input-scenario-state={scenarioState.kind}
      aria-live="polite"
    >
      <strong>{isEdited ? 'User-defined scenario' : defaultTitle}.</strong>{' '}
      {isEdited
        ? `The current path includes user changes. Reset provenance: ${defaultTitle.toLowerCase()}. `
        : ''}
      {defaultDetail}{' '}
      {sourceUrl && (
        <>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            {sourceLabel}
          </a>
          .{' '}
        </>
      )}
      <button
        type="button"
        className="slider-card__footnote-link"
        onClick={onMethodology}
      >
        {methodologyLabel}
      </button>
      .
    </p>
  );
}
