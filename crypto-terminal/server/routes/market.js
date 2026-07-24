const express = require("express");
const router = express.Router();
const deltaClient = require("../services/deltaClient");

/**
 * GET /api/market/products
 * List of all tradeable symbols, used to populate the pair dropdown/sidebar.
 * Optionally filter by ?type=spot or ?type=perpetual_futures via query string.
 */
router.get("/products", async (req, res) => {
  try {
    const products = await deltaClient.getProducts();
    const { type } = req.query;
    const filtered = type ? products.filter((p) => p.contract_type === type) : products;

    // Slim payload down to what the UI actually needs
    const slim = filtered.map((p) => ({
      symbol: p.symbol,
      description: p.description,
      contractType: p.contract_type,
      baseAsset: p.underlying_asset?.symbol,
      quoteAsset: p.quoting_asset?.symbol,
      tickSize: p.tick_size,
    }));

    res.json({ result: slim });
  } catch (err) {
    console.error("[market/products]", err.message);
    res.status(502).json({ error: "Failed to fetch products from Delta Exchange." });
  }
});

/**
 * GET /api/market/candles?symbol=BTCUSDT&resolution=15m&start=...&end=...
 * start/end are unix seconds. If omitted, defaults to the last 500 candles.
 */
router.get("/candles", async (req, res) => {
  const { symbol, resolution = "15m" } = req.query;
  if (!symbol) return res.status(400).json({ error: "symbol is required." });

  const now = Math.floor(Date.now() / 1000);
  const barSeconds = resolutionToSeconds(resolution);
  const end = req.query.end ? Number(req.query.end) : now;
  const start = req.query.start ? Number(req.query.start) : end - barSeconds * 500;

  try {
    const candles = await deltaClient.getCandles({ symbol, resolution, start, end });
    // Normalize to the shape TradingView Lightweight Charts expects
    const formatted = candles
      .map((c) => ({
        time: c.time,
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: Number(c.volume),
      }))
      .sort((a, b) => a.time - b.time);

    res.json({ result: formatted });
  } catch (err) {
    console.error("[market/candles]", err.message);
    res.status(502).json({ error: "Failed to fetch candles from Delta Exchange." });
  }
});

/** GET /api/market/ticker/:symbol */
router.get("/ticker/:symbol", async (req, res) => {
  try {
    const ticker = await deltaClient.getTicker(req.params.symbol);
    res.json({ result: ticker });
  } catch (err) {
    console.error("[market/ticker]", err.message);
    res.status(502).json({ error: "Failed to fetch ticker from Delta Exchange." });
  }
});

function resolutionToSeconds(resolution) {
  const unit = resolution.slice(-1);
  const value = parseInt(resolution.slice(0, -1), 10) || 1;
  const map = { m: 60, h: 3600, d: 86400, w: 604800 };
  return value * (map[unit] || 60);
}

module.exports = router;
