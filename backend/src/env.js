// Cargador mínimo de .env (sin dependencias). Lee KEY=VALUE de backend/.env
// y los vuelca en process.env (sin pisar lo que ya venga del entorno real).
const fs = require("fs");
const path = require("path");

try {
  const file = path.join(__dirname, "..", ".env");
  const txt = fs.readFileSync(file, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2].replace(/^["']|["']$/g, "");
    if (process.env[key] == null) process.env[key] = val;
  }
} catch { /* sin .env: se usan las variables del entorno (host) */ }
