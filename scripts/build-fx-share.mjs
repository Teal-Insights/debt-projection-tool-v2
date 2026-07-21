#!/usr/bin/env node
/**
 * build-fx-share.mjs — derive src/data/fx-share.json from the adjudicated
 * DSA FX-share dataset (TEA-878 adjudication package, 2026-07-17).
 *
 * Source of truth: data/fx-share/proposed-corrected-dataset.csv, a VERBATIM
 * copy of 02-Proposed-Dataset/proposed-corrected-dataset.csv from the
 * adjudication package (sha256
 * a44dff6429d0211fff4498b8a786910cd55ee0fe4b7fc9f054cee16ed8bdfd80).
 * This script only selects and renames fields; it never edits values.
 *
 * Run: node scripts/build-fx-share.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_CSV = join(ROOT, 'data', 'fx-share', 'proposed-corrected-dataset.csv');
const OUT_JSON = join(ROOT, 'src', 'data', 'fx-share.json');
const EXPECTED_SHA256 =
  'a44dff6429d0211fff4498b8a786910cd55ee0fe4b7fc9f054cee16ed8bdfd80';
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

const raw = readFileSync(SRC_CSV, 'utf8');
const sha256 = createHash('sha256').update(raw).digest('hex');
if (sha256 !== EXPECTED_SHA256) {
  console.error(
    `FATAL: dataset hash mismatch.\n  expected ${EXPECTED_SHA256}\n  got      ${sha256}\n` +
      'The bundled CSV is no longer the verbatim adjudicated file. ' +
      'Re-copy it from the TEA-878 adjudication package or update the lock deliberately.',
  );
  process.exit(1);
}

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
  console.error(
    `FATAL: expected ${EXPECTED_ROWS} data rows, parsed ${records.length}.`,
  );
  process.exit(1);
}

/**
 * ISO-3 aliases: dataset code -> the code countries.json uses.
 * Kosovo is XKX in the DSA dataset but "kos" in the WEO extract.
 * Pure re-keying of the same country; values are untouched.
 */
const ISO_ALIASES = { xkx: 'kos' };

const countries = {};
for (const r of records) {
  if (r.metric !== 'fx_share' || r.unit !== 'pct_total_debt') {
    console.error(`FATAL: unexpected metric/unit on ${r.iso3}: ${r.metric}/${r.unit}`);
    process.exit(1);
  }
  const rawIso = r.iso3.toLowerCase();
  const iso = ISO_ALIASES[rawIso] ?? rawIso;
  if (countries[iso]) {
    console.error(`FATAL: duplicate country row for ${r.iso3}.`);
    process.exit(1);
  }
  const value = Number(r.value);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    console.error(`FATAL: value out of range for ${r.iso3}: ${r.value}`);
    process.exit(1);
  }
  countries[iso] = {
    valuePct: value,
    year: r.year, // kept as string: some reports use fiscal-year labels
    framework: r.framework, // LIC_DSF | MAC_SRDSF
    definitionBasis: r.definition_basis, // currency | residency
    debtPerimeter: r.debt_perimeter,
    isProxy: r.is_proxy === 'y',
    proxySource: r.proxy_source || null,
    confidence: r.confidence,
    reportTitle: r.report_title,
    reportDate: r.report_date,
    publicationUrl: r.publication_url,
    pdfPage: r.pdf_page,
    printedPage: r.printed_page || null,
    tableRef: r.table_ref,
  };
}

const nLic = records.filter(r => r.framework === 'LIC_DSF').length;
const nMac = records.filter(r => r.framework === 'MAC_SRDSF').length;

const out = {
  _meta: {
    name: 'DSA FX-share dataset (adjudicated)',
    description:
      'Foreign-currency share of public debt, latest actual year per country, ' +
      'extracted from the most recent published IMF DSA for each country ' +
      '(LIC-DSF and MAC SRDSF staff reports) and human-adjudicated.',
    source_csv: 'data/fx-share/proposed-corrected-dataset.csv',
    source_csv_sha256: EXPECTED_SHA256,
    source_package:
      'SovTech/Workstreams/2026-07_DSA-FX-Share-Extraction/04-Dataset/' +
      'TEA-878-adjudication-20260717/02-Proposed-Dataset (Drive)',
    row_count: records.length,
    coverage: {
      LIC_DSF: nLic,
      MAC_SRDSF: nMac,
      LIC_DSF_roster: 68,
      MAC_SRDSF_roster: 123,
    },
    generated_by: 'scripts/build-fx-share.mjs',
    linear_issue: 'TEA-880',
  },
  countries,
};

writeFileSync(OUT_JSON, JSON.stringify(out, null, 2) + '\n');
console.log(
  `Wrote ${OUT_JSON}: ${records.length} countries (LIC_DSF ${nLic}, MAC_SRDSF ${nMac}).`,
);
