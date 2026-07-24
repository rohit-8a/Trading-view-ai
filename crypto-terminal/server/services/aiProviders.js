/**
 * aiProviders.js
 * ----------------------------------------------------------------------------
 * Normalizes calls to whichever LLM provider the user configured (Anthropic,
 * OpenAI, or Gemini) behind one function: chat({ systemPrompt, messages }).
 *
 * The API key never touches the frontend — it's read from the encrypted
 * secureStore and attached to the outbound request here on the server.
 * ----------------------------------------------------------------------------
 */
const axios = require("axios");
const secureStore = require("../config/secureStore");

function getAiConfig() {
  const store = secureStore.get();
  return store.ai || null; // { provider: "anthropic"|"openai"|"gemini", apiKey, model }
}

function isConfigured() {
  const cfg = getAiConfig();
  return !!(cfg && cfg.provider && cfg.apiKey);
}

async function callAnthropic({ apiKey, model, systemPrompt, messages }) {
  const resp = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: model || "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    },
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      timeout: 30000,
    }
  );
  const text = (resp.data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return text;
}

async function callOpenAI({ apiKey, model, systemPrompt, messages }) {
  const resp = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model: model || "gpt-4o",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    }
  );
  return resp.data.choices?.[0]?.message?.content || "";
}

async function callGemini({ apiKey, model, systemPrompt, messages }) {
  const modelName = model || "gemini-1.5-pro";
  const resp = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
    {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    },
    { headers: { "Content-Type": "application/json" }, timeout: 30000 }
  );
  const candidate = resp.data.candidates?.[0];
  return candidate?.content?.parts?.map((p) => p.text).join("\n") || "";
}

/**
 * @param {{ systemPrompt: string, messages: {role: "user"|"assistant", content: string}[] }} args
 */
async function chat({ systemPrompt, messages }) {
  const cfg = getAiConfig();
  if (!cfg) throw new Error("AI Copilot is not configured yet. Add an API key in Settings.");

  const args = { apiKey: cfg.apiKey, model: cfg.model, systemPrompt, messages };

  switch (cfg.provider) {
    case "anthropic":
      return callAnthropic(args);
    case "openai":
      return callOpenAI(args);
    case "gemini":
      return callGemini(args);
    default:
      throw new Error(`Unknown AI provider: ${cfg.provider}`);
  }
}

module.exports = { chat, isConfigured, getAiConfig };
