// spotScore(spot, forecast) → 0..100  ·  fuente de verdad del sistema de puntuación.
//
// Modelo (escala interna 0..10, se devuelve ×10):
//   Base 10  ±  Tamaño  +  Viento  +  Periodo
// Bandas (0..100):
//   0-20   Malo        (1★)
//   21-45  Surfable    (2★)
//   46-70  Bueno       (3★)
//   71-90  Muy bueno   (4★)
//   91-100 Épico       (5★)
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
  if (score <= 45) return "Surfable";
  if (score <= 70) return "Bueno";
  if (score <= 90) return "Muy bueno";
  return "Épico";
}

// ¿El viento sopla hacia la orilla (onshore)? Onshore ≈ opuesto a la dir offshore.
function isOnshore(deg, offList) {
  if (deg == null || !offList || !offList.length) return false;
  const idx = C16.indexOf(offList[0]);
  if (idx < 0) return false;
  const onDeg = (idx * 22.5 + 180) % 360;
  const d = Math.abs(((deg - onDeg + 540) % 360) - 180);
  return d <= 67.5;
}

// Ajuste por VIENTO (puntos): +2 offshore/cross-off o glassy; +1 flojo cualquier
// dir; -3 onshore con fuerza o > 15 kn.
function windAdjust(fc, rules) {
  const kn = (fc.windSpeed || 0) * MS_TO_KN;
  const offList = rules.bestWindDirection || [];
  const off = dirMatch(fc.windDirection, offList);     // 1 offshore, 0.6 cross-off
  const onshore = isOnshore(fc.windDirection, offList);
  if (kn > 15 || (onshore && kn > 5)) return -3;
  if (off >= 0.6) return 2;        // offshore / cross-offshore
  if (kn < 5) return 2;            // glassy (casi sin viento, cualquier dirección)
  if (kn <= 6) return 1;           // flojo, cualquier dirección
  return 0;                        // cruzado / side moderado
}

// Puntuación 0..100 según el modelo del cliente:
//   Base 10  ±  Tamaño  +  Viento  +  Periodo   (luego ×10 a escala 0..100).
//   Tamaño:  <1,0 m → −2 por cada 0,2 m;  1,0–2,5 m → 0;  >2,5 m → −1,5 por cada
//            0,5 m;  >5 m → 0 directo.
//   Periodo (swellPeriod +1 s, porque Stormglass es conservador): ≥9 → +0,5; 6–8 → 0; ≤5 → −0,5.
function spotScore(spot, fc) {
  const rules = spot || {};
  const h = fc.swellHeight != null ? fc.swellHeight : fc.waveHeight;
  if (h == null) return 0;
  if (h > 5) return 0;                                  // demasiado grande → 0

  let pts = 10;                                         // base

  // --- Tamaño ---
  if (h < 1.0) pts -= 2 * ((1.0 - h) / 0.2);
  else if (h > 2.5) pts -= 1.5 * ((h - 2.5) / 0.5);
  // 1,0–2,5 m → sin penalización

  // --- Viento ---
  pts += windAdjust(fc, rules);

  // --- Periodo (+1 s respecto a Stormglass, que es conservador) ---
  const per = fc.swellPeriod != null ? fc.swellPeriod + 1 : null;
  if (per != null) {
    if (per >= 9) pts += 0.5;
    else if (per <= 5) pts -= 0.5;
  }

  pts = Math.max(0, Math.min(10, pts));
  return Math.round(pts * 10);                          // 0..100
}

module.exports = { spotScore, bandFor, compass };
