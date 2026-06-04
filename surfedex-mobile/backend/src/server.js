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
});
