/**
 * socket.js — connects to OUR backend's Socket.IO relay (not Delta directly).
 * The backend maintains the real upstream WS connection to Delta and fans out
 * "delta:message" events to every connected browser tab.
 */
const SocketModule = (() => {
  let socket;
  let activeSymbol = null;
  let activeResolution = null;

  function init({ onConnectionChange, onTicker, onCandle }) {
    socket = io();

    socket.on("connect", () => onConnectionChange(true));
    socket.on("disconnect", () => onConnectionChange(false));

    socket.on("delta:message", (msg) => {
      // Delta sends different message shapes depending on channel type.
      // We only act on messages relevant to the currently active symbol.
      if (!msg || !msg.symbol) return;
      if (msg.symbol !== activeSymbol) return;

      if (msg.type === "v2/ticker" || msg.type === "ticker") {
        onTicker(msg);
      } else if (typeof msg.type === "string" && msg.type.startsWith("candlestick_")) {
        onCandle({
          time: Math.floor(msg.candle_start_time / 1000) || msg.timestamp,
          open: Number(msg.open),
          high: Number(msg.high),
          low: Number(msg.low),
          close: Number(msg.close),
          volume: Number(msg.volume),
        });
      }
    });
  }

  /** Switch the live subscription to a new symbol/timeframe. */
  function watch(symbol, resolution) {
    if (activeSymbol && activeResolution) {
      socket.emit("unsubscribe", { symbol: activeSymbol, resolution: activeResolution });
    }
    activeSymbol = symbol;
    activeResolution = resolution;
    socket.emit("subscribe", { symbol, resolution });
  }

  return { init, watch };
})();
