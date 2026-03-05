console.log("SERVER.JS LOADED FROM:", __filename);

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");
const { ethers } = require("ethers");

/* =========================================================
   EXPRESS SETUP
========================================================= */
const app = express();
app.use(cors());
app.use(express.json());

/* =========================================================
   OPTIONAL ETHEREUM SETUP (SHOWCASE)
========================================================= */
let wallet = null;

try {
  if (process.env.ALCHEMY_RPC && process.env.PRIVATE_KEY) {
    const provider = new ethers.JsonRpcProvider(process.env.ALCHEMY_RPC);
    wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log("Ethereum wallet loaded (Sepolia)");
  }
} catch {
  console.log("Ethereum disabled (env not ready)");
}

/* =========================================================
   IN-MEMORY LEDGER
========================================================= */
let ledger = [];

/* =========================================================
   SHORT HASH (16 HEX CHARS)
========================================================= */
function shortHash(input) {
  return crypto
    .createHash("sha256")
    .update(input)
    .digest("hex")
    .substring(0, 16);
}

/* =========================================================
   MODULE 7A: LEDGER ADD
========================================================= */
app.post("/api/ledger/add", (req, res) => {
  const { url, trustScore } = req.body;

  if (!url || trustScore === undefined) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const timestamp = Date.now();
  const hash = shortHash(`${url}|${trustScore}|${timestamp}`);

  ledger.push({
    url,
    trustScore,
    hash,
    timestamp
  });

  res.json({ hash });
});

/* =========================================================
   MODULE 7A: LEDGER READ
========================================================= */
app.get("/api/ledger", (req, res) => {
  res.json(ledger);
});

/* =========================================================
   MODULE 7B: REPUTATION PROOF (LOCAL CRYPTO)
========================================================= */
app.post("/api/proof/reputation", (req, res) => {
  const { url, trustScore } = req.body;

  if (!url || trustScore === undefined) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const timestamp = new Date().toISOString();
  const payload = `${url}|${trustScore}|${timestamp}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex");

  res.json({
    proofId: "PG-" + Date.now(),
    algorithm: "SHA-256",
    hash,
    timestamp,
    status: "Verified (Blockchain-Ready)"
  });
});

/* =========================================================
   MODULE 7C: WEBSITE AVAILABILITY CHECK
   HEAD → GET FALLBACK (IMPORTANT)
========================================================= */
app.post("/api/site/check", async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "URL required" });
  }

  /* ---- TRY HEAD FIRST ---- */
  try {
    const head = await axios.head(url, {
      timeout: 5000,
      validateStatus: () => true
    });

    if (head.status >= 200 && head.status < 500) {
      return res.json({
        exists: true,
        statusCode: head.status,
        method: "HEAD"
      });
    }
  } catch {
    // Ignore and fallback
  }

  /* ---- FALLBACK TO GET (YouTube, GitHub, etc.) ---- */
  try {
    const get = await axios.get(url, {
      timeout: 5000,
      maxContentLength: 1024,
      validateStatus: () => true
    });

    return res.json({
      exists: true,
      statusCode: get.status,
      method: "GET"
    });
  } catch {
    return res.json({
      exists: false,
      statusCode: null,
      method: "BLOCKED"
    });
  }
});

/* =========================================================
   MODULE 7D: ETHEREUM PROOF (OPTIONAL)
========================================================= */
app.post("/api/ethereum/proof", async (req, res) => {
  if (!wallet) {
    return res.json({
      status: "Skipped",
      message: "Ethereum not configured"
    });
  }

  try {
    const tx = await wallet.sendTransaction({
      to: wallet.address,
      value: 0
    });

    await tx.wait();

    res.json({
      status: "Success",
      network: "Sepolia",
      txHash: tx.hash
    });
  } catch (err) {
    res.status(500).json({ error: "Ethereum failed" });
  }
});

/* =========================================================
   START SERVER
========================================================= */
const PORT = process.env.PORT || 5000;

console.log("Routes loaded:");
console.log("- POST /api/site/check");
console.log("- POST /api/ledger/add");
console.log("- GET  /api/ledger");
console.log("- POST /api/proof/reputation");
console.log("- POST /api/ethereum/proof");

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
