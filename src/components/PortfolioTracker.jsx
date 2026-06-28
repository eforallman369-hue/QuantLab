import { useState, useMemo } from 'react';
import {
  PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { useMarketData, BEI_STOCKS } from '../hooks/useMarketData.js';
import { simpleReturns, sharpe, maxDrawdown, annualReturn, rollingMA } from '../utils/math.js';

const COLORS = ['#00D4FF','#10B981','#8B5CF6','#F59E0B','#EC4899','#EF4444','#3B82F6','#14B8A6'];
const rp  = v => `Rp${Math.round(v).toLocaleString('id-ID')}`;
const pct = (v, d=1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`;

const emptyHolding = () => ({
  id: Date.now(), ticker: 'BBCA.JK', shares: '', buyPrice: '', buyDate: ''
});

export default function PortfolioTracker() {
  const { data, loading, errors, fetchStock } = useMarketData();
  const [holdings, setHoldings] = useState([emptyHolding()]);
  const [fetched,  setFetched]  = useState(false);

  const addRow    = () => setHoldings(h => [...h, emptyHolding()]);
  const removeRow = id => setHoldings(h => h.filter(x => x.id !== id));
  const updateRow = (id, field, val) =>
    setHoldings(h => h.map(x => x.id === id ? { ...x, [field]: val } : x));

  const fetchAll = async () => {
    const tickers = [...new Set(holdings.map(h => h.ticker).filter(Boolean))];
    tickers.push('^JKSE'); // selalu fetch IHSG untuk benchmark
    await Promise.all(tickers.map(fetchStock));
    setFetched(true);
  };

  // Hitung portfolio metrics dari data real
  const portfolio = useMemo(() => {
    if (!fetched) return null;
    const rows = holdings.filter(h => h.ticker && h.shares && h.buyPrice);
    if (!rows.length) return null;

    let totalCost = 0, totalValue = 0;
    const positions = rows.map(h => {
      const d = data[h.ticker];
      const currentPrice = d?.data?.[d.data.length - 1]?.close ?? +h.buyPrice;
      const cost  = +h.shares * +h.buyPrice;
      const value = +h.shares * currentPrice;
      const ret   = (value - cost) / cost;
      totalCost  += cost;
      totalValue += value;
      return {
        ...h,
        currentPrice,
        cost,
        value,
        ret,
        name: BEI_STOCKS.find(s => s.ticker === h.ticker)?.name || h.ticker,
        color: COLORS[rows.indexOf(h) % COLORS.length],
        priceHistory: d?.data || [],
      };
    });

    const totalRet = (totalValue - totalCost) / totalCost;

    // Equity curve portofolio (agregat)
    const minDate = rows
      .map(h => h.buyDate || (data[h.ticker]?.data?.[0]?.date ?? ''))
      .filter(Boolean)
      .sort()[0];

    // Ambil tanggal dari IHSG sebagai basis
    const ihsgData = data['^JKSE']?.data || [];

    // Build daily portfolio value dari tanggal terlama
    const dateMap = {};
    for (const pos of positions) {
      for (const day of pos.priceHistory) {
        if (!dateMap[day.date]) dateMap[day.date] = 0;
        dateMap[day.date] += +pos.shares * day.close;
      }
    }
    const eqCurve = Object.entries(dateMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({ date, value }));

    // Benchmark IHSG normalized ke portfolio start value
    const ihsgCurve = ihsgData.map(d => ({ date: d.date, value: d.close }));
    const startIHSG = ihsgCurve[0]?.value || 1;
    const startPort = eqCurve[0]?.value || 1;

    const combined = eqCurve.map(p => {
      const ihsg = ihsgCurve.find(i => i.date === p.date);
      return {
        date: p.date,
        portfolio: +((p.value / startPort * 100).toFixed(2)),
        ihsg:      ihsg ? +((ihsg.value / startIHSG * 100).toFixed(2)) : undefined,
      };
    });

    // Risk metrics dari daily returns
    const portRets = simpleReturns(eqCurve.map(d => d.value));
    const mdd = maxDrawdown(eqCurve.map(d => d.value));
    const sh  = sharpe(portRets);

    return {
      positions, totalCost, totalValue, totalRet,
      eqCurve, combined,
      sharpe: sh,
      mdd: mdd * 100,
      pieData: positions.map(p => ({ name: p.name, value: p.value, color: p.color })),
    };
  }, [fetched, holdings, data]);

  const c = { bg:'#080D18', surf:'#111827', surf2:'#0D1117', border:'1px solid #1E293B' };
  const mono = '"Courier New", monospace';

  return (
    <div style={{ fontFamily: mono, color: '#E2E8F0', fontSize: 12 }}>

      {/* INPUT */}
      <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2, marginBottom: 12 }}>
          INPUT PORTOFOLIO — DATA REAL DARI BEI
        </div>

        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 32px', gap: 6, marginBottom: 6 }}>
          {['SAHAM', 'JUMLAH LOT (100 lembar)', 'HARGA BELI (Rp)', 'TANGGAL BELI', ''].map(h => (
            <div key={h} style={{ fontSize: 6.5, color: '#374151', letterSpacing: 1 }}>{h}</div>
          ))}
        </div>

        {holdings.map(h => (
          <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 32px', gap: 6, marginBottom: 6 }}>
            <select value={h.ticker} onChange={e => updateRow(h.id, 'ticker', e.target.value)}
              style={{ background: c.surf2, border: c.border, color: '#E2E8F0', padding: '6px 7px', borderRadius: 4, fontSize: 9, fontFamily: mono }}>
              {BEI_STOCKS.filter(s => s.ticker !== '^JKSE').map(s => (
                <option key={s.ticker} value={s.ticker}>{s.name} ({s.ticker})</option>
              ))}
            </select>
            <input type="number" placeholder="10" value={h.shares}
              onChange={e => updateRow(h.id, 'shares', e.target.value)}
              style={{ background: c.surf2, border: c.border, color: '#10B981', padding: '6px 7px', borderRadius: 4, fontSize: 10, fontFamily: mono }} />
            <input type="number" placeholder="9500" value={h.buyPrice}
              onChange={e => updateRow(h.id, 'buyPrice', e.target.value)}
              style={{ background: c.surf2, border: c.border, color: '#F59E0B', padding: '6px 7px', borderRadius: 4, fontSize: 10, fontFamily: mono }} />
            <input type="date" value={h.buyDate}
              onChange={e => updateRow(h.id, 'buyDate', e.target.value)}
              style={{ background: c.surf2, border: c.border, color: '#8B5CF6', padding: '6px 7px', borderRadius: 4, fontSize: 9, fontFamily: mono }} />
            <button onClick={() => removeRow(h.id)}
              style={{ background: 'none', border: '1px solid #EF444430', color: '#EF4444', borderRadius: 4, cursor: 'pointer', fontSize: 10 }}>×</button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={addRow}
            style={{ padding: '6px 14px', background: c.surf2, border: c.border, color: '#374151', borderRadius: 4, cursor: 'pointer', fontSize: 8, fontFamily: mono }}>
            + Tambah Saham
          </button>
          <button onClick={fetchAll}
            style={{ padding: '6px 18px', background: '#00D4FF', border: 'none', color: c.bg, borderRadius: 4, cursor: 'pointer', fontWeight: 800, fontSize: 8, letterSpacing: 2, fontFamily: mono }}>
            {Object.values(loading).some(Boolean) ? '▶ LOADING...' : '▶ FETCH DATA & HITUNG'}
          </button>
        </div>

        {Object.entries(errors).filter(([k,v]) => v && k !== '^JKSE').map(([k,v]) => (
          <div key={k} style={{ fontSize: 7.5, color: '#EF4444', marginTop: 6 }}>⚠ {k}: {v}</div>
        ))}
      </div>

      {/* NO DATA */}
      {!portfolio && (
        <div style={{ background: c.surf, borderRadius: 8, padding: 36, textAlign: 'center', fontSize: 8.5, color: '#374151', letterSpacing: 2, lineHeight: 2 }}>
          Isi data portofolio kamu di atas<br/>
          Klik FETCH DATA — data real dari Yahoo Finance BEI<br/>
          <span style={{ color: '#1E293B', fontSize: 7 }}>lot × 100 lembar = jumlah saham</span>
        </div>
      )}

      {/* RESULTS */}
      {portfolio && (
        <div>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { l: 'Total Modal', v: rp(portfolio.totalCost), c: '#E2E8F0' },
              { l: 'Total Nilai', v: rp(portfolio.totalValue), c: portfolio.totalValue >= portfolio.totalCost ? '#10B981' : '#EF4444' },
              { l: 'P&L Total', v: `${pct(portfolio.totalRet*100)}`, c: portfolio.totalRet >= 0 ? '#10B981' : '#EF4444' },
              { l: 'Sharpe Ratio', v: portfolio.sharpe.toFixed(2), c: portfolio.sharpe >= 1 ? '#10B981' : portfolio.sharpe >= 0 ? '#F59E0B' : '#EF4444' },
              { l: 'Max Drawdown', v: `${portfolio.mdd.toFixed(1)}%`, c: '#EF4444' },
              { l: '# Posisi', v: portfolio.positions.length, c: '#8B5CF6' },
            ].map((s, i) => (
              <div key={i} style={{ background: c.surf, border: c.border, borderRadius: 5, padding: '10px 7px', textAlign: 'center' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: s.c }}>{s.v}</div>
                <div style={{ fontSize: 6.5, color: '#374151', marginTop: 4, letterSpacing: 1 }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Equity curve vs IHSG */}
          <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2, marginBottom: 10 }}>
              PORTOFOLIO vs IHSG — NORMALIZED (Base 100)
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={portfolio.combined.filter((_, i) => i % 3 === 0)} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 6" stroke="#0D1117" />
                <XAxis dataKey="date" tick={{ fill: '#374151', fontSize: 6.5 }} tickFormatter={d => d?.slice(5)} interval={Math.ceil(portfolio.combined.length / 8)} />
                <YAxis tick={{ fill: '#374151', fontSize: 7 }} domain={['auto','auto']} width={32} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid #1E293B', fontSize: 8 }} formatter={(v, n) => [`${v}%`, n]} />
                <ReferenceLine y={100} stroke="#374151" strokeDasharray="3 2" />
                <Line type="monotone" dataKey="portfolio" stroke="#00D4FF" dot={false} strokeWidth={2} name="Portofolio" />
                <Line type="monotone" dataKey="ihsg" stroke="#374151" dot={false} strokeWidth={1.5} strokeDasharray="4 2" name="IHSG Benchmark" />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 7 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Pie + positions table */}
          <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 12, marginBottom: 14 }}>
            <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2, marginBottom: 8 }}>ALOKASI</div>
              <PieChart width={170} height={170}>
                <Pie data={portfolio.pieData} dataKey="value" cx={80} cy={80} outerRadius={70} innerRadius={30}>
                  {portfolio.pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0D1117', border: '1px solid #1E293B', fontSize: 8 }} formatter={v => [rp(v)]} />
              </PieChart>
            </div>
            <div style={{ background: c.surf, border: c.border, borderRadius: 8, padding: 14, overflowX: 'auto' }}>
              <div style={{ fontSize: 7.5, color: '#374151', letterSpacing: 2, marginBottom: 10 }}>DETAIL POSISI</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 8.5, minWidth: 450 }}>
                <thead>
                  <tr style={{ borderBottom: c.border }}>
                    {['SAHAM','LOT','MODAL','NILAI','P&L','%'].map(h => (
                      <th key={h} style={{ padding: '4px 8px', textAlign: h === 'SAHAM' ? 'left' : 'right', color: '#374151', fontSize: 7, letterSpacing: 1 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {portfolio.positions.map((pos, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #0D1117' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <span style={{ color: pos.color, fontWeight: 700 }}>{pos.name}</span>
                        <div style={{ fontSize: 6.5, color: '#374151' }}>{pos.ticker}</div>
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748B' }}>{pos.shares}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#64748B' }}>{rp(pos.cost)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: '#E2E8F0' }}>{rp(pos.value)}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: pos.ret >= 0 ? '#10B981' : '#EF4444', fontWeight: 700 }}>
                        {rp(pos.value - pos.cost)}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', color: pos.ret >= 0 ? '#10B981' : '#EF4444', fontWeight: 800 }}>
                        {pct(pos.ret * 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
