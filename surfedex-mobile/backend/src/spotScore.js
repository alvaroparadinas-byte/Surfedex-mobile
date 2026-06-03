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

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Puntuación EXIGENTE. La "ola en sí" (dirección + tamaño del swell) es la base,
// y el PERIODO y el VIENTO actúan como filtros multiplicadores: si fallan,
// recortan la nota con fuerza. El viento solo puntúa si es Glass (muy flojo) u
// offshore limpio; un viento onshore/cruzado —aunque sea suave— hunde la nota.
function spotScore(spot, fc) {
  const rules = spot || {};

  // --- base: la ola en sí (dirección + tamaño del swell), 0..1 ---
  const sw = dirMatch(fc.swellDirection, rules.bestSwellDirection || []);          // 0..1
  const [lo, hi] = (rules.score && rules.score.swellIdeal) || [1, 3];
  const h = fc.swellHeight != null ? fc.swellHeight : fc.waveHeight;
  const size = h == null ? 0
             : h < lo ? Math.max(0, h / lo)
             : h > hi ? Math.max(0, 1 - (h - hi) / hi)
             : 1;                                                                   // 0..1
  const waveBase = 0.55 * sw + 0.45 * size;                                         // 0..1

  // --- periodo: filtro de calidad (windswell corto castiga fuerte) ---
  const periodIdeal = (rules.score && rules.score.periodIdeal) || 12;
  const periodFactor = clamp01((fc.swellPeriod - 6) / (periodIdeal - 6));           // 0 a 6 s → 1 al ideal
  const periodMult = 0.4 + 0.6 * periodFactor;                                      // recorta hasta un 60%

  // --- viento: bueno SOLO si es Glass (≤3 kn) u offshore limpio ---
  const wd = dirMatch(fc.windDirection, rules.bestWindDirection || []);            // 0..1 offshore
  const kn = (fc.windSpeed || 0) * MS_TO_KN;
  const glass = clamp01(1 - (kn - 3) / 5);                                          // ≤3 kn = 1 ; ≥8 kn = 0
  const offshoreClean = wd * clamp01(1 - (kn - 8) / 16);                            // offshore ideal ~8 kn, soplado >24 kn
  const windScore = Math.max(glass, offshoreClean);                                 // 0..1
  const windMult = 0.4 + 0.6 * windScore;                                           // recorta hasta un 60%

  const score = 100 * waveBase * periodMult * windMult;
  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = { spotScore, bandFor, compass };
