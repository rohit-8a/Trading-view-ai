/**
 * chart.js — renders the candlestick chart with TradingView Lightweight Charts.
 * Exposes a small ChartModule API that app.js / socket.js drive.
 */
const ChartModule = (() => {
  let chart, candleSeries, volumeSeries;
  let currentCandles = []; // kept in memory so the AI Copilot can read recent context

  function init() {
    const container = document.getElementById("chartContainer");

    chart = LightweightCharts.createChart(container, {
      layout: {
        background: { color: "#0b0e14" },
        textColor: "#9aa4b8",
        fontFamily: "SF Mono, Roboto Mono, Consolas, monospace",
      },
      grid: {
        vertLines: { color: "#171c26" },
        horzLines: { color: "#171c26" },
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#262d3a" },
      timeScale: { borderColor: "#262d3a", timeVisible: true, secondsVisible: false },
    });

    candleSeries = chart.addCandlestickSeries({
      upColor: "#17c37b",
      downColor: "#f6465d",
      borderVisible: false,
      wickUpColor: "#17c37b",
      wickDownColor: "#f6465d",
    });

    volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "", // overlay, separate scale
      color: "#2a3140",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      chart.resize(width, height);
    }).observe(container);
  }

  /** Replace the whole dataset — used when switching symbol/timeframe. */
  function setHistory(candles) {
    currentCandles = candles;
    candleSeries.setData(candles.map(toCandlePoint));
    volumeSeries.setData(candles.map(toVolumePoint));
    chart.timeScale().fitContent();
  }

  /** Push/update the most recent candle from a live tick — avoids full reloads. */
  function updateCandle(candle) {
    const idx = currentCandles.findIndex((c) => c.time === candle.time);
    if (idx >= 0) currentCandles[idx] = candle;
    else currentCandles.push(candle);

    candleSeries.update(toCandlePoint(candle));
    volumeSeries.update(toVolumePoint(candle));
  }

  function toCandlePoint(c) {
    return { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close };
  }
  function toVolumePoint(c) {
    return {
      time: c.time,
      value: c.volume,
      color: c.close >= c.open ? "rgba(23,195,123,0.5)" : "rgba(246,70,93,0.5)",
    };
  }

  /** Used by the AI Copilot to get context about what's currently on screen. */
  function getRecentCandles(count = 60) {
    return currentCandles.slice(-count);
  }

  function getLastPrice() {
    if (!currentCandles.length) return null;
    return currentCandles[currentCandles.length - 1].close;
  }

  return { init, setHistory, updateCandle, getRecentCandles, getLastPrice };
})();
