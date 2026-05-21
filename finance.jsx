// Finance math — all functions are pure.
// Exposed on `window` so other Babel scripts can use them.

// Monthly principal & interest for fixed-rate mortgage.
// principal in $, annualRate as decimal (0.065), years (number)
function monthlyPI(principal, annualRate, years) {
  if (principal <= 0 || years <= 0) return 0;
  const n = years * 12;
  const r = annualRate / 12;
  if (r === 0) return principal / n;
  return (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

// Total interest paid over the life of the loan.
function totalInterest(principal, annualRate, years) {
  return monthlyPI(principal, annualRate, years) * years * 12 - principal;
}

// Future value of a series of monthly contributions, compounded monthly.
// pmt = monthly payment, annualRate as decimal, months
function fvOfMonthly(pmt, annualRate, months) {
  if (pmt <= 0 || months <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return pmt * months;
  return pmt * (Math.pow(1 + r, months) - 1) / r;
}

// Future value of a lump sum compounded monthly.
function fvOfLump(pv, annualRate, months) {
  if (pv <= 0 || months <= 0) return pv;
  const r = annualRate / 12;
  return pv * Math.pow(1 + r, months);
}

// Build a 30-year (360-month) projection of two scenarios.
// Scenario "fifteen":  pay 15yr PI for 180 months, then invest 15yr PI for 180 months.
// Scenario "thirty":   pay 30yr PI for 360 months; invest (15PI - 30PI) for 360 months.
// We sample yearly (years 0..30) and return arrays of:
//   { year, paid15, paid30, inv15, inv30, net15, net30 }
// paid = cumulative housing P&I outflow at end of year
// inv  = portfolio balance at end of year
// net  = inv - paid (signed; you can also think of it as wealth accumulated minus money spent)
function buildProjection({ principal, rate15, rate30, invReturn, years = 30 }) {
  const pi15 = monthlyPI(principal, rate15, 15);
  const pi30 = monthlyPI(principal, rate30, 30);
  const diff = Math.max(0, pi15 - pi30); // monthly amount invested under 30yr scenario
  const r = invReturn / 12;

  const out = [];
  // Track running balances month by month, sample at year boundaries.
  let inv15 = 0; // 30yr scenario "fifteen invests once paid off" — represents 15yr buyer's portfolio
  let inv30 = 0; // 30yr buyer's portfolio (always investing the diff)
  let paid15 = 0;
  let paid30 = 0;

  out.push({ year: 0, paid15: 0, paid30: 0, inv15: 0, inv30: 0 });

  for (let m = 1; m <= years * 12; m++) {
    // 15yr scenario
    if (m <= 180) {
      paid15 += pi15;
      // not investing yet
      inv15 = inv15 * (1 + r);
    } else {
      // mortgage paid off — invest the same pi15 amount every month
      inv15 = inv15 * (1 + r) + pi15;
    }
    // 30yr scenario
    paid30 += pi30;
    inv30 = inv30 * (1 + r) + diff;

    if (m % 12 === 0) {
      out.push({
        year: m / 12,
        paid15,
        paid30,
        inv15,
        inv30,
      });
    }
  }
  return { points: out, pi15, pi30, diff };
}

// ============ Formatters ============
function fmtMoney(n, opts = {}) {
  const { dp = 0, sign = false } = opts;
  if (!isFinite(n)) return "—";
  const s = n < 0 ? "-" : (sign && n > 0 ? "+" : "");
  const abs = Math.abs(n);
  return s + "$" + abs.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function fmtMoneyShort(n) {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return s + "$" + (abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2) + "M";
  if (abs >= 1_000) return s + "$" + (abs / 1000).toFixed(abs >= 10_000 ? 0 : 1) + "k";
  return s + "$" + Math.round(abs);
}

function fmtPct(n, dp = 2) {
  if (!isFinite(n)) return "—";
  return (n * 100).toFixed(dp) + "%";
}

Object.assign(window, {
  monthlyPI, totalInterest, fvOfMonthly, fvOfLump, buildProjection,
  fmtMoney, fmtMoneyShort, fmtPct,
  TAX_BRACKETS_2026, STD_DEDUCTION_2026, FILING_LABELS,
  computeFederalTax, computeFICA, computeEffectiveTax,
});

// =================== 2026 federal tax brackets ===================
// Source: IRS Rev. Proc. 2025-32 (Tax Foundation table).
const TAX_BRACKETS_2026 = {
  single: [
    [0, 0.10], [12400, 0.12], [50400, 0.22], [105700, 0.24],
    [201775, 0.32], [256225, 0.35], [640600, 0.37],
  ],
  mfj: [
    [0, 0.10], [24800, 0.12], [100800, 0.22], [211400, 0.24],
    [403550, 0.32], [512450, 0.35], [768700, 0.37],
  ],
  hoh: [
    [0, 0.10], [17700, 0.12], [67450, 0.22], [105700, 0.24],
    [201775, 0.32], [256200, 0.35], [640600, 0.37],
  ],
};
const STD_DEDUCTION_2026 = {
  single: 16100,
  mfj: 32200,
  hoh: 24150,
};
const FILING_LABELS = {
  single: "Single",
  mfj: "Married",
  hoh: "HoH",
};
const CTC_PER_CHILD_2026 = 2200;
const SS_WAGE_BASE_2026 = 183600;  // approx 2026 SS wage base
const SS_RATE = 0.062;
const MEDICARE_RATE = 0.0145;

function computeFederalTax(taxableAnnual, filingStatus) {
  if (taxableAnnual <= 0) return 0;
  const brackets = TAX_BRACKETS_2026[filingStatus] || TAX_BRACKETS_2026.single;
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [floor, rate] = brackets[i];
    const ceil = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    if (taxableAnnual > floor) {
      tax += (Math.min(taxableAnnual, ceil) - floor) * rate;
    } else break;
  }
  return tax;
}

function computeFICA(annualGross) {
  const ss = Math.min(annualGross, SS_WAGE_BASE_2026) * SS_RATE;
  const medicare = annualGross * MEDICARE_RATE;
  return ss + medicare;
}

// Returns annual breakdown:
//   { federal, fica, state, ctc, totalAnnual, totalMonthly, effectiveRate, taxableAnnual }
function computeEffectiveTax({ grossMonthly, pretaxMonthly, filingStatus, dependents, stateRate }) {
  const annualGross = grossMonthly * 12;
  const annualPretax = pretaxMonthly * 12;
  const stdDed = STD_DEDUCTION_2026[filingStatus] || STD_DEDUCTION_2026.single;
  const taxableAnnual = Math.max(0, annualGross - annualPretax - stdDed);

  const federalPre = computeFederalTax(taxableAnnual, filingStatus);
  const ctc = Math.min(federalPre, (dependents || 0) * CTC_PER_CHILD_2026);
  const federal = Math.max(0, federalPre - ctc);

  // FICA is paid on gross wages (pre-tax 401k still has FICA withheld)
  const fica = computeFICA(annualGross);

  // State income tax — applied to taxable (gross - pretax - std deduction); simplification.
  const state = Math.max(0, taxableAnnual * (stateRate || 0));

  const totalAnnual = federal + fica + state;
  const totalMonthly = totalAnnual / 12;
  const effectiveRate = annualGross > 0 ? totalAnnual / annualGross : 0;

  return { federal, fica, state, ctc, totalAnnual, totalMonthly, effectiveRate, taxableAnnual };
}
