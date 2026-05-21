// Main app
const { useState, useMemo, useEffect } = React;

const REMAINDER_CATS = [
  { id: "emergency", name: "Emergency & savings", color: "oklch(0.55 0.07 165)" },
  { id: "retirement", name: "Post-tax investing", color: "oklch(0.55 0.09 255)" },
  { id: "necessities", name: "Food, utilities, transport", color: "oklch(0.62 0.06 75)" },
  { id: "lifestyle", name: "Trips & lifestyle", color: "oklch(0.65 0.10 35)" },
];

function App() {
  // ---- Primary inputs ----
  const [income, setIncome] = useState(10500);           // gross monthly (stored as monthly internally)
  const [incomeMode, setIncomeMode] = useState("monthly"); // monthly | annual (display only)
  const [pretaxRetirement, setPretaxRetirement] = useState(500); // 401k / 403b / pre-tax IRA per month
  const [pretaxMode, setPretaxMode] = useState("monthly"); // monthly | annual (display only)
  const [filingStatus, setFilingStatus] = useState("single"); // single | mfj | hoh
  const [dependents, setDependents] = useState(0);
  const [stateTaxRate, setStateTaxRate] = useState(0.05);  // state income tax (decimal)
  const [homePrice, setHomePrice] = useState(620000);
  const [downMode, setDownMode] = useState("pct");       // "pct" | "dol"
  const [downPct, setDownPct] = useState(20);            // %
  const [rate15, setRate15] = useState(0.05875);
  const [rate30, setRate30] = useState(0.0650);
  const [propTax, setPropTax] = useState(0.011);         // 1.1% annual
  const [insurance, setInsurance] = useState(150);
  const [hoa, setHoa] = useState(0);
  const [otherDebts, setOtherDebts] = useState(480);
  const [invReturn, setInvReturn] = useState(0.07);

  // Remainder allocation percentages — must sum to 100. We let users set 3; the 4th is residual.
  const [alloc, setAlloc] = useState({ emergency: 25, retirement: 30, necessities: 35 });
  const allocLifestyle = Math.max(0, 100 - alloc.emergency - alloc.retirement - alloc.necessities);

  // Which loan term the budget bar reflects
  const [budgetTerm, setBudgetTerm] = useState(30);

  // ---- Derived ----
  const grossMonthly = income;
  const pretax = Math.min(pretaxRetirement, grossMonthly); // can't contribute more than gross

  const taxCalc = computeEffectiveTax({
    grossMonthly,
    pretaxMonthly: pretax,
    filingStatus,
    dependents,
    stateRate: stateTaxRate,
  });
  const taxRate = taxCalc.effectiveRate;
  const taxes = taxCalc.totalMonthly;
  const taxableIncome = Math.max(0, grossMonthly - pretax);
  const netMonthly = Math.max(0, grossMonthly - pretax - taxes);

  const downPayment = useMemo(() => Math.round(homePrice * (downPct / 100)), [homePrice, downPct]);
  const principal = Math.max(0, homePrice - downPayment);

  const pi15 = monthlyPI(principal, rate15, 15);
  const pi30 = monthlyPI(principal, rate30, 30);
  const monthlyTax = (homePrice * propTax) / 12;
  const monthlyEscrow = monthlyTax + insurance + hoa;

  const piti15 = pi15 + monthlyEscrow;
  const piti30 = pi30 + monthlyEscrow;
  const piti = budgetTerm === 15 ? piti15 : piti30;
  const pi = budgetTerm === 15 ? pi15 : pi30;

  const totalInt15 = totalInterest(principal, rate15, 15);
  const totalInt30 = totalInterest(principal, rate30, 30);
  const totalPaid15 = pi15 * 180;
  const totalPaid30 = pi30 * 360;

  // Front-end DTI = PITI / GROSS income; back-end DTI = (PITI + other debts) / GROSS income
  // (Lenders use gross — keep that convention. Budget math below uses NET.)
  const frontDTI = piti / grossMonthly;
  const backDTI = (piti + otherDebts) / grossMonthly;

  // Monthly remainder is what you live on AFTER taxes, housing, and debts.
  const remainder = Math.max(0, netMonthly - piti - otherDebts);

  // Projection
  const proj = useMemo(
    () => buildProjection({ principal, rate15, rate30, invReturn, years: 30 }),
    [principal, rate15, rate30, invReturn]
  );

  // For the budget bar, show: PITI / debts / each remainder category
  const allocAmounts = {
    emergency: remainder * (alloc.emergency / 100),
    retirement: remainder * (alloc.retirement / 100),
    necessities: remainder * (alloc.necessities / 100),
    lifestyle: remainder * (allocLifestyle / 100),
  };

  return (
    <div className="app">
      <TopBar />

      <div className="layout">
        {/* ===================== LEFT — INPUTS ===================== */}
        <div className="panel" aria-label="Inputs">
          <div className="panel-head">
            <div>
              <div className="panel-title">Your finances</div>
              <div className="panel-eyebrow" style={{marginTop: 4}}>Inputs · adjust freely</div>
            </div>
          </div>

          <Section label="Household">
            <div className="field">
              <span className="field-label">Household income (gross)</span>
              <span className="row" style={{ gap: 8 }}>
                <div className="segmented" role="tablist" aria-label="Income period">
                  <button className={incomeMode === "monthly" ? "on" : ""} onClick={() => setIncomeMode("monthly")}>Mo</button>
                  <button className={incomeMode === "annual" ? "on" : ""} onClick={() => setIncomeMode("annual")}>Yr</button>
                </div>
                <MoneyInput
                  value={incomeMode === "annual" ? Math.round(income * 12) : income}
                  onChange={(v) => setIncome(incomeMode === "annual" ? v / 12 : v)}
                  min={0}
                  max={incomeMode === "annual" ? 2_400_000 : 200_000}
                />
              </span>
              <span className="field-hint">
                {incomeMode === "monthly"
                  ? <>≈ <span className="mono">{fmtMoney(income * 12)}</span>/yr · </>
                  : <>≈ <span className="mono">{fmtMoney(income)}</span>/mo · </>}
                take-home <span className="mono">{fmtMoney(netMonthly, {dp:0})}/mo</span> after pre-tax retirement &amp; taxes
              </span>
            </div>
            <div className="field">
              <span className="field-label">Pre-tax retirement</span>
              <span className="row" style={{ gap: 8 }}>
                <div className="segmented" role="tablist" aria-label="Pre-tax period">
                  <button className={pretaxMode === "monthly" ? "on" : ""} onClick={() => setPretaxMode("monthly")}>Mo</button>
                  <button className={pretaxMode === "annual" ? "on" : ""} onClick={() => setPretaxMode("annual")}>Yr</button>
                </div>
                <MoneyInput
                  value={pretaxMode === "annual" ? Math.round(pretaxRetirement * 12) : pretaxRetirement}
                  onChange={(v) => setPretaxRetirement(pretaxMode === "annual" ? v / 12 : v)}
                  min={0}
                  max={pretaxMode === "annual" ? 60_000 : 5_000}
                />
              </span>
              <span className="field-hint">
                401(k) / 403(b) / Traditional IRA · reduces taxable income ·{" "}
                {pretaxMode === "monthly"
                  ? <>≈ <span className="mono">{fmtMoney(pretax * 12)}</span>/yr</>
                  : <>≈ <span className="mono">{fmtMoney(pretax)}</span>/mo</>}
              </span>
            </div>
            <div className="field tax-field">
              <span className="field-label">Tax rate</span>
              <span className="input-wrap" style={{ width: 88, background: "var(--bg-2)", borderStyle: "dashed" }}>
                <input readOnly value={(taxRate * 100).toFixed(2)} aria-label="Effective tax rate (computed)" />
                <span className="suffix">%</span>
              </span>
              <div className="tax-detail">
                <div className="tax-detail-row">
                  <span className="tax-detail-label">Filing</span>
                  <div className="segmented">
                    <button className={filingStatus === "single" ? "on" : ""} onClick={() => setFilingStatus("single")}>Single</button>
                    <button className={filingStatus === "mfj" ? "on" : ""} onClick={() => setFilingStatus("mfj")}>Married</button>
                    <button className={filingStatus === "hoh" ? "on" : ""} onClick={() => setFilingStatus("hoh")}>HoH</button>
                  </div>
                </div>
                <div className="tax-detail-row">
                  <span className="tax-detail-label">Dependents</span>
                  <IntInput value={dependents} onChange={setDependents} min={0} max={20} />
                </div>
                <div className="tax-detail-row">
                  <span className="tax-detail-label">State tax</span>
                  <PercentInput value={stateTaxRate} onChange={setStateTaxRate} min={0} max={15} />
                </div>
                <div className="tax-detail-hint">
                  2026 IRS brackets · fed <span className="mono">{fmtMoneyShort(taxCalc.federal)}</span>
                  {" + FICA "}<span className="mono">{fmtMoneyShort(taxCalc.fica)}</span>
                  {" + state "}<span className="mono">{fmtMoneyShort(taxCalc.state)}</span>
                  {taxCalc.ctc > 0 && <> · CTC <span className="mono">−{fmtMoneyShort(taxCalc.ctc)}</span></>}
                  {" / yr"}
                </div>
              </div>
            </div>
            <Field label="Other monthly debts" hint="Cars, student loans, credit-card minimums">
              <MoneyInput value={otherDebts} onChange={setOtherDebts} min={0} max={20000} />
            </Field>
          </Section>

          <Section label="The home">
            <Field label="Home price">
              <MoneyInput value={homePrice} onChange={setHomePrice} min={50000} max={5000000} />
            </Field>
            <div className="field">
              <span className="field-label">Down payment</span>
              <span className="row" style={{ gap: 8 }}>
                <div className="segmented" role="tablist">
                  <button className={downMode === "pct" ? "on" : ""} onClick={() => setDownMode("pct")}>%</button>
                  <button className={downMode === "dol" ? "on" : ""} onClick={() => setDownMode("dol")}>$</button>
                </div>
                {downMode === "pct" ? (
                  <span className="input-wrap" style={{ width: 86 }}>
                    <input
                      type="number" min="0" max="80" step="0.5"
                      value={downPct}
                      onChange={(e) => setDownPct(Math.max(0, Math.min(80, Number(e.target.value))))}
                    />
                    <span className="suffix">%</span>
                  </span>
                ) : (
                  <MoneyInput
                    value={downPayment}
                    onChange={(v) => setDownPct(Math.max(0, Math.min(80, (v / homePrice) * 100)))}
                    min={0} max={homePrice}
                  />
                )}
              </span>
              <span className="field-hint">
                {downMode === "pct"
                  ? `≈ ${fmtMoney(downPayment)} cash down`
                  : `≈ ${downPct.toFixed(1)}% of price`}
                {" · loan amount "}<span className="mono">{fmtMoney(principal)}</span>
              </span>
            </div>
            <Field label="Property tax rate" hint="Annual, applied to home price">
              <PercentInput value={propTax} onChange={setPropTax} min={0} max={5} />
            </Field>
            <Field label="Homeowner's insurance">
              <MoneyInput value={insurance} onChange={setInsurance} min={0} max={2000} suffix="/mo" />
            </Field>
            <Field label="HOA / maintenance">
              <MoneyInput value={hoa} onChange={setHoa} min={0} max={5000} suffix="/mo" />
            </Field>
          </Section>

          <Section label="Loan terms">
            <Field label={<span><span className="legend-sw" style={{display:"inline-block", background:"var(--c15)", marginRight:8, verticalAlign:"middle"}}></span>15-yr interest rate</span>}>
              <PercentInput value={rate15} onChange={setRate15} min={0} max={20} />
            </Field>
            <Slider value={rate15 * 100} min={2} max={12} step={0.05} klass="is-15" onChange={(v) => setRate15(v/100)} />
            <Field label={<span><span className="legend-sw" style={{display:"inline-block", background:"var(--c30)", marginRight:8, verticalAlign:"middle"}}></span>30-yr interest rate</span>}>
              <PercentInput value={rate30} onChange={setRate30} min={0} max={20} />
            </Field>
            <Slider value={rate30 * 100} min={2} max={12} step={0.05} klass="is-30" onChange={(v) => setRate30(v/100)} />
            <div className="field-hint" style={{marginTop: 10, gridColumn: "1 / -1"}}>
              30-yr rates are typically <span className="mono">+0.4–0.8%</span> higher than 15-yr.
            </div>
          </Section>

          <Section label="Investing assumption">
            <Field label="Expected annual return" hint="Used to project what investing the monthly difference could grow to">
              <PercentInput value={invReturn} onChange={setInvReturn} min={0} max={15} />
            </Field>
            <Slider value={invReturn * 100} min={0} max={12} step={0.25} klass="is-inv" onChange={(v) => setInvReturn(v/100)} />
          </Section>
        </div>

        {/* ===================== RIGHT — RESULTS ===================== */}
        <div className="col-right">
          <HeroCompare
            pi15={pi15} pi30={pi30}
            piti15={piti15} piti30={piti30}
            totalPaid15={totalPaid15} totalPaid30={totalPaid30}
            totalInt15={totalInt15} totalInt30={totalInt30}
            rate15={rate15} rate30={rate30}
            monthlyEscrow={monthlyEscrow}
            principal={principal}
          />

          <BudgetCard
            grossMonthly={grossMonthly}
            netMonthly={netMonthly}
            taxes={taxes}
            taxRate={taxRate}
            pretax={pretax}
            piti={piti}
            otherDebts={otherDebts}
            remainder={remainder}
            alloc={alloc} setAlloc={setAlloc}
            allocLifestyle={allocLifestyle}
            allocAmounts={allocAmounts}
            frontDTI={frontDTI}
            backDTI={backDTI}
            budgetTerm={budgetTerm} setBudgetTerm={setBudgetTerm}
            piti15={piti15} piti30={piti30}
          />

          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">30-year horizon — spend vs. wealth</div>
                <div className="card-desc">
                  Below the zero line: cumulative money spent on housing. Above:
                  what you'd have if you invested the 15-yr buyer's “monthly headroom”
                  at <span className="mono">{fmtPct(invReturn, 1)}</span> a year. Hover to inspect any year.
                </div>
              </div>
              <div className="card-eyebrow">Year 0 → 30 · monthly compounding</div>
            </div>
            <ProjectionChart
              points={proj.points}
              pi15={pi15} pi30={pi30}
              invReturn={invReturn}
              principal={principal}
              rate15={rate15} rate30={rate30}
            />
          </div>

          <Verdict
            proj={proj}
            pi15={pi15} pi30={pi30}
            totalPaid15={totalPaid15} totalPaid30={totalPaid30}
            invReturn={invReturn}
          />
        </div>
      </div>

      <div className="fineprint">
        Planner only — figures are estimates. Property tax and insurance are assumed constant; in practice both
        rise modestly over time. Investment return is a smooth annualized assumption applied monthly; actual
        markets are volatile. Mortgage interest is generally deductible if you itemize — not modeled here.
        Speak with a licensed mortgage advisor before signing anything.
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M3 9 L10 3 L17 9 V16 H12 V11 H8 V16 H3 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </div>
        <div>
          <div className="brand-title">Home Purchase Planner</div>
          <div className="brand-sub">Mortgage · Budget · 30-yr Outlook</div>
        </div>
      </div>
      <div className="topbar-meta">
        <span><span className="dot"></span> Live recalculation</span>
        <span>v1.0</span>
      </div>
    </div>
  );
}

