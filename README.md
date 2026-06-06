# POE2 Orb Arbitrage Calculator

A small, dependency-free web app that helps detect possible **triangular
arbitrage** between POE2 currencies:

```
Exalted Orb → Chaos Orb → Divine Orb → Exalted Orb
```

This is a **manual** trade-feasibility calculator — no API, no scraping, no
login, no automation. You enter real, executable trade rates and instantly see
whether the loop is profitable.

## Usage

Open `index.html` in any browser (desktop or mobile). Enter:

| Input | Meaning |
| --- | --- |
| **Start Exalted** | How many Exalted Orb you start with |
| **1 Exalted = X Chaos** | Chaos you get for selling 1 Exalted |
| **1 Divine = X Chaos** | Chaos you must pay to buy 1 Divine |
| **1 Divine = X Exalted** | Exalted you get for selling 1 Divine |
| **Safety Margin %** | Risk haircut applied to the final amount |
| **Minimum Profit %** | Threshold below which profit is flagged "too thin" |

The result recalculates instantly as you type.

## Formula

```js
chaosAmount  = startExalted * exaltedToChaosRate;
divineAmount = chaosAmount  / chaosPerDivineRate;
finalExalted = divineAmount * divineToExaltedRate;

profitExalted = finalExalted - startExalted;
profitPercent = (profitExalted / startExalted) * 100;
```

Status is based on profit **after** the safety margin:

- `adjustedProfitPercent <= 0` → **Not Profitable**
- `0 < adjustedProfitPercent < minimumProfitPercent` → **Potential but Too Thin**
- `adjustedProfitPercent >= minimumProfitPercent` → **Profitable**

## Files

```
index.html    markup
styles.css    dark fantasy / POE-style theme
app.js        calculation, validation, rendering
sprites/      optional orb icons (app works fine without them)
```

## Disclaimer

This calculator only checks mathematical opportunity from manually entered
rates. Real trades can fail due to price movement, fake listings, low stock,
whisper delay, and market spread. It does not promise guaranteed profit.
