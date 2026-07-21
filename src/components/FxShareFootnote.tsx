import type { FxShareEntry } from '../fxShare';
import { frameworkLabel, perimeterLabel } from '../fxShare';

interface Props {
  /** Sourced dataset entry, or undefined when the country has no value. */
  entry: FxShareEntry | undefined;
  countryName: string;
}

/**
 * Provenance footnote for the "Foreign currency debt share" slider card.
 *
 * Two states (TEA-880, transparency request from Plamen Iossifov, IMF SPR):
 *
 * 1. SOURCED — the default comes from the adjudicated DSA FX-share dataset.
 *    Show the value's basis (currency vs residency), the debt perimeter,
 *    the reference year, and a link to the exact page of the source report,
 *    so an IMF reader can see the definitional basis at a glance.
 *
 * 2. UNSOURCED FALLBACK — no adjudicated value exists. The default stays 0,
 *    but the zero is clearly labeled as a placeholder that switches off the
 *    FX-revaluation channel, NOT as data.
 */
export function FxShareFootnote({ entry, countryName }: Props) {
  if (!entry) {
    return (
      <p className="slider-card__footnote slider-card__footnote--fallback">
        <strong>Unsourced default.</strong> No published DSA value for{' '}
        {countryName} in the current dataset, so the default is 0% — a
        placeholder, not data. At 0% the FX-revaluation channel is switched
        off; drag the slider to explore it.
      </p>
    );
  }

  const basis =
    entry.definitionBasis === 'currency'
      ? 'currency-denomination basis'
      : 'residency basis (external debt used as a proxy for FX-denominated debt)';
  const pageRef = entry.printedPage
    ? `p. ${entry.printedPage} (PDF p. ${entry.pdfPage})`
    : `PDF p. ${entry.pdfPage}`;

  return (
    <p
      className="slider-card__footnote"
      title={`${entry.tableRef} — ${entry.reportTitle}`}
    >
      Default {entry.valuePct}% ({entry.year}) from the latest IMF{' '}
      {frameworkLabel(entry.framework)} DSA, {basis}, {perimeterLabel(entry.debtPerimeter)}{' '}
      perimeter ·{' '}
      <a
        href={entry.publicationUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        source
      </a>{' '}
      ({pageRef})
    </p>
  );
}
