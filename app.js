"use strict";

/* ---------- config ---------- */

const DEFAULTS = {
  startAmount: 100,
  exaltedPerChaos: 5.5,
  chaosPerDivine: 14.5,
  exaltedPerDivine: 90,
  safetyMarginPercent: 1,
  minimumProfitPercent: 2,
  goldPerExalted: 120,
  goldPerChaos: 160,
  goldPerDivine: 800,
};

// `icon` hot-links the official PoE CDN art (loaded by the visitor's browser);
// `fallback` is the local stylized SVG used if the CDN image fails to load.
const CURRENCIES = {
  exalted: {
    name: "Exalted Orb",
    short: "Exalted",
    icon: "https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyAddModToRare.png",
    fallback: "sprites/exalted-orb.svg",
  },
  chaos: {
    name: "Chaos Orb",
    short: "Chaos",
    icon: "https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png",
    fallback: "sprites/chaos-orb.svg",
  },
  divine: {
    name: "Divine Orb",
    short: "Divine",
    icon: "https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyModValues.png",
    fallback: "sprites/divine-orb.svg",
  },
};

// Single active route. (Add more here to re-enable multi-route scanning.)
const ROUTES = [
  ["exalted", "chaos", "divine"],
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
  goldPerExalted: "ge",
  goldPerChaos: "gc",
  goldPerDivine: "gd",
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

// Gold fee per orb bought; blank counts as 0 (no fee on that orb).
const GOLD_FIELDS = [
  { id: "goldPerExalted", label: "Gold per Exalted" },
  { id: "goldPerChaos", label: "Gold per Chaos" },
  { id: "goldPerDivine", label: "Gold per Divine" },
];

const ALL_FIELDS = [...REQUIRED_POSITIVE, ...OPTIONAL_NONNEG, ...GOLD_FIELDS];

/* ---------- input handling ---------- */

function readInputs() {
  const get = (id) => document.getElementById(id).value.trim();
  const raw = {};
  ALL_FIELDS.forEach(({ id }) => {
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

  GOLD_FIELDS.forEach(({ id, label }) => {
    if (raw[id] === "") {
      values[id] = 0; // blank = no gold fee on this orb
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
  const { safetyMarginPercent, minimumProfitPercent } = input;
  // In-game orbs are whole numbers — round down at every step.
  const startAmount = Math.floor(input.startAmount);
  const goldPerOrb = {
    exalted: input.goldPerExalted || 0,
    chaos: input.goldPerChaos || 0,
    divine: input.goldPerDivine || 0,
  };
  const path = [...route, route[0]];

  let amount = startAmount;
  let goldFee = 0;
  const steps = [];
  for (let i = 0; i < 3; i++) {
    const from = path[i];
    const to = path[i + 1];
    const out = Math.floor(convert(amount, from, to, input));
    // Gold fee is paid on the orb you buy (the step's output).
    const stepGold = out * goldPerOrb[to];
    goldFee += stepGold;
    steps.push({ from, to, inAmount: amount, outAmount: out, goldFee: stepGold });
    amount = out;
  }

  const finalAmount = amount;
  // Value the total gold fee in the start currency, when a gold price exists.
  const goldPerStart = goldPerOrb[route[0]];
  const goldFeeInStart = goldPerStart > 0 ? goldFee / goldPerStart : 0;
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
    goldFee,
    goldFeeInStart,
    netProfitAfterGold: profit - goldFeeInStart,
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
  // Fall back to the local SVG once if the CDN image fails.
  return `<img class="orb-icon sm" src="${meta.icon}" alt=""
    onerror="this.onerror=null;this.src='${meta.fallback}'">`;
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
    .map((s, i) => {
      const fee =
        s.goldFee > 0
          ? ` <span class="step-fee">· ${formatNumber(s.goldFee, 0)} gold</span>`
          : "";
      return `
      <li><span class="step-num">${i + 1}.</span>
        ${formatNumber(s.inAmount)} ${CURRENCIES[s.from].short} →
        <span class="amt">${formatNumber(s.outAmount)}</span> ${CURRENCIES[s.to].short}${fee}</li>`;
    })
    .join("");

  const warning =
    best.status === STATUS.THIN
      ? `<p class="status-warning">Profit looks thin. Real trade spread, delay, or fake listings may remove the gain.</p>`
      : "";

  let routesSection = "";
  if (scan.length > 1) {
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
    routesSection = `
      <h2 class="routes-heading">All Routes</h2>
      <p class="routes-note">Profit % below is after the safety margin. Rotations of the same loop share a %.</p>
      <div class="routes">${routeRows}</div>`;
  }

  const netSign = best.netProfitAfterGold >= 0 ? "pos" : "neg";
  const goldSection =
    best.goldFee > 0
      ? `
    <div class="gold-card">
      <div class="gold-row">
        <span class="card-label">Total Gold Fee</span>
        <span class="gold-value">${formatNumber(best.goldFee, 0)} gold</span>
      </div>
      <div class="gold-sub">
        ≈ ${formatNumber(best.goldFeeInStart)} ${startShort}-equivalent · net after gold:
        <span class="${netSign}">${signed(best.netProfitAfterGold)} ${startShort}</span>
      </div>
    </div>`
      : "";

  el.innerHTML = `
    <h2>${scan.length > 1 ? "Best Route" : "Route"}</h2>
    <div class="best-route-path">${routePathHtml(best.route)}</div>
    <ol class="steps">
      <li><span class="step-num">0.</span> Start:
        <span class="amt">${formatNumber(best.startAmount)}</span> ${startShort}</li>
      ${stepLis}
    </ol>
    <p class="routes-note">Whole orbs only — each step is rounded down.</p>

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
    ${goldSection}

    <div class="status-banner ${statusClass(best.status)}">${best.status}</div>
    ${warning}
    ${routesSection}`;
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
  ALL_FIELDS.forEach(({ id }) => {
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

  ALL_FIELDS.forEach(({ id }) => {
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
