const express = require("express");
const router = express.Router();
const aiProviders = require("../services/aiProviders");

/**
 * POST /api/ai/chat
 * body: {
 *   message: string,
 *   history: {role, content}[]           // prior turns in this chat session
 *   context: {                            // what the user is currently looking at
 *     symbol: string,
 *     resolution: string,
 *     lastPrice: number,
 *     candles: {time,open,high,low,close,volume}[]  // recent candles, already trimmed by frontend
 *   }
 * }
 */
router.post("/chat", async (req, res) => {
  const { message, history = [], context = {} } = req.body;
  if (!message) return res.status(400).json({ error: "message is required." });

  if (!aiProviders.isConfigured()) {
    return res.status(400).json({
      error: "AI Copilot has no API key configured yet. Add one in Settings.",
    });
  }

  const systemPrompt = buildSystemPrompt(context);

  try {
    const reply = await aiProviders.chat({
      systemPrompt,
      messages: [...history, { role: "user", content: message }],
    });
    res.json({ reply });
  } catch (err) {
    console.error("[ai/chat]", err.response?.data || err.message);
    res.status(502).json({ error: "The AI provider request failed. Check your API key and model." });
  }
});

function buildSystemPrompt(context) {
  const { symbol, resolution, lastPrice, candles = [] } = context;

  // Summarize the recent candles compactly instead of dumping raw arrays —
  // keeps the prompt small and gives the model an actual read on trend/volatility.
  let candleSummary = "No recent candle data available.";
  if (candles.length > 0) {
    const first = candles[0];
    const last = candles[candles.length - 1];
    const high = Math.max(...candles.map((c) => c.high));
    const low = Math.min(...candles.map((c) => c.low));
    const pctChange = (((last.close - first.open) / first.open) * 100).toFixed(2);
    candleSummary =
      `Over the last ${candles.length} candles: opened at ${first.open}, ` +
      `currently at ${last.close} (${pctChange}% change), ` +
      `range high ${high} / low ${low}.`;
  }

  return `You are an AI trading copilot embedded in a crypto trading terminal.
The user is currently viewing:
- Symbol: ${symbol || "unknown"}
- Timeframe: ${resolution || "unknown"}
- Last traded price: ${lastPrice ?? "unknown"}
- ${candleSummary}

Use this context automatically when the user asks things like "what do you think of this chart"
or "analyze this" — you already know what they're looking at, don't ask them to repeat it.
Be concise and concrete. You may reference support/resistance, momentum, and volatility based on
the summary above. Always remind the user, when giving directional views, that this is not
financial advice and markets are risky — but don't let that disclaimer dominate the answer.`;
}

module.exports = router;
