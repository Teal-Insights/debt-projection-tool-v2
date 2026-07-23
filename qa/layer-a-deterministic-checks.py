#!/usr/bin/env python3
"""Layer A deterministic QA over the adjudicated FX-share dataset.

Checks, per row:
  A1 arithmetic: parse the notes' visible-arithmetic expression, recompute
     numerator/denominator, compare with the note's own result AND the
     shipped value (1-dp rounding tolerance).
  A2 direct statements: rows without a division expression must carry a
     direct share statement consistent with the value.
  A3 metadata invariants: unit/metric, value range, proxy<->residency,
     proxy_source presence, framework enum, confidence enum, page fields.
  A4 year sanity: numeric year vs report_date gap; flag negative or >3y.
  A5 estimate-column flag: notes language indicating the chosen column is
     an estimate or projection ("Est.", "estimate", "projection").
  A6 WEO cross-check: parsed total-debt denominator vs WEO GGXWDG_NGDP
     for general-government rows with year 2022-2025 (informational).
Outputs /tmp/qa/layer-a-results.json and a console summary.
"""
import csv
import json
import re
from collections import Counter

CSV_PATH = '/tmp/dpt2/data/fx-share/proposed-corrected-dataset.csv'
WEO_PATH = '/tmp/dpt2/src/data/countries.json'
OUT_PATH = '/tmp/qa/layer-a-results.json'

rows = list(csv.DictReader(open(CSV_PATH)))
weo = json.load(open(WEO_PATH))['countries']
weo_hist = {}
for iso, c in weo.items() if isinstance(weo, dict) else []:
    pass
if isinstance(weo, list):
    for c in weo:
        weo_hist[c['iso'].upper()] = {h['year']: h['debtPct'] for h in c.get('historical', [])}
else:
    for iso, c in weo.items():
        weo_hist[iso.upper()] = {h['year']: h['debtPct'] for h in c.get('historical', [])}

NUM = r'(\d[\d,]*\.?\d*)'


def fnum(s):
    return float(s.replace(',', ''))


def norm(text):
    return (text.replace('×', 'x').replace('÷', '/')
            .replace('−', '-').replace('–', '-'))


def parse_arithmetic(notes):
    """Return list of (num, den, stated_result) tuples found in notes."""
    t = norm(notes)
    out = []
    for m in re.finditer(NUM + r'\s*/\s*' + NUM + r'\s*(?:x|\*)\s*100\s*=\s*' + NUM, t):
        out.append((fnum(m.group(1)), fnum(m.group(2)), fnum(m.group(3))))
    for m in re.finditer(r'100\s*(?:x|\*)\s*' + NUM + r'\s*/\s*' + NUM + r'\s*=\s*' + NUM, t):
        out.append((fnum(m.group(1)), fnum(m.group(2)), fnum(m.group(3))))
    # "A / B x 100 = C percent" with div sign already normalised; also
    # "A รท B" handled by norm. Bare "A / B = C" (no x100):
    for m in re.finditer(NUM + r'\s*/\s*' + NUM + r'\s*=\s*' + NUM, t):
        a, b, c = fnum(m.group(1)), fnum(m.group(2)), fnum(m.group(3))
        if b != 0 and abs(a / b * 100 - c) < 0.2:
            out.append((a, b, c))
    return out


def parse_direct(notes, value):
    """Direct share statements consistent with value."""
    t = norm(notes)
    hits = []
    for m in re.finditer(NUM + r'\s*(?:percent|%)', t):
        hits.append(fnum(m.group(1)))
    return [h for h in hits if abs(h - value) < 0.05]


