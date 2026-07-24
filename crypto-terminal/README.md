# Delta Terminal — Custom Crypto Trading Dashboard

A self-hosted crypto trading terminal: live Delta Exchange charts (TradingView
Lightweight Charts), a secure settings page for your Delta + AI keys, and a
context-aware AI Copilot sidebar.

## Folder structure

```
crypto-terminal/
├── package.json
├── .env.example
├── server/
│   ├── index.js                # Express + Socket.IO bootstrap
│   ├── config/
│   │   └── secureStore.js      # AES-256-GCM encrypted key storage
│   ├── routes/
│   │   ├── config.js           # save/check Delta + AI credentials
│   │   ├── market.js           # REST proxy: products, candles, ticker
│   │   └── ai.js                # AI Copilot chat endpoint (context-aware)
│   ├── services/
│   │   ├── deltaClient.js       # signed Delta REST client
│   │   ├── deltaSocket.js       # Delta WS -> Socket.IO relay
│   │   └── aiProviders.js       # Anthropic / OpenAI / Gemini switch
│   └── data/                    # secure-config.enc lives here (gitignored)
└── public/
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js                # fetch wrapper
        ├── chart.js               # Lightweight Charts rendering
        ├── socket.js              # Socket.IO client, live updates
        ├── settings.js            # Settings modal
        ├── copilot.js             # AI Copilot widget
        └── app.js                 # bootstraps everything, symbol/timeframe state
```

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and set MASTER_ENCRYPTION_PASSPHRASE to a long random string
npm start
```

Open `http://localhost:4000`.

1. Click the ⚙ **Settings** button, paste your Delta Exchange API Key/Secret,
   and save. It's encrypted with AES-256-GCM and written to
   `server/data/secure-config.enc` — the browser never sees it again.
2. In the same modal, pick an AI provider (Anthropic/OpenAI/Gemini), paste an
   API key, and save.
3. Use the symbol button top-left (or sidebar) to switch pairs, and the
   timeframe buttons for 1m/5m/15m/1h/4h/1D.
4. Click the ✦ floating button to open the AI Copilot. It automatically knows
   the symbol, timeframe, last price, and a summary of recent candles — you
   can just ask "what's the trend here?" without repeating context.

## How the security model works

- **Delta API Secret** and **AI API key** are POSTed once from the settings
  modal to the backend, encrypted at rest, and never sent back to the
  frontend in any subsequent response — `/api/config/status` only returns
  booleans.
- All Delta REST calls (`/v2/products`, `/v2/history/candles`, signed
  account endpoints) and all AI provider calls happen **server-side**. The
  browser only ever talks to `/api/*` on your own backend.
- Real-time data flows: `Delta WS -> server/services/deltaSocket.js -> Socket.IO -> browser`.
  There's exactly one upstream WebSocket to Delta regardless of how many
  browser tabs are open.

## Keeping Delta API details current

Delta Exchange's exact hosts/endpoints can change over time. Everything
region-specific is isolated in `server/services/deltaClient.js` (`HOSTS`
object) and `server/services/deltaSocket.js`. If requests start failing,
check `https://docs.delta.exchange` and update those two files — nothing
else needs to change.

## Extending

- **Order placement**: add signed calls to `deltaClient.js` (e.g.
  `POST /v2/orders`) and a corresponding route — the signing helper already
  supports it.
- **Multiple simultaneous charts**: `deltaSocket.js` already tracks
  subscriptions per symbol/channel independently of any single browser tab.
- **Streaming AI replies**: swap the `/api/ai/chat` route to a
  Server-Sent-Events or chunked response and stream `aiProviders.chat()`
  output as it arrives.
