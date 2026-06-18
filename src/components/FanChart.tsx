import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import type { CountryState, RecomputeResult } from '../engine';

interface Props {
  /** User scenario — current slider values. */
  result: RecomputeResult;
  /** Baseline projection — country defaults, independent of slider state. */
  baselineResult: RecomputeResult;
  country: CountryState;
}

const MARGIN = { top: 36, right: 56, bottom: 36, left: 48 };

/** Colours — picked to keep history visually distinct from the projection lines.
 *  Past is a neutral near-black; baseline is a brighter sky blue; user is amber. */
const HIST_COLOR = '#1f2937';     // dark slate — historical (past, neutral)
const BASELINE_COLOR = '#3b82f6'; // sky blue — baseline (WEO defaults)
const USER_COLOR = '#c08a3e';     // amber — user scenario
const OUTER_BAND_FILL = '#dfe4ec'; // wider envelope — paler
const INNER_BAND_FILL = '#c2cad6'; // tighter envelope — darker

export function FanChart({ result, baselineResult, country }: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Y-axis upper bound is fully data-driven — adjusts both UP (when worst-case
  // sliders push the projection past the country's baseline range) and DOWN
  // (when best-case sliders drive debt toward the floor). This is symmetric
  // by design: previously the axis only grew, which left the chart zoomed-out
  // when debt fell, making the descent look like a small squiggle at the
  // bottom. Now the descent gets the visual prominence it deserves.
  //
  // Historical and WEO baseline values are always included in the max
  // calculation so the y-axis can never zoom in tighter than the "where
  // we came from" range — there's always context for the user's path.
  const yDomain = useMemo<[number, number]>(() => {
    const histVals = country.historical.map(h => h.debtPct);
    const baseProjVals = country.baselineProjection?.map(p => p.debtPct) ?? [];
    const userProjVals = result.path.map(p => p.debtPct);
    const bandUpper = result.fanBands.outerBand.map(b => b.upper);
    const maxObserved = Math.max(
      ...histVals,
      ...baseProjVals,
      ...userProjVals,
      ...bandUpper,
      country.startingDebtPct,
    );
    // 15% headroom above the highest observed point so the projection line
    // never grazes the top frame. d3.scaleLinear().nice() will round up to
    // a clean tick. A 10pp hard floor prevents collapse to a micro-band on
    // countries with extremely low debt (or when projection bottoms at 0).
    const yMax = Math.max(maxObserved * 1.15, 10);
    return [0, yMax];
  }, [
    country.iso,
    country.startingDebtPct,
    country.historical,
    country.baselineProjection,
    result.path,
    result.fanBands.outerBand,
  ]);

  useEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap) return;

    d3.select(svg).selectAll('*').remove();
    // Old tooltip divs accumulate across renders if not cleared — strip them.
    d3.select(wrap).selectAll('.fan-chart__tooltip').remove();

    const width = wrap.clientWidth || 700;
    const height = wrap.clientHeight || 360;
    const innerW = width - MARGIN.left - MARGIN.right;
    const innerH = height - MARGIN.top - MARGIN.bottom;

    const root = d3
      .select(svg)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const g = root
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`);

    // X domain: full path span (history + projection). result.path is always
    // non-empty (≥3 entries: 2 history + 1 projection), so d3.extent never
    // returns [undefined, undefined] here — but assert non-null defensively.
    const years = result.path.map(p => p.year);
    const [yMinYear, yMaxYear] = d3.extent(years);
    if (yMinYear == null || yMaxYear == null) return; // unreachable in practice
    const xScale = d3
      .scaleLinear()
      .domain([yMinYear, yMaxYear])
      .range([0, innerW]);

    // Y domain: locked per country
    const yScale = d3.scaleLinear().domain(yDomain).range([innerH, 0]).nice();

    // Gridlines
    g.append('g')
      .attr('class', 'gridline')
      .selectAll('line')
      .data(yScale.ticks(10))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#eaeaea')
      .attr('stroke-width', 1);

    // Axes
    const xAxis = d3.axisBottom(xScale).tickFormat(d3.format('d')).ticks(8);
    const yAxis = d3.axisLeft(yScale).ticks(10).tickFormat(d => `${d}`);

    g.append('g')
      .attr('class', 'axis axis--x')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);

    g.append('g').attr('class', 'axis axis--y').call(yAxis);

    g.append('text')
      .attr('class', 'axis-title')
      .attr('x', -MARGIN.left + 12)
      .attr('y', -14)
      .attr('text-anchor', 'start')
      .text('Debt to GDP ratio (%)');

    // ---------- Fan bands (around the USER projection — uncertainty wraps the
    //                       scenario the user is exploring, not the baseline) ----------
    const areaGen = d3
      .area<{ year: number; lower: number; upper: number }>()
      .x(d => xScale(d.year))
      .y0(d => yScale(d.lower))
      .y1(d => yScale(d.upper))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(result.fanBands.outerBand)
      .attr('class', 'fan fan--outer')
      .attr('d', areaGen)
      .attr('fill', OUTER_BAND_FILL)
      .attr('stroke', 'none');

    g.append('path')
      .datum(result.fanBands.innerBand)
      .attr('class', 'fan fan--inner')
      .attr('d', areaGen)
      .attr('fill', INNER_BAND_FILL)
      .attr('stroke', 'none');

    // ---------- Lines ----------
    const histPath = result.path.filter(p => p.year < country.baselineYear);

    // Baseline projection — uses country defaults; from anchor onward.
    const baselineProjPath = baselineResult.path.filter(
      p => p.year >= country.baselineYear - 1,
    );

    // User projection — uses current sliders; from anchor onward.
    const userProjPath = result.path.filter(
      p => p.year >= country.baselineYear - 1,
    );

    const lineGen = d3
      .line<{ year: number; debtPct: number }>()
      .x(d => xScale(d.year))
      .y(d => yScale(d.debtPct))
      .curve(d3.curveMonotoneX);

    // Historical line (navy)
    g.append('path')
      .datum(histPath)
      .attr('class', 'line line--hist')
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', HIST_COLOR)
      .attr('stroke-width', 2);

    // Baseline projection (blue, slightly thinner — it's the reference)
    g.append('path')
      .datum(baselineProjPath)
      .attr('class', 'line line--baseline')
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', BASELINE_COLOR)
      .attr('stroke-width', 2);

    // User projection (amber, overlaid on baseline — it's what the user is exploring)
    g.append('path')
      .datum(userProjPath)
      .attr('class', 'line line--proj')
      .attr('d', lineGen)
      .attr('fill', 'none')
      .attr('stroke', USER_COLOR)
      .attr('stroke-width', 2.25);

    // ---------- Baseline marker (vertical dashed line at the anchor year) ----------
    const anchorYear = country.baselineYear - 1;
    g.append('line')
      .attr('class', 'baseline-marker')
      .attr('x1', xScale(anchorYear))
      .attr('x2', xScale(anchorYear))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#a0a0a0')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 1);

    // ---------- Historical / Projections zone labels ----------
    const labelY = 14;
    const anchorX = xScale(anchorYear);
    const histMidX = (0 + anchorX) / 2;
    g.append('text')
      .attr('class', 'zone-label zone-label--hist')
      .attr('x', histMidX)
      .attr('y', labelY)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('font-weight', 700)
      .attr('letter-spacing', '0.08em')
      .attr('fill', '#707070')
      .text('HISTORICAL');

    const projMidX = (anchorX + innerW) / 2;
    g.append('text')
      .attr('class', 'zone-label zone-label--proj')
      .attr('x', projMidX)
      .attr('y', labelY)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('font-weight', 700)
      .attr('letter-spacing', '0.08em')
      .attr('fill', '#707070')
      .text('PROJECTIONS');

    // Peak + end-of-horizon read-outs live in the app header, not on the chart.
    // (Removed the on-chart "Peak X.X%" and "→ Y.Y% by year" labels.)

    // Legend lives outside the plot area as an HTML overlay (see JSX below) so it
    // never collides with data lines or the fan band.

    // ---------- Hover tooltip ----------
    // Indicator group: vertical guide line + dots for each line at the hovered year.
    const hover = g
      .append('g')
      .attr('class', 'hover-indicator')
      .style('display', 'none')
      .style('pointer-events', 'none');

    hover
      .append('line')
      .attr('class', 'hover-line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#404040')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,3');

    hover
      .append('circle')
      .attr('class', 'hover-dot-hist')
      .attr('r', 4)
      .attr('fill', HIST_COLOR)
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    hover
      .append('circle')
      .attr('class', 'hover-dot-baseline')
      .attr('r', 4)
      .attr('fill', BASELINE_COLOR)
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    hover
      .append('circle')
      .attr('class', 'hover-dot-user')
      .attr('r', 4)
      .attr('fill', USER_COLOR)
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    // HTML tooltip lives inside the wrap (which is position: relative).
    const tooltip = d3
      .select(wrap)
      .append('div')
      .attr('class', 'fan-chart__tooltip')
      .style('display', 'none');

    // Build per-year lookups for fast hover.
    const userByYear = new Map(result.path.map(p => [p.year, p.debtPct]));
    const baselineByYear = new Map(
      baselineResult.path.map(p => [p.year, p.debtPct]),
    );
    const minYear = result.path[0].year;
    const maxYear = result.path[result.path.length - 1].year;

    // Transparent overlay captures pointer events without blocking visuals beneath.
    const capture = g
      .append('rect')
      .attr('class', 'hover-capture')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    capture.on('mousemove', function (event) {
      const [mx] = d3.pointer(event, g.node());
      const yearFloat = xScale.invert(mx);
      let y = Math.round(yearFloat);
      if (y < minYear) y = minYear;
      if (y > maxYear) y = maxYear;

      const userPct = userByYear.get(y);
      const baselinePct = baselineByYear.get(y);
      if (userPct == null) return;

      const isHistorical = y < country.baselineYear;
      const cx = xScale(y);

      hover.style('display', 'block');
      hover.select<SVGLineElement>('.hover-line').attr('x1', cx).attr('x2', cx);

      // Historical dot: only when in the history segment.
      hover
        .select<SVGCircleElement>('.hover-dot-hist')
        .attr('cx', cx)
        .attr('cy', yScale(userPct))
        .style('display', isHistorical ? 'block' : 'none');

      // Baseline + user dots: only on the projection side.
      if (!isHistorical && baselinePct != null) {
        hover
          .select<SVGCircleElement>('.hover-dot-baseline')
          .attr('cx', cx)
          .attr('cy', yScale(baselinePct))
          .style('display', 'block');
        hover
          .select<SVGCircleElement>('.hover-dot-user')
          .attr('cx', cx)
          .attr('cy', yScale(userPct))
          .style('display', 'block');
      } else {
        hover.select('.hover-dot-baseline').style('display', 'none');
        hover.select('.hover-dot-user').style('display', 'none');
      }

      // Position tooltip near the hovered point. Flip left when near right edge.
      const tooltipX = cx + MARGIN.left;
      const tooltipY = yScale(userPct) + MARGIN.top;
      const flipLeft = tooltipX > width - 200;

      const summary = `Peak ${result.peak.debtPct.toFixed(1)}% in ${result.peak.year} · → ${result.endOfHorizon.debtPct.toFixed(1)}% by ${result.endOfHorizon.year}`;

      const userRowLabel = isHistorical ? 'Historical' : 'Projection';
      const userRowColor = isHistorical ? HIST_COLOR : USER_COLOR;
      const baselineRow =
        !isHistorical && baselinePct != null
          ? `<div class="fan-chart__tooltip-row">
               <span class="fan-chart__tooltip-swatch" style="background:${BASELINE_COLOR}"></span>
               <span class="fan-chart__tooltip-label">Baseline</span>
               <strong>${baselinePct.toFixed(1)}%</strong>
             </div>`
          : '';

      // "vs baseline" delta — only shown when we have both projection and
      // baseline values for the hovered year (i.e. not on historical years).
      // Sign convention: positive = above baseline, negative = below. The
      // `pp` (percentage points) suffix is explicit so the delta isn't
      // misread as a percent of GDP.
      const deltaRow =
        !isHistorical && baselinePct != null
          ? (() => {
              const d = userPct - baselinePct;
              const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
              const magnitude = Math.abs(d).toFixed(1);
              return `<div class="fan-chart__tooltip-row fan-chart__tooltip-delta">
                <span class="fan-chart__tooltip-swatch fan-chart__tooltip-swatch--blank"></span>
                <span class="fan-chart__tooltip-label">vs baseline</span>
                <strong>${sign}${magnitude} pp</strong>
              </div>`;
            })()
          : '';

      tooltip
        .style('display', 'block')
        .style('left', flipLeft ? 'auto' : `${tooltipX + 12}px`)
        .style('right', flipLeft ? `${width - tooltipX + 12}px` : 'auto')
        .style('top', `${tooltipY - 8}px`)
        .html(`
          <div class="fan-chart__tooltip-year">${y} · Debt-to-GDP</div>
          <div class="fan-chart__tooltip-row">
            <span class="fan-chart__tooltip-swatch" style="background:${userRowColor}"></span>
            <span class="fan-chart__tooltip-label">${userRowLabel}</span>
            <strong>${userPct.toFixed(1)}%</strong>
          </div>
          ${baselineRow}
          ${deltaRow}
          <div class="fan-chart__tooltip-summary">${summary}</div>
        `);
    });

    capture.on('mouseleave', () => {
      hover.style('display', 'none');
      tooltip.style('display', 'none');
    });
  }, [result, baselineResult, country, yDomain]);

  return (
    <div ref={wrapRef} className="fan-chart">
      <div className="fan-chart__legend" aria-hidden="true">
        <span className="fan-chart__legend-item">
          <span
            className="fan-chart__legend-line"
            style={{ background: HIST_COLOR }}
          />
          Historical
        </span>
        <span className="fan-chart__legend-item">
          <span
            className="fan-chart__legend-line"
            style={{ background: BASELINE_COLOR }}
          />
          Baseline
        </span>
        <span className="fan-chart__legend-item">
          <span
            className="fan-chart__legend-line"
            style={{ background: USER_COLOR }}
          />
          Projection
        </span>
        <span className="fan-chart__legend-item">
          <span
            className="fan-chart__legend-fill"
            style={{ background: OUTER_BAND_FILL }}
          />
          Severe stress (±2 pp)
        </span>
        <span className="fan-chart__legend-item">
          <span
            className="fan-chart__legend-fill"
            style={{ background: INNER_BAND_FILL }}
          />
          Moderate stress (±1 pp)
        </span>
      </div>
      <svg ref={svgRef} className="fan-chart__svg" />
    </div>
  );
}
