// Ensambla las horas crudas almacenadas en la respuesta del contrato:
//   { spotId, updatedAt, units, current, next24h, next7days }
// y calcula la puntuación (spotScore) por hora/día.

const { spotScore } = require("./spotScore");

function assemble(spot, entry) {
  let hours = (entry && entry.hours) || [];

  // ----- Factor de exposición por spot (waveFactor) -----
  // Algunos spots filtran parte de la energía del oleaje por su orientación o por
  // bajos/rocas delante (p. ej. Cadavedo deja pasar ~30 %: 4 m mar abierto → ~1,2 m).
  // Se aplica AQUÍ, en el origen, a la altura de ola y de swell, de modo que TODO
  // lo que se calcula después (actual, días, gráfico de barras, puntuación y los
  // colores por altura) ya parte de la altura real que rompe en el spot.
  const wf = (spot && typeof spot.waveFactor === "number") ? spot.waveFactor : 1;
  if (wf !== 1) {
    hours = hours.map((h) => Object.assign({}, h, {
      waveHeight: h.waveHeight != null ? round1(h.waveHeight * wf) : h.waveHeight,
      swellHeight: h.swellHeight != null ? round1(h.swellHeight * wf) : h.swellHeight
    }));
  }
  const now = Date.now();

  // ----- current: la hora almacenada más cercana a "ahora" -----
  let current = null, bestDt = Infinity;
  for (const h of hours) {
    const dt = Math.abs(new Date(h.timestamp).getTime() - now);
    if (dt < bestDt) { bestDt = dt; current = h; }
  }
  if (current) current = withScore(spot, current);

  // ----- next24h: cada ~3 h durante las próximas 24 h -----
  const futur = hours.filter((h) => new Date(h.timestamp).getTime() >= now - 36e5);
  const next24h = futur
    .filter((h) => new Date(h.timestamp).getTime() <= now + 24 * 36e5)
    .filter((_, i) => i % 3 === 0)
    .slice(0, 8)
    .map((h) => withScore(spot, h));

  // ----- next7days: resumen diario (mín/máx ola, periodo, viento, mejor franja) -----
  const byDay = {};
  for (const h of futur) {
    const d = new Date(h.timestamp);
    const key = d.toISOString().slice(0, 10);
    (byDay[key] = byDay[key] || []).push(h);
  }
  const next7days = Object.keys(byDay).sort().slice(0, 7).map((key) => {
    const arr = byDay[key];
    let wMin = Infinity, wMax = 0, perSum = 0, windSum = 0, n = 0;
    let wSin = 0, wCos = 0, sSin = 0, sCos = 0, swN = 0;   // medias circulares de dirección
    let best = -1, bestT = null, dSum = 0, dN = 0;
    for (const h of arr) {
      if (h.waveHeight != null) { wMin = Math.min(wMin, h.waveHeight); wMax = Math.max(wMax, h.waveHeight); }
      if (h.wavePeriod != null) perSum += h.wavePeriod;
      if (h.windSpeed != null) windSum += h.windSpeed;
      if (h.windDirection != null) { const r = h.windDirection * Math.PI / 180; wSin += Math.sin(r); wCos += Math.cos(r); }
      if (h.swellDirection != null) { const r = h.swellDirection * Math.PI / 180; sSin += Math.sin(r); sCos += Math.cos(r); swN++; }
      n++;
      const sc = spotScore(spot, h);
      // Solo horas de luz (6–21): acumulamos para la MEDIA del día y guardamos
      // la mejor franja por separado. El rating del día es representativo (media),
      // no el pico de una sola hora (eso inflaba casi todo a 5★).
      const hr = new Date(h.timestamp).getHours();
      if (hr >= 6 && hr <= 21) {
        dSum += sc; dN++;
        if (sc > best) { best = sc; bestT = new Date(h.timestamp); }
      }
    }
    const dayScore = dN ? Math.round(dSum / dN) : (best < 0 ? null : best);
    const circDir = (sin, cos) => Math.round((Math.atan2(sin, cos) * 180 / Math.PI + 360) % 360);
    // detalle 3-horario del día (con puntuación) — lo despliega la UI al tocar el día
    const dayHours = arr.filter((_, i) => i % 3 === 0).map((h) => withScore(spot, h));
    return {
      date: key + "T06:00:00.000Z",
      waveMin: round1(wMin === Infinity ? 0 : wMin),
      waveMax: round1(wMax),
      periodDom: round1(perSum / n),
      windAvg: round1(windSum / n),
      windDirection: circDir(wSin, wCos),
      swellDirection: swN ? circDir(sSin, sCos) : null,
      score: dayScore,
      bestWindow: bestT ? String(bestT.getHours()).padStart(2, "0") + ":00" : null,
      hours: dayHours
    };
  });

  return {
    spotId: spot.id,
    updatedAt: (entry && entry.updatedAt) || null,
    units: { wave: "m", period: "s", wind: "m/s", temp: "C", direction: "deg" },
    current, next24h, next7days,
    waveFactor: wf,
    waveFactorApplied: wf !== 1,   // el frontend NO vuelve a filtrar si ya viene aplicado
    _sample: false
  };
}

function withScore(spot, h) {
  return Object.assign({}, h, { score: spotScore(spot, h) });
}
function round1(v) { return Math.round(v * 10) / 10; }

module.exports = { assemble };
