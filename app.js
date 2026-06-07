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
const LANG_KEY = "poe2-arb-lang";
let lang = "en";

// Orb names are kept in English (item proper nouns) in both languages.
const I18N = {
  en: {
    title: "POE2 Orb Arbitrage Calculator",
    subtitle: "Manual triangular arbitrage checker for",
    start_label: "Start Exalted",
    start_hint: "How many Exalted Orb you start with",
    rate1_hint: "Exalted you pay to buy 1 Chaos",
    rate2_hint: "Chaos you must pay to buy 1 Divine",
    rate3_hint: "Exalted you get for selling 1 Divine",
    gold_summary: "Gold Fees (per orb bought)",
    gold_hint: "Gold paid each trade = orbs bought × gold rate. Leave blank for no fee.",
    gold_exalted: "Gold per Exalted",
    gold_chaos: "Gold per Chaos",
    gold_divine: "Gold per Divine",
    optional_settings: "Optional Settings",
    safety_label: "Safety Margin %",
    safety_hint: "Haircut applied to final amount for risk",
    minprofit_label: "Minimum Profit %",
    minprofit_hint: "Below this, profit is flagged as too thin",
    calc_btn: "Calculate",
    reset_btn: "Reset",
    copy_btn: "Copy shareable link",
    copy_done: "Link copied!",
    disclaimer:
      "This calculator only checks mathematical opportunity from manually entered rates. Real trades can fail due to price movement, fake listings, low stock, whisper delay, and market spread.",
    route_title: "Route",
    best_route_title: "Best Route",
    start_word: "Start:",
    whole_orbs: "Whole orbs only — each step is rounded down.",
    raw_profit: "Raw Profit",
    after_safety: "After {p}% Safety",
    total_gold_fee: "Total Gold Fee",
    gold_unit: "gold",
    leftover_orbs: "Leftover orbs",
    in_profit: "in profit",
    all_routes: "All Routes",
    routes_note: "Profit % below is after the safety margin. Rotations of the same loop share a %.",
    warning_thin: "Profit looks thin. Real trade spread, delay, or fake listings may remove the gain.",
    invalid_input: "Invalid input",
    status_profitable: "Profitable",
    status_thin: "Potential but Too Thin",
    status_not: "Not Profitable",
    f_startAmount: "Start amount",
    f_exaltedPerChaos: "1 Chaos = Exalted rate",
    f_chaosPerDivine: "1 Divine = Chaos rate",
    f_exaltedPerDivine: "1 Divine = Exalted rate",
    f_safetyMarginPercent: "Safety Margin %",
    f_minimumProfitPercent: "Minimum Profit %",
    f_goldPerExalted: "Gold per Exalted",
    f_goldPerChaos: "Gold per Chaos",
    f_goldPerDivine: "Gold per Divine",
    msg_required: "{label} is required.",
    msg_number: "{label} must be a number.",
    msg_gt0: "{label} must be greater than 0.",
    msg_negative: "{label} cannot be negative.",
  },
  th: {
    title: "เครื่องคำนวณ Arbitrage ออร์บ POE2",
    subtitle: "ตัวเช็ก arbitrage สามเหลี่ยมแบบกรอกเอง สำหรับ",
    start_label: "Exalted เริ่มต้น",
    start_hint: "เริ่มต้นด้วย Exalted Orb กี่อัน",
    rate1_hint: "Exalted ที่จ่ายเพื่อซื้อ Chaos 1 อัน",
    rate2_hint: "Chaos ที่ต้องจ่ายเพื่อซื้อ Divine 1 อัน",
    rate3_hint: "Exalted ที่ได้จากการขาย Divine 1 อัน",
    gold_summary: "ค่าธรรมเนียม Gold (ต่อออร์บที่ซื้อ)",
    gold_hint: "Gold ที่จ่ายต่อการเทรด = จำนวนออร์บที่ซื้อ × อัตรา gold · ปล่อยว่าง = ไม่คิดค่าธรรมเนียม",
    gold_exalted: "Gold ต่อ Exalted",
    gold_chaos: "Gold ต่อ Chaos",
    gold_divine: "Gold ต่อ Divine",
    optional_settings: "ตั้งค่าเพิ่มเติม",
    safety_label: "เผื่อความปลอดภัย %",
    safety_hint: "หักออกจากยอดสุดท้ายเพื่อกันความเสี่ยง",
    minprofit_label: "กำไรขั้นต่ำ %",
    minprofit_hint: "ต่ำกว่านี้จะถูกตีว่ากำไรบางเกินไป",
    calc_btn: "คำนวณ",
    reset_btn: "รีเซ็ต",
    copy_btn: "คัดลอกลิงก์แชร์",
    copy_done: "คัดลอกลิงก์แล้ว!",
    disclaimer:
      "เครื่องมือนี้ตรวจแค่โอกาสเชิงตัวเลขจากเรตที่กรอกเอง การเทรดจริงอาจล้มเหลวได้จากราคาที่ขยับ ประกาศหลอก ของไม่พอ ดีเลย์ตอน whisper และส่วนต่างราคาตลาด",
    route_title: "เส้นทาง",
    best_route_title: "เส้นทางที่ดีที่สุด",
    start_word: "เริ่ม:",
    whole_orbs: "ออร์บเป็นจำนวนเต็มเท่านั้น — ปัดลงทุกสเต็ป",
    raw_profit: "กำไรดิบ",
    after_safety: "หลังเผื่อ {p}%",
    total_gold_fee: "ค่าธรรมเนียม Gold รวม",
    gold_unit: "gold",
    leftover_orbs: "ออร์บที่เหลือ",
    in_profit: "รวมในกำไรแล้ว",
    all_routes: "ทุกเส้นทาง",
    routes_note: "% กำไรด้านล่างคิดหลังเผื่อความปลอดภัยแล้ว · การหมุนวนเส้นเดียวกันได้ % เท่ากัน",
    warning_thin: "กำไรดูบางมาก ส่วนต่างราคา ดีเลย์ หรือประกาศหลอกอาจทำให้กำไรหายได้",
    invalid_input: "ข้อมูลไม่ถูกต้อง",
    status_profitable: "ทำกำไรได้",
    status_thin: "พอมีโอกาส แต่บางเกินไป",
    status_not: "ไม่คุ้ม",
    f_startAmount: "จำนวนเริ่มต้น",
    f_exaltedPerChaos: "เรต 1 Chaos = Exalted",
    f_chaosPerDivine: "เรต 1 Divine = Chaos",
    f_exaltedPerDivine: "เรต 1 Divine = Exalted",
    f_safetyMarginPercent: "เผื่อความปลอดภัย %",
    f_minimumProfitPercent: "กำไรขั้นต่ำ %",
    f_goldPerExalted: "Gold ต่อ Exalted",
    f_goldPerChaos: "Gold ต่อ Chaos",
    f_goldPerDivine: "Gold ต่อ Divine",
    msg_required: "ต้องกรอก {label}",
    msg_number: "{label} ต้องเป็นตัวเลข",
    msg_gt0: "{label} ต้องมากกว่า 0",
    msg_negative: "{label} ห้ามติดลบ",
  },
};