function HeroCompare({ pi15, pi30, piti15, piti30, totalPaid15, totalPaid30, totalInt15, totalInt30, rate15, rate30, monthlyEscrow, principal }) {
  const Cents = ({ n }) => {
    const dollars = Math.floor(n);
    const cents = Math.round((n - dollars) * 100).toString().padStart(2, "0");
    return (
      <>
        ${dollars.toLocaleString("en-US")}
        <span className="cents">.{cents}</span>
      </>
    );
  };

  const Card = ({ which, pi, piti, totalPaid, totalInt, rate }) => (
    <div className={`hero-card c${which}`}>
      <div className={`hero-eyebrow c${which}`}>
        <span className="swatch"></span>
        {which}-year fixed · {fmtPct(rate, 2)}
      </div>
      <div className="hero-title">Monthly payment</div>
      <div className="hero-big"><Cents n={piti} /></div>
      <div className="hero-sub">
        P&amp;I {fmtMoney(pi, {dp: 0})} + tax/ins/HOA {fmtMoney(monthlyEscrow, {dp: 0})}
      </div>
      <div className="hero-grid">
        <div className="hero-stat">
          <div className="k">Loan amount</div>
          <div className="v small">{fmtMoney(principal)}</div>
        </div>
        <div className="hero-stat">
          <div className="k">Total interest</div>
          <div className="v small">{fmtMoneyShort(totalInt)}</div>
        </div>
        <div className="hero-stat">
          <div className="k">Total of payments</div>
          <div className="v small">{fmtMoneyShort(totalPaid)}</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="hero">
      <Card which="15" pi={pi15} piti={piti15} totalPaid={totalPaid15} totalInt={totalInt15} rate={rate15} />
      <Card which="30" pi={pi30} piti={piti30} totalPaid={totalPaid30} totalInt={totalInt30} rate={rate30} />
    </div>
  );
}

