// ═══════════════════════════════════════════════════
// BEI QUANT LAB — 5 STRATEGY ENGINES
// Input: array { date, close, volume }
// Output: { trades, equity }
// ═══════════════════════════════════════════════════

import {
  mean, std, rollingZScore, volumeRatio, simpleReturns, logReturns
} from './math.js';

// ── STRATEGY 1: PEAD ─────────────────────────────
// Post-Earnings Announcement Drift (Bernard & Thomas 1989)
// 
// Di data real: SUE butuh EPS data → kita proxy dengan
// earnings-window price jump (gap besar = market surprised)
// ─────────────────────────────────────────────────

export const runPEAD = (data, params = {}) => {
  const {
    minGap    = 0.04,   // min 4% gap = "earnings surprise" proxy
    holdDays  = 60,     // Bernard & Thomas: 60 hari
    sizeRatio = 0.9,    // 90% kapital per trade
  } = params;

  const prices = data.map(d => d.close);
  const n = prices.length;
  const trades = [];
  let cap = 10000;
  const equity = [cap];
  let inTrade = false, entryDay = 0, entryPrice = 0, tradeSize = 0;

  for (let i = 5; i < n; i++) {
    // Exit check
    if (inTrade && i - entryDay >= holdDays) {
      const ret = prices[i] / entryPrice - 1;
      cap += tradeSize * ret;
      trades.push({
        entryDate:  data[entryDay].date,
        exitDate:   data[i].date,
        entryPrice,
        exitPrice:  prices[i],
        ret,
        holdDays,
        strategy: 'PEAD',
      });
      inTrade = false;
    }

    // Entry: gap besar = proxy earnings surprise
    if (!inTrade) {
      const gap = (prices[i] - prices[i - 1]) / prices[i - 1];
      // Volume confirmation: volume harus >2x rata-rata
      const vol5 = mean(data.slice(Math.max(0, i-5), i).map(d => d.volume || 1));
      const volToday = data[i].volume || vol5;
      if (gap >= minGap && volToday > vol5 * 2) {
        inTrade = true;
        entryDay = i;
        entryPrice = prices[i];
        tradeSize = cap * sizeRatio;
      }
    }

    equity.push(cap);
  }

  return { trades, equity };
};

// ── STRATEGY 2: MEAN REVERSION (Z-Score) ─────────
// Entry: Z < -2.0 (harga terlalu jauh di bawah mean)
// Exit: Z kembali ke 0 ATAU +0.5
// ─────────────────────────────────────────────────

export const runMeanReversion = (data, params = {}) => {
  const {
    lookback  = 20,   // window MA
    entryZ    = -2.0, // entry threshold
    exitZ     = 0.3,  // exit threshold
    sizeRatio = 0.9,
  } = params;

  const prices = data.map(d => d.close);
  const n = prices.length;
  const zScores = rollingZScore(prices, lookback);
  const trades = [];
  let cap = 10000;
  const equity = Array(lookback).fill(cap);
  let inTrade = false, entryDay = 0, entryPrice = 0, tradeSize = 0;

  for (let i = lookback; i < n; i++) {
    const z = zScores[i];

    if (inTrade && z >= exitZ) {
      const ret = prices[i] / entryPrice - 1;
      cap += tradeSize * ret;
      trades.push({
        entryDate:  data[entryDay].date,
        exitDate:   data[i].date,
        entryPrice,
        exitPrice:  prices[i],
        ret,
        holdDays:   i - entryDay,
        strategy:   'MEAN_REV',
        entryZ:     zScores[entryDay],
        exitZ:      z,
      });
      inTrade = false;
    }

    if (!inTrade && z <= entryZ) {
      inTrade = true;
      entryDay = i;
      entryPrice = prices[i];
      tradeSize = cap * sizeRatio;
    }

    equity.push(cap);
  }

  return { trades, equity };
};

// ── STRATEGY 3: BROKER FLOW (Smart Money Proxy) ──
// Di data real, kita proxy dengan:
// Harga diam + volume besar + net tick positif = akumulasi
// ─────────────────────────────────────────────────

export const runBrokerFlow = (data, params = {}) => {
  const {
    volMultiplier   = 3.0,  // volume harus >3x rata-rata
    maxPriceMove    = 0.008,// harga tidak bergerak >0.8%
    confirmDays     = 3,    // butuh 3 hari konfirmasi
    holdDays        = 20,
    sizeRatio       = 0.9,
  } = params;

  const prices  = data.map(d => d.close);
  const volumes = data.map(d => d.volume || 1);
  const n = prices.length;
  const vRatio = volumeRatio(volumes, 20);
  const trades = [];
  let cap = 10000;
  const equity = Array(20).fill(cap);
  let inTrade = false, entryDay = 0, entryPrice = 0, tradeSize = 0;
  let confirmCount = 0;

  for (let i = 20; i < n; i++) {
    const priceMove = Math.abs(prices[i] / prices[i - 1] - 1);
    const isAccum = vRatio[i] >= volMultiplier && priceMove <= maxPriceMove;

    if (inTrade && i - entryDay >= holdDays) {
      const ret = prices[i] / entryPrice - 1;
      cap += tradeSize * ret;
      trades.push({
        entryDate:  data[entryDay].date,
        exitDate:   data[i].date,
        entryPrice,
        exitPrice:  prices[i],
        ret,
        holdDays,
        strategy:   'BROKER_FLOW',
      });
      inTrade = false;
      confirmCount = 0;
    }

    if (!inTrade) {
      confirmCount = isAccum ? confirmCount + 1 : 0;
      if (confirmCount >= confirmDays) {
        inTrade = true;
        entryDay = i;
        entryPrice = prices[i];
        tradeSize = cap * sizeRatio;
        confirmCount = 0;
      }
    }

    equity.push(cap);
  }

  return { trades, equity };
};

