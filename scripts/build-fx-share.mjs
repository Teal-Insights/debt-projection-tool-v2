#!/usr/bin/env node
/**
 * build-fx-share.mjs — derive src/data/fx-share.json from the adjudicated
 * DSA FX-share dataset plus the QA overlay.
 *
 * Sources of truth:
 *  - data/fx-share/proposed-corrected-dataset.csv — dataset v0.1.2: the
 *    TEA-878 adjudicated final (row-identical to the TEA-879 publication
 *    candidate dataset-final.csv) plus the six TEA-880 QA corrections of
 *    2026-07-23 (BWA, GAB, KWT, LBN, SVK, KIR), each documented in its
 *    notes field. Hash-locked below.
 *  - data/fx-share/qa-overlay.json — per-country year status (actual vs
 *    staff estimate), derivation transparency (the arithmetic behind each
 *    share), and the 2026-07-23 independent-audit outcome. Chained to the
 *    CSV by sha256.
 *
 * This script selects, renames, merges, and VALIDATES; it never edits
 * values. Validation is a build gate: any arithmetic that fails to
 * reproduce a shipped value fails the build. Run: node scripts/build-fx-share.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_CSV = join(ROOT, 'data', 'fx-share', 'proposed-corrected-dataset.csv');
const SRC_OVERLAY = join(ROOT, 'data', 'fx-share', 'qa-overlay.json');
const OUT_JSON = join(ROOT, 'src', 'data', 'fx-share.json');
const EXPECTED_SHA256 =
  'e74f12d457a9af717508c447edf661dd01e3dc03ce6bdcb798e800fd63489f18';
const EXPECTED_ROWS = 167;

/** Minimal RFC-4180 CSV parser (handles quoted fields, embedded commas,
 *  escaped quotes, and embedded newlines). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

function fatal(msg) {
  console.error(`FATAL: ${msg}`);
  process.exit(1);
}

const raw = readFileSync(SRC_CSV, 'utf8');
const sha256 = createHash('sha256').update(raw).digest('hex');
if (sha256 !== EXPECTED_SHA256) {
  fatal(
    `dataset hash mismatch.\n  expected ${EXPECTED_SHA256}\n  got      ${sha256}\n` +
      'The bundled CSV is no longer the locked v0.1.2 dataset. ' +
      'Re-generate it from the adjudication pipeline or update the lock deliberately.',
  );
}

const overlayFile = JSON.parse(readFileSync(SRC_OVERLAY, 'utf8'));
if (overlayFile._meta?.dataset_csv_sha256 !== sha256) {
  fatal(
    'qa-overlay.json was generated for a different CSV ' +
      `(overlay lock ${overlayFile._meta?.dataset_csv_sha256}, csv ${sha256}). ` +
      'Regenerate the overlay for this dataset version.',
  );
}
const overlay = overlayFile.countries;

const rows = parseCsv(raw);
const header = rows[0];
const records = rows.slice(1).map(r => {
  const o = {};
  header.forEach((h, i) => {
    o[h] = r[i] ?? '';
  });
  return o;
});

if (records.length !== EXPECTED_ROWS) {
  fatal(`expected ${EXPECTED_ROWS} data rows, parsed ${records.length}.`);
}

/**
 * ISO-3 aliases: dataset code -> the code countries.json uses.
 * Kosovo is XKX in the DSA dataset but "kos" in the WEO extract.
 * Pure re-keying of the same country; values are untouched.
 */
const ISO_ALIASES = { xkx: 'kos' };

/** Validation tolerances, by derivation kind. Ratio components are printed
 *  numbers, so the share must reproduce to one decimal; figure components
 *  are chart measurements, so a 1.0pp tolerance absorbs band-edge reads. */
const RATIO_TOL = 0.06;
const FIGURE_TOL = 1.0;

