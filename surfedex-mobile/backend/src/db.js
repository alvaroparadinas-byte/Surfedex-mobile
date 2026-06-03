// Almacén de previsiones. MVP: un archivo JSON en disco (data/forecasts.json).
// Guarda las horas crudas por spot; el endpoint las ensambla en
// { current, next24h, next7days } al servir.
//
// >>> En producción, sustituye este módulo por tu base de datos real
//     (Postgres, Mongo...). La interfaz pública (getHours / setHours / meta)
//     es lo único que usa el resto del backend.

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "forecasts.json");

function load() {
  try { return JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch { return {}; }
}
function persist(db) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

let cache = load();

function setHours(spotId, hours) {
  cache[spotId] = { updatedAt: new Date().toISOString(), hours };
  persist(cache);
}
function getEntry(spotId) { return cache[spotId] || null; }
function allSpotIds() { return Object.keys(cache); }

module.exports = { setHours, getEntry, allSpotIds };
