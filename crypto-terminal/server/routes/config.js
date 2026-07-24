const express = require("express");
const router = express.Router();
const secureStore = require("../config/secureStore");
const deltaClient = require("../services/deltaClient");
const aiProviders = require("../services/aiProviders");

/**
 * GET /api/config/status
 * Returns only boolean flags — never the actual keys — so the frontend can
 * show "Connected" / "Not connected" without ever touching the secrets.
 */
router.get("/status", (req, res) => {
  res.json({
    delta: {
      configured: deltaClient.isConfigured(),
      region: deltaClient.getRegion(),
    },
    ai: {
      configured: aiProviders.isConfigured(),
      provider: aiProviders.getAiConfig()?.provider || null,
      model: aiProviders.getAiConfig()?.model || null,
    },
  });
});

/**
 * POST /api/config/delta
 * body: { apiKey, apiSecret }
 * Encrypts and stores credentials server-side. Frontend never sees these again.
 */
router.post("/delta", (req, res) => {
  const { apiKey, apiSecret } = req.body;
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ error: "apiKey and apiSecret are required." });
  }
  secureStore.update({ delta: { apiKey, apiSecret } });
  res.json({ success: true });
});

/**
 * POST /api/config/ai
 * body: { provider: "anthropic"|"openai"|"gemini", apiKey, model? }
 */
router.post("/ai", (req, res) => {
  const { provider, apiKey, model } = req.body;
  const allowed = ["anthropic", "openai", "gemini"];
  if (!allowed.includes(provider) || !apiKey) {
    return res
      .status(400)
      .json({ error: `provider must be one of ${allowed.join(", ")}, and apiKey is required.` });
  }
  secureStore.update({ ai: { provider, apiKey, model: model || null } });
  res.json({ success: true });
});

module.exports = router;
