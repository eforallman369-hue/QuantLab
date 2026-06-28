// Vercel Serverless Function
// Proxy untuk Yahoo Finance — bypass CORS dari browser
// Deploy ke Vercel, fungsi ini jalan di server

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { ticker, range = '2y', interval = '1d' } = req.query;

  if (!ticker) {
    return res.status(400).json({ error: 'ticker is required' });
  }

  // Validasi ticker — hanya allow format BEI (XXXX.JK) atau index (^JKSE)
  const allowed = /^[\^A-Z0-9.]{2,12}$/;
  if (!allowed.test(ticker)) {
    return res.status(400).json({ error: 'invalid ticker format' });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}&includeAdjustedClose=true`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status}`);
    }

    const data = await response.json();
    
    // Parse & bersihkan data
    const chart = data?.chart?.result?.[0];
    if (!chart) {
      return res.status(404).json({ error: 'No data found for this ticker' });
    }

    const timestamps = chart.timestamp || [];
    const closes    = chart.indicators?.quote?.[0]?.close || [];
    const opens     = chart.indicators?.quote?.[0]?.open  || [];
    const highs     = chart.indicators?.quote?.[0]?.high  || [];
    const lows      = chart.indicators?.quote?.[0]?.low   || [];
    const volumes   = chart.indicators?.quote?.[0]?.volume || [];
    const adjClose  = chart.indicators?.adjclose?.[0]?.adjclose || closes;

    // Bersihkan null values
    const cleaned = timestamps
      .map((ts, i) => ({
        date:   new Date(ts * 1000).toISOString().split('T')[0],
        open:   opens[i]   ?? null,
        high:   highs[i]   ?? null,
        low:    lows[i]    ?? null,
        close:  closes[i]  ?? null,
        adjClose: adjClose[i] ?? closes[i] ?? null,
        volume: volumes[i] ?? 0,
      }))
      .filter(d => d.close !== null && d.close > 0);

    return res.status(200).json({
      ticker,
      name: chart.meta?.longName || ticker,
      currency: chart.meta?.currency || 'IDR',
      exchange: chart.meta?.exchangeName || 'JKT',
      data: cleaned,
      count: cleaned.length,
    });

  } catch (err) {
    console.error('Price fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
}
