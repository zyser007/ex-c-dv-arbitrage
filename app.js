"use strict";

const DEFAULTS = {
  startExalted: 100,
  exaltedPerChaos: 5.5,
  chaosPerDivineRate: 14.5,
  divineToExaltedRate: 90,
  safetyMarginPercent: 1,
  minimumProfitPercent: 2,
};

const STATUS = {
  PROFITABLE: "Profitable",
  THIN: "Potential but Too Thin",
  NOT: "Not Profitable",
};

// Fields that must be > 0 for a valid calculation.
const REQUIRED_POSITIVE = [
  { id: "startExalted", label: "Start Exalted" },
  { id: "exaltedPerChaos", label: "1 Chaos = Exalted rate" },
  { id: "chaosPerDivineRate", label: "1 Divine = Chaos rate" },
  { id: "divineToExaltedRate", label: "1 Divine = Exalted rate" },
];

// Optional fields that, if provided, must be >= 0.
const OPTIONAL_NONNEG = [
  { id: "safetyMarginPercent", label: "Safety Margin %" },
  { id: "minimumProfitPercent", label: "Minimum Profit %" },
];

/* ---------- input handling ---------- */

function readInputs() {
  const get = (id) => document.getElementById(id).value.trim();
  return {
    startExalted: get("startExalted"),
    exaltedPerChaos: get("exaltedPerChaos"),
    chaosPerDivineRate: get("chaosPerDivineRate"),
    divineToExaltedRate: get("divineToExaltedRate"),
    safetyMarginPercent: get("safetyMarginPercent"),
    minimumProfitPercent: get("minimumProfitPercent"),
  };
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
      values[id] = DEFAULTS[id]; // fall back to default when left blank
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

function calculateArbitrage(input) {
  const {
    startExalted,
    exaltedPerChaos,
    chaosPerDivineRate,
    divineToExaltedRate,
    safetyMarginPercent,
    minimumProfitPercent,
  } = input;

  // Step 1 sells Exalted to acquire Chaos; each Chaos costs `exaltedPerChaos`.
  const chaosAmount = startExalted / exaltedPerChaos;
  const divineAmount = chaosAmount / chaosPerDivineRate;
  const finalExalted = divineAmount * divineToExaltedRate;

  const profitExalted = finalExalted - startExalted;
  const profitPercent = (profitExalted / startExalted) * 100;

  const safetyMultiplier = 1 - safetyMarginPercent / 100;
  const adjustedFinalExalted = finalExalted * safetyMultiplier;
  const adjustedProfitExalted = adjustedFinalExalted - startExalted;
  const adjustedProfitPercent = (adjustedProfitExalted / startExalted) * 100;

  const status = getStatus(adjustedProfitPercent, minimumProfitPercent);

  return {
    startExalted,
    chaosAmount,
    divineAmount,
    finalExalted,
    profitExalted,
    profitPercent,
    safetyMarginPercent,
    adjustedFinalExalted,
    adjustedProfitExalted,
    adjustedProfitPercent,
    minimumProfitPercent,
    status,
  };
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
  const prefix = value > 0 ? "+" : "";
  return prefix + formatNumber(value, decimals);
}

/* ---------- rendering ---------- */

function statusClass(status) {
  if (status === STATUS.PROFITABLE) return "status-profitable";
  if (status === STATUS.THIN) return "status-thin";
  return "status-not";
}

function renderValidation(errors) {
  const el = document.getElementById("resultContent");
  const items = errors.map((e) => `<li>${e.message}</li>`).join("");
  el.innerHTML = `
    <div class="validation">
      <strong>Invalid input</strong>
      <ul>${items}</ul>
    </div>`;
}

function renderResult(r) {
  const el = document.getElementById("resultContent");
  const profitSign = r.profitExalted >= 0 ? "pos" : "neg";
  const adjSign = r.adjustedProfitExalted >= 0 ? "pos" : "neg";

  const showWarning =
    r.status === STATUS.THIN
      ? `<p class="status-warning">Profit looks thin. Real trade spread, delay, or fake listings may remove the gain.</p>`
      : "";

  el.innerHTML = `
    <h2>Result</h2>
    <ol class="steps">
      <li><span class="step-num">0.</span> Start:
        <span class="amt">${formatNumber(r.startExalted)}</span> Exalted</li>
      <li><span class="step-num">1.</span>
        ${formatNumber(r.startExalted)} Exalted →
        <span class="amt">${formatNumber(r.chaosAmount)}</span> Chaos</li>
      <li><span class="step-num">2.</span>
        ${formatNumber(r.chaosAmount)} Chaos →
        <span class="amt">${formatNumber(r.divineAmount)}</span> Divine</li>
      <li><span class="step-num">3.</span>
        ${formatNumber(r.divineAmount)} Divine →
        <span class="amt">${formatNumber(r.finalExalted)}</span> Exalted</li>
    </ol>

    <div class="profit-cards">
      <div class="card">
        <span class="card-label">Raw Profit</span>
        <span class="card-value ${profitSign}">${signed(r.profitExalted)} Ex</span>
        <span class="card-sub ${profitSign}">${signed(r.profitPercent, 2)}%</span>
      </div>
      <div class="card">
        <span class="card-label">After ${formatNumber(r.safetyMarginPercent, 2)}% Safety</span>
        <span class="card-value ${adjSign}">${signed(r.adjustedProfitExalted)} Ex</span>
        <span class="card-sub ${adjSign}">${signed(r.adjustedProfitPercent, 2)}%</span>
      </div>
    </div>

    <div class="status-banner ${statusClass(r.status)}">
      ${r.status}
    </div>
    ${showWarning}`;
}

function renderEmpty() {
  document.getElementById("resultContent").innerHTML =
    `<div class="result-empty">Enter rates and press Calculate to check the route.</div>`;
}

/* ---------- orchestration ---------- */

function run() {
  const raw = readInputs();
  const { ok, errors } = validateInputs(raw);

  // mark invalid fields
  const errorIds = new Set(errors.map((e) => e.id));
  [...REQUIRED_POSITIVE, ...OPTIONAL_NONNEG].forEach(({ id }) => {
    document.getElementById(id).classList.toggle("invalid", errorIds.has(id));
  });

  if (!ok) {
    renderValidation(errors);
    return;
  }

  const result = calculateArbitrage(validateInputs(raw).values);
  renderResult(result);
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

  // instant recalculation as the user types
  [...REQUIRED_POSITIVE, ...OPTIONAL_NONNEG].forEach(({ id }) => {
    document.getElementById(id).addEventListener("input", run);
  });
}

function init() {
  setDefaults();
  bindEvents();
  run();
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", init);
}

// Exported for potential testing environments (no-op in browser).
if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateArbitrage, getStatus, validateInputs, formatNumber };
}
