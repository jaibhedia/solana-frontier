# uWu Protocol — Superteam Agentic Engineering Grant Application
*Generated via Claude Code (claude-sonnet-4-6) · solana.new session · April 2026*

---

## What was built using AI-assisted agentic engineering

**uWu Protocol** is a UPI↔stablecoin settlement attestation layer built on Solana devnet. The entire product — frontend, backend wiring, Supabase integration, live Solana RPC feeds, and deployment config — was shipped in a single Claude Code agentic session using the CLI at `claude.ai/code`.

**Live URL:** https://solana.uwuprotocol.xyz  
**GitHub:** https://github.com/jaibhedia  
**X:** https://x.com/uwu_protocol  

---

## Grant Application

**Project Title:** uWu Protocol

**One Line Description:**  
UPI↔stablecoin settlement attestation on Solana — proof the money moved, via Account Aggregator, not screenshots.

**Telegram:** t.me/shantanucsd  
**X:** x.com/ShantanuSwami11  
**GitHub:** github.com/jaibhedia  
**Deadline:** May 10, 2026  

---

## Project Details

### Problem

India's P2P crypto↔INR market runs entirely on trust — traders send UPI screenshots as "proof of payment." Screenshots are trivially faked, admin keys are the norm, and there's no on-chain record that fiat ever moved. The result: disputes, chargebacks, and zero verifiability for any counterparty.

### Solution

uWu Protocol is an attestation layer that replaces the screenshot with cryptographic proof. When a user pays INR via UPI, uWu fetches a signed bank transaction record from the RBI-regulated Account Aggregator network (Finvu / Setu) — the same infrastructure Indian banks use for consented data sharing. That proof is hashed and anchored as a PDA on Solana. The USDC/USDT leg settles only after the on-chain attestation is verified.

No admin keys. No custodians. No screenshots — just proof the money moved.

### MVP Scope (shippable before May 11)

- AA consent flow via Setu sandbox
- UPI transaction fetch + SHA-256 hash
- Anchor program: write attestation PDA on Solana devnet
- Settlement confirmation UI with live devnet explorer
- Submit to Colosseum Frontier before May 11 deadline

---

## Files Shipped in This Session

| File | Purpose |
|---|---|
| `index.html` | Self-contained React 18 app (JSX via Babel standalone, no build step) |
| `config.js` | Runtime env injection (`window.ENV` pattern, gitignored) |
| `.env.example` | Safe-to-commit env documentation |
| `vercel.json` | Deployment config with security headers and cache policy |
| `package.json` | Build script entrypoint |
| `build.js` | Node script to generate `config.js` from Vercel env vars at build time |
| `.gitignore` | Excludes secrets, DS_Store, node_modules |
| `favicon.png` | uWu pixel-art logo (transparent bg) |

---

## Technical Implementation (Claude Code built this)

### Solana — live devnet RPC

```javascript
// Polls Solana devnet every 30s for real network stats
async function fetchSolanaStats() {
  const rpc = SOLANA_RPC || "https://api.devnet.solana.com";
  const [perfRes, txRes, slotRes] = await Promise.all([
    fetch(rpc, { method: "POST", body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "getRecentPerformanceSamples",
      params: [{ limit: 5 }] }) }),
    fetch(rpc, { method: "POST", body: JSON.stringify({
      jsonrpc: "2.0", id: 2, method: "getTransactionCount" }) }),
    fetch(rpc, { method: "POST", body: JSON.stringify({
      jsonrpc: "2.0", id: 3, method: "getSlot" }) }),
  ]);
}
```

### Supabase Waitlist with RLS-safe Count

```javascript
// Signup — anon INSERT only, no SELECT exposed
const res = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
  method: "POST",
  headers: {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
  },
  body: JSON.stringify({ email, role, region, monthly_volume: vol, note }),
});

// Count via security definer RPC — bypasses RLS without exposing PII
const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/waitlist_count`, {
  method: "POST",
  headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({}),
});
```

### Realistic Demo Feed (Solana base58 signatures, weighted amounts)

```javascript
const BASE_RATE = 84.1; // USDC/INR P2P rate, April 2026
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function randSig() {
  let s = "";
  for (let i = 0; i < 8; i++) s += B58[Math.floor(Math.random() * B58.length)];
  return s + "…";
}

// Weighted: 55% retail (₹8K–₹67K), 30% mid, 15% OTC
function randAmt() {
  const r = Math.random();
  if (r < 0.55) return randInt(100, 800);
  if (r < 0.85) return randInt(800, 2500);
  return randInt(2500, 5000);
}

// 6 settled : 2 attesting : 1 pending
const STATUSES = [
  ...Array(6).fill({ label: "settled",   cls: "ok" }),
  ...Array(2).fill({ label: "attesting", cls: "attest" }),
  ...Array(1).fill({ label: "pending",   cls: "pending" }),
];
```

### Vercel Build — env-injected config

```javascript
// build.js runs at Vercel build time, writes config.js from env vars
const config = `window.ENV = {
  SUPABASE_URL:     "${process.env.SUPABASE_URL}",
  SUPABASE_ANON_KEY:"${process.env.SUPABASE_ANON_KEY}",
  SOLANA_RPC_URL:   "${process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"}",
};`;
fs.writeFileSync("config.js", config);
```

---

## Proof of Work

- Live site with real Solana devnet data: **https://solana.uwuprotocol.xyz**
- Waitlist collecting signups via Supabase with RLS + security definer RPC
- Live Solana TPS, transaction count, and slot number from devnet RPC
- Dark mode, mobile responsive, social meta tags, Vercel deployment config
- Built entirely in Claude Code agentic sessions — zero manual scaffolding

This application itself was generated by running `help me apply for the agentic engineering grant by Superteam` inside an active Claude Code session, as required by the grant instructions.

---

*uWu Protocol · India's UPI↔stablecoin attestation layer · Built on Solana*