function BudgetCard({ grossMonthly, netMonthly, taxes, taxRate, pretax, piti, otherDebts, remainder, alloc, setAlloc, allocLifestyle, allocAmounts, frontDTI, backDTI, budgetTerm, setBudgetTerm, piti15, piti30 }) {
  // budget bar segments — denominator is GROSS so taxes are visible
  const segments = [
    { id: "pretax", name: "Pre-tax retirement", amount: pretax, color: "oklch(0.38 0.07 255)" },
    { id: "tax", name: "Taxes & withholding", amount: taxes, color: "oklch(0.42 0.02 250)" },
    { id: "piti", name: "Housing (PITI)", amount: piti, color: budgetTerm === 15 ? "var(--c15)" : "var(--c30)" },
    { id: "debts", name: "Other debts", amount: otherDebts, color: "oklch(0.55 0.05 35)" },
    { id: "emergency", name: REMAINDER_CATS[0].name, amount: allocAmounts.emergency, color: REMAINDER_CATS[0].color },
    { id: "retirement", name: REMAINDER_CATS[1].name, amount: allocAmounts.retirement, color: REMAINDER_CATS[1].color },
    { id: "necessities", name: REMAINDER_CATS[2].name, amount: allocAmounts.necessities, color: REMAINDER_CATS[2].color },
    { id: "lifestyle", name: REMAINDER_CATS[3].name, amount: allocAmounts.lifestyle, color: REMAINDER_CATS[3].color },
  ];
  const income = grossMonthly; // bar denominator
  const totalBar = segments.reduce((a, s) => a + s.amount, 0);

  const setAllocKey = (k, v) => {
    const othersSum = Object.entries(alloc).filter(([kk]) => kk !== k).reduce((a, [, vv]) => a + vv, 0);
    const max = 100 - othersSum;
    const clamped = Math.max(0, Math.min(max, Math.round(v)));
    setAlloc({ ...alloc, [k]: clamped });
  };

  // DTI bands: 28/36 are the conventional thresholds.
  const dtiBand = (v, kind) => {
    if (kind === "front") {
      if (v <= 0.28) return "good";
      if (v <= 0.31) return "warn";
      return "bad";
    } else {
      if (v <= 0.36) return "good";
      if (v <= 0.43) return "warn";
      return "bad";
    }
  };
  const fBand = dtiBand(frontDTI, "front");
  const bBand = dtiBand(backDTI, "back");

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Monthly budget</div>
          <div className="card-desc">
            Your gross paycheck sliced honestly. Pre-tax retirement comes off first,
            then taxes on what's left, then housing and debts. The remaining post-tax
            pool is what you actually spend on food, trips, and additional savings.
          </div>
        </div>
        <div className="scenario-toggle">
          <span className="card-eyebrow">Use payment from</span>
          <div className="segmented">
            <button className={budgetTerm === 15 ? "on" : ""} onClick={() => setBudgetTerm(15)}>15-yr</button>
            <button className={budgetTerm === 30 ? "on" : ""} onClick={() => setBudgetTerm(30)}>30-yr</button>
          </div>
        </div>
      </div>

      {/* Budget bar */}
      <div className="budget">
        <div className="budget-bar">
          {segments.map(s => {
            const pct = (s.amount / income) * 100;
            const wide = pct > 8;
            return (
              <div
                key={s.id}
                className="seg"
                style={{ width: `${pct}%`, background: s.color, color: pct > 12 ? "#fff" : "var(--ink)" }}
                title={`${s.name} · ${fmtMoney(s.amount)} (${pct.toFixed(1)}%)`}
              >
                {wide && <span style={{opacity: 0.95}}>{Math.round(pct)}%</span>}
              </div>
            );
          })}
          {/* Trailing unallocated */}
          {totalBar < income && (
            <div className="seg" style={{ width: `${((income - totalBar) / income) * 100}%`, background: "transparent", color: "var(--muted)" }}>
              {/* unfilled */}
            </div>
          )}
        </div>

        <div className="budget-legend">
          {segments.map(s => (
            <div key={s.id} className="legend-row">
              <span className="legend-sw" style={{ background: s.color }}></span>
              <span className="legend-name">{s.name}</span>
              <span className="legend-val">{fmtMoney(s.amount, { dp: 0 })}</span>
            </div>
          ))}
        </div>
      </div>

      {/* DTI gauges */}
      <div className="gauge-row">
        <DTIGauge
          label="Housing ratio (front-end, gross)"
          value={frontDTI}
          band={fBand}
          markers={[{at: 0.28, label: "28%"}]}
          note={
            fBand === "good" ? "Comfortably within the conventional 28% guideline." :
            fBand === "warn" ? "Above 28% — many lenders accept it but it'll feel tight." :
            "Above 31% — lenders may push back; budget will be tight."
          }
        />
        <DTIGauge
          label="Total debt ratio (back-end, gross)"
          value={backDTI}
          band={bBand}
          markers={[{at: 0.36, label: "36%"}, {at: 0.43, label: "43%"}]}
          note={
            bBand === "good" ? "Healthy — under the 36% rule of thumb." :
            bBand === "warn" ? "Between 36–43%. Qualifying, but limited cushion." :
            "Over 43% — qualifying for a conforming loan gets hard here."
          }
        />
      </div>

      {/* Allocation editor */}
      <div style={{marginTop: 22}}>
        <div className="section-label" style={{marginBottom: 10}}>
          Plan your post-tax remainder · <span style={{color: "var(--ink)"}}>{fmtMoney(remainder)}</span> left after pre-tax retirement, taxes, housing &amp; debts
        </div>
        <div className="alloc">
          {[
            { key: "emergency", ...REMAINDER_CATS[0], pct: alloc.emergency },
            { key: "retirement", ...REMAINDER_CATS[1], pct: alloc.retirement },
            { key: "necessities", ...REMAINDER_CATS[2], pct: alloc.necessities },
          ].map(c => {
            const othersSum = Object.entries(alloc).filter(([k]) => k !== c.key).reduce((a, [, v]) => a + v, 0);
            const maxForThis = 100 - othersSum;
            return (
              <div key={c.key} className="alloc-row">
                <span className="alloc-name">
                  <span className="legend-sw" style={{ background: c.color, display: "inline-block", marginRight: 8, verticalAlign: "middle" }}></span>
                  {c.name}
                </span>
                <input
                  type="range"
                  className="slider"
                  min="0" max="100" step="1"
                  value={c.pct}
                  onChange={(e) => setAllocKey(c.key, Number(e.target.value))}
                  style={{ accentColor: c.color }}
                />
                <span className="alloc-pct">
                  <IntPercentInput value={c.pct} onChange={(v) => setAllocKey(c.key, v)} min={0} max={maxForThis} />
                </span>
                <span className="alloc-amt">{fmtMoney(remainder * (c.pct / 100))}</span>
              </div>
            );
          })}
          <div className="alloc-row">
            <span className="alloc-name">
              <span className="legend-sw" style={{ background: REMAINDER_CATS[3].color, display: "inline-block", marginRight: 8, verticalAlign: "middle" }}></span>
              {REMAINDER_CATS[3].name}
            </span>
            <div style={{height: 2, background: "var(--line-2)", borderRadius: 2, position: "relative"}}>
              <div style={{position: "absolute", inset: 0, width: `${allocLifestyle}%`, background: REMAINDER_CATS[3].color, borderRadius: 2}}></div>
            </div>
            <span className="alloc-pct">{allocLifestyle}%</span>
            <span className="alloc-amt">{fmtMoney(remainder * (allocLifestyle / 100))}</span>
          </div>
        </div>
        <div className="alloc-foot">
          <span>Residual to lifestyle · auto-balances to 100%</span>
          <span>{fmtMoney(remainder)} / mo</span>
        </div>
      </div>
    </div>
  );
}

