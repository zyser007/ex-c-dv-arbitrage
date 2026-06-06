"use strict";

/* ---------- config ---------- */

const DEFAULTS = {
  startAmount: 100,
  exaltedPerChaos: 5.5,
  chaosPerDivine: 14.5,
  exaltedPerDivine: 90,
  safetyMarginPercent: 1,
  minimumProfitPercent: 2,
};

const CURRENCIES = {
  exalted: { name: "Exalted Orb", short: "Exalted", icon: "sprites/exalted-orb.svg" },
  chaos: { name: "Chaos Orb", short: "Chaos", icon: "sprites/chaos-orb.svg" },
  divine: { name: "Divine Orb", short: "Divine", icon: "sprites/divine-orb.svg" },
};

// All 6 triangular permutations (each loops back to its start).
const ROUTES = [
  ["exalted", "chaos", "divine"],
  ["exalted", "divine", "chaos"],
  ["chaos", "exalted", "divine"],
  ["chaos", "divine", "exalted"],
  ["divine", "exalted", "chaos"],
  ["divine", "chaos", "exalted"],
];

const STATUS = {
  PROFITABLE: "Profitable",
  THIN: "Potential but Too Thin",
  NOT: "Not Profitable",
};

const STORAGE_KEY = "poe2-arb-state";

// Short URL keys for shareable links.
const PARAM_MAP = {
  startAmount: "s",
  exaltedPerChaos: "ec",
  chaosPerDivine: "cd",
  exaltedPerDivine: "ed",
  safetyMarginPercent: "sm",
  minimumProfitPercent: "mp",
};

const REQUIRED_POSITIVE = [
  { id: "startAmount", label: "Start amount" },
  { id: "exaltedPerChaos", label: "1 Chaos = Exalted rate" },
  { id: "chaosPerDivine", label: "1 Divine = Chaos rate" },
  { id: "exaltedPerDivine", label: "1 Divine = Exalted rate" },
];

const OPTIONAL_NONNEG = [
  { id: "safetyMarginPercent", label: "Safety Margin %" },
  { id: "minimumProfitPercent", label: "Minimum Profit %" },
];

/* ---------- input handling ---------- */

function readInputs() {
  const get = (id) => document.getElementById(id).value.trim();
  const raw = {};
  [...REQUIRED_POSITIVE, ...OPTIONAL_NONNEG].forEach(({ id }) => {
    raw[id] = get(id);
  });
  return raw;
}

function validateInputs(raw) {
  const errors = [];
  const values = {};

  REQUIRED_POSITIVE.forEach(({ id, label }) => {
    if (raw[id] === "") {
      errors.push({ id, message: `${label} is required.` });
      return;
    }
    const n = Number(raw[id]);
    if (!Number.isFinite(n)) {
      errors.push({ id, message: `${label} must be a number.` });
    } else if (n <= 0) {
      errors.push({ id, message: `${label} must be greater than 0.` });
    } else {
      values[id] = n;
    }
  });

  OPTIONAL_NONNEG.forEach(({ id, label }) => {
    if (raw[id] === "") {
      values[id] = DEFAULTS[id];
      return;
    }
    const n = Number(raw[id]);
    if (!Number.isFinite(n)) {
      errors.push({ id, message: `${label} must be a number.` });
    } else if (n < 0) {
      errors.push({ id, message: `${label} cannot be negative.` });
    } else {
      values[id] = n;
    }
  });

  return { ok: errors.length === 0, errors, values };
}

/* ---------- core math ---------- */

// Convert `amount` of `from` currency into `to` using the direct pair rate.
// The three rates are intentionally allowed to be mutually inconsistent —
// that inconsistency is exactly what creates an arbitrage opportunity.
function convert(amount, from, to, rates) {
  const { exaltedPerChaos, chaosPerDivine, exaltedPerDivine } = rates;
  switch (from + "_" + to) {
    case "exalted_chaos": return amount / exaltedPerChaos;
    case "chaos_exalted": return amount * exaltedPerChaos;
    case "chaos_divine": return amount / chaosPerDivine;
    case "divine_chaos": return amount * chaosPerDivine;
    case "exalted_divine": return amount / exaltedPerDivine;
    case "divine_exalted": return amount * exaltedPerDivine;
    default: throw new Error("Unknown currency pair: " + from + " -> " + to);
  }
}

