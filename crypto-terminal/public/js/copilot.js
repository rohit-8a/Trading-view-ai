/**
 * copilot.js — floating/sidebar AI chat widget.
 * Key requirement: it always knows the currently viewed symbol + timeframe
 * without the user having to say it — that context is read straight from
 * AppState / ChartModule and sent alongside every message to /api/ai/chat.
 */
const CopilotModule = (() => {
  const panel = document.getElementById("copilotPanel");
  const messagesEl = document.getElementById("copilotMessages");
  const inputEl = document.getElementById("copilotInput");
  const contextEl = document.getElementById("copilotContext");

  let history = []; // [{role, content}] for this session

  function open() {
    panel.classList.add("open");
  }
  function close() {
    panel.classList.remove("open");
  }
  function toggle() {
    panel.classList.toggle("open");
  }

  /** Called whenever the symbol/timeframe changes so the header stays accurate. */
  function updateContextLabel(symbol, resolution) {
    contextEl.textContent = `Watching ${symbol} · ${resolution}`;
  }

  function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `copilot-msg ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function send() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    appendMessage("user", text);
    history.push({ role: "user", content: text });

    const thinkingDiv = document.createElement("div");
    thinkingDiv.className = "copilot-msg assistant";
    thinkingDiv.textContent = "Thinking…";
    messagesEl.appendChild(thinkingDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const context = {
        symbol: AppState.symbol,
        resolution: AppState.resolution,
        lastPrice: ChartModule.getLastPrice(),
        candles: ChartModule.getRecentCandles(60),
      };

      const { reply } = await Api.post("/api/ai/chat", {
        message: text,
        history: history.slice(0, -1), // don't double-send the message we just pushed
        context,
      });

      thinkingDiv.textContent = reply;
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      thinkingDiv.remove();
      appendMessage("error", err.message || "The AI Copilot request failed.");
    }
  }

  function init() {
    document.getElementById("copilotToggle").addEventListener("click", toggle);
    document.getElementById("copilotClose").addEventListener("click", close);
    document.getElementById("copilotSend").addEventListener("click", send);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

  return { init, open, close, toggle, updateContextLabel };
})();
