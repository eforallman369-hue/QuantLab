# BEI QUANT LAB

Platform riset kuantitatif untuk Bursa Efek Indonesia.
Data real dari Yahoo Finance · Dihosting di Vercel · Gratis.

---

## CARA DEPLOY (30 menit, gratis)

### STEP 1 — SETUP GITHUB

1. Buat akun di github.com (gratis)
2. Buat repository baru → nama: `bei-quant-lab`
3. Upload semua file ini ke repo:
   - Cara termudah: drag & drop semua file ke GitHub web UI
   - Atau pakai GitHub Desktop app di HP/laptop

### STEP 2 — DEPLOY KE VERCEL

1. Buat akun di vercel.com (gratis, login pakai GitHub)
2. Klik "Add New Project"
3. Import repository `bei-quant-lab` dari GitHub kamu
4. Settings:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Klik **Deploy**
6. Tunggu ~2 menit → dapat URL: `bei-quant-lab.vercel.app`

Done. Bisa dibuka dari HP manapun.

---

## FITUR

### ◎ PORTOFOLIO TRACKER
- Input saham BEI kamu (ticker + lot + harga beli)
- Fetch harga real dari Yahoo Finance otomatis
- Lihat P&L real-time vs IHSG benchmark
- Equity curve portfolio vs benchmark
- Alokasi pie chart + detail posisi

### ◈ MONTE CARLO SIMULATION
- Pilih saham BEI → parameter μ dan σ dikalibrasi otomatis dari 2 tahun data
- Run 200–2000 simulasi GBM
- Lihat fan chart: P5/P25/P50/P75/P95
- Distribusi harga akhir
- Probabilitas profit, VaR 95%, CVaR

### ◉ EDGE FINDER
- **Hurst Exponent**: deteksi apakah saham mean-reverting, random, atau trending
- **Autocorrelation**: ada pattern momentum atau mean reversion?
- **Return Distribution**: fat tails? skewness?
- **Rolling Sharpe**: kapan edge ada dan kapan tidak
- **5 Strategi sekaligus**: PEAD, Mean Reversion, Broker Flow, Volume Anomaly, Window Dressing — semua ditest di data real saham yang dipilih

---

## DATA SOURCES

| Data | Sumber | Update |
|------|--------|--------|
| Harga Saham BEI | Yahoo Finance (.JK) | ~15 min delay |
| IHSG Index | Yahoo Finance (^JKSE) | ~15 min delay |
| Semua data historis | 2 tahun ke belakang | Daily |

Tidak butuh API key. Gratis.

---

## FORMULA YANG DIGUNAKAN

```
HURST EXPONENT   H = slope(log RS ~ log n) — via rescaled range
AUTOCORRELATION  AC(k) = Σ(r_t - μ)(r_{t-k} - μ) / Σ(r_t - μ)²
SHARPE RATIO     S = (μ_annual - r_f) / σ_annual
SORTINO RATIO    Sort = (μ_annual - r_f) / downside_deviation
MAX DRAWDOWN     MDD = max[(Peak - Trough) / Peak]
KELLY CRITERION  f* = (b·p - q) / b
EXPECTED VALUE   EV = p·avg_win - q·avg_loss
GBM (Monte Carlo) S_t = S_0 · exp[(μ - σ²/2)·t + σ·√t·Z]
Z-SCORE          Z = (Price - MA_n) / σ_n
CALMAR RATIO     Calmar = Annual Return / Max Drawdown
VAR 95%          VaR = -percentile(returns, 5%)
```

---

## DISCLAIMER

Platform ini dibuat untuk tujuan edukasi dan riset kuantitatif.
BUKAN saran investasi. Selalu lakukan due diligence sendiri.
Past performance tidak menjamin hasil di masa depan.
