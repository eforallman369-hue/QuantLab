// ═══════════════════════════════════════════════════
// BEI QUANT LAB — MATH ENGINE
// Semua formula dari scratch, tidak ada library magic
// ═══════════════════════════════════════════════════

// ── BASIC STATS ──────────────────────────────────

export const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

export const std = arr => {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
};

export const median = arr => {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const percentile = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
};

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── RETURNS ──────────────────────────────────────

/**
 * Hitung daily log returns dari array harga
 * Log return: r_t = ln(P_t / P_{t-1})
 */
export const logReturns = prices =>
  prices.slice(1).map((p, i) => Math.log(p / prices[i]));

/**
 * Hitung daily simple returns
 * r_t = (P_t - P_{t-1}) / P_{t-1}
 */
export const simpleReturns = prices =>
  prices.slice(1).map((p, i) => (p - prices[i]) / prices[i]);

/**
 * Annualized return dari array harga (252 trading days)
 */
export const annualReturn = prices => {
  const total = prices[prices.length - 1] / prices[0] - 1;
  const years = prices.length / 252;
  return Math.pow(1 + total, 1 / years) - 1;
};

/**
 * Annualized volatility dari daily returns
 */
export const annualVol = dailyReturns =>
  std(dailyReturns) * Math.sqrt(252);

// ── RISK METRICS ─────────────────────────────────

/**
 * Sharpe Ratio = (Annualized Return - Risk Free) / Annualized Vol
 * Risk free rate default: 6% (BI Rate Indonesia)
 */
export const sharpe = (dailyReturns, rf = 0.06) => {
  const aR = mean(dailyReturns) * 252;
  const aV = std(dailyReturns) * Math.sqrt(252);
  return aV === 0 ? 0 : (aR - rf) / aV;
};

/**
 * Sortino Ratio = (Annualized Return - Rf) / Downside Deviation
 * Hanya hitung volatilitas return negatif
 */
export const sortino = (dailyReturns, rf = 0.06) => {
  const aR = mean(dailyReturns) * 252;
  const negRets = dailyReturns.filter(r => r < 0);
  if (!negRets.length) return Infinity;
  const downDev = Math.sqrt(negRets.reduce((a, r) => a + r * r, 0) / negRets.length) * Math.sqrt(252);
  return downDev === 0 ? 0 : (aR - rf) / downDev;
};

/**
 * Maximum Drawdown = max(peak - trough) / peak
 */
export const maxDrawdown = prices => {
  let mdd = 0, peak = prices[0];
  for (const p of prices) {
    if (p > peak) peak = p;
    const dd = (peak - p) / peak;
    if (dd > mdd) mdd = dd;
  }
  return mdd;
};

/**
 * Calmar Ratio = Annualized Return / Max Drawdown
 */
export const calmar = prices => {
  const rets = simpleReturns(prices);
  const aR = mean(rets) * 252;
  const mdd = maxDrawdown(prices);
  return mdd === 0 ? 0 : aR / mdd;
};

/**
 * Value at Risk (VaR) — Historical method
 * Berapa kerugian maksimum pada confidence level tertentu
 */
export const varHistorical = (dailyReturns, confidence = 0.95) =>
  -percentile(dailyReturns, (1 - confidence) * 100);

/**
 * Expected Shortfall (CVaR) — rata-rata kerugian melebihi VaR
 */
export const cvar = (dailyReturns, confidence = 0.95) => {
  const v = varHistorical(dailyReturns, confidence);
  const tail = dailyReturns.filter(r => r < -v);
  return tail.length ? -mean(tail) : v;
};

// ── POSITION SIZING ───────────────────────────────

/**
 * Kelly Criterion
 * f* = (b*p - q) / b
 * b = avg_win / avg_loss (odds)
 * p = win rate
 * q = 1 - p
 * Gunakan half-Kelly (f* / 2) untuk safety.
 */
export const kellyFraction = (winRate, avgWin, avgLoss) => {
  if (avgLoss === 0 || avgWin === 0) return 0;
  const b = Math.abs(avgWin / avgLoss);
  const q = 1 - winRate;
  const f = (b * winRate - q) / b;
  return clamp(f, 0, 1);
};

/**
 * Expected Value per trade
 * EV = (P_win * Avg_win) - (P_loss * Avg_loss)
 */
export const expectedValue = (winRate, avgWin, avgLoss) =>
  winRate * avgWin - (1 - winRate) * Math.abs(avgLoss);

// ── SIGNAL GENERATION ─────────────────────────────

/**
 * Z-Score rolling
 * Z_i = (Price_i - MA_n) / σ_n
 */
