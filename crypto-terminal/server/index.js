require("dotenv").config();
const path = require("path");
const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const { Server } = require("socket.io");

const configRoutes = require("./routes/config");
const marketRoutes = require("./routes/market");
const aiRoutes = require("./routes/ai");
const deltaSocket = require("./services/deltaSocket");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 4000;

app.use(
  helmet({
    // Relaxed CSP so CDN-hosted lightweight-charts / socket.io client can load.
    // Tighten this to your actual asset hosts before deploying publicly.
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json());

// ---- API routes -------------------------------------------------------------
app.use("/api/config", configRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/ai", aiRoutes);

// ---- Static frontend ---------------------------------------------------------
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// ---- Real-time relay: browser <-socket.io-> this server <-ws-> Delta Exchange
deltaSocket.attach(io);

server.listen(PORT, () => {
  console.log(`\n🚀 Crypto Trading Terminal running at http://localhost:${PORT}\n`);
});