function t(key, params) {
  let s = (I18N[lang] && I18N[lang][key]) || I18N.en[key] || key;
  if (params) {
    Object.keys(params).forEach((k) => {
      s = s.replace("{" + k + "}", params[k]);
    });
  }
  return s;
}

function statusText(status) {
  if (status === STATUS.PROFITABLE) return t("status_profitable");
  if (status === STATUS.THIN) return t("status_thin");
  return t("status_not");
}

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
  { id: "startAmount", labelKey: "f_startAmount" },
  { id: "exaltedPerChaos", labelKey: "f_exaltedPerChaos" },
  { id: "chaosPerDivine", labelKey: "f_chaosPerDivine" },
  { id: "exaltedPerDivine", labelKey: "f_exaltedPerDivine" },
];

const OPTIONAL_NONNEG = [
  { id: "safetyMarginPercent", labelKey: "f_safetyMarginPercent" },
  { id: "minimumProfitPercent", labelKey: "f_minimumProfitPercent" },
];

// Gold fee per orb bought; blank counts as 0 (no fee on that orb).
const GOLD_FIELDS = [
  { id: "goldPerExalted", labelKey: "f_goldPerExalted" },
  { id: "goldPerChaos", labelKey: "f_goldPerChaos" },
  { id: "goldPerDivine", labelKey: "f_goldPerDivine" },
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

  REQUIRED_POSITIVE.forEach(({ id, labelKey }) => {
    const label = t(labelKey);
    if (raw[id] === "") {
      errors.push({ id, message: t("msg_required", { label }) });
      return;
    }
    const n = Number(raw[id]);
    if (!Number.isFinite(n)) {
      errors.push({ id, message: t("msg_number", { label }) });
    } else if (n <= 0) {
      errors.push({ id, message: t("msg_gt0", { label }) });
    } else {
      values[id] = n;
    }
  });

  OPTIONAL_NONNEG.forEach(({ id, labelKey }) => {
    if (raw[id] === "") {
      values[id] = DEFAULTS[id];
      return;
    }
    const label = t(labelKey);
    const n = Number(raw[id]);
    if (!Number.isFinite(n)) {
      errors.push({ id, message: t("msg_number", { label }) });
    } else if (n < 0) {
      errors.push({ id, message: t("msg_negative", { label }) });
    } else {
      values[id] = n;
    }
  });

  GOLD_FIELDS.forEach(({ id, labelKey }) => {
    if (raw[id] === "") {
      values[id] = 0; // blank = no gold fee on this orb
      return;
    }
    const label = t(labelKey);
    const n = Number(raw[id]);
    if (!Number.isFinite(n)) {
      errors.push({ id, message: t("msg_number", { label }) });
    } else if (n < 0) {
      errors.push({ id, message: t("msg_negative", { label }) });
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

// How much of the input orb a step actually spends. "Buy" steps (divide)
// can leave a remainder; "sell" steps (multiply) consume the whole input.
function stepConsumed(from, to, outAmount, rates) {
  switch (from + "_" + to) {
    case "exalted_chaos": return Math.floor(outAmount * rates.exaltedPerChaos);
    case "chaos_divine": return Math.floor(outAmount * rates.chaosPerDivine);
    case "exalted_divine": return Math.floor(outAmount * rates.exaltedPerDivine);
    default: return null; // sell step — all input is consumed
  }
}

function evaluateRoute(route, input) {
  const { safetyMarginPercent, minimumProfitPercent } = input;
  // In-game orbs are whole numbers — round down at every step.
  const startAmount = Math.floor(input.startAmount);
  const startCurrency = route[0];
  const goldPerOrb = {
    exalted: input.goldPerExalted || 0,
    chaos: input.goldPerChaos || 0,
    divine: input.goldPerDivine || 0,
  };
  const path = [...route, startCurrency];

  let amount = startAmount;
  let goldFee = 0;
  const leftovers = {}; // currency -> whole orbs left unspent
  const steps = [];
  for (let i = 0; i < 3; i++) {
    const from = path[i];
    const to = path[i + 1];
    const out = Math.floor(convert(amount, from, to, input));
    // Gold fee is paid on the orb you buy (the step's output).
    const stepGold = out * goldPerOrb[to];
    goldFee += stepGold;

    const consumed = stepConsumed(from, to, out, input);
    const leftover = consumed === null ? 0 : amount - consumed;
    if (leftover > 0) leftovers[from] = (leftovers[from] || 0) + leftover;

    steps.push({ from, to, inAmount: amount, outAmount: out, goldFee: stepGold, leftover });
    amount = out;
  }

  // Leftover in the start currency is held in the same orb you end with,
  // so it adds to the final total; other leftovers stay stranded.
  const startLeftover = leftovers[startCurrency] || 0;
  const otherLeftovers = Object.keys(leftovers)
    .filter((c) => c !== startCurrency && leftovers[c] > 0)
    .map((c) => ({ currency: c, amount: leftovers[c] }));

  const finalAmount = amount + startLeftover;
  const profit = finalAmount - startAmount;
  const profitPercent = (profit / startAmount) * 100;

  const safetyMultiplier = 1 - safetyMarginPercent / 100;
  const adjustedFinal = finalAmount * safetyMultiplier;
  const adjustedProfit = adjustedFinal - startAmount;
  const adjustedProfitPercent = (adjustedProfit / startAmount) * 100;

  return {
    route,
    startCurrency,
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
    startLeftover,
    otherLeftovers,
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
      <strong>${t("invalid_input")}</strong>
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
          ? ` <span class="step-fee">· ${formatNumber(Math.floor(s.goldFee), 0)} ${t("gold_unit")}</span>`
          : "";
      return `
      <li><span class="step-num">${i + 1}.</span>
        ${formatNumber(s.inAmount)} ${CURRENCIES[s.from].short} →
        <span class="amt">${formatNumber(s.outAmount)}</span> ${CURRENCIES[s.to].short}${fee}</li>`;
    })
    .join("");

  // Leftover summary: start-currency leftover is folded into profit; the rest
  // is kept in other orbs. Show every orb that has a remainder, with its icon.
  const allLeftovers = [];
  if (best.startLeftover > 0) {
    allLeftovers.push({ currency: best.startCurrency, amount: best.startLeftover, inProfit: true });
  }
  best.otherLeftovers.forEach((l) =>
    allLeftovers.push({ currency: l.currency, amount: l.amount, inProfit: false })
  );

  const leftoverCard =
    allLeftovers.length > 0
      ? `
    <div class="leftover-card">
      <span class="card-label">${t("leftover_orbs")}</span>
      <div class="leftover-list">
        ${allLeftovers
          .map(
            (l) => `
          <span class="leftover-item">
            <img class="orb-icon" src="${CURRENCIES[l.currency].icon}" alt=""
              onerror="this.onerror=null;this.src='${CURRENCIES[l.currency].fallback}'">
            <span class="leftover-amt">${formatNumber(l.amount, 0)}</span> ${CURRENCIES[l.currency].short}
            ${l.inProfit ? `<span class="tag">${t("in_profit")}</span>` : ""}
          </span>`
          )
          .join("")}
      </div>
    </div>`
      : "";

  const warning =
    best.status === STATUS.THIN
      ? `<p class="status-warning">${t("warning_thin")}</p>`
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
            <span class="pill ${statusClass(r.status)}">${statusText(r.status)}</span>
          </div>
        </div>`;
      })
      .join("");
    routesSection = `
      <h2 class="routes-heading">${t("all_routes")}</h2>
      <p class="routes-note">${t("routes_note")}</p>
      <div class="routes">${routeRows}</div>`;
  }

  const goldSection =
    best.goldFee > 0
      ? `
    <div class="gold-card">
      <div class="gold-row">
        <span class="card-label">${t("total_gold_fee")}</span>
        <span class="gold-value">${formatNumber(Math.floor(best.goldFee), 0)} ${t("gold_unit")}</span>
      </div>
    </div>`
      : "";

  el.innerHTML = `
    <h2>${scan.length > 1 ? t("best_route_title") : t("route_title")}</h2>
    <div class="best-route-path">${routePathHtml(best.route)}</div>
    <ol class="steps">
      <li><span class="step-num">0.</span> ${t("start_word")}
        <span class="amt">${formatNumber(best.startAmount)}</span> ${startShort}</li>
      ${stepLis}
    </ol>
    <p class="routes-note">${t("whole_orbs")}</p>

    <div class="profit-cards">
      <div class="card">
        <span class="card-label">${t("raw_profit")}</span>
        <span class="card-value ${profitSign}">${signed(Math.floor(best.profit), 0)} ${startShort}</span>
        <span class="card-sub ${profitSign}">${signed(best.profitPercent, 2)}%</span>
      </div>
      <div class="card">
        <span class="card-label">${t("after_safety", { p: formatNumber(best.safetyMarginPercent, 2) })}</span>
        <span class="card-value ${adjSign}">${signed(Math.floor(best.adjustedProfit), 0)} ${startShort}</span>
        <span class="card-sub ${adjSign}">${signed(best.adjustedProfitPercent, 2)}%</span>
      </div>
    </div>
    ${goldSection}

    <div class="status-banner ${statusClass(best.status)}">${statusText(best.status)}</div>
    ${warning}
    ${leftoverCard}
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
  if (lang && lang !== "en") params.set("lang", lang);
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
  btn.textContent = t("copy_done");
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = t("copy_btn");
    btn.classList.remove("copied");
  }, 1500);
}

/* ---------- language ---------- */

function loadLang() {
  let l = "en";
  try {
    l = localStorage.getItem(LANG_KEY) || l;
  } catch (e) {
    /* ignore */
  }
  if (typeof location !== "undefined") {
    const p = new URLSearchParams(location.search);
    if (p.has("lang")) l = p.get("lang");
  }
  lang = l === "th" ? "th" : "en";
}

function applyStaticI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.documentElement.lang = lang;
  document.title = t("title");
  document.querySelectorAll(".lang-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.lang === lang);
  });
}

function setLang(newLang) {
  lang = newLang === "th" ? "th" : "en";
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch (e) {
    /* ignore */
  }
  applyStaticI18n();
  run(); // re-render dynamic content + refresh URL (incl. lang)
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

  document.querySelectorAll(".lang-btn").forEach((b) => {
    b.addEventListener("click", () => setLang(b.dataset.lang));
  });

  ALL_FIELDS.forEach(({ id }) => {
    document.getElementById(id).addEventListener("input", run);
  });
}

function registerServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

function init() {
  loadLang();
  applyStaticI18n();
  loadInitialValues();
  bindEvents();
  run();
  registerServiceWorker();
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
