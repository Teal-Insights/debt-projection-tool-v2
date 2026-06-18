import { useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  label: string;
  /** Projection years (length = horizonYears). */
  years: number[];
  /** Per-year values. */
  values: number[];
  /**
   * Per-year WEO baseline values for this indicator (same shape as `values`).
   * When provided, a small notch is drawn on each year's track at the baseline
   * position so users can see at a glance whether they've moved above or
   * below the WEO default. Optional — pass undefined to suppress notches.
   */
  baselineValues?: number[];
  min: number;
  max: number;
  step: number;
  unit?: string;
  /** Called when the user drags one of the year markers. */
  onChange: (yearIndex: number, value: number) => void;
}

/**
 * Slider card showing all projection years as a vertical-strip mini-chart.
 * Each year has its own vertical track with a draggable circle marker.
 * Adjacent circles are connected by a line so the year-by-year trajectory
 * is immediately visible.
 *
 * Drag a circle up or down to change that year's value. No ◀/▶ navigation —
 * every year is editable in place.
 */
export function SliderRow({
  label,
  years,
  values,
  baselineValues,
  min,
  max,
  step,
  unit = '%',
  onChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Visual frame — kept constant so cards layout predictably in the right column.
  const WIDTH = 360;
  const HEIGHT = 120;
  const PAD = { top: 24, right: 14, bottom: 22, left: 14 };

  const xScale = d3
    .scalePoint<string>()
    .domain(years.map(String))
    .range([PAD.left, WIDTH - PAD.right])
    .padding(0.55);

  const yScale = d3
    .scaleLinear()
    .domain([min, max])
    .range([HEIGHT - PAD.bottom, PAD.top]);

  const xPositions = years.map(y => xScale(String(y)) ?? 0);

  // Convert client Y position to a stepped, clamped data value.
  const clientYToValue = (clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const ySvg = ((clientY - rect.top) / rect.height) * HEIGHT;
    const yClamped = Math.max(PAD.top, Math.min(HEIGHT - PAD.bottom, ySvg));
    const raw = yScale.invert(yClamped);
    const stepped = Math.round(raw / step) * step;
    return Math.max(min, Math.min(max, stepped));
  };

  const handlePointerDown =
    (i: number) => (e: React.PointerEvent<SVGCircleElement>) => {
      e.preventDefault();
      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);
      onChange(i, clientYToValue(e.clientY));

      const handleMove = (ev: PointerEvent) => {
        onChange(i, clientYToValue(ev.clientY));
      };
      const handleUp = (ev: PointerEvent) => {
        // releasePointerCapture can throw on pointercancel if the browser
        // already invalidated the capture (touch interruption, OS gesture).
        // Wrap so the listener cleanup below always runs.
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {
          /* capture already released by the browser */
        }
        target.removeEventListener('pointermove', handleMove);
        target.removeEventListener('pointerup', handleUp);
        target.removeEventListener('pointercancel', handleUp);
      };
      target.addEventListener('pointermove', handleMove);
      target.addEventListener('pointerup', handleUp);
      target.addEventListener('pointercancel', handleUp);
    };

  // Connecting line path through every circle.
  const linePath = values
    .map(
      (v, i) =>
        `${i === 0 ? 'M' : 'L'} ${xPositions[i].toFixed(2)} ${yScale(v).toFixed(2)}`,
    )
    .join(' ');

  /** Render values with at most 1 decimal; integers when step >= 1. */
  const formatValue = (v: number): string =>
    step >= 1 ? Math.round(v).toString() : v.toFixed(1);

  /** Year label: always the full year, consistent across all positions. */
  const formatYear = (year: number): string => String(year);

  return (
    <div className="slider-card">
      <div className="slider-card__head">
        <span className="slider-card__label">
          {label} <span className="slider-card__unit">({unit})</span>
        </span>
      </div>
      <svg
        ref={svgRef}
        className="slider-card__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={`${label} for years ${years[0]} to ${years[years.length - 1]}`}
      >
        {/* Vertical tracks — one per year. */}
        {years.map((_, i) => (
          <line
            key={`track-${i}`}
            className="slider-card__track"
            x1={xPositions[i]}
            x2={xPositions[i]}
            y1={PAD.top}
            y2={HEIGHT - PAD.bottom}
            stroke="#d4d4d0"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}

        {/* WEO baseline notches — small horizontal tick on each year's track at
            the baseline value position. Lets users see at a glance whether
            they've moved above or below the WEO default. Rendered between
            tracks and the connector so the user's projection line + thumbs
            sit visually on top of the notch. Color matches the FanChart's
            baseline line color (#3b82f6) for cross-component consistency.
            Visually clamped to [min, max] for the rare outlier countries
            whose baseline sits outside the slider domain (e.g. Suriname
            growth ~43%); the actual slider value is preserved untouched —
            the notch just slides to the edge. */}
        {baselineValues &&
          baselineValues.map((b, i) => {
            const clamped = Math.max(min, Math.min(max, b));
            const yNotch = yScale(clamped);
            // When the WEO baseline sits outside the slider domain (a few
            // outliers — Suriname growth, Kuwait rates, Ukraine balance —
            // see the standup audit), draw a small chevron pointing in the
            // direction of the off-screen baseline so users know the tick
            // glued to the edge isn't the actual WEO value.
            const overshootDir =
              b > max ? 'up' : b < min ? 'down' : null;
            return (
              <g key={`notch-${i}`} aria-hidden="true">
                <line
                  className="slider-card__notch"
                  x1={xPositions[i] - 7}
                  x2={xPositions[i] + 7}
                  y1={yNotch}
                  y2={yNotch}
                  stroke="#3b82f6"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                {overshootDir === 'up' && (
                  <polygon
                    className="slider-card__notch-arrow"
                    points={`${xPositions[i]},${yNotch - 7} ${xPositions[i] - 4},${yNotch - 1} ${xPositions[i] + 4},${yNotch - 1}`}
                    fill="#3b82f6"
                  />
                )}
                {overshootDir === 'down' && (
                  <polygon
                    className="slider-card__notch-arrow"
                    points={`${xPositions[i]},${yNotch + 7} ${xPositions[i] - 4},${yNotch + 1} ${xPositions[i] + 4},${yNotch + 1}`}
                    fill="#3b82f6"
                  />
                )}
              </g>
            );
          })}

        {/* Connecting line through all circles. */}
        <path
          className="slider-card__connector"
          d={linePath}
          stroke="#0a2540"
          strokeWidth={1.25}
          fill="none"
        />

        {/* Draggable circle markers — one per year. */}
        {values.map((value, i) => (
          <circle
            key={`circle-${i}`}
            className="slider-card__handle"
            cx={xPositions[i]}
            cy={yScale(value)}
            r={6}
            fill="white"
            stroke="#0a2540"
            strokeWidth={2}
            style={{ cursor: 'ns-resize', touchAction: 'none' }}
            onPointerDown={handlePointerDown(i)}
            aria-label={`${label} ${years[i]}: ${formatValue(value)}${unit}`}
            role="slider"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
          />
        ))}

        {/* Value labels (above the chart). */}
        {values.map((value, i) => (
          <text
            key={`val-${i}`}
            className="slider-card__value"
            x={xPositions[i]}
            y={PAD.top - 8}
            textAnchor="middle"
            fontSize={12}
            fontWeight={600}
            fill="#0a2540"
          >
            {formatValue(value)}
          </text>
        ))}

        {/* Year labels (below the chart). */}
        {years.map((year, i) => (
          <text
            key={`year-${i}`}
            className="slider-card__year"
            x={xPositions[i]}
            y={HEIGHT - PAD.bottom + 14}
            textAnchor="middle"
            fontSize={10}
            fill="#707070"
          >
            {formatYear(year)}
          </text>
        ))}
      </svg>
    </div>
  );
}