function evaluateRoute(route, input) {
  const { startAmount, safetyMarginPercent, minimumProfitPercent } = input;
  const path = [...route, route[0]];

  let amount = startAmount;
  const steps = [];
  for (let i = 0; i < 3; i++) {
    const from = path[i];
    const to = path[i + 1];
    const out = convert(amount, from, to, input);
    steps.push({ from, to, inAmount: amount, outAmount: out });
    amount = out;
  }

  const finalAmount = amount;
  const profit = finalAmount - startAmount;
  const profitPercent = (profit / startAmount) * 100;

  const safetyMultiplier = 1 - safetyMarginPercent / 100;
  const adjustedFinal = finalAmount * safetyMultiplier;
  const adjustedProfit = adjustedFinal - startAmount;
  const adjustedProfitPercent = (adjustedProfit / startAmount) * 100;

  return {
    route,
    startCurrency: route[0],
    startAmount,
    steps,
    finalAmount,
    profit,
    profitPercent,
    safetyMarginPercent,
    adjustedFinal,
    adjustedProfit,
    adjustedProfitPercent,
    minimumProfitPercent,
    status: getStatus(adjustedProfitPercent, minimumProfitPercent),
  };
}

// Evaluate every route, best (highest adjusted profit) first.
function scanRoutes(input) {
  return ROUTES.map((route) => evaluateRoute(route, input)).sort(
    (a, b) => b.adjustedProfitPercent - a.adjustedProfitPercent
  );
}

function getStatus(adjustedProfitPercent, minimumProfitPercent) {
  if (adjustedProfitPercent <= 0) return STATUS.NOT;
  if (adjustedProfitPercent < minimumProfitPercent) return STATUS.THIN;
  return STATUS.PROFITABLE;
}

/* ---------- formatting ---------- */

function formatNumber(value, decimals = 4) {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function signed(value, decimals = 4) {
  return (value > 0 ? "+" : "") + formatNumber(value, decimals);
}

function statusClass(status) {
  if (status === STATUS.PROFITABLE) return "status-profitable";
  if (status === STATUS.THIN) return "status-thin";
  return "status-not";
}

function icon(currency) {
  const meta = CURRENCIES[currency];
  return `<img class="orb-icon sm" src="${meta.icon}" alt="" onerror="this.style.display='none'">`;
}

function routePathHtml(route) {
  const path = [...route, route[0]];
  return path
    .map((c, i) => {
      const sep = i < path.length - 1 ? '<span class="arrow">→</span>' : "";
      return `<span class="cur">${icon(c)}${CURRENCIES[c].short}</span>${sep}`;
    })
    .join("");
}

/* ---------- rendering ---------- */

function renderValidation(errors) {
  const items = errors.map((e) => `<li>${e.message}</li>`).join("");
  document.getElementById("resultContent").innerHTML = `
    <div class="validation">
      <strong>Invalid input</strong>
      <ul>${items}</ul>
    </div>`;
}

function renderResult(scan) {
  const best = scan[0];
  const el = document.getElementById("resultContent");

  const profitSign = best.profit >= 0 ? "pos" : "neg";
  const adjSign = best.adjustedProfit >= 0 ? "pos" : "neg";
  const startShort = CURRENCIES[best.startCurrency].short;

  const stepLis = best.steps
    .map(
      (s, i) => `
      <li><span class="step-num">${i + 1}.</span>
        ${formatNumber(s.inAmount)} ${CURRENCIES[s.from].short} →
        <span class="amt">${formatNumber(s.outAmount)}</span> ${CURRENCIES[s.to].short}</li>`
    )
    .join("");

  const warning =
    best.status === STATUS.THIN
      ? `<p class="status-warning">Profit looks thin. Real trade spread, delay, or fake listings may remove the gain.</p>`
      : "";

  const routeRows = scan
    .map((r, i) => {
      const sign = r.adjustedProfit >= 0 ? "pos" : "neg";
      return `
      <div class="route-row ${i === 0 ? "best" : ""}">
        <div class="route-path">${routePathHtml(r.route)}</div>
        <div class="route-meta">
          <span class="route-pct ${sign}">${signed(r.adjustedProfitPercent, 2)}%</span>
          <span class="pill ${statusClass(r.status)}">${r.status}</span>
        </div>
      </div>`;
    })
    .join("");

  el.innerHTML = `
    <h2>Best Route</h2>
    <div class="best-route-path">${routePathHtml(best.route)}</div>
    <ol class="steps">
      <li><span class="step-num">0.</span> Start:
        <span class="amt">${formatNumber(best.startAmount)}</span> ${startShort}</li>
      ${stepLis}
    </ol>

    <div class="profit-cards">
      <div class="card">
        <span class="card-label">Raw Profit</span>
        <span class="card-value ${profitSign}">${signed(best.profit)} ${startShort}</span>
        <span class="card-sub ${profitSign}">${signed(best.profitPercent, 2)}%</span>
      </div>
      <div class="card">
        <span class="card-label">After ${formatNumber(best.safetyMarginPercent, 2)}% Safety</span>
        <span class="card-value ${adjSign}">${signed(best.adjustedProfit)} ${startShort}</span>
        <span class="card-sub ${adjSign}">${signed(best.adjustedProfitPercent, 2)}%</span>
      </div>
    </div>

    <div class="status-banner ${statusClass(best.status)}">${best.status}</div>
    ${warning}

    <h2 class="routes-heading">All Routes</h2>
    <p class="routes-note">Profit % below is after the safety margin. Rotations of the same loop share a %.</p>
    <div class="routes">${routeRows}</div>`;
}

/* ---------- persistence + sharing ---------- */

function persist(raw) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  } catch (e) {
    /* storage unavailable — ignore */
  }
  updateUrl(raw);
}