function DTIGauge({ label, value, band, markers, note }) {
  const pct = Math.min(1, value / 0.6); // scale: 0..60% maps to 0..100% of track width
  const fill = `${pct * 100}%`;
  return (
    <div className="gauge">
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "baseline"}}>
        <span className="gauge-label">{label}</span>
        <span className="mono" style={{fontSize: 11, color: "var(--muted)"}}>scale 0–60%</span>
      </div>
      <div className="gauge-val">{fmtPct(value, 1)}</div>
      <div className="gauge-track">
        <div className={`gauge-fill ${band === "warn" ? "warn" : band === "bad" ? "bad" : ""}`} style={{width: fill}}></div>
        {markers.map(m => (
          <div key={m.at} className="gauge-marker" style={{left: `${(m.at / 0.6) * 100}%`}} data-label={m.label}></div>
        ))}
      </div>
      <div className={`gauge-note ${band}`}>{note}</div>
    </div>
  );
}

function Verdict({ proj, pi15, pi30, totalPaid15, totalPaid30, invReturn }) {
  const end = proj.points[proj.points.length - 1];
  const diff = pi15 - pi30;
  const wealth15 = end.inv15;
  const wealth30 = end.inv30;
  const advantage = wealth15 - wealth30;
  const winner = advantage > 0 ? "15-yr" : "30-yr";

  // Net financial position: portfolio - total paid on housing
  const net15 = wealth15 - totalPaid15;
  const net30 = wealth30 - totalPaid30;

  return (
    <div className="verdict">
      <div className="verdict-cell headline">
        <div className="verdict-k">After 30 years, assuming you commit the same monthly outlay either way</div>
        <div className="verdict-v" style={{marginTop: 8}}>
          {Math.abs(advantage) < 5000 ? (
            <>It's roughly a wash — within <span className="mono">{fmtMoneyShort(Math.abs(advantage))}</span>.</>
          ) : advantage > 0 ? (
            <>
              <span className="accent-15">15-year</span> wins by{" "}
              <span className="mono">{fmtMoneyShort(advantage)}</span>
            </>
          ) : (
            <>
              <span className="accent-30">30-year</span> wins by{" "}
              <span className="mono">{fmtMoneyShort(-advantage)}</span>
            </>
          )}
        </div>
        <div className="verdict-note">
          Both plans assume you spend the equivalent of the 15-yr P&amp;I every month for 30 years —
          either to the bank, or split between a smaller mortgage and an investment account. The investing
          assumption is <span className="mono">{fmtPct(invReturn, 1)}</span>/yr.
        </div>
      </div>

      <div className="verdict-cell">
        <div className="verdict-k">15-yr path · portfolio at year 30</div>
        <div className="verdict-v accent-15">{fmtMoneyShort(wealth15)}</div>
        <div className="verdict-note">
          Spent <span className="mono">{fmtMoneyShort(totalPaid15)}</span> on housing.
          Net: <span className="mono">{fmtMoneyShort(net15)}</span>.
        </div>
      </div>

      <div className="verdict-cell">
        <div className="verdict-k">30-yr path · portfolio at year 30</div>
        <div className="verdict-v accent-inv">{fmtMoneyShort(wealth30)}</div>
        <div className="verdict-note">
          Invested <span className="mono">{fmtMoney(Math.max(0, diff), {dp:0})}</span>/mo for 30 years.
          Spent <span className="mono">{fmtMoneyShort(totalPaid30)}</span> on housing. Net:{" "}
          <span className="mono">{fmtMoneyShort(net30)}</span>.
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
