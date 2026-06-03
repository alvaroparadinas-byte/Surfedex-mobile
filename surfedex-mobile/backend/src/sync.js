// Proceso de sincronización: lee los spots → consulta Stormglass → guarda en BD.
//   Lee todos los spots
//        ↓
//   Consulta Stormglass   (1 petición por spot; cuidado con la cuota diaria)
//        ↓
//   Actualiza previsiones
//        ↓
//   Guarda resultados en BD
//
// Se ejecuta:
//   • Al arrancar el servidor (una vez), y
//   • Programado por cron (SYNC_CRON, por defecto cada 4 h).
// También se puede lanzar a mano:  npm run sync

require("./env");
const SPOTS = require("./spots");
const { fetchPoint } = require("./stormglass");
const db = require("./db");

async function syncAll() {
  const days = Number(process.env.FORECAST_DAYS || 7);
  const source = process.env.SG_SOURCE || "sg";
  let ok = 0, fail = 0;
  for (const spot of SPOTS) {
    try {
      const hours = await fetchPoint(spot.latitude, spot.longitude, { days, source });
      if (hours.length) { db.setHours(spot.id, hours); ok++; }
      else { console.warn(`[sync] ${spot.id}: 0 horas devueltas`); fail++; }
    } catch (e) {
      console.error(`[sync] ${spot.id}: ${e.message}`);
      fail++;
    }
  }
  console.log(`[sync] hecho · ${ok} ok / ${fail} fallos · ${new Date().toISOString()}`);
  return { ok, fail };
}

module.exports = { syncAll };

// Permite ejecutarlo directamente:  node src/sync.js
if (require.main === module) {
  syncAll().then(() => process.exit(0));
}
