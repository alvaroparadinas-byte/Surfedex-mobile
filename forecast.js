// SurfMach / Surfedex — panel de previsión propio (sustituye a Windguru en spots piloto).
//
// IMPORTANTE (seguridad): este módulo NUNCA habla con Stormglass. Solo consume el
// endpoint de TU backend:   GET {API_BASE}/api/spots/:id/forecast
// y espera la forma de respuesta:   { current, next24h, next7days } (+ meta).
// La clave de Stormglass vive únicamente en el backend (variables de entorno).
//
// Unidades del contrato (lo que guarda el backend, en SI tal cual Stormglass):
//   waveHeight/swellHeight  → metros
//   wavePeriod/swellPeriod  → segundos
//   *Direction              → grados (de dónde viene)
//   windSpeed               → m/s   (el frontend lo muestra en nudos)
//   waterTemperature        → °C
//
// Mientras no haya backend en vivo, si la petición falla generamos datos de
// ejemplo realistas para poder validar el diseño. Se marca con un aviso visible.

(function () {
  "use strict";

  // Base del backend. Cuando despliegues, define en la página (antes de este script):
  //   <script>window.SURFEDEX_FORECAST_API = "https://tu-backend.ejemplo.com";</script>
  const API_BASE = (window.SURFEDEX_FORECAST_API || "").replace(/\/$/, "");

  // Spots piloto que usan el forecast propio (en vez de Windguru).
  // Asturias completa: West + East. Sus IDs deben existir también en el backend
  // (backend/src/spots.js) para que devuelva datos reales.
  const PILOT_SPOTS = [
    // Asturias West
    "salinas", "verdicio", "xago", "san-juan-nieva", "bayas", "quebrantos",
    "aguilar", "cadavedo", "otur", "barayo", "frejulfe", "navia", "tapia",
    "penarronda", "custom-mpsrsykc", "custom-mpsrz0k3", "custom-mpss0cx1",
    // Asturias East
    "san-lorenzo", "la-nora", "custom-mpsuiolb", "custom-mpsud51b", "custom-mpsu7cla",
    // Asturias East · spots propios
    "custom-mpswn3ha", "custom-mpswt1ni", "custom-mpsxedcm", "custom-mpsxgbby",
    "custom-mpsxiv0u", "custom-mpsxmluu", "custom-mpsxq9cm", "custom-mpsxulha",
    "custom-mpsxxjw6", "custom-mpsy1puu", "custom-mpsy4a66",
    // Gran Canaria
    "vagabundo", "el-circo", "bunker", "derecha-roque", "boquines", "molokai",
    "enanos", "quintanilla", "puertillo", "cicer", "muellitos", "lloret", "confital",
    "san-cristobal", "la-laja", "playa-la-laja", "terrazas", "playa-hombre", "burrero",
    "ojos-garza", "vargas", "arinaga", "pozo", "pozo-izquierdo", "juangrande",
    "arguineguin", "patalavaca", "pasito", "maspalomas", "playa-ingles",
    "fronton", "agujero", "bocabarranco", "agaete", "aldea"
  ];

  // ---------- factores de exposición por spot (waveFactor) ----------
  // ESPEJO de backend/src/spots.js. La fuente de verdad es el backend, que ya
  // aplica el factor y marca la respuesta con waveFactorApplied:true. Esto de
  // aquí es solo para PREVISUALIZAR el efecto mientras el backend no se ha
  // redeployado: si la respuesta ya viene filtrada, NO se vuelve a aplicar.
  // Valor = fracción de altura que deja pasar (0.3 = filtra el 70%).
  const WAVE_FACTORS = {
    "cadavedo": 0.30,            // orientación + roca delante → filtra ~70%
    "aguilar": 0.60,             // entra ~40% menos que Salinas/Xagó
    "otur": 0.65,                // filtra ~35%
    "barayo": 0.70,              // filtra ~30%
    "frejulfe": 0.90,            // filtra ~10%
    "navia": 0.60,               // filtra ~40%
    "tapia": 0.85,               // filtra ~15%
    "penarronda": 0.95,          // filtra ~5%
    "custom-mpsrz0k3": 0.42,     // La Concha de Artedo → filtra ~58%
    "custom-mpss0cx1": 0.42,     // San Pedro → filtra ~58%
    "custom-mpsrsykc": 0.70,     // Cueva → recibe ~70%

    // --- Asturias East (energía recibida por cada playa) ---
    "san-lorenzo": 0.70,         // muy expuesto pese a la bahía
    "la-nora": 0.60,             // ensenada protegida por acantilados
    "custom-mpswn3ha": 0.50,     // Playa de España → muy protegida
    "custom-mpswt1ni": 0.85,     // Merón → muy abierta
    "custom-mpsuiolb": 0.75,     // Rodiles → fuerza de la desembocadura
    "custom-mpsxedcm": 0.80,     // La Espasa → arenal abierto
    "custom-mpsxgbby": 0.80,     // Arenal de Morís → expuesta
    "custom-mpsud51b": 0.85,     // Vega → imán de swell
    "custom-mpsxiv0u": 0.80,     // Santa Marina → expuesta
    "custom-mpsxmluu": 0.90,     // San Antolín → de las más expuestas
    "custom-mpsxq9cm": 0.50,     // Torimbia → muy protegida
    "custom-mpsxulha": 0.40,     // Barro → playa muy cerrada
    "custom-mpsu7cla": 0.75,     // Andrín → expuesta
    "custom-mpsxxjw6": 0.60,     // Ballota → algo protegida
    "custom-mpsy1puu": 0.70,     // Vidiago → expuesta, fondo rocoso
    "custom-mpsy4a66": 0.30      // La Franca → muy protegida
  };

  // Aplica el waveFactor del spot a las alturas (ola y swell) en TODO el objeto,
  // salvo que el backend ya lo haya aplicado (data.waveFactorApplied).
  function applyWaveFactor(spot, data) {
    const wf = WAVE_FACTORS[spot && spot.id];
    if (!wf || wf === 1 || !data || data.waveFactorApplied) return data;
    const r1 = (v) => (v == null || isNaN(v) ? v : Math.round(v * wf * 10) / 10);
    const hour = (h) => {
      if (!h) return h;
      if (h.waveHeight != null) h.waveHeight = r1(h.waveHeight);
      if (h.swellHeight != null) h.swellHeight = r1(h.swellHeight);
      return h;
    };
    hour(data.current);
    (data.next24h || []).forEach(hour);
    (data.next7days || []).forEach((e) => {
      if (e.waveMin != null) e.waveMin = r1(e.waveMin);
      if (e.waveMax != null) e.waveMax = r1(e.waveMax);
      (e.hours || []).forEach(hour);
    });
    data.waveFactorApplied = true;       // marca para no reaplicar
    data._wfPreview = true;              // preview en frontend (la nota lo usa)
    return data;
  }

  // ---------- helpers de formato/unidades ----------
  const MS_TO_KN = 1.94384;
  const C16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  function compass(deg) {
    if (deg == null || isNaN(deg)) return "—";
    return C16[Math.round(((deg % 360) / 22.5)) % 16];
  }
  const m1 = (v) => (v == null || isNaN(v) ? "—" : v.toFixed(1));
  const i0 = (v) => (v == null || isNaN(v) ? "—" : Math.round(v).toString());
  // Periodo SIEMPRE +1 s respecto a Stormglass (es conservador). Solo display.
  const i0p = (v) => (v == null || isNaN(v) ? "—" : Math.round(v + 1).toString());
  const kn = (ms) => (ms == null || isNaN(ms) ? "—" : Math.round(ms * MS_TO_KN).toString());

  // Color por altura de ola: >2 m amarillo (cuidado), >3 m rojo (mar grande).
  function heightClass(h) {
    if (h == null || isNaN(h)) return "";
    if (h > 3) return "h-big";
    if (h > 2) return "h-mid";
    return "";
  }

  // Flecha que apunta a DÓNDE va el flujo (downwind/down-swell = dir + 180º).
  function arrow(deg, cls) {
    const r = ((deg || 0) + 180) % 360;
    return `<span class="sfc-arr ${cls||""}" style="transform:rotate(${r}deg)">↑</span>`;
  }

  // Bandas de calidad — escala del modelo (0..100): 1-5★ + adjetivo.
  function band(score) {
    if (score == null || isNaN(score)) return { label: "—", cls: "b0" };
    if (score <= 20) return { label: "Malo", cls: "b1" };
    if (score <= 45) return { label: "Surfable", cls: "b2" };
    if (score <= 70) return { label: "Bueno", cls: "b3" };
    if (score <= 90) return { label: "Muy bueno", cls: "b4" };
    return { label: "Épico", cls: "b5" };
  }
  // Estrellas (1–5) discretas, alineadas con la banda del adjetivo.
  function starCount(score) {
    if (score == null || isNaN(score)) return 0;
    if (score <= 20) return 1;
    if (score <= 45) return 2;
    if (score <= 70) return 3;
    if (score <= 90) return 4;
    return 5;
  }

  function fmtDay(iso) {
    const d = new Date(iso);
    const dias = ["dom","lun","mar","mié","jue","vie","sáb"];
    return { dow: dias[d.getDay()], dm: d.getDate() + "/" + (d.getMonth() + 1) };
  }
  function fmtHour(iso) {
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, "0") + ":00";
  }

  // ---------- petición al backend (datos REALES; sin datos de ejemplo) ----------
  // Si el backend no responde o no tiene este spot, NO inventamos nada: se lanza
  // un error y la UI muestra "Previsión no disponible".
  async function fetchForecast(spot) {
    if (!API_BASE) throw new Error("backend no configurado");
    const r = await fetch(`${API_BASE}/api/spots/${spot.id}/forecast`, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error("backend " + r.status);
    const data = await r.json();
    data._sample = false;
    return applyWaveFactor(spot, data);
  }

  // ---------- generador de datos de ejemplo (realista para Salinas, NW) ----------
  // Reproduce EXACTAMENTE el contrato del backend para que la UI sea idéntica.
  function buildSample(spot) {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const rng = mulberry32(hash(spot.id + now.toDateString()));
    // Régimen marino por DÍA: el swell sube y baja en pulsos de varios días, la
    // dirección cambia (de SW malo a NW/N ideal) y el viento alterna offshore
    // (limpio) / onshore (sucio). Así la CALIDAD —y las estrellas— varía de verdad,
    // y un 5/5 solo sale cuando todo se alinea (swell NW + tamaño + periodo + offshore).
    const mkHour = (date) => {
      const dayAbs = Math.floor(date.getTime() / 86400000);
      const dr = mulberry32(hash(spot.id + ":d:" + dayAbs));
      const dRnd = dr(), dRnd2 = dr(), dRnd3 = dr(), dRnd4 = dr();
      const hr = mulberry32(hash(spot.id + ":h:" + Math.floor(date.getTime() / 3600e3)));
      const hRnd = hr();
      const hourFrac = date.getHours() / 24;

      // swell: pulso lento de varios días (~0.4 .. 3.3 m) + leve oscilación horaria
      const pulse = 0.5 + 0.5 * Math.sin(dayAbs * 0.85 + 1.3);
      const sBase = 0.5 + 2.6 * pulse * (0.55 + 0.45 * dRnd);
      const sH = Math.max(0.3, sBase + 0.12 * Math.sin(hourFrac * 6.283) + (hRnd - 0.5) * 0.25);
      const wH = sH + 0.1 + hRnd * 0.2;

      // periodo correlacionado con el tamaño (windswell corto ↔ groundswell largo)
      const per = Math.min(16, Math.max(6, 6.5 + sBase * 2.3 + (dRnd2 - 0.5) * 1.5 + (hRnd - 0.5) * 0.6));

      // dirección del swell: de SW (malo para Salinas) a NW/N (ideal) según el día
      const sDir = (240 + dRnd2 * 130 + (hRnd - 0.5) * 12 + 360) % 360;
      const wDir = (sDir + (hRnd - 0.5) * 14 + 360) % 360;

      // viento: días offshore (S/SW, limpio) vs onshore (N/NW, sucio) + brisa térmica
      const offshore = dRnd3 < 0.5;
      const windDir = offshore
        ? (195 + (hRnd - 0.5) * 60 + 360) % 360
        : (335 + (hRnd - 0.5) * 90 + 360) % 360;
      const windSpd = (offshore ? 1.8 + dRnd4 * 4 : 4.5 + dRnd4 * 7)
        + (0.5 + 0.5 * Math.sin(hourFrac * 6.283 + 1)) * 2 + hRnd;
      const wTemp = 14.2 + dRnd * 1.8;

      const fc = {
        waveHeight: round1(wH), wavePeriod: round1(per), waveDirection: Math.round(wDir),
        swellHeight: round1(sH), swellPeriod: round1(per + 0.5), swellDirection: Math.round(sDir),
        windSpeed: round1(windSpd), windDirection: Math.round(windDir),
        waterTemperature: round1(wTemp)
      };
      const sc = scoreForSpot(spot, fc);
      return Object.assign({ timestamp: date.toISOString() }, fc, { score: sc });
    };

    const current = mkHour(now);

    const next24h = [];
    for (let h = 3; h <= 24; h += 3) {
      const d = new Date(now.getTime() + h * 3600e3);
      next24h.push(mkHour(d));
    }

    const next7days = [];
    for (let day = 0; day < 7; day++) {
      const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, 0);
      let wMin = 99, wMax = 0, perSum = 0, windSum = 0, n = 0;
      let wSin = 0, wCos = 0, sSin = 0, sCos = 0;     // medias circulares de dirección
      let best = null, bestT = null;
      const hrs = [];
      for (let hh = 0; hh <= 21; hh += 3) {
        const d = new Date(d0.getTime() + hh * 3600e3);
        const e = mkHour(d);
        hrs.push(e);
        wMin = Math.min(wMin, e.waveHeight); wMax = Math.max(wMax, e.waveHeight);
        perSum += e.wavePeriod; windSum += e.windSpeed; n++;
        const wr = e.windDirection * Math.PI / 180; wSin += Math.sin(wr); wCos += Math.cos(wr);
        const sr = e.swellDirection * Math.PI / 180; sSin += Math.sin(sr); sCos += Math.cos(sr);
        // mejor ventana solo en horas de luz (6–21) para que sea surfeable
        if (hh >= 6 && (best == null || e.score > best)) { best = e.score; bestT = d; }
      }
      const circDir = (sin, cos) => Math.round((Math.atan2(sin, cos) * 180 / Math.PI + 360) % 360);
      next7days.push({
        date: d0.toISOString(),
        waveMin: round1(wMin), waveMax: round1(wMax),
        periodDom: round1(perSum / n),
        windAvg: round1(windSum / n), windDirection: circDir(wSin, wCos),
        swellDirection: circDir(sSin, sCos),
        score: best,
        bestWindow: bestT ? (String(bestT.getHours()).padStart(2,"0") + ":00") : null,
        hours: hrs            // detalle 3-horario del día (lo despliega la UI al hacer click)
      });
    }

    return {
      spotId: spot.id,
      updatedAt: now.toISOString(),
      units: { wave: "m", period: "s", wind: "m/s", temp: "C", direction: "deg" },
      current, next24h, next7days,
      _sample: true
    };
  }

  // ---------- spotScore (espejo ligero del backend, para el ejemplo) ----------
  // Reglas por spot: bestSwellDirection / bestWindDirection (en compás).
  function scoreForSpot(spot, fc) {
    const rules = spot.score || defaultRules(spot);
    return spotScore(rules, fc);
  }
  function defaultRules(spot) {
    // Salinas: swell NW/N, viento offshore S/SW.
    return { bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSW","SW","SE"],
             swellIdeal: [1.2, 2.5], periodIdeal: 12 };
  }
  function dirMatch(deg, list) {
    const c = compass(deg);
    if (list.includes(c)) return 1;
    // vecinos del compás puntúan parcial
    const idx = C16.indexOf(c);
    for (const l of list) {
      const li = C16.indexOf(l);
      const d = Math.min((idx - li + 16) % 16, (li - idx + 16) % 16);
      if (d === 1) return 0.6;
      if (d === 2) return 0.3;
    }
    return 0;
  }
  function spotScore(rules, fc) {
    // Misma lógica EXIGENTE que el backend: la ola en sí es la base; periodo y
    // viento son filtros multiplicadores. El viento solo puntúa si es Glass
    // (muy flojo) u offshore limpio.
    const c01 = (v) => Math.max(0, Math.min(1, v));
    const sw = dirMatch(fc.swellDirection, rules.bestSwellDirection || []);   // 0..1
    const [lo, hi] = rules.swellIdeal || [1, 3];
    const h = fc.swellHeight;
    const size = h == null ? 0
               : h < lo ? Math.max(0, h / lo)
               : h > hi ? Math.max(0, 1 - (h - hi) / hi)
               : 1;                                                            // 0..1
    const waveBase = 0.6 * sw + 0.4 * size;
    const periodIdeal = rules.periodIdeal || 12;
    const periodFactor = c01((fc.swellPeriod - 6) / (periodIdeal - 6));        // 0 a 6 s → 1 al ideal
    const periodMult = 0.35 + 0.65 * periodFactor;
    const wd = dirMatch(fc.windDirection, rules.bestWindDirection || []);     // 0..1 (offshore)
    const kn = (fc.windSpeed || 0) * MS_TO_KN;
    const glass = c01(1 - (kn - 3) / 5);                                       // ≤3 kn = 1 ; ≥8 kn = 0
    const offshoreClean = wd * c01(1 - (kn - 8) / 16);                         // offshore ideal ~8 kn
    const windScore = Math.max(glass, offshoreClean);
    const windMult = 0.3 + 0.7 * windScore;
    const score = 100 * waveBase * periodMult * windMult;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // utilidades random determinista
  function hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function round1(v){return Math.round(v*10)/10;}

  // ---------- render ----------
  const DOW_LETTER = ["D", "L", "M", "X", "J", "V", "S"];   // dom..sáb

  // Barra vertical (gráfico de barras) escalada a la altura del swell.
  function swellBar(ph, h) {
    ph = Math.max(3, Math.round(ph));
    const cls = heightClass(h);
    return `<span class="sfc-sw-bar ${cls}" style="height:${ph}px"></span>`;
  }

  // ---------- render ----------
  // BARRA VISUAL de oleaje (7 días): olas escaladas contra una regla de metros con
  // la letra del día (L M X J V S D) y la altura máx debajo. La "foto" rápida.
  function renderSwell(d) {
    const PLOT = 80;
    const rulerMax = 4;                                     // escala fija 0–4 m
    const step = PLOT / rulerMax;
    const grid =
      `repeating-linear-gradient(to top, var(--line) 0, var(--line) 1px, transparent 1px, transparent ${step}px)`;
    let labels = "";
    for (let m = 0; m <= rulerMax; m++) {
      labels += `<span class="sfc-sw-rl" style="bottom:${(m * step).toFixed(1)}px">${m}m</span>`;
    }
    const today = new Date().toDateString();
    const cols = d.next7days.map((e) => {
      const dt = new Date(e.date);
      const isToday = dt.toDateString() === today;
      const ph = Math.min(PLOT, (e.waveMax / rulerMax) * PLOT);   // se queda en el tope a 4 m+
      return `<div class="sfc-sw-col ${isToday ? "is-today" : ""}">
        <div class="sfc-sw-plot" style="background-image:${grid}">${swellBar(ph, e.waveMax)}</div>
        <span class="sfc-sw-h ${heightClass(e.waveMax)}">${m1(e.waveMax)}</span>
        <span class="sfc-sw-d">${DOW_LETTER[dt.getDay()]}</span>
      </div>`;
    }).join("");
    return `<div class="sfc-swell">
      <div class="sfc-bh"><span>Oleaje · 7 días</span><span class="sfc-bh-hint">altura máx · m</span></div>
      <div class="sfc-sw-chart" style="--plot:${PLOT}px">
        <div class="sfc-sw-ruler">${labels}</div>
        <div class="sfc-sw-cols">${cols}</div>
      </div>
    </div>`;
  }

  function chip(label, value, unit, sub, cls) {
    return `<div class="sfc-chip">
      <span class="sfc-clabel">${label}</span>
      <span class="sfc-cval ${cls || ""}">${value}<i>${unit || ""}</i>${sub || ""}</span>
    </div>`;
  }

  // Estrellas DISCRETAS (1–5) según la banda del adjetivo.
  function stars(score) {
    const n = starCount(score);
    const pct = (n / 5 * 100).toFixed(1);
    return `<span class="sfc-stars" title="${n} / 5" aria-label="${n} de 5">
      <span class="sfc-stars-bg">★★★★★</span>
      <span class="sfc-stars-fg" style="width:${pct}%">★★★★★</span>
    </span>`;
  }

  // Condiciones actuales: cabecera + estrellas + tira de números (sin recuadro).
  function renderCurrent(d) {
    const c = d.current;
    return `
      <div class="sfc-block sfc-now">
        <div class="sfc-bh">
          <span>Condiciones actuales</span>
          <span class="sfc-now-rating">${stars(c.score)}</span>
        </div>
        <div class="sfc-strip">
          ${chip("Ola", m1(c.waveHeight), "m", "", heightClass(c.waveHeight))}
          ${chip("Periodo", i0p(c.wavePeriod), "s", "")}
          ${chip("Swell", m1(c.swellHeight), "m", arrow(c.swellDirection))}
          ${chip("Viento", kn(c.windSpeed), "kn", arrow(c.windDirection, "wind"))}
          ${chip("Agua", i0(c.waterTemperature), "°C", "")}
        </div>
      </div>`;
  }

  // detalle 3-horario de un día (se inyecta al desplegar la fila del día) — solo números
  function renderDayHours(e) {
    const rows = (e.hours || []).map((h) => {
      const hb = band(h.score);
      return `<div class="sfc-hr">
        <span class="sfc-ht">${fmtHour(h.timestamp)}</span>
        <span class="sfc-hcell">${m1(h.waveHeight)}<i>m</i></span>
        <span class="sfc-hcell">${i0p(h.wavePeriod)}<i>s</i></span>
        <span class="sfc-hdir">${arrow(h.swellDirection)}${compass(h.swellDirection)}</span>
        <span class="sfc-hwind">${arrow(h.windDirection,"wind")}${kn(h.windSpeed)}<i>kn</i></span>
        <span class="sfc-hsc ${hb.cls}">${h.score}</span>
      </div>`;
    }).join("");
    return `<div class="sfc-dayhours">
      <div class="sfc-hr sfc-hr-head"><span>Hora</span><span>Ola</span><span>Per</span><span>Dir</span><span>Viento</span><span>Pts</span></div>
      ${rows}
    </div>`;
  }

  // 7 días: tira horizontal de tarjetas (una por día), con el resumen apilado
  // debajo del nombre. Al tocar una tarjeta se despliega su detalle por horas.
  // Rating REPRESENTATIVO del día: media de las horas de luz (6–21) del detalle,
  // no el pico de una sola hora. Si el backend ya manda un score representativo
  // (tras el redeploy) coincide; aquí lo recalculamos para verlo ya en preview.
  function dayRating(e) {
    const hrs = (e.hours || []).filter((h) => {
      if (h.score == null || isNaN(h.score)) return false;
      const H = new Date(h.timestamp).getHours();
      return H >= 6 && H <= 21;
    });
    if (!hrs.length) return e.score;
    return Math.round(hrs.reduce((s, h) => s + h.score, 0) / hrs.length);
  }
  function renderDaily(d) {
    const cards = d.next7days.map((e) => {
      const f = fmtDay(e.date);
      return `<details class="sfc-day">
        <summary class="sfc-dr">
          <div class="sfc-dhead">
            <span class="sfc-dday"><b>${f.dow}</b><i>${f.dm}</i></span>
            <span class="sfc-dstars">${stars(dayRating(e))}</span>
          </div>
          <div class="sfc-dstats">
            <span class="sfc-dstat"><em>Ola</em><b class="${heightClass(e.waveMax)}">${m1(e.waveMin)}–${m1(e.waveMax)}</b><i>m</i></span>
            <span class="sfc-dstat"><em>Periodo</em><b>${i0p(e.periodDom)}</b><i>s</i></span>
            <span class="sfc-dstat"><em>Swell</em><b>${arrow(e.swellDirection)} ${compass(e.swellDirection)}</b></span>
            <span class="sfc-dstat"><em>Viento</em><b>${arrow(e.windDirection,"wind")} ${kn(e.windAvg)}</b><i>kn</i></span>
          </div>
          <span class="sfc-dchev">horas<span class="sfc-dchev-ic">▾</span></span>
        </summary>
        ${renderDayHours(e)}
      </details>`;
    }).join("");
    return `<details class="sfc-block sfc-foldable" open>
      <summary class="sfc-bh">
        <span>Próximos 7 días · detalle</span>
        <span class="sfc-bh-peek">desliza ▸ · toca un día para sus horas<span class="sfc-chev">▾</span></span>
      </summary>
      <div class="sfc-daily">${cards}</div>
    </details>`;
  }

  function renderAll(el, d) {
    // El parte Surfedex usa el modelo de tabla (condiciones actuales + pronóstico
    // 7 días en tabla con scroll lateral). renderAlt es la única fuente del diseño.
    el.innerHTML = renderAlt(d);
  }

  async function mount(spot, el) {
    if (!el) return;
    el.innerHTML = `<div class="sfc-loading">Cargando previsión…</div>`;
    try {
      const data = await fetchForecast(spot);
      renderAll(el, data);
    } catch (e) {
      el.innerHTML = `<div class="sfc-unavailable">
        <span class="t">Previsión no disponible</span>
        <span class="d">Este spot todavía no tiene datos del servidor.</span>
      </div>`;
    }
  }

  window.SurfedexForecast = {
    mount,
    mountAlt,
    usesPilot: (id) => PILOT_SPOTS.includes(id),
    spotScore,           // expuesto por si se quiere puntuar en cliente
    compass, band
  };

  // =====================================================================
  // FORMATO 3 — réplica del parte de Surf-Forecast (tabla días × horas)
  // con datos de Stormglass (vía backend). Solo se usa donde lo monte la app.
  // =====================================================================

  // Energía del oleaje (índice de fuerza del swell, en kJ). Escala con H²·T,
  // usando el periodo +1 s (igual que el resto: Stormglass es conservador).
  function energyKj(h, t) {
    if (h == null || t == null || isNaN(h) || isNaN(t)) return null;
    return Math.round(20 * h * h * t);
  }
  // Estado del viento relativo a la orilla (deducido del swell): offshore si el
  // viento viene del lado de tierra (≈ swellDir+180). Glassy si es muy flojo.
  function windState(windDir, kmh, swellDir) {
    if (kmh != null && kmh < 6) return { label: "Glassy", cls: "st-glass" };
    if (windDir == null || swellDir == null) return { label: "—", cls: "st-cross" };
    const offshore = (swellDir + 180) % 360;
    const diff = Math.abs(((windDir - offshore + 540) % 360) - 180);
    if (diff <= 55) return { label: "Offshore", cls: "st-glass" };
    if (diff <= 120) return { label: "Cruzado", cls: "st-cross" };
    return { label: "Onshore", cls: "st-on" };
  }
  // Notación 0–10 (de la nota 0–100) en una estrella, con aviso si es peligroso.
  function ratingCell(h) {
    const n = (h.score == null || isNaN(h.score)) ? null : Math.round(h.score / 10);
    const danger = (h.waveHeight != null && h.waveHeight > 4) ||
                   (h.windSpeed != null && h.windSpeed * 3.6 > 45);
    if (danger) return `<span class="sff-rate sff-rate--danger" title="Peligroso">▲</span>`;
    const cls = n >= 4 ? "is-good" : n >= 2 ? "is-mid" : "is-low";
    return `<span class="sff-rate ${cls}"><i>★</i><b>${n == null ? "—" : n}</b></span>`;
  }
  // Puntuación 0–100 (la misma nota del backend), coloreada por rango.
  function scoreCell(h) {
    if (h.score == null || isNaN(h.score)) return `<b class="sff-score sc-low">—</b>`;
    const n = Math.round(h.score);
    const cls = n >= 71 ? "sc-good" : n >= 46 ? "sc-mid" : "sc-low";
    return `<b class="sff-score ${cls}">${n}</b>`;
  }
  // Glifo de ola escalado a la altura (0–5 m), estilo Surf-Forecast.
  function waveGlyph(hgt) {
    const max = 5, ph = Math.max(6, Math.min(100, ((hgt || 0) / max) * 100));
    const cls = heightClass(hgt);
    return `<span class="sff-wave ${cls}" style="height:${ph}%"></span>`;
  }

  function renderAlt(d) {
    // columnas: horas de cada día (filtramos a 5–23 h para acercarnos a Surf-Forecast)
    const days = (d.next7days || []).map((e) => {
      const hrs = (e.hours || []).filter((h) => {
        const H = new Date(h.timestamp).getHours();
        return H >= 5 && H <= 23;
      });
      return { date: new Date(e.date), hrs };
    }).filter((x) => x.hrs.length);

    const DOW = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
    // construye una fila: etiqueta sticky + celdas por día/hora
    const row = (label, cls, cellFn) => {
      let cells = "";
      days.forEach((day, di) => {
        day.hrs.forEach((h, hi) => {
          cells += `<span class="sff-c${hi === 0 && di > 0 ? " sff-c--daysep" : ""}">${cellFn(h)}</span>`;
        });
      });
      return `<div class="sff-row ${cls}"><span class="sff-rl">${label}</span><div class="sff-cells">${cells}</div></div>`;
    };

    // cabecera de días (cada día ocupa nº de horas)
    let dayHead = "";
    days.forEach((day, di) => {
      dayHead += `<span class="sff-dh${di > 0 ? " sff-c--daysep" : ""}" style="flex:0 0 ${day.hrs.length * 46}px">
        <b>${DOW[day.date.getDay()]}</b><i>${day.date.getDate()}</i></span>`;
    });
    const hourRow = row("", "sff-hours", (h) => fmtHourShort(h.timestamp));

    const body =
      row("Altura (m)", "sff-r-hgt", (h) => `<b class="${heightClass(h.waveHeight)}">${m1(h.waveHeight)}</b>${arrow(h.swellDirection)}`) +
      row("Dirección", "sff-r-dir", (h) => compass(h.windDirection)) +
      row("Viento km/h", "sff-r-wind", (h) => `${arrow(h.windDirection,"wind")}<b>${h.windSpeed==null?"—":Math.round(h.windSpeed*3.6)}</b>`) +
      row("Estado", "sff-r-state", (h) => {
        const s = windState(h.windDirection, h.windSpeed==null?null:h.windSpeed*3.6, h.swellDirection);
        return `<span class="sff-st ${s.cls}">${s.label}</span>`;
      }) +
      row("Periodo (s)", "sff-r-per", (h) => i0p(h.wavePeriod)) +
      row("Gráfico", "sff-r-graph", (h) => waveGlyph(h.waveHeight)) +
      row("Energía kJ", "sff-r-kj", (h) => ej(energyKj(h.waveHeight, h.wavePeriod == null ? null : h.wavePeriod + 1)));

    const upd = new Date(d.updatedAt);
    const updTxt = upd.toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    return `<div class="sff">
      ${d._sample ? `<div class="sfc-banner">Datos de ejemplo · el backend aún no está conectado</div>` : ""}
      ${d._wfPreview ? `<div class="sfc-banner sfc-banner--info">Altura ajustada al spot (vista previa)</div>` : ""}
      ${renderCurrent(d)}
      <div class="sff-title">Pronóstico 7 días</div>
      <div class="sff-scroll">
        <div class="sff-row sff-dayhead"><span class="sff-rl"></span><div class="sff-cells sff-daycells">${dayHead}</div></div>
        ${hourRow}
        ${body}
      </div>
      <div class="sfc-foot"><span>Actualizado ${updTxt}</span><span>Fuente: Stormglass · vía backend Surfedex</span></div>
    </div>`;
  }
  function ej(v) { return v == null ? "—" : v.toString(); }
  function fmtHourShort(iso) {
    const h = new Date(iso).getHours();
    if (h === 0) return "12 AM"; if (h === 12) return "12 PM";
    return h < 12 ? h + " AM" : (h - 12) + " PM";
  }

  async function mountAlt(spot, el) {
    if (!el) return;
    el.innerHTML = `<div class="sfc-loading">Cargando previsión…</div>`;
    try {
      const data = await fetchForecast(spot);
      el.innerHTML = renderAlt(data);
    } catch (e) {
      el.innerHTML = `<div class="sfc-unavailable">
        <span class="t">Previsión no disponible</span>
        <span class="d">Este spot todavía no tiene datos del servidor.</span>
      </div>`;
    }
  }
})();
