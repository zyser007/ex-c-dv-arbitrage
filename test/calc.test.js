"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  convert,
  evaluateRoute,
  scanRoutes,
  getStatus,
  validateInputs,
  formatNumber,
  ROUTES,
} = require("../app.js");

const RATES = {
  exaltedPerChaos: 5.5,
  chaosPerDivine: 14.5,
  exaltedPerDivine: 90,
};

const BASE = {
  startAmount: 900,
  ...RATES,
  safetyMarginPercent: 1,
  minimumProfitPercent: 2,
  goldPerExalted: 120,
  goldPerChaos: 160,
  goldPerDivine: 800,
  goldBudget: 0,
};

test("convert handles every pair in both directions", () => {
  assert.equal(convert(11, "exalted", "chaos", RATES), 2); // 11 / 5.5
  assert.equal(convert(2, "chaos", "exalted", RATES), 11); // 2 * 5.5
  assert.equal(convert(29, "chaos", "divine", RATES), 2); // 29 / 14.5
  assert.equal(convert(2, "divine", "chaos", RATES), 29); // 2 * 14.5
  assert.equal(convert(180, "exalted", "divine", RATES), 2); // 180 / 90
  assert.equal(convert(2, "divine", "exalted", RATES), 180); // 2 * 90
});

test("convert throws on an unknown pair", () => {
  assert.throws(() => convert(1, "exalted", "exalted", RATES));
});

test("evaluateRoute floors every step to whole orbs", () => {
  const r = evaluateRoute(["exalted", "chaos", "divine"], BASE);
  assert.deepEqual(
    r.steps.map((s) => s.outAmount),
    [163, 11, 990]
  );
  // No fractional orbs anywhere.
  r.steps.forEach((s) => assert.ok(Number.isInteger(s.outAmount)));
});

test("evaluateRoute tracks leftovers and folds the start-currency one into profit", () => {
  const r = evaluateRoute(["exalted", "chaos", "divine"], BASE);
  assert.equal(r.startLeftover, 4); // 900 - floor(163*5.5)=896
  assert.deepEqual(r.otherLeftovers, [{ currency: "chaos", amount: 4 }]); // 163 - floor(11*14.5)=159
  assert.equal(r.finalAmount, 994); // 990 + 4 folded Exalted
  assert.equal(r.profit, 94);
  assert.equal(r.status, "Profitable");
});

test("evaluateRoute sums the gold fee on each bought orb", () => {
  const r = evaluateRoute(["exalted", "chaos", "divine"], BASE);
  assert.equal(r.steps[0].goldFee, 163 * 160);
  assert.equal(r.steps[1].goldFee, 11 * 800);
  assert.equal(r.steps[2].goldFee, 990 * 120);
  assert.equal(r.goldFee, 26080 + 8800 + 118800);
});

test("a smaller start can lose to rounding", () => {
  const r = evaluateRoute(["exalted", "chaos", "divine"], { ...BASE, startAmount: 100 });
  // 100 -> 18 chaos -> 1 divine -> 90 exalted (+1 leftover) = 91
  assert.equal(r.profit, -9);
  assert.equal(r.status, "Not Profitable");
});

test("gold budget yields whole loops, total profit and remaining gold", () => {
  const r = evaluateRoute(["exalted", "chaos", "divine"], { ...BASE, goldBudget: 500000 });
  assert.deepEqual(r.budget, {
    goldBudget: 500000,
    maxLoops: 3, // floor(500000 / 153680)
    totalProfit: 282, // 3 * 94
    goldUsed: 461040,
    goldLeft: 38960,
  });
});

test("no gold budget (or no fee) leaves budget null", () => {
  assert.equal(evaluateRoute(["exalted", "chaos", "divine"], BASE).budget, null);
  const noFee = { ...BASE, goldBudget: 1000, goldPerExalted: 0, goldPerChaos: 0, goldPerDivine: 0 };
  assert.equal(evaluateRoute(["exalted", "chaos", "divine"], noFee).budget, null);
});

test("getStatus thresholds", () => {
  assert.equal(getStatus(-1, 2), "Not Profitable");
  assert.equal(getStatus(0, 2), "Not Profitable");
  assert.equal(getStatus(1, 2), "Potential but Too Thin");
  assert.equal(getStatus(2, 2), "Profitable");
  assert.equal(getStatus(5, 2), "Profitable");
});

test("scanRoutes returns one entry for the single active route", () => {
  assert.equal(ROUTES.length, 1);
  assert.equal(scanRoutes(BASE).length, 1);
});

test("validateInputs rejects non-positive required fields", () => {
  const raw = {
    startAmount: "0",
    exaltedPerChaos: "5.5",
    chaosPerDivine: "14.5",
    exaltedPerDivine: "90",
    safetyMarginPercent: "",
    minimumProfitPercent: "",
    goldPerExalted: "",
    goldPerChaos: "",
    goldPerDivine: "",
    goldBudget: "",
  };
  const { ok, errors } = validateInputs(raw);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.id === "startAmount"));
});

test("validateInputs treats blank gold/budget as 0 and blank optionals as defaults", () => {
  const raw = {
    startAmount: "900",
    exaltedPerChaos: "5.5",
    chaosPerDivine: "14.5",
    exaltedPerDivine: "90",
    safetyMarginPercent: "",
    minimumProfitPercent: "",
    goldPerExalted: "",
    goldPerChaos: "",
    goldPerDivine: "",
    goldBudget: "",
  };
  const { ok, values } = validateInputs(raw);
  assert.equal(ok, true);
  assert.equal(values.goldPerExalted, 0);
  assert.equal(values.goldBudget, 0);
  assert.equal(values.safetyMarginPercent, 1); // default
  assert.equal(values.minimumProfitPercent, 2); // default
});

test("validateInputs rejects negative gold values", () => {
  const raw = {
    startAmount: "900",
    exaltedPerChaos: "5.5",
    chaosPerDivine: "14.5",
    exaltedPerDivine: "90",
    safetyMarginPercent: "",
    minimumProfitPercent: "",
    goldPerExalted: "-1",
    goldPerChaos: "",
    goldPerDivine: "",
    goldBudget: "",
  };
  const { ok, errors } = validateInputs(raw);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => e.id === "goldPerExalted"));
});

test("formatNumber groups thousands and limits decimals", () => {
  assert.equal(formatNumber(153680, 0), "153,680");
  assert.equal(formatNumber(6.66666, 2), "6.67");
});
