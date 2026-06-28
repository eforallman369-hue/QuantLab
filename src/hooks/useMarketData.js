import { useState, useCallback } from 'react';

// Daftar saham BEI populer dengan suffix .JK
export const BEI_STOCKS = [
  { ticker: 'BBCA.JK',  name: 'BCA',          sector: 'Perbankan' },
  { ticker: 'BBRI.JK',  name: 'BRI',          sector: 'Perbankan' },
  { ticker: 'BMRI.JK',  name: 'Mandiri',       sector: 'Perbankan' },
  { ticker: 'BBNI.JK',  name: 'BNI',           sector: 'Perbankan' },
  { ticker: 'TLKM.JK',  name: 'Telkom',        sector: 'Telekomunikasi' },
  { ticker: 'ASII.JK',  name: 'Astra',         sector: 'Otomotif' },
  { ticker: 'UNVR.JK',  name: 'Unilever',      sector: 'Consumer' },
  { ticker: 'HMSP.JK',  name: 'HM Sampoerna',  sector: 'Consumer' },
  { ticker: 'ICBP.JK',  name: 'Indofood CBP',  sector: 'Consumer' },
  { ticker: 'KLBF.JK',  name: 'Kalbe Farma',   sector: 'Farmasi' },
  { ticker: 'GOTO.JK',  name: 'GoTo',           sector: 'Teknologi' },
  { ticker: 'BYAN.JK',  name: 'Bayan Resources',sector: 'Batubara' },
  { ticker: 'ADRO.JK',  name: 'Adaro Energy',  sector: 'Batubara' },
  { ticker: 'ANTM.JK',  name: 'Aneka Tambang', sector: 'Mining' },
  { ticker: '^JKSE',    name: 'IHSG',           sector: 'Index' },
];

export const useMarketData = () => {
  const [data, setData]       = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors]   = useState({});

  const fetchStock = useCallback(async ticker => {
    if (loading[ticker]) return;

    setLoading(prev => ({ ...prev, [ticker]: true }));
    setErrors(prev => ({ ...prev, [ticker]: null }));

    try {
      // Gunakan API route Vercel kita sebagai proxy
      const res = await fetch(`/api/prices?ticker=${encodeURIComponent(ticker)}&range=2y&interval=1d`);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const json = await res.json();
      setData(prev => ({ ...prev, [ticker]: json }));
    } catch (err) {
      setErrors(prev => ({ ...prev, [ticker]: err.message }));
    } finally {
      setLoading(prev => ({ ...prev, [ticker]: false }));
    }
  }, [loading]);

  const fetchMultiple = useCallback(async tickers => {
    await Promise.all(tickers.map(fetchStock));
  }, [fetchStock]);

  const clearTicker = useCallback(ticker => {
    setData(prev => { const n = {...prev}; delete n[ticker]; return n; });
    setErrors(prev => { const n = {...prev}; delete n[ticker]; return n; });
  }, []);

  return { data, loading, errors, fetchStock, fetchMultiple, clearTicker };
};
