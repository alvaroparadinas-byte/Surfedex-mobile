// Cliente de Stormglass. ÚNICO punto que conoce la clave (de process.env).
// Doc: https://docs.stormglass.io/#/weather
//
// Pide los parámetros del brief y devuelve un array de horas normalizado (SI):
//   { timestamp, waveHeight, wavePeriod, waveDirection,
//     swellHeight, swellPeriod, swellDirection,
//     windSpeed, windDirection, waterTemperature }

const PARAMS = [
  "waveHeight", "wavePeriod", "waveDirection",
  "swellHeight", "swellPeriod", "swellDirection",
  "windSpeed", "windDirection", "waterTemperature"
];

async function fetchPoint(lat, lng, { days = 7, source = "sg" } = {}) {
  const key = process.env.STORMGLASS_API_KEY;
  if (!key) throw new Error("Falta STORMGLASS_API_KEY en el entorno");

  const start = Math.floor(Date.now() / 1000);
  const end = start + days * 24 * 3600;
  const url = `https://api.stormglass.io/v2/weather/point` +
    `?lat=${lat}&lng=${lng}` +
    `&params=${PARAMS.join(",")}` +
    `&start=${start}&end=${end}`;

  const res = await fetch(url, { headers: { Authorization: key } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Stormglass ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const pick = (h, p) => (h[p] && (h[p][source] != null ? h[p][source] : firstVal(h[p])));
  return (json.hours || []).map((h) => ({
    timestamp: h.time,
    waveHeight: num(pick(h, "waveHeight")),
    wavePeriod: num(pick(h, "wavePeriod")),
    waveDirection: num(pick(h, "waveDirection")),
    swellHeight: num(pick(h, "swellHeight")),
    swellPeriod: num(pick(h, "swellPeriod")),
    swellDirection: num(pick(h, "swellDirection")),
    windSpeed: num(pick(h, "windSpeed")),
    windDirection: num(pick(h, "windDirection")),
    waterTemperature: num(pick(h, "waterTemperature"))
  }));
}

function firstVal(obj) { const k = Object.keys(obj || {})[0]; return k ? obj[k] : null; }
function num(v) { return v == null ? null : Math.round(Number(v) * 100) / 100; }

module.exports = { fetchPoint, PARAMS };
