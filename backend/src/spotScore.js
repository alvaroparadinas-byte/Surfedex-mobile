// spotScore(spot, forecast) → 0..100  ·  fuente de verdad del sistema de puntuación.
//
// Bandas:
//   0-20   Malo
//   21-40  Surfable
//   41-60  Bueno
//   61-80  Muy bueno
//   81-100 Épico
//
// Depende de: dirección del swell, tamaño del swell, periodo del swell,
// dirección del viento e intensidad del viento. Cada spot trae sus reglas
// (bestSwellDirection / bestWindDirection y, opcionalmente, swellIdeal/periodIdeal).
//
// `forecast` es un punto con (SI): swellHeight m, swellPeriod s, swellDirection deg,
// windSpeed m/s, windDirection deg.

const C16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const MS_TO_KN = 1.94384;

function compass(deg) {
  if (deg == null || isNaN(deg)) return null;
  return C16[Math.round(((deg % 360) / 22.5)) % 16];
}

// 1 si la dirección cae en la lista; 0.6 si es vecina inmediata; 0.3 a dos pasos; si no 0.
function dirMatch(deg, list) {
  const c = compass(deg);
  if (!c || !list || !list.length) return 0;
  if (list.includes(c)) return 1;
  const idx = C16.indexOf(c);
  let best = 0;
  for (const l of list) {
    const li = C16.indexOf(l);
    if (li < 0) continue;
    const d = Math.min((idx - li + 16) % 16, (li - idx + 16) % 16);
    if (d === 1) best = Math.max(best, 0.6);
    else if (d === 2) best = Math.max(best, 0.3);
  }
  return best;
}

function bandFor(score) {
  if (score <= 20) return "Malo";
  if (score <= 40) return "Surfable";
  if (score <= 60) return "Bueno";
  if (score <= 80) return "Muy bueno";
  return "Épico";
}

function spotScore(spot, fc) {
  const rules = spot || {};
  const sw = dirMatch(fc.swellDirection, rules.bestSwellDirection || []);          // 0..1
  const [lo, hi] = (rules.score && rules.score.swellIdeal) || [1, 3];
  const h = fc.swellHeight != null ? fc.swellHeight : fc.waveHeight;
  let size = h < lo ? Math.max(0, h / lo)
           : h > hi ? Math.max(0, 1 - (h - hi) / hi)
           : 1;                                                                     // 0..1
  const periodIdeal = (rules.score && rules.score.periodIdeal) || 12;
  const per = Math.max(0, Math.min(1, (fc.swellPeriod - 7) / (periodIdeal - 7)));   // 0..1
  const wd = dirMatch(fc.windDirection, rules.bestWindDirection || []);            // 0..1 (offshore)
  const wkn = fc.windSpeed * MS_TO_KN;
  const calm = Math.max(0, Math.min(1, 1 - (wkn - 6) / 22));                        // ideal <6kn, malo >28kn
  const windScore = 0.55 * wd + 0.45 * calm;

  const score = 100 * (0.30 * sw + 0.22 * size + 0.18 * per + 0.30 * windScore);
  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = { spotScore, bandFor, compass };
