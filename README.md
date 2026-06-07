# POE2 Orb Arbitrage Calculator

A small, dependency-free web app that checks for possible **triangular
arbitrage** between three POE2 currencies, on the loop:

```
Exalted → Chaos → Divine → Exalted
```

This is a **manual** trade-feasibility tool — no API, no scraping, no login,
no automation. You enter real, executable trade rates and instantly see
whether the loop is profitable.

> The engine is route-agnostic — add more entries to `ROUTES` in `app.js` to
> re-enable multi-route scanning (it will list every route and highlight the
> most profitable).

## Usage

Open `index.html` in any browser (desktop or mobile). Enter:

| Input | Meaning |
| --- | --- |
| **Start Exalted** | How many Exalted Orb you start with |
| **1 Chaos = X Exalted** | Exalted you pay to buy 1 Chaos |
| **1 Divine = X Chaos** | Chaos you must pay to buy 1 Divine |
| **1 Divine = X Exalted** | Exalted you get for selling 1 Divine |
| **Safety Margin %** | Risk haircut applied to the final amount |
| **Minimum Profit %** | Threshold below which profit is flagged "too thin" |

The result recalculates instantly as you type.

### Gold fees

PoE2 currency-exchange trades cost **Gold**, paid on the orb you *buy*:

```
gold fee (per trade) = orbs bought × gold rate of that orb
```

Enter a gold rate per orb (e.g. Exalted 120, Chaos 160, Divine 800) and the
app shows the gold fee per step plus the total. Leave a rate blank for no fee
on that orb. Gold is a separate resource from orbs, so it does not change the
orb-based profit/status — it is shown alongside as a reference cost.

### Convenience features

- **Auto-save** — your rates are stored in `localStorage` and restored on the
  next visit.
- **Shareable link** — "Copy shareable link" puts the current inputs into the
  URL so you can send an exact scenario to someone else. URL values take
  priority over saved ones when the page loads.

## How it works

The three rates fully define the relative value of all three orbs. They are
allowed to be mutually inconsistent — that inconsistency is exactly what an
arbitrage exploits. Each hop converts directly through the relevant pair:

```js
exalted → chaos : amount / exaltedPerChaos
chaos → divine  : amount / chaosPerDivine
divine → exalted: amount * exaltedPerDivine
// ...and the reverse of each
```

For every route the app multiplies the loop, then:

```js
profitPercent         = (finalAmount / startAmount - 1) * 100;
adjustedProfitPercent = profitPercent after the safety-margin haircut;
```

Status (per route) is based on profit **after** the safety margin:

- `adjustedProfitPercent <= 0` → **Not Profitable**
- `0 < adjustedProfitPercent < minimumProfitPercent` → **Potential but Too Thin**
- `adjustedProfitPercent >= minimumProfitPercent` → **Profitable**

Note: rotations of the same loop (e.g. starting from Exalted vs. Chaos) share
the same profit %, since profit is start-amount independent.

## Files

```
index.html    markup
styles.css    dark fantasy / POE-style theme
app.js        conversion, route scanning, validation, persistence, rendering
sprites/      local stylized SVG orb icons (fallback)
```

## Orb icons

Icons hot-link the official Path of Exile art from `web.poecdn.com`, loaded
directly by the visitor's browser. If a CDN image fails to load, the app
falls back automatically to the local stylized SVGs in `sprites/`. To pin
exact PoE2 art, drop your own PNGs in `sprites/` and point `CURRENCIES[...]`
in `app.js` (and the input `<img>` tags) at them.

## Disclaimer

This calculator only checks mathematical opportunity from manually entered
rates. Real trades can fail due to price movement, fake listings, low stock,
whisper delay, and market spread. It does not promise guaranteed profit.
