import { useState, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import {
  logReturns, simpleReturns, autocorrelation, hurstExponent,
  rollingSharpe, rollingZScore, volumeRatio, annualReturn, annualVol,
  maxDrawdown, sharpe, mean, std, percentile
} from '../utils/math.js';
import { runAllStrategies, STRATEGIES } from '../utils/strategies.js';
import { calcTradeMetrics } from '../utils/math.js';
import { useMarketData, BEI_STOCKS } from '../hooks/useMarketData.js';

const pct = (v, d = 2) => `${(+v).toFixed(d)}%`;
const fmt = (v, d = 2) => isFinite(v) ? (+v).toFixed(d) : '—';

export default function EdgeFinder() {
  const { data, loading, errors, fetchStock } = useMarketData();
  const [ticker,  setTicker]  = useState('BBCA.JK');
  const [result,  setResult]  = useState(null);
  const [running, setRunning] = useState(false);

  const analyze = useCallback(async () => {
    setRunning(true);
    setResult(null);

    if (!data[ticker]) await fetchStock(ticker);
    const stockData = data[ticker];

    if (!stockData?.data?.length || stockData.data.length < 100) {
      setRunning(false);
      return;
    }

    await new Promise(r => setTimeout(r, 30));

    const priceArr = stockData.data.map(d => d.close);
    const volArr   = stockData.data.map(d => d.volume || 1);
    const logRet   = logReturns(priceArr);
    const simpRet  = simpleReturns(priceArr);

    // ── STATISTICAL EDGE METRICS ──
    const hurst = hurstExponent(priceArr);
    const ac1   = autocorrelation(logRet, 1);
    const ac2   = autocorrelation(logRet, 2);
    const ac3   = autocorrelation(logRet, 3);
    const ac5   = autocorrelation(logRet, 5);

    // Rolling Sharpe — lihat kapan ada edge dan kapan tidak
    const rollSh = rollingSharpe(logRet, 60).map((v, i) => ({
      date: stockData.data[i]?.date,
      sharpe: v !== null ? +v.toFixed(2) : null,
    })).filter(d => d.sharpe !== null);

    // Distribusi return — apakah normal?
    const mean_r = mean(logRet);
    const std_r  = std(logRet);
    const bins = 30;
    const min_r = mean_r - 4 * std_r, max_r = mean_r + 4 * std_r;
    const step  = (max_r - min_r) / bins;
    const hist  = Array(bins).fill(0);
    let kurtosis = 0, skewness = 0;
    logRet.forEach(r => {
      const idx = Math.min(Math.floor((r - min_r) / step), bins - 1);
      if (idx >= 0) hist[idx]++;
      kurtosis += Math.pow((r - mean_r) / std_r, 4);
      skewness += Math.pow((r - mean_r) / std_r, 3);
    });
    kurtosis = kurtosis / logRet.length - 3; // excess kurtosis
    skewness = skewness / logRet.length;

    const histData = hist.map((c, i) => ({
      ret:   +((min_r + i * step) * 100).toFixed(2),
      count: c,
      pct:   +(c / logRet.length * 100).toFixed(2),
      // Normal distribution curve untuk perbandingan
      normal: +((Math.exp(-0.5 * ((min_r + i * step - mean_r) / std_r) ** 2) / (std_r * Math.sqrt(2 * Math.PI)) * step * logRet.length)).toFixed(2),
    }));

    // Run semua strategi di data ini
    const stratResults = {};
    for (const [id, cfg] of Object.entries(STRATEGIES)) {
      try {
        const res = cfg.fn(stockData.data);
        stratResults[id] = { ...res, metrics: calcTradeMetrics(res.trades), ...cfg };
      } catch (e) {
        stratResults[id] = { trades: [], equity: [], metrics: calcTradeMetrics([]), ...cfg };
      }
    }

    // Summary stats
    const annRet = annualReturn(priceArr);
    const annV   = annualVol(logRet);
    const sh     = sharpe(logRet);
    const mdd    = maxDrawdown(priceArr);

    setResult({
      stockName: stockData.name || ticker,
      ticker,
      n: priceArr.length,
      hurst, ac1, ac2, ac3, ac5,
      rollSh, histData,
      kurtosis, skewness,
      annRet, annV, sh, mdd,
      stratResults,
      mean_r, std_r,
    });

    setRunning(false);
  }, [ticker, data, fetchStock]);

  const c = { bg:'#080D18', surf:'#111827', surf2:'#0D1117', border:'1px solid #1E293B' };
  const mono = '"Courier New", monospace';

  // Interpretasi Hurst
  const hurstInterp = h => h < 0.45 ? ['MEAN REVERTING', '#10B981', 'Saham ini cenderung kembali ke rata-rata. Strategi Z-score dan PEAD cocok.']
    : h > 0.55 ? ['TRENDING (MOMENTUM)', '#00D4FF', 'Saham ini cenderung trending. Momentum strategy lebih efektif.']
    : ['RANDOM WALK', '#F59E0B', 'Mendekati random walk. Edge lebih sulit ditemukan.'];

  const acInterp = ac => ac > 0.05 ? 'momentum' : ac < -0.05 ? 'mean reversion' : 'random';

  return (
    <div style={{ fontFamily: mono, color: '#E2E8F0', fontSize: 12 }}>

      {/* CONTROLS */}
      <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2, marginBottom: 12 }}>
          EDGE FINDER — STATISTICAL ANALYSIS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 7, color: '#374151', marginBottom: 5, letterSpacing: 1 }}>PILIH SAHAM BEI</div>
            <select value={ticker} onChange={e => setTicker(e.target.value)}
              style={{ width: '100%', background: c.surf2, border: c.border, color: '#E2E8F0', padding: '7px 8px', borderRadius: 4, fontSize: 10, fontFamily: mono }}>
              {BEI_STOCKS.map(s => (
                <option key={s.ticker} value={s.ticker}>{s.name} ({s.ticker})</option>
              ))}
            </select>
          </div>
          <button onClick={analyze} disabled={running}
            style={{ padding: '8px 18px', background: running ? c.surf2 : '#00D4FF', border: 'none', color: running ? '#374151' : c.bg, borderRadius: 4, fontWeight: 800, fontSize: 9, letterSpacing: 2, cursor: running ? 'not-allowed' : 'pointer', fontFamily: mono }}>
            {running ? '▶ ANALYZING...' : '▶ FIND EDGE'}
          </button>
        </div>
        {errors[ticker] && (
          <div style={{ fontSize: 7.5, color: '#EF4444', marginTop: 8 }}>⚠ {errors[ticker]}</div>
        )}
      </div>

      {!result && (
        <div style={{ background: c.surf, borderRadius: 8, padding: 36, textAlign: 'center', fontSize: 8.5, color: '#374151', letterSpacing: 2, lineHeight: 2.2 }}>
          EDGE FINDER menganalisis:<br/>
          Hurst Exponent · Autocorrelation · Return Distribution · Fat Tails<br/>
          Rolling Sharpe · Semua 5 Strategi pada data real
        </div>
      )}

      {result && (
        <div>
          {/* Header stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { l: 'Saham', v: result.stockName, c: '#00D4FF' },
              { l: 'Annual Return', v: pct(result.annRet*100), c: result.annRet >= 0 ? '#10B981' : '#EF4444' },
              { l: 'Annual Vol', v: pct(result.annV*100), c: '#F59E0B' },
              { l: 'Sharpe (raw)', v: fmt(result.sh), c: result.sh >= 1 ? '#10B981' : result.sh >= 0 ? '#F59E0B' : '#EF4444' },
              { l: 'Max Drawdown', v: pct(result.mdd*100), c: '#EF4444' },
            ].map((s, i) => (
              <div key={i} style={{ background: c.surf, border: c.border, borderRadius: 5, padding: '10px 7px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.c, lineHeight: 1.2 }}>{s.v}</div>
                <div style={{ fontSize: 6.5, color: '#374151', marginTop: 4, letterSpacing: 1 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* HURST EXPONENT */}
          {(() => {
            const [label, color, desc] = hurstInterp(result.hurst);
            return (
              <div style={{ background: c.surf, border: `1px solid ${color}30`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2 }}>HURST EXPONENT</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>
                      H = {result.hurst.toFixed(3)}
                    </div>
                    <div style={{ fontSize: 9, color, fontWeight: 700, marginTop: 2 }}>{label}</div>
                  </div>
                  <div style={{ background: c.surf2, borderRadius: 6, padding: '10px 14px', maxWidth: 300 }}>
                    <div style={{ fontSize: 8, color: '#64748B', lineHeight: 1.8 }}>{desc}</div>
                    <div style={{ marginTop: 8, fontSize: 7.5, color: '#374151', lineHeight: 1.7 }}>
                      H &lt; 0.45 → Mean reverting<br/>
                      H = 0.50 → Random walk<br/>
                      H &gt; 0.55 → Trending
                    </div>
                  </div>
                </div>
                {/* Hurst bar visual */}
                <div style={{ height: 8, background: '#0D1117', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '45%', top: 0, width: 2, height: '100%', background: '#374151' }} />
                  <div style={{ position: 'absolute', left: '55%', top: 0, width: 2, height: '100%', background: '#374151' }} />
                  <div style={{ width: `${result.hurst * 100}%`, height: '100%', background: color, borderRadius: 4 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#374151', marginTop: 3 }}>
                  <span>0 (Strong MR)</span><span>0.5 (Random)</span><span>1.0 (Strong Trend)</span>
                </div>
              </div>
            );
          })()}

          {/* AUTOCORRELATION */}
          <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2, marginBottom: 12 }}>
              AUTOCORRELATION — MEMORY DALAM RETURN
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
              {[
                { lag: 'Lag 1', v: result.ac1 },
                { lag: 'Lag 2', v: result.ac2 },
                { lag: 'Lag 3', v: result.ac3 },
                { lag: 'Lag 5', v: result.ac5 },
              ].map(({ lag, v }) => {
                const col = v > 0.05 ? '#00D4FF' : v < -0.05 ? '#10B981' : '#F59E0B';
                return (
                  <div key={lag} style={{ background: c.surf2, borderRadius: 5, padding: '10px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: col }}>{fmt(v, 3)}</div>
                    <div style={{ fontSize: 7, color: '#374151', marginTop: 3 }}>{lag}</div>
                    <div style={{ fontSize: 7, color: col, marginTop: 2 }}>{acInterp(v)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 7.5, color: '#374151', lineHeight: 2 }}>
              AC &gt; 0 = besok lebih mungkin naik kalau hari ini naik (momentum) ·
              AC &lt; 0 = besok lebih mungkin berbalik (mean reversion) ·
              |AC| &lt; 0.05 = tidak ada pattern yang jelas
            </div>
          </div>

          {/* RETURN DISTRIBUTION */}
          <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2 }}>DISTRIBUSI RETURN — FAT TAILS?</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 7.5 }}>
                <span style={{ color: '#374151' }}>Skewness: <b style={{ color: result.skewness < 0 ? '#EF4444' : '#10B981' }}>{fmt(result.skewness)}</b></span>
                <span style={{ color: '#374151' }}>Excess Kurtosis: <b style={{ color: result.kurtosis > 1 ? '#EF4444' : '#10B981' }}>{fmt(result.kurtosis)}</b></span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={result.histData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="#0D1117" />
                <XAxis dataKey="ret" tick={{ fill: '#374151', fontSize: 6.5 }} tickFormatter={v => `${v}%`} interval={4} />
                <YAxis tick={{ fill: '#374151', fontSize: 7 }} width={24} />
                <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid #1E293B', fontSize: 8 }} />
                <ReferenceLine x={0} stroke="#374151" />
                <Bar dataKey="count" fill="#8B5CF640" name="Actual" radius={[1,1,0,0]} />
                <Bar dataKey="normal" fill="#00D4FF20" name="Normal Dist" radius={[1,1,0,0]} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 7 }} />
              </BarChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 7.5, color: '#374151', marginTop: 6, lineHeight: 1.8 }}>
              {result.kurtosis > 2 ? '⚠ FAT TAILS TERDETEKSI — Crash lebih sering dari yang diprediksi model normal. Black swan risk nyata.' :
               result.kurtosis > 0.5 ? '⚠ Kurtosis elevated — Sedikit lebih berisiko dari distribusi normal.' :
               '✓ Distribusi mendekati normal. Model GBM cukup representatif.'}
              {result.skewness < -0.3 && ' · Negative skew — Return besar negatif lebih sering dari positif.'}
            </div>
          </div>

          {/* ROLLING SHARPE */}
          <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2, marginBottom: 4 }}>
              ROLLING SHARPE (60 HARI) — KAPAN EDGE ADA DAN KAPAN HILANG
            </div>
            <div style={{ fontSize: 7, color: '#1E293B', marginBottom: 10 }}>
              Sharpe &gt; 1 = periode ada edge yang cukup · Sharpe &lt; 0 = periode losing
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={result.rollSh.filter((_, i) => i % 3 === 0)} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="#0D1117" />
                <XAxis dataKey="date" tick={{ fill: '#374151', fontSize: 6.5 }} tickFormatter={d => d?.slice(0,7)} interval={Math.ceil(result.rollSh.length / 8)} />
                <YAxis tick={{ fill: '#374151', fontSize: 7 }} domain={['auto','auto']} width={28} />
                <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid #1E293B', fontSize: 8 }} />
                <ReferenceLine y={0} stroke="#374151" />
                <ReferenceLine y={1} stroke="#10B98150" strokeDasharray="3 2" />
                <Line type="monotone" dataKey="sharpe" stroke="#00D4FF" dot={false} strokeWidth={1.5} name="Rolling Sharpe" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ALL STRATEGIES ON THIS STOCK */}
          <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2, marginBottom: 12 }}>
              SEMUA STRATEGI — DITEST DI DATA REAL {result.stockName}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5, minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: c.border }}>
                    {['STRATEGI','RET','SHARPE','MDD','WR','EV','KELLY','N'].map(h => (
                      <th key={h} style={{ padding: '4px 8px', textAlign: h==='STRATEGI'?'left':'right', color: '#374151', fontSize: 7, letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(result.stratResults)
                    .sort((a,b) => b[1].metrics.sharpeT - a[1].metrics.sharpeT)
                    .map(([id, res]) => {
                      const m = res.metrics;
                      const rc = m.totalReturn >= 0 ? '#10B981' : '#EF4444';
                      const sc = m.sharpeT >= 1 ? '#10B981' : m.sharpeT >= 0 ? '#F59E0B' : '#EF4444';
                      return (
                        <tr key={id} style={{ borderBottom: '1px solid #0D1117' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <span style={{ color: res.color, fontWeight: 700 }}>{res.label}</span>
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: rc, fontWeight: 700 }}>{m.totalReturn > 0 ? '+' : ''}{m.totalReturn}%</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: sc, fontWeight: 700 }}>{m.sharpeT}</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#EF4444' }}>{m.mdd}%</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{m.wr}%</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: m.ev >= 0 ? '#10B981' : '#EF4444' }}>{m.ev > 0 ? '+' : ''}{m.ev}%</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#F59E0B' }}>{m.kelly}%</td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748B' }}>{m.n}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
