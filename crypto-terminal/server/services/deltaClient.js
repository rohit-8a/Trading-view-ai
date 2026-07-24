/**
 * deltaClient.js
 * ----------------------------------------------------------------------------
 * Thin wrapper around the Delta Exchange REST API.
 *
 * NOTE ON KEEPING THIS CURRENT:
 * Delta occasionally changes hosts / endpoint paths. Everything region/host
 * specific lives in HOSTS below — check https://docs.delta.exchange if
 * requests start failing with 404s.
 *
 * Auth scheme (per Delta's current docs):
 *   headers: api-key, timestamp (unix seconds), signature
 *   signature = HMAC_SHA256( method + timestamp + requestPath + queryString + body, api_secret )
 *   Signatures are only valid for a few seconds, so timestamp must be "now".
 * ----------------------------------------------------------------------------
 */
const axios = require("axios");
const crypto = require("crypto");
const secureStore = require("../config/secureStore");

const HOSTS = {
  india: {
    rest: "https://api.india.delta.exchange",
    ws: "wss://socket.india.delta.exchange",
  },
  global: {
    rest: "https://api.delta.exchange",
    ws: "wss://socket.delta.exchange",
  },
};

function getRegion() {
  return HOSTS[process.env.DELTA_REGION] ? process.env.DELTA_REGION : "india";
}

function getHosts() {
  return HOSTS[getRegion()];
}

function getCredentials() {
  const store = secureStore.get();
  return store.delta || null; // { apiKey, apiSecret }
}

function isConfigured() {
  const creds = getCredentials();
  return !!(creds && creds.apiKey && creds.apiSecret);
}

function sign({ method, path, queryString = "", body = "" }) {
  const creds = getCredentials();
  if (!creds) throw new Error("Delta API credentials are not configured yet.");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const prehash = method + timestamp + path + queryString + body;
  const signature = crypto
    .createHmac("sha256", creds.apiSecret)
    .update(prehash)
    .digest("hex");

  return {
    "api-key": creds.apiKey,
    timestamp,
    signature,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Generic request helper.
 * @param {"GET"|"POST"|"PUT"|"DELETE"} method
 * @param {string} path - e.g. "/v2/products"
 * @param {object} [opts] - { params, data, authenticated }
 */
async function request(method, path, opts = {}) {
  const { params = {}, data = undefined, authenticated = false } = opts;
  const { rest } = getHosts();

  const query = new URLSearchParams(params).toString();
  const queryString = query ? `?${query}` : "";
  const body = data ? JSON.stringify(data) : "";

  let headers = { "Content-Type": "application/json", Accept: "application/json" };

  if (authenticated) {
    headers = sign({ method, path, queryString, body });
  }

  const response = await axios({
    method,
    url: `${rest}${path}${queryString}`,
    headers,
    data: data || undefined,
    timeout: 15000,
  });

  return response.data;
}

// ---- Public market data endpoints (no signing required) --------------------

/** All tradeable products (spot + perpetuals + options). Used to populate the symbol dropdown. */
async function getProducts() {
  const data = await request("GET", "/v2/products", { params: { page_size: 500 } });
  return data.result || [];
}

/** Latest ticker snapshot for one symbol, e.g. "BTCUSDT" */
async function getTicker(symbol) {
  const data = await request("GET", `/v2/tickers/${symbol}`);
  return data.result;
}

/**
 * Historical OHLC candles.
 * resolution examples: "1m","5m","15m","1h","4h","1d"
 * start/end are unix seconds.
 */
async function getCandles({ symbol, resolution, start, end }) {
  const data = await request("GET", "/v2/history/candles", {
    params: { symbol, resolution, start, end },
  });
  return data.result || [];
}

// ---- Authenticated endpoints (require stored api key/secret) ---------------

async function getBalances() {
  return request("GET", "/v2/wallet/balances", { authenticated: true });
}

async function getPositions() {
  return request("GET", "/v2/positions/margined", { authenticated: true });
}

module.exports = {
  getRegion,
  getHosts,
  isConfigured,
  getProducts,
  getTicker,
  getCandles,
  getBalances,
  getPositions,
};
