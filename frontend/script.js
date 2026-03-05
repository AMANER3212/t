/* =========================================================
   1. CORE AI ENGINE: RANDOM FOREST (Ensemble)
========================================================= */
const PhishGuardAI = {
  // Each "Tree" analyzes a specific dimension of the URL
  trees: {
    // Tree 1: Identity & Encryption (SSL/IP Check)
    identityTree: (f) => {
      let risk = 0;
      if (f.ip) risk += 0.45;       // Raw IPs are high risk
      if (!f.https) risk += 0.30;   // No SSL is suspicious
      return risk;
    },

    // Tree 2: Lexical Obfuscation (URL Structure)
    structureTree: (f) => {
      let risk = 0;
      if (f.length > 75) risk += 0.15;
      if (f.subdomains > 3) risk += 0.10;
      if (f.specialChars > 6) risk += 0.10;
      return risk;
    },

    // Tree 3: Social Engineering (Keyword Detection)
    intentTree: (f) => {
      const weight = 0.25;
      // Normalizes keyword count to a 0-1 risk scale
      return Math.min(f.keywords * 0.33, 1) * weight;
    },

    // Tree 4: Obfuscation Detection (Entropy Analysis)
    complexityTree: (f) => {
      // Entropy > 4.5 usually indicates random/DGA strings
      return f.entropy > 4.5 ? 0.20 : 0;
    }
  },

  // Aggregator: Combines all trees (The "Forest" Logic)
  calculateRisk(features) {
    let totalRisk = 0;
    for (const tree in this.trees) {
      totalRisk += this.trees[tree](features);
    }
    return Math.min(totalRisk, 1);
  }
};

/* =========================================================
   2. MAIN CONTROLLER (Analysis Workflow)
========================================================= */
async function analyzeURL() {
  const urlInput = document.getElementById("urlInput").value.trim();
  const resultSection = document.getElementById("result");
  const summarySection = document.getElementById("summary");

  // Validation
  if (!/^https?:\/\//i.test(urlInput)) {
    alert("Invalid Format: Please include http:// or https://");
    return;
  }

  // Phase 1: Feature Extraction
  const features = extractFeatures(urlInput);
  
  // Phase 2: Ensemble AI Prediction
  const aiRisk = PhishGuardAI.calculateRisk(features);
  
  // Phase 3: Content Safety Layer (Manual Override)
  const safetyRisk = /login|verify|bank|secure|account/i.test(urlInput) ? 0.10 : 0;
  
  // Phase 4: Final Trust Score Calculation
  let trustScore = Math.round((1 - Math.min(aiRisk + safetyRisk, 1)) * 100);

  // Phase 5: Live Site Availability (Backend Check)
  const siteStatus = await checkSiteAvailability(urlInput);
  if (!siteStatus.exists) {
    trustScore = Math.max(trustScore - 20, 0); // Penalize dead sites
  }

  // Phase 6: Update UI Components
  resultSection.hidden = false;
  renderFeatureTable(features);
  renderVerdict(trustScore, siteStatus);

  // Phase 7: Ledger & Reputation Proof
  const ledgerHash = await addToLedger(urlInput, trustScore);
  const proof = await getReputationProof(urlInput, trustScore);
  
  // Phase 8: Persistence
  await loadLedger(); // Refresh the history table
  
  // Auto-scroll to result
  resultSection.scrollIntoView({ behavior: 'smooth' });
}

/* =========================================================
   3. DATA EXTRACTION & MATH
========================================================= */
function extractFeatures(url) {
  return {
    length: url.length,
    https: url.startsWith("https"),
    ip: /(\d{1,3}\.){3}\d{1,3}/.test(url),
    specialChars: (url.match(/[@\-_%=&]/g) || []).length,
    subdomains: url.replace(/^https?:\/\//, "").split("/")[0].split(".").length - 2,
    keywords: ["login","verify","secure","bank","account","update"].filter(k => url.toLowerCase().includes(k)).length,
    entropy: calculateShannonEntropy(url)
  };
}

// Shannon Entropy: Detects randomness in strings
function calculateShannonEntropy(str) {
  const freq = {};
  for (let char of str) freq[char] = (freq[char] || 0) + 1;
  return Object.values(freq).reduce((e, f) => {
    let p = f / str.length;
    return e - p * Math.log2(p);
  }, 0);
}

/* =========================================================
   4. UI RENDERING (Matches your CSS)
========================================================= */
function renderFeatureTable(f) {
  document.getElementById("f-https").textContent = f.https ? "Active" : "None";
  document.getElementById("f-ip").textContent = f.ip ? "Yes (Alert)" : "No";
  document.getElementById("f-length").textContent = `${f.length} chars`;
  document.getElementById("f-subdomains").textContent = f.subdomains;
  document.getElementById("f-keywords").textContent = f.keywords;
  document.getElementById("f-entropy").textContent = f.entropy.toFixed(2);
}

function renderVerdict(score, status) {
  const summary = document.getElementById("summary");
  let level = "SAFE";
  let colorClass = "safe";

  if (score < 75) { level = "SUSPICIOUS"; colorClass = "risky"; }
  if (score < 50) { level = "DANGER"; colorClass = "danger"; }

  summary.innerHTML = `
    <div class="result-card">
      <h2 class="${colorClass}">${score}% Trust Score</h2>
      <p class="verdict">System Verdict: <strong>${level}</strong></p>
      <p style="margin-top: 10px; font-size: 0.85rem; color: var(--text-muted);">
        Website Status: ${status.exists ? `Online (HTTP ${status.statusCode})` : "Unreachable"}
      </p>
    </div>
  `;
}

/* =========================================================
   5. BACKEND API INTEGRATION
========================================================= */
async function checkSiteAvailability(url) {
  try {
    const res = await fetch("http://localhost:5000/api/site/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    return await res.json();
  } catch { return { exists: false }; }
}

async function addToLedger(url, trustScore) {
  try {
    const res = await fetch("http://localhost:5000/api/ledger/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, trustScore })
    });
    const data = await res.json();
    return data.hash || "Hash Pending";
  } catch { return "Offline Ledger"; }
}

async function loadLedger() {
  try {
    const res = await fetch("http://localhost:5000/api/ledger");
    const ledger = await res.json();
    const table = document.getElementById("ledger-table");

    // Reset table headers
    table.innerHTML = `<tr><th>URL</th><th>Score</th><th>Hash</th><th>Timestamp</th></tr>`;

    ledger.forEach(entry => {
      const row = table.insertRow();
      row.innerHTML = `
        <td data-label="URL">${entry.url}</td>
        <td data-label="Score">${entry.trustScore}%</td>
        <td data-label="Hash" style="font-family: monospace; font-size: 0.7rem;">${entry.hash.substring(0, 16)}...</td>
        <td data-label="Timestamp">${new Date(entry.timestamp).toLocaleTimeString()}</td>
      `;
    });
    document.getElementById("ledger-section").hidden = false;
  } catch (e) { console.error("Ledger Unavailable"); }
}

// Initializing the Reputation Proof call
async function getReputationProof(url, trustScore) {
  try {
    const res = await fetch("http://localhost:5000/api/proof/reputation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, trustScore })
    });
    return await res.json();
  } catch { return null; }
}