export const rollingZScore = (prices, window = 20) =>
  prices.map((_, i) => {
    if (i < window) return 0;
    const w = prices.slice(i - window, i);
    const m = mean(w), s = std(w);
    return s === 0 ? 0 : (prices[i] - m) / s;
  });

/**
 * Rolling Moving Average
 */
export const rollingMA = (prices, window) =>
  prices.map((_, i) => {
    if (i < window - 1) return null;
    return mean(prices.slice(i - window + 1, i + 1));
  });

/**
 * Rolling Standard Deviation
 */
export const rollingStd = (prices, window) =>
  prices.map((_, i) => {
    if (i < window - 1) return null;
    return std(prices.slice(i - window + 1, i + 1));
  });

/**
 * RSI — Relative Strength Index
 */
export const rsi = (prices, period = 14) => {
  const rets = simpleReturns(prices);
  return rets.map((_, i) => {
    if (i < period) return null;
    const w = rets.slice(i - period, i);
    const gains = w.filter(r => r > 0);
    const losses = w.filter(r => r < 0);
    const avgG = gains.length ? mean(gains) : 0;
    const avgL = losses.length ? Math.abs(mean(losses)) : 0;
    if (avgL === 0) return 100;
    const rs = avgG / avgL;
    return 100 - 100 / (1 + rs);
  });
};

/**
 * Volume Ratio — deteksi unusual volume
 * VR = Volume_i / MA_Volume_20
 */
export const volumeRatio = (volumes, window = 20) =>
  volumes.map((v, i) => {
    if (i < window) return 1;
    const avg = mean(volumes.slice(i - window, i));
    return avg === 0 ? 1 : v / avg;
  });

// ── STATISTICAL EDGE DETECTION ────────────────────

/**
 * Autocorrelation lag-1
 * Positif = momentum tendency
 * Negatif = mean reversion tendency
 */
export const autocorrelation = (returns, lag = 1) => {
  const n = returns.length;
  if (n <= lag) return 0;
  const m = mean(returns);
  const variance = returns.reduce((a, r) => a + (r - m) ** 2, 0);
  let cov = 0;
  for (let i = lag; i < n; i++) {
    cov += (returns[i] - m) * (returns[i - lag] - m);
  }
  return variance === 0 ? 0 : cov / variance;
};

/**
 * Hurst Exponent (rescaled range analysis)
 * H > 0.5 = trending/momentum
 * H = 0.5 = random walk
 * H < 0.5 = mean reverting
 */
export const hurstExponent = prices => {
  const lags = [2, 4, 8, 16, 32].filter(l => l < prices.length / 2);
  if (lags.length < 2) return 0.5;

  const logRS = lags.map(lag => {
    const blocks = Math.floor(prices.length / lag);
    const rsArr = [];
    for (let b = 0; b < blocks; b++) {
      const seg = prices.slice(b * lag, (b + 1) * lag);
      const rets = simpleReturns(seg);
      if (!rets.length) continue;
      const m = mean(rets);
      let cumDev = 0, max = -Infinity, min = Infinity;
      for (const r of rets) {
        cumDev += r - m;
        if (cumDev > max) max = cumDev;
        if (cumDev < min) min = cumDev;
      }
      const R = max - min;
      const S = std(rets);
      if (S > 0) rsArr.push(R / S);
    }
    return rsArr.length ? Math.log(mean(rsArr)) : null;
  });

  const validLags = lags.filter((_, i) => logRS[i] !== null);
  const validRS   = logRS.filter(v => v !== null);
  if (validLags.length < 2) return 0.5;

  const logL = validLags.map(Math.log);
  // Linear regression logRS ~ logL → slope = Hurst
  const n = logL.length;
  const mX = mean(logL), mY = mean(validRS);
  const num = logL.reduce((a, x, i) => a + (x - mX) * (validRS[i] - mY), 0);
  const den = logL.reduce((a, x) => a + (x - mX) ** 2, 0);
  return den === 0 ? 0.5 : clamp(num / den, 0, 1);
};

/**
 * Rolling Sharpe — deteksi periode edge vs no edge
 */
export const rollingSharpe = (returns, window = 60, rf = 0.06) =>
  returns.map((_, i) => {
    if (i < window) return null;
    const w = returns.slice(i - window, i);
    const aR = mean(w) * 252;
    const aV = std(w) * Math.sqrt(252);
    return aV === 0 ? 0 : (aR - rf) / aV;
  });

// ── MONTE CARLO ENGINE ────────────────────────────

/**
 * Box-Muller transform → standard normal random number
 */
