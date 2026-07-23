import {
  auditSentence,
  derivationSentence,
  formatFxShareValue,
  frameworkLabel,
  getFxShareScenarioState,
  perimeterLabel,
  yearStatusSentence,
  type FxShareDefaultState,
} from '../fxShare';

interface Props {
  defaultState: FxShareDefaultState;
  countryName: string;
  /** Current per-year scenario values, used to distinguish reset from edits. */
  values: number[];
}

export interface FxShareFootnotePresentation {
  title: string;
  detail: string;
  tone: 'source' | 'observed-zero' | 'fallback' | 'user-defined';
}

function getFxShareFootnotePresentation(
  defaultState: FxShareDefaultState,
  countryName: string,
  values: number[],
): FxShareFootnotePresentation {
  const scenario = getFxShareScenarioState(defaultState, values);
  if (scenario.kind === 'fallback_default') {
    return {
      title: 'FX-share coverage unavailable',
      detail:
        `No reviewed DSA value is available in the current dataset for ${countryName}. ` +
        'The model starts from a 0% calculation fallback so the projection can run. ' +
        `This does not establish the actual foreign-currency debt share for ${countryName}.`,
      tone: 'fallback',
    };
  }
  if (scenario.kind === 'observed_zero_default') {
    return {
      title: 'Observed DSA value: 0.0%',
      detail:
        'The source reports an observed 0% foreign-currency share. ' +
        'This is a sourced observation, not the missing-coverage fallback. ' +
        (defaultState.kind === 'observed' ? auditSentence(defaultState.entry) : ''),
      tone: 'observed-zero',
    };
  }
  if (scenario.kind === 'user_defined') {
    const sourceContext =
      defaultState.kind === 'fallback'
        ? 'No reviewed DSA value is available in the current dataset, so the source coverage gap remains.'
        : `The sourced DSA default is ${formatFxShareValue(defaultState.entry)}.`;
    return {
      title: 'User-defined FX-share scenario',
      detail: `${sourceContext} The current slider path is a scenario assumption.`,
      tone: 'user-defined',
    };
  }
  // Sourced nonzero default at reset.
  const entry = defaultState.kind === 'observed' ? defaultState.entry : null;
  const chartTag =
    entry?.extractionMethod === 'figure' ? ' (chart-derived)' : '';
  const sentences = [
    entry ? derivationSentence(entry) : '',
    entry ? (yearStatusSentence(entry) ?? '') : '',
    'The value is held constant across the projection until changed.',
    entry ? auditSentence(entry) : '',
  ].filter(Boolean);
  return {
    title: `Sourced DSA default: ${
      entry ? formatFxShareValue(entry) : `${defaultState.modelValuePct.toFixed(1)}%`
    }${chartTag}`,
    detail: sentences.join(' '),
    tone: 'source',
  };
}

/** Provenance and coverage state for the foreign-currency-share input. */
export function FxShareFootnote({
  defaultState,
  countryName,
  values,
}: Props) {
  const presentation = getFxShareFootnotePresentation(
    defaultState,
    countryName,
    values,
  );
  const entry = defaultState.kind === 'observed' ? defaultState.entry : null;
  const pageRef = entry
    ? entry.printedPage
      ? `p. ${entry.printedPage} (PDF p. ${entry.pdfPage})`
      : `PDF p. ${entry.pdfPage}`
    : null;
  const basis = entry
    ? entry.definitionBasis === 'currency'
      ? 'currency-denomination basis'
      : 'residency basis (external debt used as an FX-share proxy)'
    : null;
  const yearLabel = entry
    ? `${entry.year} (${entry.yearStatus === 'estimate' ? 'staff estimate' : 'actual'})`
    : null;

  return (
    <p
      className={`slider-card__footnote slider-card__footnote--${presentation.tone}`}
      data-fx-share-state={presentation.tone}
      aria-live="polite"
      title={entry ? `${entry.tableRef}; ${entry.reportTitle}` : undefined}
    >
      <strong>{presentation.title}.</strong> {presentation.detail}
      {entry && (
        <>
          {' '}
          Source: {yearLabel}, {frameworkLabel(entry.framework)}, {basis},{' '}
          {perimeterLabel(entry.debtPerimeter)} perimeter.{' '}
          <a
            href={entry.publicationUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            IMF report
          </a>{' '}
          ({pageRef}).
        </>
      )}
    </p>
  );
}
