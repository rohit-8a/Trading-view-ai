/**
 * settings.js — handles the Settings modal: saving Delta + AI credentials.
 * Values are POSTed to our backend and never stored in localStorage/sessionStorage
 * or kept in any client-side variable after the save request completes.
 */
const SettingsModule = (() => {
  const modal = document.getElementById("settingsModal");

  function open() {
    modal.classList.remove("hidden");
    refreshStatus();
  }
  function close() {
    modal.classList.add("hidden");
  }

  async function refreshStatus() {
    try {
      const { delta, ai } = await Api.get("/api/config/status");
      setPill("deltaStatus", delta.configured, delta.configured ? `Connected (${delta.region})` : "Not connected");
      setPill("aiStatus", ai.configured, ai.configured ? `Connected (${ai.provider})` : "Not connected");
    } catch (err) {
      console.error("Failed to load config status", err);
    }
  }

  function setPill(id, ok, label) {
    const el = document.getElementById(id);
    el.textContent = label;
    el.classList.toggle("ok", ok);
    el.classList.toggle("bad", !ok);
  }

  async function saveDelta() {
    const apiKey = document.getElementById("deltaApiKey").value.trim();
    const apiSecret = document.getElementById("deltaApiSecret").value.trim();
    if (!apiKey || !apiSecret) return alert("Enter both API key and secret.");

    try {
      await Api.post("/api/config/delta", { apiKey, apiSecret });
      document.getElementById("deltaApiKey").value = "";
      document.getElementById("deltaApiSecret").value = "";
      refreshStatus();
    } catch (err) {
      alert("Failed to save Delta credentials: " + err.message);
    }
  }

  async function saveAi() {
    const provider = document.getElementById("aiProvider").value;
    const apiKey = document.getElementById("aiApiKey").value.trim();
    const model = document.getElementById("aiModel").value.trim();
    if (!apiKey) return alert("Enter an API key.");

    try {
      await Api.post("/api/config/ai", { provider, apiKey, model });
      document.getElementById("aiApiKey").value = "";
      refreshStatus();
    } catch (err) {
      alert("Failed to save AI Copilot key: " + err.message);
    }
  }

  function init() {
    document.getElementById("settingsBtn").addEventListener("click", open);
    document.getElementById("settingsClose").addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.getElementById("saveDeltaBtn").addEventListener("click", saveDelta);
    document.getElementById("saveAiBtn").addEventListener("click", saveAi);
  }

  return { init, open, close };
})();
