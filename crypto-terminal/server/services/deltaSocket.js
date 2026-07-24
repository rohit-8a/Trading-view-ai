/**
 * deltaSocket.js
 * ----------------------------------------------------------------------------
 * Maintains ONE upstream WebSocket connection to Delta Exchange (public market
 * data channels only — no keys needed for ticker/candlestick data) and relays
 * messages to all connected browser clients over Socket.IO.
 *
 * Why proxy instead of connecting the browser directly to Delta?
 *  - Keeps a single upstream connection regardless of how many browser tabs
 *    are open (Delta rate-limits connections/subscriptions).
 *  - Lets us centrally track "who is subscribed to what" so the frontend
 *    doesn't need any Delta-specific protocol knowledge at all.
 * ----------------------------------------------------------------------------
 */
const WebSocket = require("ws");
const { getHosts } = require("./deltaClient");

let upstream = null;
let io = null;
let reconnectTimer = null;

// symbol -> Set of channel names currently subscribed upstream (e.g. "v2/ticker", "candlestick_1m")
const activeSubscriptions = new Map();

function channelsPayload(entries) {
  return {
    type: "subscribe",
    payload: { channels: entries },
  };
}

function connectUpstream() {
  const { ws: wsUrl } = getHosts();
  console.log(`[deltaSocket] Connecting upstream: ${wsUrl}`);
  upstream = new WebSocket(wsUrl);

  upstream.on("open", () => {
    console.log("[deltaSocket] Upstream connected.");
    // Re-subscribe to anything that was active before a reconnect
    resubscribeAll();
    startHeartbeat();
  });

  upstream.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    // Relay every market data message straight to the frontend.
    // Frontend filters by symbol/type client-side (see public/js/socket.js).
    if (io) io.emit("delta:message", msg);
  });

  upstream.on("close", () => {
    console.warn("[deltaSocket] Upstream closed. Reconnecting in 3s...");
    stopHeartbeat();
    scheduleReconnect();
  });

  upstream.on("error", (err) => {
    console.error("[deltaSocket] Upstream error:", err.message);
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectUpstream();
  }, 3000);
}

let heartbeatInterval = null;
function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(() => {
    if (upstream && upstream.readyState === WebSocket.OPEN) {
      upstream.send(JSON.stringify({ type: "ping" }));
    }
  }, 25000);
}
function stopHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = null;
}

function resubscribeAll() {
  const entries = [];
  for (const [channel, symbols] of activeSubscriptions.entries()) {
    if (symbols.size > 0) entries.push({ name: channel, symbols: [...symbols] });
  }
  if (entries.length && upstream.readyState === WebSocket.OPEN) {
    upstream.send(JSON.stringify(channelsPayload(entries)));
  }
}

function sendSubscribe(channel, symbol) {
  if (!activeSubscriptions.has(channel)) activeSubscriptions.set(channel, new Set());
  const set = activeSubscriptions.get(channel);
  if (set.has(symbol)) return; // already subscribed
  set.add(symbol);

  if (upstream && upstream.readyState === WebSocket.OPEN) {
    upstream.send(JSON.stringify(channelsPayload([{ name: channel, symbols: [symbol] }])));
  }
}

function sendUnsubscribe(channel, symbol) {
  const set = activeSubscriptions.get(channel);
  if (!set || !set.has(symbol)) return;
  set.delete(symbol);

  if (upstream && upstream.readyState === WebSocket.OPEN) {
    upstream.send(
      JSON.stringify({
        type: "unsubscribe",
        payload: { channels: [{ name: channel, symbols: [symbol] }] },
      })
    );
  }
}

/**
 * Called from index.js once the Socket.IO server exists.
 * Wires up per-client subscribe/unsubscribe requests coming from the browser.
 */
function attach(ioServer) {
  io = ioServer;
  connectUpstream();

  io.on("connection", (socket) => {
    console.log(`[deltaSocket] Frontend client connected: ${socket.id}`);

    // Frontend asks to watch a symbol at a given candle resolution.
    socket.on("subscribe", ({ symbol, resolution }) => {
      if (!symbol) return;
      sendSubscribe("v2/ticker", symbol);
      if (resolution) sendSubscribe(`candlestick_${resolution}`, symbol);
    });

    socket.on("unsubscribe", ({ symbol, resolution }) => {
      if (!symbol) return;
      sendUnsubscribe("v2/ticker", symbol);
      if (resolution) sendUnsubscribe(`candlestick_${resolution}`, symbol);
    });

    socket.on("disconnect", () => {
      console.log(`[deltaSocket] Frontend client disconnected: ${socket.id}`);
      // Note: we intentionally do NOT auto-unsubscribe upstream here, since
      // other connected tabs/clients may still want the same symbol's data.
    });
  });
}

module.exports = { attach };
