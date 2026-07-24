/**
 * app.js — application entry point. Holds the single source of truth for
 * "what symbol/timeframe is currently being viewed" (AppState), which the
 * AI Copilot reads from for context-aware answers.
 */
const AppState = {
  symbol: "BTCUSDT",
  resolution: "15m",
  products: [],
};

async function loadProducts() {
  const listEl = document.getElementById("symbolList");
  try {
    const { result } = await Api.get("/api/market/products");
    AppState.products = result;
    renderSymbolList(result);
  } catch (err) {
    listEl.innerHTML = `<div class="empty-row">Failed to load products.<br>${err.message}</div>`;
  }
}

function renderSymbolList(products, filter = "") {
  const listEl = document.getElementById("symbolList");
  const q = filter.trim().toUpperCase();
  const filtered = q ? products.filter((p) => p.symbol.includes(q)) : products;

  if (!filtered.length) {
    listEl.innerHTML = `<div class="empty-row">No matching pairs.</div>`;
    return;
  }

  listEl.innerHTML = filtered
    .slice(0, 300) // guard against rendering thousands of rows at once
    .map(
      (p) => `
      <div class="symbol-row ${p.symbol === AppState.symbol ? "active" : ""}" data-symbol="${p.symbol}">
        <span class="pair">${p.symbol}</span>
        <span class="type-tag">${p.contractType || ""}</span>
      </div>`
    )
    .join("");

  listEl.querySelectorAll(".symbol-row").forEach((row) => {
    row.addEventListener("click", () => switchSymbol(row.dataset.symbol));
  });
}

async function switchSymbol(symbol) {
  if (symbol === AppState.symbol) return;
  AppState.symbol = symbol;
  document.getElementById("currentSymbol").textContent = symbol;
  document
    .querySelectorAll(".symbol-row")
    .forEach((r) => r.classList.toggle("active", r.dataset.symbol === symbol));

  await reloadChart();
  document.getElementById("symbolSidebar").classList.remove("open");
}

async function switchResolution(resolution) {
  if (resolution === AppState.resolution) return;
  AppState.resolution = resolution;
  document.querySelectorAll("#timeframeGroup button").forEach((b) => {
    b.classList.toggle("active", b.dataset.res === resolution);
  });
  await reloadChart();
}

async function reloadChart() {
  CopilotModule.updateContextLabel(AppState.symbol, AppState.resolution);
  try {
    const { result } = await Api.get(
      `/api/market/candles?symbol=${encodeURIComponent(AppState.symbol)}&resolution=${AppState.resolution}`
    );
    ChartModule.setHistory(result);
    updatePriceHeader(result[result.length - 1]);
  } catch (err) {
    console.error("Failed to load candles:", err.message);
  }
  SocketModule.watch(AppState.symbol, AppState.resolution);
}

function updatePriceHeader(lastCandle) {
  if (!lastCandle) return;
  const priceEl = document.getElementById("lastPrice");
  const changeEl = document.getElementById("priceChange");
  priceEl.textContent = lastCandle.close;

  const pct = (((lastCandle.close - lastCandle.open) / lastCandle.open) * 100).toFixed(2);
  changeEl.textContent = `${pct > 0 ? "+" : ""}${pct}%`;
  changeEl.classList.toggle("up", pct >= 0);
  changeEl.classList.toggle("down", pct < 0);
}

function initUiHandlers() {
  document.getElementById("symbolSelectBtn").addEventListener("click", () => {
    document.getElementById("symbolSidebar").classList.toggle("open");
  });

  document.getElementById("symbolSearch").addEventListener("input", (e) => {
    renderSymbolList(AppState.products, e.target.value);
  });

  document.getElementById("timeframeGroup").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-res]");
    if (btn) switchResolution(btn.dataset.res);
  });
}

async function main() {
  ChartModule.init();
  SettingsModule.init();
  CopilotModule.init();
  initUiHandlers();

  SocketModule.init({
    onConnectionChange: (connected) => {
      const el = document.getElementById("connStatus");
      el.textContent = connected ? "● live" : "● offline";
      el.classList.toggle("online", connected);
      el.classList.toggle("offline", !connected);
    },
    onTicker: (ticker) => {
      const last = Number(ticker.close || ticker.mark_price || ticker.spot_price);
      if (!isNaN(last)) document.getElementById("lastPrice").textContent = last;
    },
    onCandle: (candle) => {
      ChartModule.updateCandle(candle);
    },
  });

  await loadProducts();
  await reloadChart();
}

document.addEventListener("DOMContentLoaded", main);
