// Servidor HTTP de Surfedex.
//   GET /api/spots/:id/forecast  →  { current, next24h, next7days } (lee SOLO de BD)
//   GET /api/health              →  estado
//
// El frontend NUNCA llama a Stormglass: llama aquí. La clave vive en el entorno.

require("./env");                       // carga backend/.env en process.env si existe
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");

const SPOTS = require("./spots");
const db = require("./db");
const { assemble } = require("./assemble");
const { syncAll } = require("./sync");

const app = express();
// CORS: por defecto ("*") refleja CUALQUIER origen (comodín real). Si defines
// CORS_ORIGIN (lista coma-separada), se restringe a esos orígenes.
const corsList = (process.env.CORS_ORIGIN || "*").split(",").map((s) => s.trim());
app.use(cors({ origin: corsList.includes("*") ? true : corsList }));

const spotById = (id) => SPOTS.find((s) => s.id === id);

app.get("/api/health", (req, res) => {
  res.json({ ok: true, spots: SPOTS.length, stored: db.allSpotIds() });
});

app.get("/api/spots/:id/forecast", (req, res) => {
  const spot = spotById(req.params.id);
  if (!spot) return res.status(404).json({ error: "spot desconocido" });
  const entry = db.getEntry(spot.id);
  if (!entry) return res.status(503).json({ error: "previsión aún no sincronizada" });
  res.json(assemble(spot, entry));     // ← se sirve EXCLUSIVAMENTE desde la BD
});

// Keep-alive: en el plan gratuito de Render el servicio se DUERME tras ~15 min
// sin tráfico (y al despertar tarda ~1 min y pierde la BD del disco temporal).
// Para evitarlo, el propio servidor se "auto-visita" cada pocos minutos: eso
// cuenta como tráfico entrante y reinicia el contador de inactividad de Render.
//   • URL: RENDER_EXTERNAL_URL la rellena Render solo. Si no, usa KEEP_ALIVE_URL.
//   • Intervalo: KEEP_ALIVE_MINUTES (por defecto 10; Render duerme a los 15).
//   • Para desactivarlo: define KEEP_ALIVE=off.
function startKeepAlive() {
  if ((process.env.KEEP_ALIVE || "").toLowerCase() === "off") return;
  const base = (process.env.RENDER_EXTERNAL_URL || process.env.KEEP_ALIVE_URL || "").replace(/\/$/, "");
  if (!base) {
    console.warn("[keep-alive] sin RENDER_EXTERNAL_URL ni KEEP_ALIVE_URL: desactivado (normal en local)");
    return;
  }
  const mins = Math.max(1, Number(process.env.KEEP_ALIVE_MINUTES || 10));
  const url = `${base}/api/health`;
  const ping = async () => {
    try {
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      console.log(`[keep-alive] ping ${url} → ${r.status} · ${new Date().toISOString()}`);
    } catch (e) {
      console.warn(`[keep-alive] ping falló: ${e.message}`);
    }
  };
  setInterval(ping, mins * 60 * 1000);
  console.log(`[keep-alive] activo · cada ${mins} min → ${url}`);
}

const PORT = Number(process.env.PORT || 8080);
app.listen(PORT, () => {
  console.log(`[server] escuchando en :${PORT}`);
  // primera sincronización al arrancar (si hay clave)
  if (process.env.STORMGLASS_API_KEY) {
    syncAll().catch((e) => console.error("[sync inicial]", e.message));
    const expr = process.env.SYNC_CRON || "0 */4 * * *";
    cron.schedule(expr, () => syncAll().catch((e) => console.error("[cron]", e.message)));
    console.log(`[server] sincronización programada: "${expr}"`);
  } else {
    console.warn("[server] sin STORMGLASS_API_KEY: no se sincronizará (solo sirve lo que haya en BD)");
  }
  startKeepAlive();
});