// ── STRATEGY 4: VOLUME ANOMALY ────────────────────
// Volume > 3.5x normal + harga flat = akumulasi diam
// Breakout setelah akumulasi = entry
// ─────────────────────────────────────────────────

export const runVolumeAnomaly = (data, params = {}) => {
  const {
    vrThreshold = 3.5,    // volume ratio threshold
    maxMove     = 0.01,   // max price move saat akumulasi
    holdDays    = 15,
    sizeRatio   = 0.9,
  } = params;

  const prices  = data.map(d => d.close);
  const volumes = data.map(d => d.volume || 1);
  const n = prices.length;
  const vRatio = volumeRatio(volumes, 20);
  const trades = [];
  let cap = 10000;
  const equity = Array(20).fill(cap);
  let inTrade = false, entryDay = 0, entryPrice = 0, tradeSize = 0;

  for (let i = 20; i < n; i++) {
    const priceMove = Math.abs(prices[i] / prices[i - 1] - 1);
    const signal = vRatio[i] >= vrThreshold && priceMove <= maxMove;

    if (inTrade && i - entryDay >= holdDays) {
      const ret = prices[i] / entryPrice - 1;
      cap += tradeSize * ret;
      trades.push({
        entryDate:  data[entryDay].date,
        exitDate:   data[i].date,
        entryPrice,
        exitPrice:  prices[i],
        ret,
        holdDays,
        strategy:   'VOL_ANOMALY',
        volumeRatio: vRatio[i],
      });
      inTrade = false;
    }

    if (!inTrade && signal) {
      inTrade = true;
      entryDay = i;
      entryPrice = prices[i];
      tradeSize = cap * sizeRatio;
    }

    equity.push(cap);
  }

  return { trades, equity };
};

// ── STRATEGY 5: WINDOW DRESSING ───────────────────
// Beli saham yang sudah naik (winners) menjelang akhir kuartal
// Fund manager beli untuk "hiasi" laporan portofolio mereka
// Entry: 10 hari sebelum akhir kuartal, momentum > 5%
// Exit: 3 hari pertama kuartal baru (fund buang)
// ─────────────────────────────────────────────────

export const runWindowDressing = (data, params = {}) => {
  const {
    momWindow   = 20,   // window momentum
    minMom      = 0.05, // min 5% momentum
    daysBeforeQEnd = 10,// entry X hari sebelum Q-end
    sizeRatio   = 0.9,
  } = params;

  const prices = data.map(d => d.close);
  const n = prices.length;
  const trades = [];
  let cap = 10000;
  const equity = Array(momWindow).fill(cap);
  let inTrade = false, entryDay = 0, entryPrice = 0, tradeSize = 0;

  for (let i = momWindow; i < n; i++) {
    // Deteksi akhir kuartal berdasarkan tanggal
    const date = new Date(data[i].date);
    const month = date.getMonth() + 1; // 1-12
    const day   = date.getDate();

    // Akhir kuartal: Maret(3), Juni(6), September(9), Desember(12)
    const isQEndMonth = [3, 6, 9, 12].includes(month);
    const daysFromMonthEnd = new Date(date.getFullYear(), month, 0).getDate() - day;
    const nearQEnd = isQEndMonth && daysFromMonthEnd <= daysBeforeQEnd;

    // Exit: awal bulan kuartal baru (hari ke 1-3)
    const isQStartMonth = [4, 7, 10, 1].includes(month);
    const isQStart = isQStartMonth && day <= 3;

    const mom = prices[i] / prices[i - momWindow] - 1;

    if (inTrade && isQStart) {
      const ret = prices[i] / entryPrice - 1;
      cap += tradeSize * ret;
      trades.push({
        entryDate:  data[entryDay].date,
        exitDate:   data[i].date,
        entryPrice,
        exitPrice:  prices[i],
        ret,
        holdDays:   i - entryDay,
        strategy:   'WINDOW_DRESS',
        momentum:   mom,
      });
      inTrade = false;
    }

    if (!inTrade && nearQEnd && mom >= minMom) {
      inTrade = true;
      entryDay = i;
      entryPrice = prices[i];
      tradeSize = cap * sizeRatio;
    }

    equity.push(cap);
  }

  return { trades, equity };
};

// ── STRATEGY RUNNER ───────────────────────────────

export const STRATEGIES = {
  pead:       { fn: runPEAD,          label: 'PEAD',         color: '#00D4FF', full: 'Post-Earnings Announcement Drift' },
  meanRev:    { fn: runMeanReversion,  label: 'MEAN REV',    color: '#10B981', full: 'Z-Score Mean Reversion'           },
  brokerFlow: { fn: runBrokerFlow,     label: 'BROKER FLOW', color: '#8B5CF6', full: 'Smart Money Detection'            },
  volAnomaly: { fn: runVolumeAnomaly,  label: 'VOL ANOMALY', color: '#F59E0B', full: 'Unusual Volume'                   },
  windowDress:{ fn: runWindowDressing, label: 'WINDOW DRESS',color: '#EC4899', full: 'Quarter-End Effect'               },
};

export const runAllStrategies = data => {
  const results = {};
  for (const [id, cfg] of Object.entries(STRATEGIES)) {
    results[id] = cfg.fn(data);
  }
  return results;
};