const randn = () => {
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

/**
 * Simulate satu GBM path
 * dS = μ·S·dt + σ·S·dW
 * S_t = S_0 * exp((μ - σ²/2)*t + σ*√t*Z)
 */
const gbmPath = (S0, mu, sigma, days) => {
  const dt = 1 / 252;
  const path = [S0];
  for (let i = 1; i < days; i++) {
    const prev = path[i - 1];
    path.push(prev * Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * randn()));
  }
  return path;
};

/**
 * Monte Carlo Simulation
 * @param {number} S0 - harga awal
 * @param {number} mu - drift tahunan (dari data historis)
 * @param {number} sigma - volatilitas tahunan (dari data historis)
 * @param {number} days - horizon simulasi dalam hari
 * @param {number} nPaths - jumlah simulasi
 * @returns {object} { paths, percentiles, finalPrices }
 */
export const monteCarlo = (S0, mu, sigma, days = 252, nPaths = 1000) => {
  const paths = [];
  const finalPrices = [];

  for (let i = 0; i < nPaths; i++) {
    const path = gbmPath(S0, mu, sigma, days);
    paths.push(path);
    finalPrices.push(path[path.length - 1]);
  }

  // Hitung percentile di setiap hari
  const pctDays = [];
  for (let d = 0; d < days; d++) {
    const dayVals = paths.map(p => p[d]);
    pctDays.push({
      day: d,
      p5:  percentile(dayVals, 5),
      p25: percentile(dayVals, 25),
      p50: percentile(dayVals, 50),
      p75: percentile(dayVals, 75),
      p95: percentile(dayVals, 95),
    });
  }

  return {
    percentiles: pctDays,
    finalPrices,
    finalMean:   mean(finalPrices),
    finalMedian: median(finalPrices),
    probProfit:  finalPrices.filter(p => p > S0).length / nPaths,
    varFinal:    varHistorical(finalPrices.map(p => p / S0 - 1), 0.95),
    cvarFinal:   cvar(finalPrices.map(p => p / S0 - 1), 0.95),
    // Sampel paths untuk visualisasi (max 100)
    samplePaths: paths
      .filter((_, i) => i % Math.max(1, Math.floor(nPaths / 100)) === 0)
      .slice(0, 100),
  };
};

// ── STRATEGY METRICS ─────────────────────────────

/**
 * Hitung semua metrics dari array trades
 */
export const calcTradeMetrics = trades => {
  if (!trades.length) return {
    n: 0, wr: 0, avgWin: 0, avgLoss: 0,
    ev: 0, kelly: 0, sharpeT: 0, sortinoT: 0,
    mdd: 0, totalReturn: 0, profitFactor: 0,
  };

  const rets = trades.map(t => t.ret);
  const wins   = rets.filter(r => r > 0);
  const losses = rets.filter(r => r < 0);

  const wr     = wins.length / rets.length;
  const avgWin = wins.length  ? mean(wins)            : 0;
  const avgLoss= losses.length? Math.abs(mean(losses)): 0.001;
  const ev     = expectedValue(wr, avgWin, avgLoss);
  const kelly  = kellyFraction(wr, avgWin, avgLoss);

  const grossWin  = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss === 0 ? Infinity : grossWin / grossLoss;

  // Equity curve dari trades
  const equity = [10000];
  for (const r of rets) equity.push(equity[equity.length - 1] * (1 + r));

  const mdd = maxDrawdown(equity);
  const totalReturn = equity[equity.length - 1] / equity[0] - 1;

  const aR = mean(rets) * (252 / (trades[0]?.holdDays || 60));
  const aV = std(rets) * Math.sqrt(252 / (trades[0]?.holdDays || 60));
  const sharpeT  = aV === 0 ? 0 : (aR - 0.06) / aV;

  const negR = rets.filter(r => r < 0);
  const dDev = negR.length
    ? Math.sqrt(negR.reduce((a, r) => a + r * r, 0) / negR.length) * Math.sqrt(252 / (trades[0]?.holdDays || 60))
    : 0.001;
  const sortinoT = (aR - 0.06) / dDev;

  const fmt = (v, d = 2) => isFinite(v) ? +v.toFixed(d) : 0;

  return {
    n: rets.length,
    wr:           fmt(wr * 100, 1),
    avgWin:       fmt(avgWin * 100),
    avgLoss:      fmt(avgLoss * 100),
    ev:           fmt(ev * 100),
    kelly:        fmt(kelly * 100, 1),
    sharpeT:      fmt(sharpeT),
    sortinoT:     fmt(sortinoT),
    mdd:          fmt(mdd * 100, 1),
    totalReturn:  fmt(totalReturn * 100, 1),
    profitFactor: fmt(profitFactor),
    equity,
  };
};
