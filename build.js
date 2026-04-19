// Generates config.js from Vercel environment variables at build time.
// Run via: node build.js
const fs = require("fs");

const required = ["SUPABASE_URL", "SUPABASE_ANON_KEY"];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error("Missing env vars:", missing.join(", "));
  process.exit(1);
}

const config = `window.ENV = {
  SUPABASE_URL:     "${process.env.SUPABASE_URL}",
  SUPABASE_ANON_KEY:"${process.env.SUPABASE_ANON_KEY}",
  SOLANA_RPC_URL:   "${process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com"}",
  APP_VERSION:      "${process.env.APP_VERSION || "v0.9.2"}",
  BETA_LABEL:       "${process.env.BETA_LABEL || "India · UPI settlement · Solana devnet"}",
};
`;

fs.writeFileSync("config.js", config);
console.log("config.js generated.");
