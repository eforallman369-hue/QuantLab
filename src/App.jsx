import { useState, lazy, Suspense } from 'react';

const MonteCarlo      = lazy(() => import('./components/MonteCarlo.jsx'));
const PortfolioTracker= lazy(() => import('./components/PortfolioTracker.jsx'));
const EdgeFinder      = lazy(() => import('./components/EdgeFinder.jsx'));

const TABS = [
  { id: 'portfolio', label: '◎ PORTOFOLIO',  color: '#00D4FF', desc: 'Track posisi real vs IHSG' },
  { id: 'montecarlo',label: '◈ MONTE CARLO', color: '#10B981', desc: 'Simulasi GBM dari data real BEI' },
  { id: 'edge',      label: '◉ EDGE FINDER', color: '#8B5CF6', desc: 'Hurst · Autocorrelation · Strategi' },
];

const Loader = () => (
  <div style={{ padding: 40, textAlign: 'center', color: '#374151', fontSize: 8.5, letterSpacing: 2 }}>
    LOADING MODULE...
  </div>
);

export default function App() {
  const [tab, setTab] = useState('portfolio');
  const mono = '"Courier New", monospace';
  const c = { bg: '#080D18', surf: '#111827', surf2: '#0D1117', border: '1px solid #1E293B' };

  return (
    <div style={{ background: c.bg, minHeight: '100vh', fontFamily: mono, color: '#E2E8F0', fontSize: 12 }}>

      {/* HEADER */}
      <div style={{ background: c.surf2, borderBottom: c.border, padding: '10px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#00D4FF', letterSpacing: 5 }}>
              BEI QUANT LAB
            </div>
            <div style={{ fontSize: 6.5, color: '#1E293B', letterSpacing: 2, marginTop: 2 }}>
              REAL DATA · YAHOO FINANCE · QUANTITATIVE RESEARCH
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 7, color: '#374151', letterSpacing: 1 }}>
              GBM · SHARPE · SORTINO · KELLY · HURST · AUTOCORR
            </div>
            <div style={{ fontSize: 6.5, color: '#1E293B', marginTop: 2 }}>
              Data: Yahoo Finance (.JK) · Proxy: Vercel API
            </div>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div style={{ background: c.surf2, borderBottom: c.border, display: 'flex', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', border: 'none',
            borderBottom: tab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
            background: 'transparent',
            color: tab === t.id ? t.color : '#374151',
            fontSize: 8, fontWeight: 700, cursor: 'pointer',
            letterSpacing: 1.5, textTransform: 'uppercase',
            fontFamily: mono, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            {t.label}
            <div style={{ fontSize: 6, color: tab === t.id ? t.color + '99' : '#1E293B', fontWeight: 400, marginTop: 2, letterSpacing: 1 }}>
              {t.desc}
            </div>
          </button>
        ))}
      </div>

      {/* CONTENT */}
      <div style={{ padding: 14 }}>
        <Suspense fallback={<Loader />}>
          {tab === 'portfolio'   && <PortfolioTracker />}
          {tab === 'montecarlo'  && <MonteCarlo />}
          {tab === 'edge'        && <EdgeFinder />}
        </Suspense>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: c.border, padding: '10px 16px', marginTop: 20, display: 'flex', justifyContent: 'space-between', fontSize: 7, color: '#1E293B' }}>
        <span>BEI QUANT LAB · Data via Yahoo Finance</span>
        <span>BUKAN SARAN INVESTASI · Gunakan untuk edukasi dan riset</span>
        <span>Harga delayed ~15 menit</span>
      </div>
    </div>
  );
}