const countries = {};
const auditCounts = {};
for (const r of records) {
  if (r.metric !== 'fx_share' || r.unit !== 'pct_total_debt') {
    fatal(`unexpected metric/unit on ${r.iso3}: ${r.metric}/${r.unit}`);
  }
  const rawIso = r.iso3.toLowerCase();
  const iso = ISO_ALIASES[rawIso] ?? rawIso;
  if (countries[iso]) fatal(`duplicate country row for ${r.iso3}.`);
  const value = Number(r.value);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    fatal(`value out of range for ${r.iso3}: ${r.value}`);
  }
  const proxy = r.is_proxy === 'y';
  if (proxy !== (r.definition_basis === 'residency')) {
    fatal(`proxy/basis invariant broken for ${r.iso3}.`);
  }
  if (r.extraction_method === 'figure' && r.confidence === 'high') {
    fatal(`figure-sourced row with high confidence for ${r.iso3}.`);
  }

  const ov = overlay[rawIso.toLowerCase()] ?? overlay[iso];
  if (!ov) fatal(`no QA-overlay entry for ${r.iso3}.`);
  const d = ov.derivation;
  if (!d || !['ratio', 'figure', 'direct'].includes(d.kind)) {
    fatal(`bad derivation kind for ${r.iso3}.`);
  }
  if (d.kind === 'direct' && Math.abs((d.printedSharePct ?? NaN) - value) > 0.05) {
    fatal(`direct derivation does not match value for ${r.iso3}.`);
  }
  if ((d.kind === 'ratio' || d.kind === 'figure') && d.numeratorPctGdp != null && d.denominatorPctGdp != null) {
    if (d.denominatorPctGdp === 0) fatal(`zero denominator for ${r.iso3}.`);
    const recomputed = (d.numeratorPctGdp / d.denominatorPctGdp) * 100;
    const tol = d.kind === 'ratio' ? RATIO_TOL : FIGURE_TOL;
    if (
      Math.abs(Math.round(recomputed * 10) / 10 - Math.round(value * 10) / 10) > tol &&
      Math.abs(recomputed - value) > tol
    ) {
      fatal(
        `derivation does not reproduce value for ${r.iso3}: ` +
          `${d.numeratorPctGdp}/${d.denominatorPctGdp}*100=${recomputed.toFixed(2)} vs ${value}`,
      );
    }
  }
  if (!['actual', 'estimate'].includes(ov.yearStatus)) {
    fatal(`bad yearStatus for ${r.iso3}: ${ov.yearStatus}`);
  }

  auditCounts[ov.audit.outcome] = (auditCounts[ov.audit.outcome] ?? 0) + 1;

  countries[iso] = {
    valuePct: value,
    year: r.year, // kept as string: some reports use fiscal-year labels
    yearStatus: ov.yearStatus, // 'actual' | 'estimate' (staff estimate column)
    framework: r.framework, // LIC_DSF | MAC_SRDSF
    definitionBasis: r.definition_basis, // currency | residency
    debtPerimeter: r.debt_perimeter,
    isProxy: proxy,
    proxySource: r.proxy_source || null,
    confidence: r.confidence,
    extractionMethod: r.extraction_method, // table | text | figure
    derivation: {
      kind: d.kind, // ratio | figure | direct
      numeratorPctGdp: d.numeratorPctGdp ?? null,
      denominatorPctGdp: d.denominatorPctGdp ?? null,
      printedSharePct: d.printedSharePct ?? null,
      note: d.note ?? null,
    },
    audit: {
      outcome: ov.audit.outcome, // CONFIRMED | CONFIRMED_APPROX | CORRECTED
      date: ov.audit.date,
      independentValuePct: ov.audit.independentValuePct ?? null,
      provenanceFixed: ov.audit.provenanceFixed ?? false,
      note: ov.audit.note ?? null,
    },
    latestActualAlternativePct: ov.latestActualAlternativePct ?? null,
    reportTitle: r.report_title,
    reportDate: r.report_date,
    publicationUrl: r.publication_url,
    pdfPage: r.pdf_page,
    printedPage: r.printed_page || null,
    tableRef: r.table_ref,
  };
}

for (const iso of Object.keys(overlay)) {
  const mapped = ISO_ALIASES[iso] ?? iso;
  if (!countries[mapped]) fatal(`overlay entry ${iso} has no dataset row.`);
}

const nLic = records.filter(r => r.framework === 'LIC_DSF').length;
const nMac = records.filter(r => r.framework === 'MAC_SRDSF').length;
const nEstimate = Object.values(countries).filter(c => c.yearStatus === 'estimate').length;
const nFigure = Object.values(countries).filter(c => c.extractionMethod === 'figure').length;

const out = {
  _meta: {
    name: 'DSA FX-share dataset (adjudicated + audited)',
    description:
      'Foreign-currency share of public debt, latest available eligible observation per country ' +
      '(actual or staff estimate, labeled), extracted from the most recent published IMF DSA for ' +
      'each country (LIC-DSF and MAC SRDSF staff reports), human-adjudicated, and independently ' +
      'audited against every cited source page.',
    dataset_version: 'v0.1.2',
    source_csv: 'data/fx-share/proposed-corrected-dataset.csv',
    source_csv_sha256: EXPECTED_SHA256,
    source_package:
      'TEA-878 adjudicated final (row-identical to TEA-879 dataset-final.csv) ' +
      'plus TEA-880 QA corrections of 2026-07-23 (BWA, GAB, KWT, LBN, SVK, KIR)',
    qa_overlay: 'data/fx-share/qa-overlay.json',
    qa_audit: {
      date: overlayFile._meta.audit_date,
      coverage: 'all 167 cited source pages independently re-read',
      outcomes: auditCounts,
    },
    policy: overlayFile._meta.policy,
    row_count: records.length,
    coverage: {
      LIC_DSF: nLic,
      MAC_SRDSF: nMac,
      LIC_DSF_roster: 68,
      MAC_SRDSF_roster: 123,
      estimate_year_rows: nEstimate,
      figure_sourced_rows: nFigure,
    },
    generated_by: 'scripts/build-fx-share.mjs',
    linear_issue: 'TEA-880',
  },
  countries,
};

writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n');
console.log(
  `Wrote ${OUT_JSON}: ${records.length} countries ` +
    `(LIC_DSF ${nLic}, MAC_SRDSF ${nMac}; ${nFigure} figure-sourced, ${nEstimate} estimate-year). ` +
    `Audit outcomes: ${JSON.stringify(auditCounts)}.`,
);