results = []
for r in rows:
    iso = r['iso3']
    value = float(r['value'])
    notes = r['notes']
    rec = {'iso': iso, 'value': value, 'method': r['extraction_method'],
           'confidence': r['confidence'], 'framework': r['framework'],
           'flags': [], 'info': []}

    # A1 arithmetic
    exprs = parse_arithmetic(notes)
    matched = None
    for a, b, c in exprs:
        if b == 0:
            rec['flags'].append(f'A1 zero denominator in notes: {a}/{b}={c}')
            continue
        recomputed = a / b * 100
        if abs(round(recomputed, 1) - round(value, 1)) < 0.06:
            matched = (a, b, c, recomputed)
            if abs(recomputed - c) > 0.15 and abs(round(recomputed, 1) - round(c, 1)) > 0.05:
                rec['flags'].append(
                    f'A1 note-internal mismatch: {a}/{b}*100={recomputed:.2f} but note states {c}')
            break
    if matched:
        rec['arith'] = {'num': matched[0], 'den': matched[1],
                        'stated': matched[2], 'recomputed': round(matched[3], 2)}
        rec['info'].append('A1 arithmetic reproduces shipped value')
    elif exprs:
        stated = ', '.join(f'{a}/{b}={c}' for a, b, c in exprs)
        rec['flags'].append(
            f'A1 arithmetic present but does NOT reproduce value {value}: {stated}')
    else:
        # A2 direct statement
        direct = parse_direct(notes, value)
        if direct:
            rec['info'].append('A2 direct share statement matches value')
        elif value == 0.0 and re.search(r'0\.0 percent|zero', norm(notes), re.I):
            rec['info'].append('A2 zero-share statement present')
        else:
            rec['flags'].append('A2 no arithmetic and no direct statement matching value')

    # A3 metadata
    if r['metric'] != 'fx_share' or r['unit'] != 'pct_total_debt':
        rec['flags'].append('A3 metric/unit unexpected')
    if not (0 <= value <= 100):
        rec['flags'].append('A3 value out of range')
    proxy = r['is_proxy'] == 'y'
    if proxy != (r['definition_basis'] == 'residency'):
        rec['flags'].append(
            f"A3 proxy/basis invariant broken: is_proxy={r['is_proxy']} basis={r['definition_basis']}")
    if proxy and not r['proxy_source']:
        rec['flags'].append('A3 proxy without proxy_source')
    if r['framework'] not in ('LIC_DSF', 'MAC_SRDSF'):
        rec['flags'].append('A3 bad framework')
    if r['confidence'] not in ('high', 'medium', 'low'):
        rec['flags'].append('A3 bad confidence')
    if not r['pdf_page'].isdigit() or int(r['pdf_page']) < 1:
        rec['flags'].append('A3 bad pdf_page')
    if not r['publication_url'].startswith('https://'):
        rec['flags'].append('A3 bad publication_url')
    if r['extraction_method'] == 'figure' and r['confidence'] == 'high':
        rec['flags'].append('A3 figure-sourced row with high confidence (cap is below high)')

    # A4 year sanity
    ym = re.match(r'^(\d{4})', r['year'])
    if ym:
        y = int(ym.group(1))
        rec['year_num'] = y
        rep = int(r['report_date'][:4]) if r['report_date'][:4].isdigit() else None
        if rep is not None:
            gap = rep - y
            if gap < 0:
                rec['flags'].append(f'A4 year {y} after report date {rep}')
            elif gap > 3:
                rec['info'].append(f'A4 stale anchor: year {y}, report {rep}')
    else:
        rec['info'].append(f"A4 non-numeric year label: {r['year']}")

    # A5 estimate-column language
    t = norm(notes)
    if re.search(r'\bEst\.?\b|estimate[d]? column|preliminary', t):
        rec['flags'].append('A5 value appears to come from an estimate column')
    elif re.search(r'projection', t, re.I) and re.search(r'chosen|selected|column', t, re.I):
        rec['info'].append('A5 projection language near selection, review wording')

    # A6 WEO cross-check on denominator
    arith = rec.get('arith')
    if arith and rec.get('year_num') in (2022, 2023, 2024, 2025) \
            and r['debt_perimeter'] == 'general_government':
        wh = weo_hist.get(iso, {})
        w = wh.get(rec['year_num'])
        if w is not None:
            gapw = arith['den'] - w
            rec['weo_debt_gap'] = round(gapw, 1)
            if abs(gapw) > 8:
                rec['flags'].append(
                    f"A6 denominator {arith['den']} vs WEO GG debt {w:.1f} ({rec['year_num']}): gap {gapw:+.1f}pp")
            else:
                rec['info'].append(f'A6 WEO debt gap {gapw:+.1f}pp')
    results.append(rec)

flagged = [r for r in results if r['flags']]
print(f"rows: {len(results)}   flagged: {len(flagged)}")
fc = Counter()
for r in flagged:
    for f in r['flags']:
        fc[f.split(' ')[0]] += 1
print("flag counts by check:", dict(fc))
for r in flagged:
    print('-', r['iso'], '|', r['method'], r['confidence'], '|', r['value'])
    for f in r['flags']:
        print('   *', f)
json.dump(results, open(OUT_PATH, 'w'), indent=1)
print("wrote", OUT_PATH)
