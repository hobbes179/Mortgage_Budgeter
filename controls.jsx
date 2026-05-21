// Reusable input controls.

const { useState, useEffect, useRef, useMemo } = React;

function MoneyInput({ value, onChange, min = 0, max = 100_000_000, step = 1000, prefix = "$", suffix }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);

  const commit = (raw) => {
    const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
    const n = Number(cleaned);
    if (!isFinite(n)) { setText(String(value)); return; }
    const clamped = Math.max(min, Math.min(max, n));
    onChange(clamped);
    setText(String(clamped));
  };

  return (
    <span className="input-wrap">
      {prefix && <span className="prefix">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </span>
  );
}

function PercentInput({ value, onChange, min = 0, max = 30, step = 0.05 }) {
  // value is decimal (0.065). Display as 6.50.
  const [text, setText] = useState((value * 100).toFixed(2));
  useEffect(() => { setText((value * 100).toFixed(2)); }, [value]);
  const commit = (raw) => {
    const n = Number(String(raw).replace(/[^0-9.\-]/g, ""));
    if (!isFinite(n)) { setText((value * 100).toFixed(2)); return; }
    const clamped = Math.max(min, Math.min(max, n));
    onChange(clamped / 100);
    setText(clamped.toFixed(2));
  };
  return (
    <span className="input-wrap" style={{ width: 88 }}>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      />
      <span className="suffix">%</span>
    </span>
  );
}

function Slider({ value, onChange, min, max, step, klass }) {
  return (
    <input
      type="range"
      className={`slider ${klass || ""}`}
      min={min} max={max} step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span>{children}</span>
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="section">
      <div className="section-label">{label}</div>
      {children}
    </div>
  );
}

function IntPercentInput({ value, onChange, min = 0, max = 100, width = 60 }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = (raw) => {
    const n = Math.round(Number(String(raw).replace(/[^0-9.\-]/g, "")));
    if (!isFinite(n)) { setText(String(value)); return; }
    const clamped = Math.max(min, Math.min(max, n));
    onChange(clamped);
    setText(String(clamped));
  };
  return (
    <span className="input-wrap pct-mini" style={{ width }}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      />
      <span className="suffix">%</span>
    </span>
  );
}

function IntInput({ value, onChange, min = 0, max = 999, width = 52 }) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);
  const commit = (raw) => {
    const n = Math.round(Number(String(raw).replace(/[^0-9.\-]/g, "")));
    if (!isFinite(n)) { setText(String(value)); return; }
    const clamped = Math.max(min, Math.min(max, n));
    onChange(clamped);
    setText(String(clamped));
  };
  return (
    <span className="input-wrap" style={{ width }}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
      />
    </span>
  );
}

Object.assign(window, { MoneyInput, PercentInput, IntPercentInput, IntInput, Slider, Field, Section });
