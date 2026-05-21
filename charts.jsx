// 30-year projection chart — interactive SVG.

const { useState: useStateC, useRef: useRefC, useMemo: useMemoC } = React;

function ProjectionChart({ points, pi15, pi30, invReturn, principal, rate15, rate30 }) {
  const W = 880, H = 360;
  const padL = 56, padR = 24, padT = 18, padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const [hover, setHover] = useStateC(null); // year index 0..30 (0 hidden) or null
  const svgRef = useRefC(null);

  // Compute net wealth = portfolio - cumulative outflow (so we can flag where breakeven happens)
  const series = useMemoC(() => {
    return points.map(p => ({
      year: p.year,
      // What we plot: cumulative housing cost (negative), and portfolio value (positive)
      paid15: -p.paid15,
      paid30: -p.paid30,
      inv15: p.inv15,
      inv30: p.inv30,
      net15: p.inv15 - p.paid15,
      net30: p.inv30 - p.paid30,
    }));
  }, [points]);

  // Y domain: min of paid (negative), max of inv (positive)
  const yMin = Math.min(
    0,
    ...series.map(s => s.paid15),
    ...series.map(s => s.paid30),
  );
  const yMax = Math.max(
    0,
    ...series.map(s => s.inv15),
    ...series.map(s => s.inv30),
  );
  const yPad = (yMax - yMin) * 0.06;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  const xScale = (year) => padL + (year / 30) * innerW;
  const yScale = (v) => padT + (1 - (v - yLo) / (yHi - yLo)) * innerH;
  const y0 = yScale(0);

  const pathFor = (key) => {
    return series.map((s, i) => `${i === 0 ? "M" : "L"} ${xScale(s.year).toFixed(2)} ${yScale(s[key]).toFixed(2)}`).join(" ");
  };

  // Filled areas for the spend (between 0 and paid, going down) and invest (between 0 and inv)
  const areaFor = (key) => {
    const pts = series.map(s => `${xScale(s.year).toFixed(2)} ${yScale(s[key]).toFixed(2)}`);
    return `M ${xScale(0).toFixed(2)} ${y0.toFixed(2)} L ${pts.join(" L ")} L ${xScale(30).toFixed(2)} ${y0.toFixed(2)} Z`;
  };

  // Gridlines
  const yTicks = niceTicks(yLo, yHi, 6);

  const xTicks = [0, 5, 10, 15, 20, 25, 30];

  const handleMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const yr = Math.round(((x - padL) / innerW) * 30);
    if (yr < 0 || yr > 30) { setHover(null); return; }
    setHover(yr);
  };
  const handleLeave = () => setHover(null);

  const hoverPt = hover != null ? series[hover] : null;

  return (
    <div className="chart-wrap" style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {/* y gridlines */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL} x2={W - padR}
              y1={yScale(t)} y2={yScale(t)}
              stroke={t === 0 ? "var(--ink-2)" : "var(--line)"}
              strokeDasharray={t === 0 ? "" : "2 4"}
              strokeWidth={t === 0 ? 1 : 1}
            />
            <text
              x={padL - 8} y={yScale(t)}
              textAnchor="end" dominantBaseline="middle"
              fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)"
            >
              {fmtMoneyShort(t)}
            </text>
          </g>
        ))}

        {/* x axis labels */}
        {xTicks.map((t) => (
          <g key={t}>
            <line x1={xScale(t)} x2={xScale(t)} y1={H - padB} y2={H - padB + 4} stroke="var(--line-2)" />
            <text
              x={xScale(t)} y={H - padB + 18}
              textAnchor="middle"
              fontFamily="var(--font-mono)" fontSize="10" fill="var(--muted)"
            >
              y{t}
            </text>
          </g>
        ))}

        {/* Mortgage paid-off marker at year 15 (only meaningful for 15yr) */}
        <line
          x1={xScale(15)} x2={xScale(15)}
          y1={padT} y2={H - padB}
          stroke="var(--c15)" strokeOpacity="0.35" strokeDasharray="3 3"
        />
        <text
          x={xScale(15) + 6} y={padT + 12}
          fontFamily="var(--font-mono)" fontSize="9" fill="var(--c15)"
        >
          15-yr loan paid off
        </text>

        {/* Areas — spending (below zero) */}
        <path d={areaFor("paid30")} fill="var(--c30)" fillOpacity="0.10" />
        <path d={areaFor("paid15")} fill="var(--c15)" fillOpacity="0.10" />

        {/* Areas — investment (above zero) */}
        <path d={areaFor("inv30")} fill="var(--inv)" fillOpacity="0.10" />
        <path d={areaFor("inv15")} fill="var(--c15)" fillOpacity="0.12" />

        {/* Lines */}
        <path d={pathFor("paid30")} fill="none" stroke="var(--c30)" strokeWidth="2" />
        <path d={pathFor("paid15")} fill="none" stroke="var(--c15)" strokeWidth="2" />
        <path d={pathFor("inv30")} fill="none" stroke="var(--inv)" strokeWidth="2" strokeDasharray="0" />
        <path d={pathFor("inv15")} fill="none" stroke="var(--c15)" strokeWidth="2" strokeDasharray="4 3" />

        {/* Hover crosshair */}
        {hoverPt && (
          <g>
            <line
              x1={xScale(hoverPt.year)} x2={xScale(hoverPt.year)}
              y1={padT} y2={H - padB}
              stroke="var(--ink-2)" strokeOpacity="0.3"
            />
            <circle cx={xScale(hoverPt.year)} cy={yScale(hoverPt.paid15)} r="3.5" fill="var(--c15)" />
            <circle cx={xScale(hoverPt.year)} cy={yScale(hoverPt.paid30)} r="3.5" fill="var(--c30)" />
            <circle cx={xScale(hoverPt.year)} cy={yScale(hoverPt.inv15)} r="3.5" fill="var(--c15)" stroke="var(--surface)" strokeWidth="1.5" />
            <circle cx={xScale(hoverPt.year)} cy={yScale(hoverPt.inv30)} r="3.5" fill="var(--inv)" />
          </g>
        )}

        {/* End-of-period labels */}
        <EndLabel x={xScale(30)} y={yScale(series[30].inv30)} text={fmtMoneyShort(series[30].inv30)} color="var(--inv)" anchor="end" dy={-6} />
        <EndLabel x={xScale(30)} y={yScale(series[30].inv15)} text={fmtMoneyShort(series[30].inv15)} color="var(--c15)" anchor="end" dy={-6} />
        <EndLabel x={xScale(30)} y={yScale(series[30].paid15)} text={fmtMoneyShort(-series[30].paid15)} color="var(--c15)" anchor="end" dy={12} />
        <EndLabel x={xScale(30)} y={yScale(series[30].paid30)} text={fmtMoneyShort(-series[30].paid30)} color="var(--c30)" anchor="end" dy={12} />
      </svg>

      {hoverPt && (
        <div
          className="tip"
          style={{
            left: `${(xScale(hoverPt.year) / W) * 100}%`,
            top: `${(padT / H) * 100}%`,
          }}
        >
          <div className="tip-year">Year {hoverPt.year}</div>
          <div className="tip-row">
            <span className="tip-c15">15-yr portfolio</span>
            <span className="v">{fmtMoneyShort(hoverPt.inv15)}</span>
          </div>
          <div className="tip-row">
            <span className="tip-inv">30-yr portfolio</span>
            <span className="v">{fmtMoneyShort(hoverPt.inv30)}</span>
          </div>
          <div className="tip-row">
            <span className="tip-c15">15-yr spent</span>
            <span className="v">{fmtMoneyShort(-hoverPt.paid15)}</span>
          </div>
          <div className="tip-row">
            <span className="tip-c30">30-yr spent</span>
            <span className="v">{fmtMoneyShort(-hoverPt.paid30)}</span>
          </div>
        </div>
      )}

      <div className="chart-legend">
        <div className="item"><span className="sw" style={{background: "var(--c15)"}}></span>15-yr cumulative spend</div>
        <div className="item"><span className="sw" style={{background: "var(--c30)"}}></span>30-yr cumulative spend</div>
        <div className="item"><span className="sw" style={{background: "var(--c15)", opacity: 0.7, border: "1px dashed var(--c15)"}}></span>15-yr portfolio (invest after payoff)</div>
        <div className="item"><span className="sw" style={{background: "var(--inv)"}}></span>30-yr portfolio (invest the diff)</div>
      </div>
    </div>
  );
}

function EndLabel({ x, y, text, color, anchor = "start", dy = 0 }) {
  return (
    <text
      x={x - 4} y={y + dy}
      textAnchor={anchor}
      fontFamily="var(--font-mono)"
      fontSize="10.5"
      fill={color}
      fontWeight="500"
    >
      {text}
    </text>
  );
}

function niceTicks(lo, hi, count) {
  const range = hi - lo;
  const rough = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  let step;
  if (norm < 1.5) step = 1 * mag;
  else if (norm < 3) step = 2 * mag;
  else if (norm < 7) step = 5 * mag;
  else step = 10 * mag;
  const start = Math.ceil(lo / step) * step;
  const out = [];
  for (let v = start; v <= hi; v += step) out.push(Math.round(v));
  // Ensure 0 included if in range
  if (lo < 0 && hi > 0 && !out.includes(0)) out.push(0);
  return out.sort((a, b) => a - b);
}

Object.assign(window, { ProjectionChart });
