import { useState, useCallback } from 'react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { monteCarlo, logReturns, annualReturn, annualVol, mean, percentile } from '../utils/math.js';
import { BEI_STOCKS, useMarketData } from '../hooks/useMarketData.js';

const fmt  = (v, d = 2) => isFinite(v) ? +v.toFixed(d) : 0;
const pct  = v => `${(v * 100).toFixed(1)}%`;
const rp   = v => `Rp${Math.round(v).toLocaleString('id-ID')}`;

export default function MonteCarloTab() {
  const { data, loading, errors, fetchStock } = useMarketData();
  const [ticker,     setTicker]     = useState('BBCA.JK');
  const [customTick, setCustomTick] = useState('');
  const [horizon,    setHorizon]    = useState(252);
  const [nPaths,     setNPaths]     = useState(500);
  const [result,     setResult]     = useState(null);
  const [running,    setRunning]    = useState(false);
  const [mode,       setMode]       = useState('calibrated'); // calibrated | manual
  const [manualMu,   setManualMu]   = useState(12);
  const [manualSig,  setManualSig]  = useState(25);

  const activeTicker = customTick.trim().toUpperCase() || ticker;

  const run = useCallback(async () => {
    setRunning(true);
    setResult(null);

    let mu, sigma, S0, stockName;

    if (mode === 'calibrated') {
      // Fetch data real jika belum ada
      if (!data[activeTicker]) {
        await fetchStock(activeTicker);
      }
      const stockData = data[activeTicker];
      if (!stockData?.data?.length) {
        setRunning(false);
        return;
      }
      const prices = stockData.data.map(d => d.close);
      const rets   = logReturns(prices);
      mu    = annualReturn(prices);
      sigma = annualVol(rets);
      S0    = prices[prices.length - 1];
      stockName = stockData.name || activeTicker;
    } else {
      mu    = manualMu / 100;
      sigma = manualSig / 100;
      S0    = 1000;
      stockName = 'Manual Parameters';
    }

    // Run Monte Carlo di web worker alternatif (setTimeout trick agar UI tidak freeze)
    await new Promise(resolve => setTimeout(resolve, 10));

    const mc = monteCarlo(S0, mu, sigma, horizon, nPaths);
    setResult({ mc, mu, sigma, S0, stockName, ticker: activeTicker, horizon, nPaths });
    setRunning(false);
  }, [mode, activeTicker, data, fetchStock, horizon, nPaths, manualMu, manualSig]);

  // Prepare chart data
  const pctChartData = result
    ? result.mc.percentiles.filter((_, i) => i % Math.max(1, Math.floor(result.horizon / 100)) === 0)
    : [];

  const histData = result
    ? (() => {
        const finals = result.mc.finalPrices;
        const min = Math.min(...finals), max = Math.max(...finals);
        const bins = 30;
        const step = (max - min) / bins;
        const counts = Array(bins).fill(0);
        finals.forEach(p => {
          const idx = Math.min(Math.floor((p - min) / step), bins - 1);
          counts[idx]++;
        });
        return counts.map((c, i) => ({
          price: Math.round(min + i * step),
          count: c,
          pct:   c / finals.length * 100,
        }));
      })()
    : [];

  const c = { bg: '#080D18', surf: '#111827', surf2: '#0D1117', border: '1px solid #1E293B' };
  const mono = '"Courier New", monospace';

  return (
    <div style={{ fontFamily: mono, color: '#E2E8F0', fontSize: 12 }}>

      {/* CONTROLS */}
      <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 16, marginBottom: 14 }}>
        <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2, marginBottom: 12 }}>
          MONTE CARLO SIMULATION — GBM ENGINE
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {[
            ['calibrated', '📡 Data Real BEI'],
            ['manual',     '⚙️ Manual Input'],
          ].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: '6px 14px', border: 'none', borderRadius: 4, cursor: 'pointer',
              background: mode === m ? '#00D4FF' : c.surf2,
              color:      mode === m ? c.bg       : '#374151',
              fontSize: 8, fontWeight: 700, fontFamily: mono, letterSpacing: 1,
            }}>{l}</button>
          ))}
        </div>

        {mode === 'calibrated' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 7, color: '#374151', letterSpacing: 1, marginBottom: 5 }}>PILIH SAHAM BEI</div>
              <select value={ticker} onChange={e => setTicker(e.target.value)}
                style={{ width: '100%', background: c.surf2, border: c.border, color: '#E2E8F0', padding: '7px 8px', borderRadius: 4, fontSize: 10, fontFamily: mono }}>
                {BEI_STOCKS.map(s => (
                  <option key={s.ticker} value={s.ticker}>{s.name} ({s.ticker})</option>
                ))}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 7, color: '#374151', letterSpacing: 1, marginBottom: 5 }}>ATAU KETIK TICKER (misal: TLKM.JK)</div>
              <input value={customTick} onChange={e => setCustomTick(e.target.value.toUpperCase())}
                placeholder="BBCA.JK"
                style={{ width: '100%', background: c.surf2, border: c.border, color: '#E2E8F0', padding: '7px 8px', borderRadius: 4, fontSize: 10, fontFamily: mono }} />
            </div>
          </div>
        )}

        {mode === 'manual' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 7, color: '#374151', letterSpacing: 1, marginBottom: 5 }}>DRIFT TAHUNAN μ (%)</div>
              <input type="number" value={manualMu} onChange={e => setManualMu(+e.target.value)}
                style={{ width: '100%', background: c.surf2, border: c.border, color: '#10B981', padding: '7px 8px', borderRadius: 4, fontSize: 11, fontFamily: mono }} />
            </div>
            <div>
              <div style={{ fontSize: 7, color: '#374151', letterSpacing: 1, marginBottom: 5 }}>VOLATILITAS TAHUNAN σ (%)</div>
              <input type="number" value={manualSig} onChange={e => setManualSig(+e.target.value)}
                style={{ width: '100%', background: c.surf2, border: c.border, color: '#F59E0B', padding: '7px 8px', borderRadius: 4, fontSize: 11, fontFamily: mono }} />
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 7, color: '#374151', letterSpacing: 1, marginBottom: 5 }}>HORIZON (HARI TRADING)</div>
            <select value={horizon} onChange={e => setHorizon(+e.target.value)}
              style={{ width: '100%', background: c.surf2, border: c.border, color: '#E2E8F0', padding: '7px 8px', borderRadius: 4, fontSize: 10, fontFamily: mono }}>
              <option value={63}>3 Bulan (63)</option>
              <option value={126}>6 Bulan (126)</option>
              <option value={252}>1 Tahun (252)</option>
              <option value={504}>2 Tahun (504)</option>
              <option value={756}>3 Tahun (756)</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 7, color: '#374151', letterSpacing: 1, marginBottom: 5 }}># SIMULASI (PATH)</div>
            <select value={nPaths} onChange={e => setNPaths(+e.target.value)}
              style={{ width: '100%', background: c.surf2, border: c.border, color: '#E2E8F0', padding: '7px 8px', borderRadius: 4, fontSize: 10, fontFamily: mono }}>
              <option value={200}>200 (cepat)</option>
              <option value={500}>500 (default)</option>
              <option value={1000}>1000 (akurat)</option>
              <option value={2000}>2000 (lambat)</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button onClick={run} disabled={running} style={{
              width: '100%', padding: '8px 0', border: 'none', borderRadius: 4,
              background: running ? c.surf2 : '#00D4FF',
              color: running ? '#374151' : c.bg,
              fontWeight: 800, fontSize: 9, letterSpacing: 2, cursor: running ? 'not-allowed' : 'pointer', fontFamily: mono,
            }}>
              {running ? '▶ SIMULATING...' : `▶ RUN ${nPaths} PATHS`}
            </button>
          </div>
        </div>

        {/* Data info jika sudah fetch */}
        {result?.mode !== 'manual' && data[activeTicker] && (
          <div style={{ background: c.surf2, borderRadius: 4, padding: '8px 10px', fontSize: 8, color: '#374151' }}>
            <span style={{ color: '#00D4FF', marginRight: 10 }}>{data[activeTicker].name}</span>
            <span style={{ marginRight: 10 }}>μ = <b style={{color:'#10B981'}}>{pct(result?.mu||0)}/yr</b></span>
            <span style={{ marginRight: 10 }}>σ = <b style={{color:'#F59E0B'}}>{pct(result?.sigma||0)}/yr</b></span>
            <span>N = <b style={{color:'#E2E8F0'}}>{data[activeTicker].data?.length} hari</b></span>
          </div>
        )}
        {errors[activeTicker] && (
          <div style={{ background: '#1A0A0A', border: '1px solid #EF444430', borderRadius: 4, padding: '8px 10px', fontSize: 8, color: '#EF4444', marginTop: 8 }}>
            ⚠ {errors[activeTicker]}. Cek koneksi atau coba ticker lain.
          </div>
        )}
      </div>

      {/* NO RESULT */}
      {!result && (
        <div style={{ background: c.surf, borderRadius: 8, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#374151', letterSpacing: 3, marginBottom: 8 }}>MONTE CARLO ENGINE READY</div>
          <div style={{ fontSize: 8, color: '#1E293B', lineHeight: 2 }}>
            Pilih saham BEI → Run simulation<br/>
            Parameter μ dan σ dikalibrasi otomatis dari data historis 2 tahun
          </div>
        </div>
      )}

      {/* RESULTS */}
      {result && (
        <div>
          {/* Key stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { l: 'Harga Sekarang', v: rp(result.S0), c: '#E2E8F0' },
              { l: 'Median 1 Tahun', v: rp(result.mc.finalMedian), c: result.mc.finalMedian >= result.S0 ? '#10B981' : '#EF4444' },
              { l: 'Prob. Profit', v: pct(result.mc.probProfit), c: result.mc.probProfit >= 0.5 ? '#10B981' : '#EF4444' },
              { l: 'VaR 95% (1Y)', v: pct(result.mc.varFinal), c: '#EF4444' },
              { l: 'Drift μ/yr', v: pct(result.mu), c: '#10B981' },
              { l: 'Volatilitas σ/yr', v: pct(result.sigma), c: '#F59E0B' },
              { l: 'P5 (Worst Case)', v: rp(result.mc.percentiles[result.horizon-1]?.p5 || 0), c: '#EF4444' },
              { l: 'P95 (Best Case)', v: rp(result.mc.percentiles[result.horizon-1]?.p95 || 0), c: '#10B981' },
            ].map((s, i) => (
              <div key={i} style={{ background: c.surf, border: c.border, borderRadius: 5, padding: '10px 7px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: s.c, lineHeight: 1.2 }}>{s.v}</div>
                <div style={{ fontSize: 6.5, color: '#374151', marginTop: 4, letterSpacing: 1 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Percentile fan chart */}
          <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2, marginBottom: 4 }}>
              DISTRIBUSI HARGA — {nPaths} SIMULASI | {result.stockName}
            </div>
            <div style={{ fontSize: 7, color: '#1E293B', marginBottom: 10 }}>
              Area biru = 90% confidence interval (P5–P95) · Garis tengah = median (P50)
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={pctChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="#0D1117" />
                <XAxis dataKey="day" tick={{ fill: '#374151', fontSize: 7 }} tickFormatter={v => `D${v}`} />
                <YAxis tick={{ fill: '#374151', fontSize: 7 }} tickFormatter={v => `${(v/result.S0*100).toFixed(0)}%`} domain={['auto','auto']} width={36} />
                <Tooltip
                  contentStyle={{ background: '#0D1117', border: '1px solid #1E293B', borderRadius: 4, fontSize: 8 }}
                  formatter={(v, n) => [rp(v), n]}
                  labelFormatter={v => `Hari ${v}`}
                />
                <Area type="monotone" dataKey="p95" stackId="a" stroke="none" fill="#10B98115" name="P95" />
                <Area type="monotone" dataKey="p75" stackId="b" stroke="none" fill="#10B98120" name="P75" />
                <Area type="monotone" dataKey="p25" stackId="c" stroke="none" fill="#10B98108" name="P25" />
                <Area type="monotone" dataKey="p5"  stackId="d" stroke="none" fill="#EF444408" name="P5"  />
                <Line type="monotone" dataKey="p95" stroke="#10B981" dot={false} strokeWidth={1} strokeDasharray="3 2" name="P95 (Best 5%)" />
                <Line type="monotone" dataKey="p75" stroke="#10B98199" dot={false} strokeWidth={1} name="P75" />
                <Line type="monotone" dataKey="p50" stroke="#00D4FF" dot={false} strokeWidth={2} name="P50 (Median)" />
                <Line type="monotone" dataKey="p25" stroke="#F59E0B99" dot={false} strokeWidth={1} name="P25" />
                <Line type="monotone" dataKey="p5"  stroke="#EF4444" dot={false} strokeWidth={1} strokeDasharray="3 2" name="P5 (Worst 5%)" />
                <ReferenceLine y={result.S0} stroke="#374151" strokeDasharray="4 2" />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 7, paddingTop: 8 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Final distribution histogram */}
          <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2, marginBottom: 10 }}>
              DISTRIBUSI HARGA AKHIR — SETELAH {result.horizon} HARI
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={histData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="#0D1117" />
                <XAxis dataKey="price" tick={{ fill: '#374151', fontSize: 6.5 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                <YAxis tick={{ fill: '#374151', fontSize: 7 }} tickFormatter={v => `${v.toFixed(0)}%`} width={28} dataKey="pct" />
                <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid #1E293B', fontSize: 8 }} formatter={(v, n) => [`${v.toFixed(1)}%`, 'Probabilitas']} labelFormatter={v => rp(v)} />
                <ReferenceLine x={result.S0} stroke="#00D4FF" strokeDasharray="3 2" />
                <Bar dataKey="pct" fill="#8B5CF6" radius={[1,1,0,0]} name="Distribusi" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Devil's advocate */}
          <div style={{ background: c.surf, border: '1px solid #EF444420', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 7.5, color: '#EF4444', letterSpacing: 2, marginBottom: 8 }}>⚠ KETERBATASAN MODEL GBM INI</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                ['GBM = Random Walk', 'Model ini anggap return independent setiap hari. Realita: ada momentum, mean reversion, dan korelasi lintas hari.'],
                ['Fat Tails Diabaikan', 'GBM anggap return berdistribusi normal. Realita BEI: crash jauh lebih sering dan lebih dalam dari yang diprediksi model.'],
                ['μ dan σ Konstan', 'Parameter dikalibrasi dari data historis — tapi volatilitas berubah (volatility clustering). Krisis = σ meledak.'],
                ['No Jump Diffusion', 'Model tidak punya "jump" untuk event shock: kebijakan OJK, krisis geopolitik, pandemi.'],
              ].map(([t, d], i) => (
                <div key={i} style={{ background: c.surf2, borderRadius: 4, padding: '8px 10px' }}>
                  <div style={{ fontSize: 8, color: '#EF4444', fontWeight: 700, marginBottom: 4 }}>× {t}</div>
                  <div style={{ fontSize: 7.5, color: '#4B5563', lineHeight: 1.7 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