function updateUrl(raw) {
  if (typeof history === "undefined" || !history.replaceState) return;
  const params = new URLSearchParams();
  Object.keys(PARAM_MAP).forEach((key) => {
    if (raw[key] !== "") params.set(PARAM_MAP[key], raw[key]);
  });
  const qs = params.toString();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
}

function loadInitialValues() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch (e) {
    stored = {};
  }
  const params =
    typeof location !== "undefined"
      ? new URLSearchParams(location.search)
      : new URLSearchParams();

  Object.keys(DEFAULTS).forEach((key) => {
    const input = document.getElementById(key);
    if (!input) return;
    const p = PARAM_MAP[key];
    if (p && params.has(p)) {
      input.value = params.get(p);
    } else if (stored[key] !== undefined && stored[key] !== "") {
      input.value = stored[key];
    } else {
      input.value = DEFAULTS[key];
    }
  });
}

function copyLink() {
  persist(readInputs()); // make sure the URL reflects current inputs
  const url = location.href;
  const done = () => flashCopyButton();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done, done);
  } else {
    done();
  }
}

function flashCopyButton() {
  const btn = document.getElementById("copyLinkBtn");
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = "Link copied!";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("copied");
  }, 1500);
}

/* ---------- orchestration ---------- */

function run() {
  const raw = readInputs();
  const { ok, errors, values } = validateInputs(raw);

  const errorIds = new Set(errors.map((e) => e.id));
  [...REQUIRED_POSITIVE, ...OPTIONAL_NONNEG].forEach(({ id }) => {
    document.getElementById(id).classList.toggle("invalid", errorIds.has(id));
  });

  persist(raw);

  if (!ok) {
    renderValidation(errors);
    return;
  }
  renderResult(scanRoutes(values));
}

function setDefaults() {
  Object.keys(DEFAULTS).forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = DEFAULTS[id];
  });
}

function bindEvents() {
  document.getElementById("calculateBtn").addEventListener("click", run);
  document.getElementById("resetBtn").addEventListener("click", () => {
    setDefaults();
    run();
  });
  const copyBtn = document.getElementById("copyLinkBtn");
  if (copyBtn) copyBtn.addEventListener("click", copyLink);

  [...REQUIRED_POSITIVE, ...OPTIONAL_NONNEG].forEach(({ id }) => {
    document.getElementById(id).addEventListener("input", run);
  });
}

function init() {
  loadInitialValues();
  bindEvents();
  run();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}

// Exported for testing environments (no-op in the browser).
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    convert,
    evaluateRoute,
    scanRoutes,
    getStatus,
    validateInputs,
    formatNumber,
    ROUTES,
  };
}
