import { randomBytes } from "crypto";
import { writeFileSync } from "fs";

// Generate random hex strings — high entropy, hard to compress.
const entries = {};
const targetBytes = 1e6; // aim above 500KB to be safe
let size = 2; // opening brace + newline

while (size < targetBytes) {
  const key = randomBytes(12).toString("hex");
  const value = randomBytes(24).toString("hex");
  const entry = `"${key}":"${value}"`;
  // account for quotes, colon, comma, etc.
  size += entry.length + 2;
  entries[key] = value;
}

const json = JSON.stringify(entries, null, "\t");
writeFileSync(new URL("../app/filler.json", import.meta.url), json);
console.log(
  `Wrote filler.json (${(Buffer.byteLength(json) / 1024).toFixed(1)} KB)`
);
