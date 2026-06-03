/* SurfMach — lógica de la aplicación
   Niveles de navegación: world → region → zone → spot
   Mapa real con Leaflet + tiles cartográficos (líneas de costa fieles). */

(function () {
  "use strict";

  const SPOTS      = window.SURFMACH_SPOTS;
  const CONTINENTS = window.SURFMACH_CONTINENTS;
  const REGIONS    = window.SURFMACH_REGIONS;   // Sur de Europa
  const ZONES      = window.SURFMACH_ZONES;     // Asturias, Canarias, Landas...
  const AREAS      = window.SURFMACH_AREAS;     // Occidente, Oriente, gc-norte...

  // ---------- datos "horneados" permanentes (compartidos por todos) ----------
  // Provienen del export del editor (data/baked.js) y se aplican como base, antes
  // que el estado local del navegador. Un spot propio horneado que coincida en
  // nombre con uno del catálogo se descarta para no duplicar pines en el mapa.
  const BAKED = window.SURFMACH_BAKED || {};
  const normName = (s) =>
    (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
  (BAKED.customSpots || []).forEach((s) => {
    const dupId = SPOTS.some((x) => x.id === s.id);
    const dupName = SPOTS.some((x) => normName(x.name) === normName(s.name));
    if (!dupId && !dupName) SPOTS.push(s);
  });
  Object.keys(BAKED.spotEdits || {}).forEach((id) => {
    const s = SPOTS.find((x) => x.id === id);
    if (s) Object.assign(s, BAKED.spotEdits[id]);
  });

  // ---------- spots propios del usuario (persistentes) ----------
  const customSpots = JSON.parse(localStorage.getItem("sm-custom-spots") || "[]");
  // Descartamos por id Y por nombre: si un spot propio coincide con uno ya presente
  // (del catálogo o ya horneado), no se añade — así no salen pines duplicados aunque
  // el navegador conserve spots propios antiguos que ya forman parte del catálogo.
  customSpots.forEach((s) => {
    const dup = SPOTS.some((x) => x.id === s.id || normName(x.name) === normName(s.name));
    if (!dup) SPOTS.push(s);
  });
  function saveCustomSpots() {
    localStorage.setItem("sm-custom-spots", JSON.stringify(customSpots));
  }

  // ---------- ediciones de spots existentes (persistentes) ----------
  // Para los spots del catálogo guardamos solo los campos cambiados y los
  // re-aplicamos al cargar. Los spots propios se editan directamente.
  const spotEdits = JSON.parse(localStorage.getItem("sm-spot-edits") || "{}");
  function saveSpotEdits() {
    localStorage.setItem("sm-spot-edits", JSON.stringify(spotEdits));
  }
  function applySpotEdits() {
    Object.keys(spotEdits).forEach((id) => {
      const s = SPOTS.find((x) => x.id === id);
      if (s) Object.assign(s, spotEdits[id]);
    });
  }
  applySpotEdits();

  // ---------- vínculo con Windguru (id de spot) ----------
  // Solo se muestra pronóstico en los spots emparejados con un spot de Windguru.
  // Semilla de spots verificados; el usuario puede añadir/editar el resto desde ✎ Editar.
  const WG_SEED = {
    "pozo-izquierdo": 168621,   // Pozo Izquierdo (PWA World Cup)
    "pozo": 168621,             // Mosca Point / Pozo (mismo modelo de viento)
    "salinas": 48710,           // Salinas (Asturias)
    // -- País Vasco --
    "mundaka": 206,
    "zarautz": 237,
    "zurriola": 238,
    "bakio": 241,
    "menakoz": 48714,
    "barinatxe": 48712,
    "laga": 244,
    "itzurun": 48718,
    "ereaga": 245,
    "punta-galea": 48720,
    "deba": 239,
    "la-arena": 48725,
    "armintza": 48728,
    "ondarreta": 48730,
    "hondarribia": 48732,
    "malkorbe": 48735,
    "la-antilla": 48738,
    "gorliz": 48740,
    "plentzia": 48742,
    "saturraran": 48745
  };
  // Ids de Windguru horneados (del export) — semilla compartida por todos.
  Object.assign(WG_SEED, BAKED.windguru || {});
  const wgPersist = JSON.parse(localStorage.getItem("sm-wg-map") || "{}");
  function wgIdFor(s) {
    if (!s) return null;
    if (Object.prototype.hasOwnProperty.call(wgPersist, s.id)) return wgPersist[s.id] || null;
    return WG_SEED[s.id] || null;
  }
  function setWgId(spotId, id) {
    wgPersist[spotId] = id ? String(id) : "";
    localStorage.setItem("sm-wg-map", JSON.stringify(wgPersist));
  }
  // Acepta un número (48710) o una URL (windguru.cz/48710) y devuelve el id.
  function parseWgId(v) {
    v = (v || "").trim();
    if (!v) return "";
    const m = v.match(/(\d{2,})/);
    return m ? m[1] : "";
  }

  // ---------- webcam en directo por spot ----------
  // Visor de cámara en vivo dentro de la ficha del spot. Soporta dos proveedores:
  //   · type "youtube" → id de vídeo de YouTube (se incrusta con su reproductor).
  //   · type "iframe"  → URL de una web de cámara que permita incrustarse en iframe.
  // Para añadir otro spot, agrega aquí su configuración.
  const WEBCAMS = {
    "salinas": { type: "youtube", id: "doNsXrJHErU", label: "Salinas · Avilés" },
    "xago": {
      type: "iframe",
      // reproductor solo-vídeo del stream (servicio rtsp.me usado por la cámara)
      url: "https://rtsp.me/embed/nsdBY5nz/",
      // enlace de respaldo: la página pública de la cámara
      link: "https://www.webcamsdeasturias.com/asturias/cabo-penas/gozon/xago/playa-de-xago-hd/118/",
      label: "Xagó · Gozón"
    },
    "cadavedo": {
      type: "iframe",
      url: "https://rtsp.me/embed/FY2tKY4R/",
      link: "https://www.webcamsdeasturias.com/asturias/occidente/valdes/cadavedo/playa-de-cadavedo-hd/190/",
      label: "Cadavedo · La Ribeirona"
    },
    "aguilar": {
      type: "iframe",
      url: "https://rtsp.me/embed/DsrHF74h/",
      link: "https://www.webcamsdeasturias.com/asturias/bajo-nalon/muros-de-nalon/aguilar/playa-de-aguilar-hd/122/",
      label: "Aguilar · Muros de Nalón"
    },
    "quebrantos": {
      type: "iframe",
      url: "https://rtsp.me/embed/iZBbNZEG/",
      link: "https://www.webcamsdeasturias.com/asturias/bajo-nalon/soto-del-barco/san-juan-del-arena/playa-de-los-quebrantos-hd/149/",
      label: "Los Quebrantos · San Juan de la Arena"
    },
    "custom-mpsrz0k3": {
      type: "iframe",
      url: "https://rtsp.me/embed/7ZD9SkQF/",
      link: "https://www.webcamsdeasturias.com/asturias/comarca-vaqueira/cudillero/lamuno/playa-de-la-concha-de-artedo/151/",
      label: "La Concha de Artedo · Cudillero"
    },
    "custom-mpss0cx1": {
      type: "iframe",
      url: "https://rtsp.me/embed/Fd8dSQre/",
      link: "https://www.webcamsdeasturias.com/asturias/occidente-de-asturias/comarca-vaqueira/cudillero/playa-san-pedro-de-la-ribera/176/",
      label: "San Pedro de la Ribera · Cudillero"
    },
    "frejulfe": {
      type: "iframe",
      url: "https://rtsp.me/embed/s2NhG4Nd/",
      link: "https://www.webcamsdeasturias.com/asturias/parque-historico-del-navia/navia/navia/playa-de-frejulfe-hd/98/",
      label: "Freijulfe · Navia"
    },
    "tapia": {
      type: "iframe",
      url: "https://rtsp.me/embed/SdzF8ESr/",
      link: "https://www.webcamsdeasturias.com/asturias/occidente/tapia-de-casariego/tapia-de-casariego/playa-de-tapia-anguileiro-o-la-grande-hd/114/",
      label: "Tapia de Casariego · Anguileiro / La Grande"
    },
    "penarronda": {
      type: "iframe",
      url: "https://rtsp.me/embed/BrKdaEZT/",
      link: "https://www.webcamsdeasturias.com/asturias/oscos-eo/castropol/penarronda/playa-de-penarronda-hd/27/",
      label: "Peñarronda · Castropol"
    },
    "puertillo": {
      type: "iframe",
      // in2thebeach: reproductor solo-vídeo (id = el de la URL /webcam/<id>/)
      url: "https://in2thebeach.es/callbacks/camviewer_ext2.php?id=7",
      link: "https://in2thebeach.es/webcam/7/el-puertillo-los-charcones/",
      label: "El Puertillo · Los Charcones (Arucas)"
    },
    "vagabundo": {
      type: "iframe",
      url: "https://in2thebeach.es/callbacks/camviewer_ext2.php?id=142",
      link: "https://in2thebeach.es/webcam/142/playa-de-arena-de-san-felipe-vagabundo/",
      label: "Vagabundo · San Felipe"
    },
    "cicer": {
      type: "iframe",
      url: "https://in2thebeach.es/callbacks/camviewer_ext2.php?id=81",
      link: "https://in2thebeach.es/webcam/81/playa-de-la-cicer-el-cruce/",
      label: "La Cicer · Las Palmas"
    },
    "playa-hombre": {
      type: "iframe",
      url: "https://in2thebeach.es/callbacks/camviewer_ext2.php?id=2",
      link: "https://in2thebeach.es/webcam/2/playa-del-hombre/",
      label: "Playa del Hombre · Telde"
    },
    "arguineguin": {
      type: "iframe",
      url: "https://in2thebeach.es/callbacks/camviewer_ext2.php?id=71",
      link: "https://in2thebeach.es/webcam/71/el-pajar-santa-agueda-arguineguin/",
      label: "El Pajar · Santa Águeda (Arguineguín)"
    },
    "maspalomas": {
      type: "iframe",
      url: "https://in2thebeach.es/callbacks/camviewer_ext2.php?id=12",
      link: "https://in2thebeach.es/webcam/12/maspalomas/",
      label: "Maspalomas · Faro"
    },
    "playa-ingles": {
      type: "iframe",
      url: "https://in2thebeach.es/callbacks/camviewer_ext2.php?id=3",
      link: "https://in2thebeach.es/webcam/3/playa-del-ingles-izquierda/",
      label: "Playa del Inglés · Izquierda"
    },

    // ===== ASTURIAS ORIENTE (Webcams de Asturias) =====
    // El reproductor de webcamsdeasturias.com bloquea la incrustación en iframe,
    // así que estas cámaras se enlazan a su página oficial (type "link": abre la
    // emisión en directo en una pestaña nueva). Para verlas EMBEBIDAS dentro de la
    // ficha, sustituye type:"link"+link por type:"iframe"+url con la URL del
    // reproductor (p. ej. https://rtsp.me/embed/XXXXXXXX/), igual que las cámaras
    // del occidente; el campo "link" se conserva como respaldo.
    "san-lorenzo": {
      type: "iframe",
      url: "https://rtsp.me/embed/akBSN4td/",
      link: "https://www.webcamsdeasturias.com/asturias/centro/gijon/gijon/la-escalerona-playa-de-san-lorenzo-hd/148/",
      label: "San Lorenzo · La Escalerona (Gijón)"
    },
    "custom-mpswn3ha": {
      type: "iframe",
      url: "https://rtsp.me/embed/9taDa6b8/",
      link: "https://www.webcamsdeasturias.com/asturias/comarca-de-la-sidra/villaviciosa/quintes/playa-espana-hd/164/",
      label: "Playa de España · Quintes"
    },
    "la-nora": {
      type: "link",
      link: "https://www.webcamsdeasturias.com/asturias/comarca-de-la-sidra/villaviciosa/villaviciosa/playa-de-la-nora/121/",
      label: "La Ñora · Villaviciosa"
    },
    "custom-mpsuiolb": {
      type: "link",
      link: "https://www.webcamsdeasturias.com/asturias/comarca-de-la-sidra/villaviciosa/rodiles/playa-de-rodiles-hd/120/",
      label: "Rodiles · Villaviciosa"
    },
    "custom-mpsxedcm": {
      type: "link",
      link: "https://www.webcamsdeasturias.com/asturias/comarca-del-sueve/caravia/caravia/playa-de-la-espasa-hd/71/",
      label: "La Espasa · Caravia"
    },
    "custom-mpsxgbby": {
      type: "link",
      link: "https://www.webcamsdeasturias.com/asturias/comarca-del-sueve/caravia/caravia/playa-arenal-de-moris-hd/188/",
      label: "Arenal de Morís · Caravia"
    },
    "custom-mpsud51b": {
      type: "link",
      link: "https://www.webcamsdeasturias.com/asturias/oriente/ribadesella/vega/playa-de-vega-hd/132/",
      label: "Playa de Vega · Ribadesella"
    },
    "custom-mpsxiv0u": {
      type: "link",
      link: "https://www.webcamsdeasturias.com/asturias/oriente/ribadesella/ribadesella/playa-de-santa-marina-hd/166/",
      label: "Santa Marina · Ribadesella"
    },
    "custom-mpsxmluu": {
      type: "link",
      link: "https://www.webcamsdeasturias.com/asturias/oriente/llanes/bedon/playa-de-san-antolin-hd/131/",
      label: "San Antolín · Llanes"
    },
    "custom-mpsxulha": {
      type: "link",
      link: "https://www.webcamsdeasturias.com/asturias/oriente-de-asturias/llanes/barro/playa-de-barro-hd/16/",
      label: "Playa de Barro · Llanes"
    },
    "custom-mpsu7cla": {
      type: "link",
      link: "https://www.webcamsdeasturias.com/asturias/oriente/llanes/andrin/playa-de-andrin-hd/187/",
      label: "Andrín · Llanes"
    },
    "custom-mpsy4a66": {
      type: "link",
      link: "https://www.webcamsdeasturias.com/asturias/oriente-de-asturias/ribadedeva/ribadedeva/playa-de-la-franca-hd/117/",
      label: "La Franca · Ribadedeva"
    }
  };
  function webcamFor(s) {
    return (s && WEBCAMS[s.id]) || null;
  }
  // src del iframe del visor según el proveedor.
  function webcamSrc(cam) {
    if (!cam) return "";
    if (cam.type === "youtube") {
      let src = "https://www.youtube.com/embed/" + cam.id +
        "?autoplay=1&mute=1&rel=0&modestbranding=1&playsinline=1";
      try {
        if (location.origin && location.origin !== "null") {
          src += "&origin=" + encodeURIComponent(location.origin);
        }
      } catch (e) {}
      return src;
    }
    return cam.url || "";   // type "iframe"
  }
  // Enlace directo (respaldo: abrir la cámara en una pestaña nueva).
  function webcamWatchUrl(cam) {
    if (!cam) return "#";
    if (cam.link) return cam.link;
    if (cam.type === "youtube") return "https://www.youtube.com/watch?v=" + cam.id;
    return cam.url || "#";
  }
  // Destruye cualquier iframe de webcam activo (al cambiar de spot / re-render).
  function clearWebcam() {
    document.querySelectorAll('iframe[data-webcam]').forEach((n) => { try { n.remove(); } catch (e) {} });
  }
  // ---------- Carga perezosa (lazy) de Windguru ----------
  // Cargar varios widgets de Windguru a la vez bloquea la página: cada uno mete un
  // <script> que descarga e inyecta su propio iframe. Por eso SOLO cargamos el
  // pronóstico cuando el usuario pulsa "Ver previsión", y garantizamos que nunca
  // haya más de un parte activo: antes de montar uno nuevo destruimos el anterior.
  let wgActiveNodes = [];   // <script> e <iframe> inyectados que debemos poder destruir

  // Destruye TODO widget de Windguru activo (scripts inyectados + iframes resultantes).
  function clearWindguru() {
    wgActiveNodes.forEach((n) => { try { n.remove(); } catch (e) {} });
    wgActiveNodes = [];
    // por si el widget dejó iframes huérfanos en cualquier parte del documento
    document.querySelectorAll('iframe[id^="wg_fwdg_"], script[src*="windguru.cz/js/widget.php"]')
      .forEach((n) => { try { n.remove(); } catch (e) {} });
  }

  // Monta el widget oficial de Windguru dentro de un contenedor del panel.
  function mountWindguru(wgId, model, params, anchorEl) {
    if (!anchorEl || !anchorEl.parentNode) return;
    const uid = "wg_fwdg_" + wgId + "_" + model + "_" + Math.random().toString(36).slice(2, 8);
    // el widget localiza su anclaje por este id y coloca el iframe junto a él
    anchorEl.id = uid;
    // limpia un iframe previo del contenedor (al re-renderizar el panel)
    anchorEl.parentNode.querySelectorAll("iframe").forEach((f) => f.remove());
    const arg = [
      "s=" + wgId, "m=" + model, "uid=" + uid,
      "wj=knots", "tj=c", "waj=m", "tej=c",
      "odh=0", "doh=48", "fhour=2", "hrsm=1",
      "vt=forecasts", "lng=es", "idbs=1",
      "p=" + params
    ];
    const sc = document.createElement("script");
    sc.src = "https://www.windguru.cz/js/widget.php?" + arg.join("&");
    sc.async = true;
    // el widget inyecta su iframe junto a este <script>, dentro de la tarjeta
    anchorEl.parentNode.insertBefore(sc, anchorEl.nextSibling);
    wgActiveNodes.push(sc);
    // el iframe lo añade el widget de forma asíncrona junto al anclaje: lo registramos
    // poco después para poder destruirlo también al cambiar de spot.
    setTimeout(() => {
      if (anchorEl.parentNode) {
        anchorEl.parentNode.querySelectorAll("iframe").forEach((f) => {
          if (!wgActiveNodes.includes(f)) wgActiveNodes.push(f);
        });
      }
    }, 1500);
  }

  // ---------- Marea / nivel del mar (MSL) en vivo — Open-Meteo Marine (gratis) ----------
  function mountTide(spot, mountEl) {
    if (!mountEl) return;
    const ll = spotLL(spot);
    const url = "https://marine-api.open-meteo.com/v1/marine?latitude=" + ll[0].toFixed(4) +
      "&longitude=" + ll[1].toFixed(4) +
      "&hourly=sea_level_height_msl&timezone=auto&forecast_days=2";
    mountEl.innerHTML = '<div class="tide-loading">Cargando marea…</div>';
    fetch(url)
      .then((r) => r.json())
      .then((d) => {
        const h = d && d.hourly;
        if (!h || !h.sea_level_height_msl || !h.sea_level_height_msl.some((v) => v != null)) {
          mountEl.innerHTML = '<div class="tide-loading">Marea no disponible en esta ubicación</div>';
          return;
        }
        renderTide(mountEl, h.time, h.sea_level_height_msl);
      })
      .catch(() => { mountEl.innerHTML = '<div class="tide-loading">No se pudo cargar la marea</div>'; });
  }

  function renderTide(mountEl, times, vals) {
    const now = Date.now();
    let start = 0;
    for (let i = 0; i < times.length; i++) {
      if (new Date(times[i]).getTime() >= now) { start = Math.max(0, i - 1); break; }
    }
    const end = Math.min(times.length, start + 49); // ~48 h por delante
    const T = times.slice(start, end).map((t) => new Date(t).getTime());
    const V = vals.slice(start, end);
    if (V.length < 3) { mountEl.innerHTML = '<div class="tide-loading">Marea no disponible</div>'; return; }
    const min = Math.min(...V), max = Math.max(...V), range = (max - min) || 1;
    const W = 320, H = 72, padX = 4, padT = 10, padB = 16;
    const X = (i) => padX + i * (W - 2 * padX) / (V.length - 1);
    const Y = (v) => padT + (1 - (v - min) / range) * (H - padT - padB);
    const line = V.map((v, i) => (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1)).join("");
    const area = line + "L" + X(V.length - 1).toFixed(1) + "," + (H - padB) + "L" + X(0).toFixed(1) + "," + (H - padB) + "Z";
    const pad2 = (n) => ("0" + n).slice(-2);
    const hhmm = (ms) => { const d = new Date(ms); return pad2(d.getHours()) + ":" + pad2(d.getMinutes()); };

    // ahora
    let nowI = 0;
    for (let i = 0; i < T.length; i++) { if (T[i] >= now) { nowI = i; break; } }
    const curV = V[nowI];

    // extremos (pleamar / bajamar) con interpolación parabólica → hora sub-horaria
    const events = [];
    for (let i = 1; i < V.length - 1; i++) {
      const a = V[i - 1], b = V[i], c = V[i + 1];
      const isMax = b >= a && b >= c && (b > a || b > c);
      const isMin = b <= a && b <= c && (b < a || b < c);
      if (isMax || isMin) {
        const denom = a - 2 * b + c;
        let d = denom ? 0.5 * (a - c) / denom : 0;
        if (d > 0.5) d = 0.5; if (d < -0.5) d = -0.5;
        const tms = T[i] + d * 3600000;
        const val = b - 0.25 * (a - c) * d;
        events.push({ type: isMax ? "hi" : "lo", i: i, t: tms, v: val });
      }
    }
    const futureEv = events.filter((e) => e.t >= now - 3600000).slice(0, 4);

    // ticks de horas cada 6 h
    let ticks = "";
    for (let i = 0; i < T.length; i++) {
      const d = new Date(T[i]);
      if (d.getHours() % 6 === 0) {
        const tx = X(i).toFixed(1);
        ticks += `<line x1="${tx}" y1="${padT}" x2="${tx}" y2="${H - padB}" class="tk"/>` +
                 `<text x="${tx}" y="${H - 4}" class="tl">${pad2(d.getHours())}h</text>`;
      }
    }
    const exDots = events.map((e) =>
      `<circle cx="${X(e.i).toFixed(1)}" cy="${Y(V[e.i]).toFixed(1)}" r="2.3" class="tide-${e.type}"/>`).join("");
    const nowX = X(nowI).toFixed(1);
    const evHtml = futureEv.map((e) =>
      `<span class="ev ${e.type}"><span class="ar">${e.type === "hi" ? "▲" : "▼"}</span>${e.type === "hi" ? "Pleamar" : "Bajamar"} <b>${hhmm(e.t)}</b> · ${e.v.toFixed(2)} m</span>`).join("");

    mountEl.innerHTML =
      `<div class="tide-top"><span class="tide-now">${curV.toFixed(2)} m<small>ahora</small></span>
         <span class="tide-hint">pasa el cursor →</span></div>
       <div class="tide-chart">
         <svg class="tide-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
           ${ticks}
           <path d="${area}" class="tide-area"/>
           <path d="${line}" class="tide-line"/>
           <line x1="${nowX}" y1="${padT}" x2="${nowX}" y2="${H - padB}" class="tide-nowline"/>
           ${exDots}
           <circle cx="${nowX}" cy="${Y(curV).toFixed(1)}" r="3" class="tide-dot"/>
         </svg>
         <div class="tide-cursor"></div>
         <div class="tide-cdot"></div>
         <div class="tide-tip"></div>
       </div>
       <div class="tide-events">${evHtml}</div>`;

    // interacción: cursor + tooltip con hora y altura exactas
    const chart = mountEl.querySelector(".tide-chart");
    const cur = chart.querySelector(".tide-cursor");
    const cdot = chart.querySelector(".tide-cdot");
    const tip = chart.querySelector(".tide-tip");
    const move = (ev) => {
      const r = chart.getBoundingClientRect();
      const px = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left;
      let f = r.width ? px / r.width : 0;
      f = Math.max(0, Math.min(1, f));
      const idx = Math.round(f * (V.length - 1));
      const lp = X(idx) / W * 100, tp = Y(V[idx]) / H * 100;
      cur.style.left = lp + "%"; cur.style.display = "block";
      cdot.style.left = lp + "%"; cdot.style.top = tp + "%"; cdot.style.display = "block";
      tip.innerHTML = `<b>${hhmm(T[idx])}</b> · ${V[idx].toFixed(2)} m`;
      tip.style.display = "block";
      let tl = lp / 100 * r.width - tip.offsetWidth / 2;
      tl = Math.max(0, Math.min(r.width - tip.offsetWidth, tl));
      tip.style.left = tl + "px";
    };
    const leave = () => { cur.style.display = cdot.style.display = tip.style.display = "none"; };
    chart.addEventListener("mousemove", move);
    chart.addEventListener("mouseleave", leave);
    chart.addEventListener("touchstart", move, { passive: true });
    chart.addEventListener("touchmove", move, { passive: true });
  }

  // ---------- fotos por spot (persistentes, reducidas) ----------
  const photos = JSON.parse(localStorage.getItem("sm-photos") || "{}");
  function savePhotos() {
    try { localStorage.setItem("sm-photos", JSON.stringify(photos)); }
    catch (e) { alert("No queda espacio para guardar la foto (almacenamiento del navegador lleno). Prueba con una imagen más ligera o elimina alguna."); }
  }
  function downscaleImage(file, maxDim, cb) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      w = Math.round(w * scale); h = Math.round(h * scale);
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      cb(cv.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); alert("No se pudo leer la imagen."); };
    img.src = url;
  }

  function areaColor(areaId) {
    const a = AREAS.find((x) => x.id === areaId);
    return (a && a.color) || "#3DA8FF";
  }

  // ---------- estado ----------
  const state = {
    level: "world",        // world | region | zone | area | spot
    continentId: null,
    regionId: null,
    zoneId: null,
    areaId: null,
    spotId: null,
    favorites: new Set(JSON.parse(localStorage.getItem("sm-favs") || "[]")),
    filters: { level: null, wave: null },
    search: "",
    calibrate: false
  };

  function saveFavs() {
    localStorage.setItem("sm-favs", JSON.stringify([...state.favorites]));
  }

  // ---------- mapa ----------
  const map = L.map("map", {
    zoomControl: false,
    attributionControl: true,
    minZoom: 2,
    maxZoom: 17,
    worldCopyJump: true,
    fadeAnimation: false,
    zoomSnap: 0.25,
    zoomDelta: 0.5
  }).fitBounds(L.latLngBounds([[27.5, -18.3], [44.0, 4.6]]), { padding: [20, 20] });

  L.control.zoom({ position: "bottomright" }).addTo(map);
  window._map = map;

  // Tiles: CARTO Dark Matter — se conserva como reserva, pero la app arranca
  // siempre en vista SATÉLITE (no se añade al mapa por defecto).
  const baseTiles = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      subdomains: "abcd",
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · © <a href="https://carto.com/">CARTO</a>'
    }
  );

  // Capa de etiquetas oscuras (reserva, junto con baseTiles)
  const labelTiles = L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
    { subdomains: "abcd", maxZoom: 19, pane: "shadowPane", opacity: 0.85 }
  );

  // Capa SATÉLITE (Esri World Imagery) — para ver el reef/la rompiente real y colocar pines exactos
  const satTiles = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      attribution:
        'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
    }
  );
  // etiquetas de calles/lugares legibles sobre el satélite
  const satLabels = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, pane: "shadowPane", opacity: 0.9 }
  );

  let baseMode = "sat"; // app fija en SATÉLITE (vista de mapa eliminada)
  function applyBaseMode(mode) {
    baseMode = mode;
    localStorage.setItem("sm-basemode", mode);
    if (mode === "sat") {
      if (map.hasLayer(baseTiles)) map.removeLayer(baseTiles);
      if (map.hasLayer(labelTiles)) map.removeLayer(labelTiles);
      if (!map.hasLayer(satTiles)) satTiles.addTo(map);
      if (!map.hasLayer(satLabels)) satLabels.addTo(map);
    } else {
      if (map.hasLayer(satTiles)) map.removeLayer(satTiles);
      if (map.hasLayer(satLabels)) map.removeLayer(satLabels);
      if (!map.hasLayer(baseTiles)) baseTiles.addTo(map);
      if (!map.hasLayer(labelTiles)) labelTiles.addTo(map);
    }
    satTiles.setZIndex(1); baseTiles.setZIndex(1);
    document.querySelectorAll("[data-base]").forEach((b) =>
      b.classList.toggle("active", b.dataset.base === mode)
    );
    document.body.classList.toggle("sat-mode", mode === "sat");
  }

  // ---------- coordenadas editables (calibración) ----------
  // Base horneada (del export) + lo que el usuario recoloque en su navegador (gana lo local).
  const coordOverrides = Object.assign({}, BAKED.coordOverrides || {}, JSON.parse(localStorage.getItem("sm-coords") || "{}"));
  function spotLL(s) {
    const o = coordOverrides[s.id];
    return o ? [o.lat, o.lng] : [s.lat, s.lng];
  }
  function saveCoords() {
    localStorage.setItem("sm-coords", JSON.stringify(coordOverrides));
  }

  // panes
  map.createPane("zonesPane");   map.getPane("zonesPane").style.zIndex = 350;
  map.createPane("calloutsPane");map.getPane("calloutsPane").style.zIndex = 450;
  map.createPane("spotsPane");   map.getPane("spotsPane").style.zIndex = 500;
  map.createPane("regionsPane"); map.getPane("regionsPane").style.zIndex = 520;

  // capas (grupos)
  const regionLayer  = L.layerGroup().addTo(map);
  const zoneLayer    = L.layerGroup().addTo(map);
  const calloutLayer = L.layerGroup().addTo(map);
  const spotLayer    = L.layerGroup().addTo(map);

  // ---------- "Foco" de cobertura ----------
  // Atenúa solo la TIERRA de los demás países (el MAR y España quedan intactos),
  // para que el usuario vea de un vistazo dónde puede trabajar. La silueta de
  // España sale de geometría real (Natural Earth vía world-atlas), así que encaja
  // con las fronteras del mapa. Canarias va incluida en el polígono de España.
  map.createPane("lockPane");
  map.getPane("lockPane").style.zIndex = 250;           // sobre el satélite, bajo fronteras/pines
  map.getPane("lockPane").style.pointerEvents = "none"; // no intercepta clicks/drag

  (function loadCoverageMask() {
    const TOPO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
    const TOPOJSON_LIB = "https://cdn.jsdelivr.net/npm/topojson-client@3/dist/topojson-client.min.js";
    const SPAIN_ID = "724";   // ISO 3166-1 numérico de España (incluye Canarias)

    const ensureLib = () => new Promise((res, rej) => {
      if (window.topojson) return res();
      const s = document.createElement("script");
      s.src = TOPOJSON_LIB; s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });

    Promise.all([ensureLib(), fetch(TOPO_URL).then((r) => r.json())])
      .then(([, topo]) => {
        const fc = window.topojson.feature(topo, topo.objects.countries);
        const foreign = fc.features.filter(
          (f) => String(f.id) !== SPAIN_ID && f.properties && f.properties.name !== "Spain"
        );
        // Evita el "barrido" horizontal de países que cruzan el antimeridiano
        // (Rusia, Fiji…): hacemos cada anillo CONTINUO en longitud (sin saltos >180º).
        const unwrapRing = (ring) => {
          let prev = ring[0][0];
          for (let i = 1; i < ring.length; i++) {
            let lng = ring[i][0];
            while (lng - prev > 180) lng -= 360;
            while (lng - prev < -180) lng += 360;
            ring[i][0] = lng;
            prev = lng;
          }
        };
        const unwrapGeom = (g) => {
          if (!g) return;
          if (g.type === "Polygon") g.coordinates.forEach(unwrapRing);
          else if (g.type === "MultiPolygon") g.coordinates.forEach((p) => p.forEach(unwrapRing));
        };
        foreign.forEach((f) => unwrapGeom(f.geometry));
        L.geoJSON({ type: "FeatureCollection", features: foreign }, {
          pane: "lockPane", interactive: false,
          style: { stroke: false, fill: true, fillColor: "#05090f", fillOpacity: 0.66 }
        }).addTo(map);
      })
      .catch((e) => console.warn("[mask] cobertura no disponible:", e.message));
  })();

  // ---------- helpers de iconos ----------
  function spotIcon(spot, focused) {
    const cls = `sm-marker ${spot.icon}${focused ? " is-focused" : ""}`;
    const inner =
      spot.icon === "easter-egg"
        ? `<div class="core"></div><div class="label">${spot.name}</div>`
        : `<div class="pulse"></div><div class="core"></div><div class="label">${spot.name}</div>`;
    return L.divIcon({
      className: "",
      html: `<div class="${cls}">${inner}</div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
      pane: "spotsPane"
    });
  }

  function nodeIcon(node, labelClass) {
    return L.divIcon({
      className: "",
      html: `<div class="sm-region ${node.detailed ? "detailed" : ""}">
               <div class="ring outer"></div>
               <div class="ring"></div>
               <div class="dot"></div>
               <div class="lbl ${labelClass || ""}">${node.name}</div>
             </div>`,
      iconSize: [64, 64],
      iconAnchor: [32, 32],
      pane: "regionsPane"
    });
  }

  // ---------- accesores de jerarquía ----------
  function regionsOfContinent(cid) { return REGIONS.filter((r) => r.continent === cid); }
  function zonesOfRegion(rid) { return ZONES.filter((z) => z.region === rid); }
  function areasOfZone(zid) { return AREAS.filter((a) => a.zone === zid); }
  function spotsOfArea(aid) { return SPOTS.filter((s) => s.area === aid); }
  function spotsOfZone(zid) {
    const aids = areasOfZone(zid).map((a) => a.id);
    return SPOTS.filter((s) => aids.includes(s.area));
  }
  // todas las áreas/spots que viven en zonas con datos — para mostrar el mapa
  // completo y poder navegar entre zonas sin volver atrás
  function allMapAreas() { return AREAS.filter((a) => zoneDetailed(a.zone)); }
  function spotsForMap() {
    return SPOTS.filter((s) => {
      const a = AREAS.find((x) => x.id === s.area);
      return a && zoneDetailed(a.zone);
    });
  }
  function continentDetailed(cid) { return regionsOfContinent(cid).some((r) => r.detailed); }
  function regionDetailed(rid) { return zonesOfRegion(rid).some((z) => z.detailed); }
  function zoneDetailed(zid) { const z = ZONES.find((x) => x.id === zid); return z && z.detailed; }

  // ---------- render marcadores por nivel ----------
  function renderContinents() {
    regionLayer.clearLayers();
    CONTINENTS.forEach((c) => {
      const m = L.marker([c.lat, c.lng], { icon: nodeIcon({ name: c.name, detailed: c.detailed }), pane: "regionsPane" });
      m.on("click", () => enterContinent(c.id));
      regionLayer.addLayer(m);
    });
  }
  function renderRegionMarkers(cid) {
    regionLayer.clearLayers();
    regionsOfContinent(cid).forEach((r) => {
      const m = L.marker([r.lat, r.lng], { icon: nodeIcon(r), pane: "regionsPane" });
      m.on("click", () => enterRegion(r.id));
      regionLayer.addLayer(m);
    });
  }
  function renderZoneMarkers(rid) {
    regionLayer.clearLayers();
    // todas las zonas del mapa (no solo las de la región seleccionada),
    // para poder saltar entre regiones libremente.
    // Escalonamos las etiquetas (arriba/abajo) SOLO dentro del grupo del Cantábrico
    // (Galicia, Asturias, Cantabria, País Vasco), que es donde las zonas se amontonan.
    // El resto (Canarias, Sur España) van con la etiqueta por defecto (abajo).
    const dir = {};
    ZONES.filter((z) => z.lat > 40).sort((a, b) => a.lng - b.lng)
      .forEach((z, i) => { dir[z.id] = i % 2 === 0 ? "lbl-down" : "lbl-up"; });
    ZONES.forEach((z) => {
      const m = L.marker([z.lat, z.lng], { icon: nodeIcon(z, dir[z.id] || "lbl-down"), pane: "regionsPane" });
      m.on("click", () => enterZone(z.id));
      regionLayer.addLayer(m);
    });
  }

  // ordena los spots de un área en una polilínea limpia (vecino más cercano)
  function areaLine(areaId) {
    const pts = spotsOfArea(areaId).map((s) => ({ ll: spotLL(s) }));
    if (pts.length < 2) return pts.map((p) => p.ll);
    let start = 0;
    pts.forEach((p, i) => { if (p.ll[0] > pts[start].ll[0]) start = i; });
    const used = new Array(pts.length).fill(false);
    const order = [start]; used[start] = true;
    while (order.length < pts.length) {
      const last = pts[order[order.length - 1]].ll;
      let best = -1, bestD = Infinity;
      pts.forEach((p, i) => {
        if (used[i]) return;
        const d = (p.ll[0] - last[0]) ** 2 + (p.ll[1] - last[1]) ** 2;
        if (d < bestD) { bestD = d; best = i; }
      });
      order.push(best); used[best] = true;
    }
    return order.map((i) => pts[i].ll);
  }

  function areaCentroid(areaId) {
    const sp = spotsOfArea(areaId);
    if (!sp.length) return null;
    let la = 0, ln = 0;
    sp.forEach((s) => { const ll = spotLL(s); la += ll[0]; ln += ll[1]; });
    return [la / sp.length, ln / sp.length];
  }

  // dibuja líneas + pills de las áreas de una zona
  // dibuja líneas + pills de TODAS las áreas con datos (no solo las de una zona),
  // para que el usuario pueda navegar y saltar entre zonas desde el propio mapa
  function renderAreas() {
    zoneLayer.clearLayers();
    calloutLayer.clearLayers();

    allMapAreas().forEach((a) => {
      const color = a.color || "#3DA8FF";

      const line = areaLine(a.id);
      if (line.length > 1) {
        const glow = L.polyline(line, {
          pane: "zonesPane", color, weight: 6, opacity: 0.07, lineCap: "round", lineJoin: "round"
        }).addTo(zoneLayer);
        const core = L.polyline(line, {
          pane: "zonesPane", color, weight: 1.5, opacity: 0.5, lineCap: "round", lineJoin: "round"
        }).addTo(zoneLayer);
        glow._smZoneLine = "glow";
        core._smZoneLine = "core";
      }

      if (a.label && spotsOfArea(a.id).length) {
        const html = `
          <div class="zone-pill" data-area="${a.id}" style="--zc:${color}">
            <span class="zp-dot"></span><span class="zp-name">${a.name}</span>
          </div>`;
        const pill = L.marker([a.label.lat, a.label.lng], {
          pane: "calloutsPane",
          icon: L.divIcon({ className: "", html, iconSize: [120, 0], iconAnchor: [60, 14] })
        });
        pill.on("click", () => enterArea(a.id));
        calloutLayer.addLayer(pill);

        const anchor = areaCentroid(a.id) || a.label.anchor;
        if (anchor) {
          L.polyline([[a.label.lat, a.label.lng], anchor], {
            pane: "zonesPane", color, weight: 1, opacity: 0.35, dashArray: "3 3"
          }).addTo(zoneLayer);
        }
      }
    });
    if (typeof fadeZoneByZoom === "function") fadeZoneByZoom();
  }

  // ---------- DOCK desplegable de condiciones por área ----------
  let dockCollapsed = localStorage.getItem("sm-dock") === "1";
  let dockOpenArea = null; // área expandida en el acordeón

  function renderZoneDock() {
    const dock = document.getElementById("zone-dock");
    if (!dock) return;

    const z = ZONES.find((x) => x.id === state.zoneId);
    const show = z && z.detailed && (state.level === "area" || state.level === "spot");
    if (!show) { dock.classList.remove("visible"); dock.innerHTML = ""; return; }

    const areas = areasOfZone(state.zoneId);
    if (dockOpenArea == null && state.areaId) dockOpenArea = state.areaId;

    let html = `
      <div class="dock-head">
        <span class="dock-title">Condiciones por área</span>
        <button class="dock-toggle" id="dock-toggle">${dockCollapsed ? "▴" : "▾"}</button>
      </div>
      <div class="dock-body ${dockCollapsed ? "hidden" : ""}">`;

    areas.forEach((a) => {
      const color = a.color || "#3DA8FF";
      const c = a.conditions || {};
      const open = dockOpenArea === a.id;
      const active = state.areaId === a.id;
      const n = spotsOfArea(a.id).length;
      html += `
        <div class="dock-zone ${open ? "open" : ""} ${active ? "active" : ""}" style="--zc:${color}">
          <button class="dz-head" data-area="${a.id}">
            <span class="dz-dot"></span>
            <span class="dz-name">${a.name}</span>
            <span class="dz-n">${n}</span>
            <span class="dz-chev">${open ? "▴" : "▾"}</span>
          </button>
          <div class="dz-body">
            <div class="dz-row"><span class="k">Swell</span><span class="v">${c.swell || "—"}</span></div>
            <div class="dz-row"><span class="k">Viento</span><span class="v">${c.wind || "—"}</span></div>
            <div class="dz-row"><span class="k">Fondo</span><span class="v">${c.bottom || "—"}</span></div>
            <div class="dz-row"><span class="k">Marea</span><span class="v">${c.tide || "—"}</span></div>
            <div class="dz-summary">${c.summary || ""}</div>
            <button class="dz-enter" data-enter="${a.id}">Ver spots del área →</button>
          </div>
        </div>`;
    });
    html += `</div>`;
    dock.innerHTML = html;
    dock.classList.add("visible");

    document.getElementById("dock-toggle").addEventListener("click", () => {
      dockCollapsed = !dockCollapsed;
      localStorage.setItem("sm-dock", dockCollapsed ? "1" : "0");
      renderZoneDock();
    });
    dock.querySelectorAll(".dz-head").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.dataset.area;
        dockOpenArea = dockOpenArea === id ? null : id;
        renderZoneDock();
      })
    );
    dock.querySelectorAll(".dz-enter").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        enterArea(b.dataset.enter);
      })
    );
  }

  // ---------- render spots ----------
  function renderSpots(spots) {
    spotLayer.clearLayers();
    spots.forEach((s) => {
      const ll = spotLL(s);
      const m = L.marker(ll, {
        icon: spotIcon(s, s.id === state.spotId),
        pane: "spotsPane",
        draggable: state.calibrate,
        riseOnHover: true
      });
      m._spotId = s.id;
      m.on("click", () => { if (!state.calibrate) enterSpot(s.id); });
      if (state.calibrate) {
        m.on("dragend", (e) => {
          const p = e.target.getLatLng();
          coordOverrides[s.id] = { lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5) };
          saveCoords();
          if (state.zoneId) renderAreas(state.zoneId);
          if (typeof updateCalibList === "function") updateCalibList();
        });
      }
      spotLayer.addLayer(m);
    });
  }

  function passesFilter(s) {
    const f = state.filters;
    if (f.level) {
      const lv = s.level.toLowerCase();
      if (f.level === "beg" && !/principiante/.test(lv)) return false;
      if (f.level === "int" && !/intermedio/.test(lv)) return false;
      if (f.level === "pro" && !/(avanzado|expert|pro)/.test(lv)) return false;
    }
    if (f.wave) {
      const tags = s.tags || [];
      if (!tags.includes(f.wave)) return false;
    }
    return true;
  }

  // ---------- navegación ----------
  const LEVELS = ["world", "region", "zone", "area", "spot"];
  function setLevel(level) {
    state.level = level;
    // Reflejamos el nivel en el <body> para poder estilar según la vista
    // (p.ej. en móvil los nombres de spot solo se muestran en nivel "spot").
    document.body.setAttribute("data-level", level);
    // Posición en la escalera = entidad seleccionada más profunda.
    // España (region) es la raíz; ya no existe el nivel "mundo".
    let pos = "region";
    if (state.spotId) pos = "spot";
    else if (state.areaId) pos = "area";
    else if (state.zoneId) pos = "zone";
    document.querySelectorAll(".zoom-ladder button").forEach((b) => {
      const lv = b.dataset.level;
      b.classList.toggle("active", lv === pos);
      let enabled = true;
      if (lv === "zone" && !state.zoneId) enabled = false;
      if (lv === "area" && !state.areaId) enabled = false;
      if (lv === "spot" && !state.spotId) enabled = false;
      // "España" (region) siempre disponible
      b.disabled = !enabled;
    });
  }

  // reabrir el panel lateral si estaba oculto (al entrar en zona/spot)
  function showPanel() {
    if (!document.body.classList.contains("panel-hidden")) return;
    document.body.classList.remove("panel-hidden");
    const t = document.getElementById("panel-toggle");
    if (t) { t.textContent = "›"; t.title = "Ocultar panel"; }
    const iv = setInterval(() => map.invalidateSize({ animate: false }), 60);
    setTimeout(() => { clearInterval(iv); map.invalidateSize({ animate: false }); }, 420);
  }

  function clearOverlays() {
    zoneLayer.clearLayers(); calloutLayer.clearLayers(); spotLayer.clearLayers();
  }

  // Antes mostraba el "mundo" (continentes). Ahora la raíz es España: redirige a la región.
  function showWorld() {
    enterRegion("sur-europa");
  }

  function enterContinent(cid) {
    const c = CONTINENTS.find((x) => x.id === cid);
    if (!c) return;
    state.level = "region"; state.continentId = cid;
    state.regionId = state.zoneId = state.areaId = state.spotId = null;
    setLevel("region");
    clearOverlays();
    renderRegionMarkers(cid);
    const pts = regionsOfContinent(cid).map((r) => [r.lat, r.lng]);
    if (pts.length === 1) map.flyTo(pts[0], 5, { duration: 1.2 });
    else if (pts.length) map.flyToBounds(L.latLngBounds(pts).pad(0.6), { duration: 1.3, maxZoom: 6 });
    else map.flyTo([c.lat, c.lng], 4, { duration: 1.2 });
    dockOpenArea = null;
    renderPanel();
    renderZoneDock();
  }

  function enterRegion(rid) {
    const r = REGIONS.find((x) => x.id === rid);
    if (!r) return;
    state.level = "zone"; state.regionId = rid; state.continentId = r.continent;
    state.zoneId = state.areaId = state.spotId = null;
    setLevel("zone");
    clearOverlays();
    renderZoneMarkers(rid);
    if (r.bounds) {
      // Encuadre un punto MÁS ABIERTO (−1 zoom) para que Canarias entre con aire.
      const b = L.latLngBounds(r.bounds);
      const fitZ = map.getBoundsZoom(b, false, L.point(20, 20));
      const z = Math.max(map.getMinZoom(), Math.min(6, fitZ) - 1);
      map.flyTo(b.getCenter(), z, { duration: 1.2 });
    } else {
      const [lat, lng, z] = r.zoomTo;
      map.flyTo([lat, lng], z, { duration: 1.3 });
    }
    dockOpenArea = null;
    renderPanel();
    renderZoneDock();
  }

  function enterZone(zid) {
    const z = ZONES.find((x) => x.id === zid);
    if (!z) return;
    showPanel();
    state.level = "area"; state.zoneId = zid; state.regionId = z.region;
    state.areaId = state.spotId = null;
    const r = REGIONS.find((x) => x.id === z.region);
    state.continentId = r ? r.continent : state.continentId;
    setLevel("area");
    regionLayer.clearLayers();

    // siempre dibujamos todas las áreas y spots del mapa (aunque la zona elegida
    // esté "próximamente"), para poder seguir navegando hacia otras zonas
    renderAreas();
    renderSpots(spotsForMap().filter(passesFilter));

    const [lat, lng, zoom] = z.zoomTo || [z.lat, z.lng, 9];
    map.flyTo([lat, lng], zoom, { duration: 1.3 });
    dockOpenArea = null;
    renderPanel();
    renderZoneDock();
  }

  function enterArea(aid) {
    const a = AREAS.find((x) => x.id === aid);
    if (!a) return;
    showPanel();
    state.level = "area"; state.areaId = aid; state.zoneId = a.zone; state.spotId = null;
    const z = ZONES.find((x) => x.id === a.zone);
    state.regionId = z ? z.region : state.regionId;
    const r = REGIONS.find((x) => x.id === state.regionId);
    state.continentId = r ? r.continent : state.continentId;
    setLevel("area");

    renderAreas();
    renderSpots(spotsForMap().filter(passesFilter));
    const pts = spotsOfArea(aid).map((s) => spotLL(s));
    if (pts.length) map.flyToBounds(L.latLngBounds(pts).pad(0.45), { duration: 1.2, maxZoom: 14 });
    dockOpenArea = aid;
    renderPanel();
    renderZoneDock();
  }

  function enterSpot(spotId) {
    const s = SPOTS.find((x) => x.id === spotId);
    if (!s) return;
    showPanel();
    state.level = "spot"; state.spotId = spotId; state.areaId = s.area;
    const a = AREAS.find((x) => x.id === s.area);
    state.zoneId = a ? a.zone : state.zoneId;
    const z = ZONES.find((x) => x.id === state.zoneId);
    state.regionId = z ? z.region : state.regionId;
    const r = REGIONS.find((x) => x.id === state.regionId);
    state.continentId = r ? r.continent : state.continentId;
    setLevel("spot");

    renderAreas();
    renderSpots(spotsForMap().filter((sp) => passesFilter(sp) || sp.id === spotId));
    map.flyTo(spotLL(s), 15.5, { duration: 1.2 });
    dockOpenArea = s.area;
    renderPanel();
    renderZoneDock();
  }

  // exponer para search/panel
  window.SM = { showWorld, enterContinent, enterRegion, enterZone, enterArea, enterSpot, state };

  // ---------- PANEL ----------
  const panelBody  = document.getElementById("panel-body");
  const breadcrumb = document.getElementById("breadcrumb");

  function renderBreadcrumb() {
    if (!breadcrumb) return;
    const parts = [];
    if (state.regionId) {
      const r = REGIONS.find((x) => x.id === state.regionId);
      parts.push(`<span class="crumb ${state.level==="zone"?"current":""}" data-nav="region">${r.name}</span>`);
    }
    if (state.zoneId) {
      const z = ZONES.find((x) => x.id === state.zoneId);
      parts.push(`<span class="sep">/</span><span class="crumb ${state.level==="area"&&!state.areaId?"current":""}" data-nav="zone">${z.name}</span>`);
    }
    if (state.areaId) {
      const a = AREAS.find((x) => x.id === state.areaId);
      parts.push(`<span class="sep">/</span><span class="crumb ${state.level==="area"?"current":""}" data-nav="area">${a.name}</span>`);
    }
    if (state.spotId) {
      const s = SPOTS.find((x) => x.id === state.spotId);
      parts.push(`<span class="sep">/</span><span class="crumb current">${s.name}</span>`);
    }
    breadcrumb.innerHTML = parts.join("");
    breadcrumb.querySelectorAll(".crumb").forEach((c) => {
      c.addEventListener("click", () => {
        const nav = c.dataset.nav;
        if (nav === "world") showWorld();
        else if (nav === "continent") enterContinent(state.continentId);
        else if (nav === "region") enterRegion(state.regionId);
        else if (nav === "zone") enterZone(state.zoneId);
        else if (nav === "area") enterArea(state.areaId);
      });
    });
  }

  function iconDot(icon) {
    if (icon === "easter-egg") return `<span class="icon easter-egg"></span>`;
    return `<span class="icon ${icon}"></span>`;
  }

  // Fotos disponibles de un spot (solo las que existen). Las fotos del proyecto
  // (window.SURFMACH_PHOTOS) más cualquier foto del usuario guardada previamente;
  // ya no se pueden subir nuevas, solo se muestran y se abren a pantalla completa.
  function getSpotPhotos(spotId) {
    const slots = [
      { slot: "main", label: "Principal" },
      { slot: "lineup", label: "Lineup" },
      { slot: "drone", label: "Drone" },
    ];
    const userPhotos = photos[spotId] || {};
    const projPhotos = (window.SURFMACH_PHOTOS && window.SURFMACH_PHOTOS[spotId]) || {};
    const out = [];
    slots.forEach(({ slot, label }) => {
      const p = userPhotos[slot] || projPhotos[slot];
      if (p) out.push({ src: p, label });
    });
    return out;
  }

  // Lightbox: visor de fotos a pantalla completa. Se crea una sola vez y se reutiliza.
  let lbState = { pics: [], idx: 0 };
  function ensureLightbox() {
    let lb = document.getElementById("sm-lightbox");
    if (lb) return lb;
    lb = document.createElement("div");
    lb.id = "sm-lightbox";
    lb.className = "lightbox";
    lb.innerHTML = `
      <button class="lb-close" aria-label="Cerrar">✕</button>
      <button class="lb-nav lb-prev" aria-label="Anterior">‹</button>
      <figure class="lb-figure">
        <img class="lb-img" alt="">
        <figcaption class="lb-cap"></figcaption>
      </figure>
      <button class="lb-nav lb-next" aria-label="Siguiente">›</button>`;
    document.body.appendChild(lb);
    const close = () => closeLightbox();
    lb.querySelector(".lb-close").addEventListener("click", close);
    lb.querySelector(".lb-prev").addEventListener("click", (e) => { e.stopPropagation(); stepLightbox(-1); });
    lb.querySelector(".lb-next").addEventListener("click", (e) => { e.stopPropagation(); stepLightbox(1); });
    // click en el fondo (no en la imagen) cierra
    lb.addEventListener("click", (e) => { if (e.target === lb || e.target.classList.contains("lb-figure")) close(); });
    document.addEventListener("keydown", (e) => {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") stepLightbox(-1);
      else if (e.key === "ArrowRight") stepLightbox(1);
    });
    return lb;
  }
  function renderLightbox() {
    const lb = ensureLightbox();
    const pic = lbState.pics[lbState.idx];
    if (!pic) return;
    lb.querySelector(".lb-img").src = pic.src;
    lb.querySelector(".lb-cap").textContent = pic.label || "";
    const multi = lbState.pics.length > 1;
    lb.querySelector(".lb-prev").style.display = multi ? "" : "none";
    lb.querySelector(".lb-next").style.display = multi ? "" : "none";
  }
  function openLightbox(pics, idx) {
    if (!pics || !pics.length) return;
    lbState = { pics, idx: idx || 0 };
    const lb = ensureLightbox();
    renderLightbox();
    lb.classList.add("open");
    document.body.classList.add("lb-lock");
  }
  function stepLightbox(dir) {
    const n = lbState.pics.length;
    if (!n) return;
    lbState.idx = (lbState.idx + dir + n) % n;
    renderLightbox();
  }
  function closeLightbox() {
    const lb = document.getElementById("sm-lightbox");
    if (lb) lb.classList.remove("open");
    document.body.classList.remove("lb-lock");
  }

  function levelBadgeClass(level) {
    const lv = level.toLowerCase();
    if (/principiante/.test(lv)) return "level-beg";
    if (/(avanzado|expert|pro)/.test(lv)) return "level-pro";
    return "level-int";
  }

  // genera un mini-forecast mockeado pero coherente con el spot
  function mockForecast(spot) {
    const days = ["HOY", "JUE", "VIE", "SÁB", "DOM"];
    // semilla por id para que sea estable
    let seed = 0; for (const c of spot.id) seed += c.charCodeAt(0);
    const rnd = (i) => {
      const x = Math.sin(seed * 9.21 + i * 4.13) * 10000;
      return x - Math.floor(x);
    };
    const cells = days.map((d, i) => {
      const h = (0.6 + rnd(i) * 2.4).toFixed(1);
      const t = Math.round(8 + rnd(i + 10) * 9);
      const windDir = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.floor(rnd(i + 20) * 8)];
      const windKt = Math.round(5 + rnd(i + 30) * 20);
      return { d, h, t, windDir, windKt, now: i === 0 };
    });
    return cells;
  }

  function renderPanel() {
    // Al re-renderizar el panel (cambiar de spot, nivel, favoritos…) destruimos
    // cualquier parte de Windguru activo: solo puede haber uno cargado a la vez.
    clearWindguru();
    clearWebcam();
    renderBreadcrumb();
    if (state.calibrate) { renderCalibPanel(); return; }
    let html = "";

    if (state.level === "world") {
      const totalSpots = SPOTS.length;
      const detailedConts = CONTINENTS.filter((c) => c.detailed).length;
      html += `
        <div class="intro">
          <div class="t">Global Surf Reference</div>
          <div class="d">Navega el oc\u00e9ano por niveles: continente \u2192 regi\u00f3n \u2192 zona \u2192 \u00e1rea \u2192 spot. Coordenadas reales y verificadas para usar como referencia antes de viajar.</div>
          <div class="stats">
            <div class="cell"><div class="n">${CONTINENTS.length}</div><div class="l">Continentes</div></div>
            <div class="cell"><div class="n">${detailedConts}</div><div class="l">Con datos</div></div>
            <div class="cell"><div class="n">${totalSpots}</div><div class="l">Spots</div></div>
          </div>
        </div>`;
      html += `<div class="section-title">Continentes <span class="count">${CONTINENTS.length}</span></div>`;
      CONTINENTS.slice().sort((a,b)=> (b.detailed?1:0)-(a.detailed?1:0)).forEach((c) => {
        const nReg = regionsOfContinent(c.id).length;
        html += `
          <div class="region-card ${c.detailed ? "detailed" : ""}" data-cont="${c.id}">
            <div class="name">${c.name}</div>
            <div class="headline">${c.headline}</div>
            <div class="meta">
              <span><b>${nReg}</b> ${nReg===1?"regi\u00f3n":"regiones"}</span>
              <span>${c.detailed ? "Disponible" : "Pr\u00f3ximamente"}</span>
            </div>
          </div>`;
      });
      panelBody.innerHTML = html;
      panelBody.querySelectorAll(".region-card").forEach((c) =>
        c.addEventListener("click", () => enterContinent(c.dataset.cont))
      );
      return;
    }

    if (state.level === "region") {
      const cont = CONTINENTS.find((x) => x.id === state.continentId);
      const regs = regionsOfContinent(state.continentId);
      if (!cont || !cont.detailed || !regs.length) {
        html += `<div class="empty">CONTINENTE EN PREPARACI\u00d3N
          <div class="hint">${cont ? cont.name : ""} estar\u00e1 disponible pr\u00f3ximamente.</div></div>`;
        panelBody.innerHTML = html;
        return;
      }
      html += `<div class="intro"><div class="t">${cont.name}</div><div class="d">${cont.description}</div></div>`;
      html += `<div class="section-title">Regiones <span class="count">${regs.length}</span></div>`;
      regs.forEach((r) => {
        const nz = zonesOfRegion(r.id).length;
        html += `
          <div class="region-card ${r.detailed ? "detailed" : ""}" data-region="${r.id}">
            <div class="name">${r.name}</div>
            <div class="headline">${r.headline}</div>
            <div class="meta"><span><b>${nz}</b> zonas</span><span>${r.detailed?"Disponible":"Pr\u00f3ximamente"}</span></div>
          </div>`;
      });
      panelBody.innerHTML = html;
      panelBody.querySelectorAll(".region-card").forEach((c) =>
        c.addEventListener("click", () => enterRegion(c.dataset.region))
      );
      return;
    }

    if (state.level === "zone") {
      const reg = REGIONS.find((x) => x.id === state.regionId);
      const zs = zonesOfRegion(state.regionId);
      html += `<div class="intro"><div class="t">${reg.name}</div><div class="d">${reg.description}</div></div>`;
      html += `<div class="section-title">Zonas <span class="count">${zs.length}</span></div>`;
      zs.forEach((z) => {
        const n = spotsOfZone(z.id).length;
        html += `
          <div class="region-card ${z.detailed ? "detailed" : ""}" data-zone="${z.id}">
            <div class="name">${z.name}</div>
            <div class="headline">${z.headline || ""}</div>
            <div class="meta"><span><b>${n}</b> spots</span><span>${z.detailed?"Disponible":"Pr\u00f3ximamente"}</span></div>
          </div>`;
      });
      panelBody.innerHTML = html;
      panelBody.querySelectorAll(".region-card").forEach((c) =>
        c.addEventListener("click", () => enterZone(c.dataset.zone))
      );
      return;
    }

    if (state.level === "area") {
      const z = ZONES.find((x) => x.id === state.zoneId);
      if (!z || !z.detailed) {
        html += `<div class="empty">ZONA EN PREPARACI\u00d3N
          <div class="hint">${z ? z.name : ""} estar\u00e1 disponible pr\u00f3ximamente.</div></div>`;
        panelBody.innerHTML = html;
        return;
      }

      // área seleccionada → lista de spots
      if (state.areaId) {
        const a = AREAS.find((x) => x.id === state.areaId);
        const color = a.color || "#3DA8FF";
        const c = a.conditions || {};
        const spots = spotsOfArea(a.id);
        html += `
          <div class="intro" style="border-left:3px solid ${color}">
            <div class="t">${a.name}</div>
            <div class="d">${c.summary || ""}</div>
            <div class="stats">
              <div class="cell"><div class="n" style="color:${color}">${spots.length}</div><div class="l">Spots</div></div>
              <div class="cell"><div class="n">${spots.filter(s=>s.icon==="consistent").length}</div><div class="l">Consist.</div></div>
              <div class="cell"><div class="n">${spots.filter(s=>s.icon==="easter-egg").length}</div><div class="l">Top spots</div></div>
            </div>
          </div>`;
        html += `<div class="section-title">Picos <span class="count">${spots.length}</span></div>`;
        spots.forEach((s) => {
          const fav = state.favorites.has(s.id) ? "favorited" : "";
          const camBadge = webcamFor(s)
            ? `<span class="cam-badge" title="Este spot tiene webcam en directo"><span class="cb-dot"></span>CAM</span>`
            : "";
          html += `
            <div class="spot-row ${fav}" data-spot="${s.id}">
              <div class="icon-wrap">${iconDot(s.icon)}</div>
              <div>
                <div class="name">${s.name}${camBadge}</div>
                <div class="coords">${spotLL(s)[0].toFixed(4)}, ${spotLL(s)[1].toFixed(4)}</div>
              </div>
              <div class="coords">${(s.tags||[]).includes("world-class") ? "★ CLASE MUNDIAL" : s.level.split(" ")[0].toUpperCase()}</div>
            </div>`;
        });
        panelBody.innerHTML = html;
        panelBody.querySelectorAll(".spot-row").forEach((row) =>
          row.addEventListener("click", () => enterSpot(row.dataset.spot))
        );
        return;
      }

      // sin área seleccionada → tarjetas de áreas
      const areas = areasOfZone(z.id);
      html += `<div class="intro"><div class="t">${z.name}</div><div class="d">${z.description || ""}</div></div>`;
      html += `<div class="section-title">\u00c1reas <span class="count">${areas.length}</span></div>`;
      areas.forEach((a) => {
        const color = a.color || "#3DA8FF";
        const c = a.conditions || {};
        const n = spotsOfArea(a.id).length;
        html += `
          <div class="zone-card" data-area="${a.id}">
            <div class="stripe" style="background:${color}"></div>
            <div class="body">
              <div class="name">${a.name}</div>
              <div class="summary">${c.summary || ""}</div>
              <div class="kv">
                <span class="k">Swell</span><span class="v">${c.swell||"—"}</span>
                <span class="k">Viento</span><span class="v">${c.wind||"—"}</span>
                <span class="k">Fondo</span><span class="v">${c.bottom||"—"}</span>
              </div>
              <div class="footer"><span>${c.season||""}</span><span><b>${n}</b> spots</span></div>
            </div>
          </div>`;
      });
      panelBody.innerHTML = html;
      panelBody.querySelectorAll(".zone-card").forEach((c) =>
        c.addEventListener("click", () => enterArea(c.dataset.area))
      );
      return;
    }

    if (state.level === "spot") {
      const s = SPOTS.find((x) => x.id === state.spotId);
      const a = AREAS.find((x) => x.id === s.area);
      const isFav = state.favorites.has(s.id);

      html += `
        <div class="spot-header">
          <h2 class="name">${s.name}</h2>
          <div class="sub">
            <span>${a ? a.name : ""}</span><span class="dot"></span>
            <span>${spotLL(s)[0].toFixed(4)}, ${spotLL(s)[1].toFixed(4)}</span>
            ${(s.tags||[]).includes("world-class") ? '<span class="dot"></span><span style="color:#ffcf4a">★ CLASE MUNDIAL</span>' : ""}
          </div>
          <div class="actions">
            <button class="btn fav ${isFav ? "active" : ""}" id="fav-btn">
              ${isFav ? "★ GUARDADO" : "☆ GUARDAR"}
            </button>
            <button class="btn" id="center-btn">⊕ CENTRAR</button>
            <button class="btn" id="edit-btn">✎ EDITAR</button>
            ${s.custom ? '<button class="btn danger" id="delspot-btn">✕ ELIMINAR</button>' : ""}
          </div>
        </div>`;

      // notas / descripción general — por encima de las fotos
      if (s.notes && s.notes.trim()) {
        html += `<div class="notes notes-top">${s.notes}</div>`;
      }

      // galería de fotos del spot (solo lectura, click → pantalla completa).
      // Solo se muestran las fotos que existen; si no hay ninguna, no se pinta nada.
      const pics = getSpotPhotos(s.id);
      if (pics.length) {
        html += `
        <div class="gallery-wrap">
          <div class="gallery" id="gallery-strip">
            ${pics.map((pic, i) => `
              <button class="img filled${i === 0 ? " main" : ""}" data-idx="${i}" style="background-image:url('${pic.src}')" title="Ver a pantalla completa">
                <span class="img-tag">${pic.label}</span>
              </button>`).join("")}
          </div>
          ${pics.length > 1 ? `<button class="gallery-nav" id="gallery-next" title="Siguiente foto" aria-label="Siguiente foto">›</button>` : ""}
        </div>`;
      }

      // webcam en directo (solo spots con cámara configurada).
      // Carga perezosa: el iframe solo se inyecta al pulsar el botón.
      const cam = webcamFor(s);
      if (cam) {
        // YouTube se incrusta de forma fiable; otros proveedores (type "iframe")
        // pueden bloquear la incrustación, así que dejamos el enlace siempre visible.
        // type "link": la cámara no se puede incrustar → botón que abre la emisión
        // oficial en una pestaña nueva (sin visor embebido).
        const isYt = cam.type === "youtube";
        const isLink = cam.type === "link";
        if (isLink) {
          html += `
        <div class="webcam-card" id="webcam-card">
          <div class="head">
            <span class="lbl">Webcam en directo</span>
            <span class="cam-live"><span class="cd"></span>EN VIVO</span>
          </div>
          <a class="webcam-load-btn" id="cam-link" href="${webcamWatchUrl(cam)}" target="_blank" rel="noopener">▶ Ver cámara en directo ↗</a>
          <span class="cam-cta-note" id="cam-cta-note">${cam.label} · se abre en una pestaña nueva</span>
        </div>`;
        } else {
        html += `
        <div class="webcam-card" id="webcam-card">
          <div class="head">
            <span class="lbl">Webcam en directo</span>
            <button class="cam-fs-btn" id="cam-fs" hidden title="Ver a pantalla completa" aria-label="Ver a pantalla completa">⛶ Pantalla completa</button>
            <span class="cam-live"><span class="cd"></span>EN VIVO</span>
          </div>
          <button class="webcam-load-btn" id="cam-load">▶ Ver cámara en directo</button>
          <span class="cam-cta-note" id="cam-cta-note">${cam.label} · se carga al pulsar</span>
          <div class="webcam-frame" id="cam-frame" hidden></div>
          <a class="cam-fallback" id="cam-fallback" href="${webcamWatchUrl(cam)}" target="_blank" rel="noopener"${isYt ? " hidden" : ""}>${isYt ? "¿No se ve la cámara? Ábrela en YouTube ↗" : "Abrir la cámara en la web del proveedor ↗"}</a>
        </div>`;
        }
      }

      // pronóstico (olas + viento + mareas): desplegable bajo la webcam.
      // Piloto (Surfedex) en spots seleccionados; resto Windguru. Las mareas
      // (Open-Meteo) van OCULTAS dentro del propio desplegable.
      const useSFC = window.SurfedexForecast && window.SurfedexForecast.usesPilot(s.id);
      const wgId = wgIdFor(s);
      const dualSrc = !!(useSFC && wgId);   // Surfedex + Windguru → conmutador de fuente
      const hasForecast = !!(useSFC || wgId);
      const fcCta = useSFC ? "Previsi\u00f3n Surfedex + mareas \u00b7 se carga al pulsar"
                  : wgId ? "Olas y viento (Windguru) + mareas \u00b7 se carga al pulsar"
                  : "Nivel del mar / mareas (Open-Meteo) \u00b7 se carga al pulsar";
      const wgPaneHTML = `
            <div class="wg-tbl">
              <div class="wg-sub">Olas · periodo · direcci\u00f3n <em>· Windguru</em></div>
              <div class="wg-anchor" id="wg-olas"></div>
            </div>
            <div class="wg-tbl">
              <div class="wg-sub">Viento · temperatura <em>· Windguru</em></div>
              <div class="wg-anchor" id="wg-viento"></div>
            </div>`;
      const sfcPaneHTML = `<div class="sfc" id="sfc-mount"><div class="sfc-loading">Cargando previsi\u00f3n\u2026</div></div>`;
      let fcInner;
      if (useSFC && wgId) {
        // dos paneles superpuestos; el conmutador del encabezado decide cuál se ve
        fcInner = `<div class="fc-pane" data-pane="sfc">${sfcPaneHTML}</div>
                   <div class="fc-pane" data-pane="wg" hidden>${wgPaneHTML}</div>`;
      } else if (useSFC) {
        fcInner = sfcPaneHTML;
      } else if (wgId) {
        fcInner = wgPaneHTML;
      } else {
        fcInner = `
            <div class="wg-na">
              <span class="t">Pron\u00f3stico de Windguru no disponible</span>
              <span class="d">Este spot no tiene punto de Windguru vinculado. Usa ✎ Editar para a\u00f1adirlo.</span>
            </div>`;
      }
      const srcToggle = dualSrc
        ? `<div class="fc-src" id="fc-src" role="tablist">
             <button type="button" class="fc-src-btn active" data-src="sfc" role="tab">Surfedex</button>
             <button type="button" class="fc-src-btn" data-src="wg" role="tab">Windguru</button>
           </div>`
        : (useSFC ? '<span class="sfc-tag">Surfedex</span>' : "");
      html += `<div class="forecast wg-card${hasForecast ? "" : " wg-empty"}">
          <div class="head"><span class="lbl">Pron\u00f3stico</span>${srcToggle}</div>
          <button class="wg-load-btn" id="fc-load">▶ ${hasForecast ? "Ver previsi\u00f3n de olas, viento y mareas" : "Ver mareas y nivel del mar"}</button>
          <span class="wg-cta-note" id="fc-note">${fcCta}</span>
          <div class="fc-body" id="fc-body" hidden>
            ${fcInner}
            <div class="wg-tbl tide-block">
              <div class="wg-sub">Marea · nivel del mar (MSL) <em>· Open-Meteo</em></div>
              <div class="tide-mount" id="tide-mount"></div>
            </div>
          </div>
        </div>`;

      // badges
      const lvClass = levelBadgeClass(s.level);
      const crowdClass = /alto|muy alto/i.test(s.crowd) ? "crowd-high" : "";
      html += `<div class="badges">
        <span class="badge ${lvClass}"><span class="k">NIVEL</span>${s.level}</span>
        <span class="badge ${crowdClass}"><span class="k">GENTE</span>${s.crowd}</span>
      </div>`;

      // datasheet
      html += `
        <div class="datasheet">
          <div class="row"><div class="k">Tipo de ola</div><div class="v">${s.wave}</div></div>
          <div class="row"><div class="k">Fondo</div><div class="v">${s.bottom}</div></div>
          <div class="row"><div class="k">Swell ideal</div><div class="v">${s.swell}</div></div>
          <div class="row"><div class="k">Viento</div><div class="v">${s.wind}</div></div>
          <div class="row"><div class="k">Marea</div><div class="v">${s.tide}</div></div>
          <div class="row"><div class="k">Temporada</div><div class="v">${s.season}</div></div>
        </div>`;

      // peligros — SIEMPRE por encima del pronóstico
      html += `
        <div class="hazards">
          <span class="lbl">Peligros</span>
          <span class="text">${s.hazards}</span>
        </div>`;

      panelBody.innerHTML = html;

      // Previsión: desplegable ÚNICO (olas + viento + mareas). Nada se carga
      // hasta pulsar; al cerrar se restablece para poder recargar limpio
      // (Windguru solo admite un widget activo a la vez).
      {
        const fcLoad = document.getElementById("fc-load");
        const fcBody = document.getElementById("fc-body");
        const fcNote = document.getElementById("fc-note");
        const fcSrc  = document.getElementById("fc-src");
        const fcTpl  = fcBody.innerHTML;   // estado limpio para poder recargar
        const lblClosed = "▶ " + (hasForecast ? "Ver previsi\u00f3n de olas, viento y mareas" : "Ver mareas y nivel del mar");
        const lblOpen   = "Cerrar " + (hasForecast ? "previsi\u00f3n" : "mareas");
        let fcOpen = false;
        let curSrc = "sfc";        // fuente activa cuando hay conmutador (por defecto: Surfedex)
        let sfcMounted = false;

        function setSrcActive(src) {
          if (!fcSrc) return;
          fcSrc.querySelectorAll(".fc-src-btn").forEach((b) =>
            b.classList.toggle("active", b.dataset.src === src));
        }

        function mountWg() {
          mountWindguru(wgId, 25, "HTSGW,PERPW,DIRPW", fcBody.querySelector("#wg-olas"));
          mountWindguru(wgId, 3, "WINDSPD,GUST,SMER,TMPE", fcBody.querySelector("#wg-viento"));
        }

        // Conmuta entre paneles (solo caso dual Surfedex + Windguru).
        function showSource(src) {
          curSrc = src;
          setSrcActive(src);
          const sfcPane = fcBody.querySelector('[data-pane="sfc"]');
          const wgPane  = fcBody.querySelector('[data-pane="wg"]');
          if (sfcPane) sfcPane.hidden = src !== "sfc";
          if (wgPane)  wgPane.hidden  = src !== "wg";
          clearWindguru();                  // 1 widget de Windguru máx.
          if (src === "sfc") {
            if (!sfcMounted) {
              window.SurfedexForecast.mount(s, fcBody.querySelector("#sfc-mount"));
              sfcMounted = true;
            }
          } else {
            mountWg();
          }
        }

        function setOpen(open) {
          fcOpen = open;
          if (open) {
            fcBody.hidden = false;
            fcLoad.textContent = lblOpen;
            fcLoad.classList.add("is-open");
            if (fcNote) fcNote.hidden = true;
            if (dualSrc) {
              showSource(curSrc);
            } else if (useSFC) {
              clearWindguru();
              window.SurfedexForecast.mount(s, fcBody.querySelector("#sfc-mount"));
            } else if (wgId) {
              clearWindguru();
              mountWg();
            } else {
              clearWindguru();
            }
            // mareas (Open-Meteo) — siempre, ocultas dentro del desplegable
            mountTide(s, fcBody.querySelector("#tide-mount"));
          } else {
            fcBody.hidden = true;
            clearWindguru();
            fcBody.innerHTML = fcTpl;        // restaura anclajes/mounts limpios
            sfcMounted = false;
            curSrc = "sfc";
            setSrcActive("sfc");
            fcLoad.textContent = lblClosed;
            fcLoad.classList.remove("is-open");
            if (fcNote) fcNote.hidden = false;
          }
        }

        fcLoad.addEventListener("click", () => setOpen(!fcOpen));

        // Conmutador de fuente: abre el desplegable si está cerrado; si no, cambia de panel.
        if (fcSrc) {
          fcSrc.querySelectorAll(".fc-src-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
              const src = btn.dataset.src;
              if (!fcOpen) { curSrc = src; setOpen(true); }
              else if (src !== curSrc) { showSource(src); }
            });
          });
        }
      }

      document.getElementById("fav-btn").addEventListener("click", () => {
        if (state.favorites.has(s.id)) state.favorites.delete(s.id);
        else state.favorites.add(s.id);
        saveFavs();
        renderPanel();
        // refrescar markers para mostrar estrella favorita en lista
      });
      document.getElementById("center-btn").addEventListener("click", () => {
        map.flyTo(spotLL(s), 16, { duration: 1 });
      });
      document.getElementById("edit-btn").addEventListener("click", () => {
        const ll = spotLL(s);
        openSpotForm(ll[0], ll[1], s);
      });

      // galería: click en una foto → abrir a pantalla completa (lightbox)
      const galleryPics = getSpotPhotos(s.id);
      panelBody.querySelectorAll(".gallery .img").forEach((tile) => {
        tile.addEventListener("click", () => {
          const idx = parseInt(tile.dataset.idx, 10) || 0;
          openLightbox(galleryPics, idx);
        });
      });

      // flecha del carrusel: avanza una foto y vuelve al principio al llegar al final
      const strip = document.getElementById("gallery-strip");
      const nextBtn = document.getElementById("gallery-next");
      if (strip && nextBtn) {
        nextBtn.addEventListener("click", () => {
          const card = strip.querySelector(".img");
          const step = card ? card.offsetWidth + 6 : strip.clientWidth;
          const atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 8;
          strip.scrollTo({ left: atEnd ? 0 : strip.scrollLeft + step, behavior: "smooth" });
        });
      }

      // webcam en directo: el iframe solo se inyecta al pulsar (carga perezosa).
      // Las cámaras type "link" no tienen visor embebido (su botón es un enlace).
      const camCfg = webcamFor(s);
      if (camCfg && camCfg.type !== "link") {
        const camBtn = document.getElementById("cam-load");
        const camFrame = document.getElementById("cam-frame");
        const camNote = document.getElementById("cam-cta-note");
        const camFallback = document.getElementById("cam-fallback");
        const camFs = document.getElementById("cam-fs");
        let camOpen = false;
        camBtn.addEventListener("click", () => {
          camOpen = !camOpen;
          clearWebcam();
          if (camOpen) {
            camFrame.hidden = false;
            const ifr = document.createElement("iframe");
            ifr.setAttribute("data-webcam", "1");
            ifr.src = webcamSrc(camCfg);
            ifr.title = "Webcam " + (camCfg.label || s.name);
            ifr.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
            ifr.allowFullscreen = true;
            ifr.frameBorder = "0";
            ifr.referrerPolicy = "strict-origin-when-cross-origin";
            camFrame.appendChild(ifr);
            camBtn.textContent = "✕ Cerrar cámara";
            camBtn.classList.add("is-open");
            if (camNote) camNote.hidden = true;
            if (camFallback) camFallback.hidden = false;
            if (camFs) camFs.hidden = false;
          } else {
            camFrame.hidden = true;
            camFrame.innerHTML = "";
            camBtn.textContent = "▶ Ver cámara en directo";
            camBtn.classList.remove("is-open");
            if (camNote) camNote.hidden = false;
            // el enlace queda visible para proveedores que no son YouTube
            if (camFallback) camFallback.hidden = (camCfg.type === "youtube");
            if (camFs) camFs.hidden = true;
          }
        });
        // Pantalla completa: usamos un modo "maximizado" propio por CSS que cubre
        // toda la ventana, ajusta el vídeo a los márgenes (16:9, letterbox) y deja
        // un botón de salida siempre visible. Es consistente en cualquier entorno
        // (la API nativa daba "zoom" y ocultaba los controles dentro del iframe).
        function setMaximized(on) {
          camFrame.classList.toggle("cam-max", on);
          document.body.classList.toggle("cam-max-lock", on);
          if (camFs) camFs.textContent = on ? "⤡ Salir" : "⛶ Pantalla completa";
          // botón flotante de salida (la cabecera queda oculta tras el visor)
          let exitBtn = camFrame.querySelector(".cam-max-exit");
          if (on && !exitBtn) {
            exitBtn = document.createElement("button");
            exitBtn.className = "cam-max-exit";
            exitBtn.type = "button";
            exitBtn.title = "Salir de pantalla completa (Esc)";
            exitBtn.innerHTML = "✕ Salir de pantalla completa";
            exitBtn.addEventListener("click", () => setMaximized(false));
            camFrame.appendChild(exitBtn);
          } else if (!on && exitBtn) {
            exitBtn.remove();
          }
        }
        if (camFs) camFs.addEventListener("click", () => {
          setMaximized(!camFrame.classList.contains("cam-max"));
        });
        // Esc cierra el modo maximizado
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape" && camFrame.classList.contains("cam-max")) setMaximized(false);
        });
      }

      // eliminar spot propio
      const delBtn = document.getElementById("delspot-btn");
      if (delBtn) delBtn.addEventListener("click", () => {
        if (!confirm(`¿Eliminar el spot "${s.name}"? Esta acción solo afecta a tus spots añadidos.`)) return;
        const i = customSpots.findIndex((x) => x.id === s.id);
        if (i >= 0) customSpots.splice(i, 1);
        const j = SPOTS.findIndex((x) => x.id === s.id);
        if (j >= 0) SPOTS.splice(j, 1);
        saveCustomSpots();
        if (state.areaId) enterArea(state.areaId);
        else if (state.zoneId) enterZone(state.zoneId);
        else showWorld();
      });
      return;
    }
  }

  // ---------- SEARCH ----------
  const searchInput   = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const searchClear   = document.getElementById("search-clear");

  function runSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) { searchResults.innerHTML = ""; return; }
    const hits = [];
    ZONES.forEach((z) => {
      if (z.name.toLowerCase().includes(q)) hits.push({ type: "zona", name: z.name, id: z.id, kind: "zone" });
    });
    SPOTS.forEach((s) => {
      if (s.name.toLowerCase().includes(q) || (s.tags||[]).some(t=>t.includes(q))) {
        const a = AREAS.find((x) => x.id === s.area);
        hits.push({ type: a ? a.name : "spot", name: s.name, id: s.id, kind: "spot", icon: s.icon });
      }
    });
    searchResults.innerHTML = hits.slice(0, 12).map((h) => `
      <div class="hit" data-kind="${h.kind}" data-id="${h.id}">
        ${h.kind === "spot" ? iconDot(h.icon) : '<span class="icon" style="background:var(--good)"></span>'}
        <span class="name">${h.name}</span>
        <span class="meta">${h.type}</span>
      </div>`).join("");
    searchResults.querySelectorAll(".hit").forEach((hit) => {
      hit.addEventListener("click", () => {
        if (hit.dataset.kind === "zone") enterZone(hit.dataset.id);
        else enterSpot(hit.dataset.id);
        searchInput.value = "";
        searchResults.innerHTML = "";
      });
    });
  }

  searchInput.addEventListener("input", (e) => runSearch(e.target.value));
  searchClear.addEventListener("click", () => { searchInput.value = ""; searchResults.innerHTML = ""; searchInput.focus(); });

  // ---------- FILTERS ----------
  document.querySelectorAll(".filter-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const type = chip.dataset.ftype;
      const val = chip.dataset.fval;
      // toggle exclusivo por tipo
      const same = state.filters[type] === val;
      document.querySelectorAll(`.filter-chip[data-ftype="${type}"]`).forEach((c) => c.classList.remove("active"));
      if (same) { state.filters[type] = null; }
      else { state.filters[type] = val; chip.classList.add("active"); }
      // re-render spots de la vista actual
      if (state.level === "area") {
        renderSpots(spotsForMap().filter(passesFilter));
        renderPanel();
      } else if (state.level === "spot") {
        renderSpots(spotsForMap().filter((sp)=>passesFilter(sp)||sp.id===state.spotId));
      }
    });
  });

  // ---------- ZOOM LADDER ----------
  document.querySelectorAll(".zoom-ladder button").forEach((b) => {
    b.addEventListener("click", () => {
      const lv = b.dataset.level;
      if (b.disabled) return;
      if (lv === "region") enterRegion("sur-europa");
      else if (lv === "zone" && state.zoneId) enterZone(state.zoneId);
      else if (lv === "area" && state.areaId) enterArea(state.areaId);
      else if (lv === "spot" && state.spotId) enterSpot(state.spotId);
    });
  });

  // ---------- BASE LAYER + CALIBRACIÓN ----------
  function refreshSpots() {
    if (state.level === "area" || state.level === "spot") {
      renderSpots(spotsForMap().filter((sp) => passesFilter(sp) || sp.id === state.spotId));
    }
  }

  // re-render de la lista de calibración (llamado en cada dragend)
  function updateCalibList() {
    if (state.calibrate) renderCalibPanel();
  }

  function setCalibrate(on) {
    state.calibrate = on;
    document.body.classList.toggle("calibrating", on);
    const btn = document.getElementById("calib-btn");
    if (btn) btn.classList.toggle("active", on);
    if (on && baseMode !== "sat") applyBaseMode("sat"); // calibrar es más fácil sobre satélite
    refreshSpots();
    renderPanel();
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  function showExport() {
    const edited = Object.keys(coordOverrides);
    const payload = edited.map((id) => {
      const s = SPOTS.find((x) => x.id === id);
      return { id, name: s ? s.name : id, lat: coordOverrides[id].lat, lng: coordOverrides[id].lng };
    });
    const text = JSON.stringify(payload, null, 2);
    copyToClipboard(text);

    let ov = document.getElementById("export-overlay");
    if (ov) ov.remove();
    ov = document.createElement("div");
    ov.id = "export-overlay";
    ov.className = "export-overlay";
    ov.innerHTML = `
      <div class="export-box">
        <div class="export-head">
          <span>COORDENADAS CALIBRADAS · ${edited.length} spots</span>
          <button class="export-close">✕</button>
        </div>
        <p class="export-note">${edited.length ? "Copiado al portapapeles. Pégamelo en el chat y lo dejo fijado en la base de datos." : "Aún no has movido ningún pin. Arrastra pines sobre el satélite y vuelve a exportar."}</p>
        <textarea class="export-ta" readonly>${edited.length ? text : "[]"}</textarea>
      </div>`;
    document.body.appendChild(ov);
    const ta = ov.querySelector(".export-ta");
    ta.focus(); ta.select();
    ov.querySelector(".export-close").addEventListener("click", () => ov.remove());
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
  }

  function renderCalibPanel() {
    let scope;
    if (state.areaId) scope = spotsOfArea(state.areaId);
    else if (state.zoneId) scope = spotsOfZone(state.zoneId);
    else scope = SPOTS;

    const editedCount = Object.keys(coordOverrides).length;
    let html = `
      <div class="calib">
        <div class="calib-head">
          <div class="t">Modo calibración</div>
          <div class="d">Arrastra cada pin sobre el satélite hasta el punto exacto de la rompiente. Se guarda automáticamente.</div>
        </div>
        <div class="calib-actions">
          <button class="calib-btn-copy" id="calib-copy">⧉ Exportar coordenadas</button>
          <button class="calib-btn-reset" id="calib-reset">↺ Descartar</button>
        </div>
        <div class="calib-count"><b>${editedCount}</b> de ${SPOTS.length} pines recolocados</div>`;

    if (!scope.length) {
      html += `<div class="empty" style="padding:24px 8px">SIN SPOTS EN VISTA
        <div class="hint">Entra en una zona o región con spots para calibrarlos.</div></div>`;
    } else {
      html += `<div class="calib-list">`;
      scope.forEach((s) => {
        const ll = spotLL(s);
        const mod = coordOverrides[s.id];
        html += `
          <div class="calib-row ${mod ? "mod" : ""}" data-goto="${s.id}">
            <span class="ci">${iconDot(s.icon)}</span>
            <span class="cn">${s.name}</span>
            <span class="cc">${ll[0].toFixed(5)}, ${ll[1].toFixed(5)}</span>
            ${mod ? `<button class="crev" data-id="${s.id}" title="Restaurar original">✕</button>` : `<span class="cok">orig</span>`}
          </div>`;
      });
      html += `</div>`;
    }
    html += `</div>`;
    panelBody.innerHTML = html;

    document.getElementById("calib-copy").addEventListener("click", showExport);
    document.getElementById("calib-reset").addEventListener("click", () => {
      if (!Object.keys(coordOverrides).length) return;
      if (confirm("¿Descartar TODAS las calibraciones y volver a las coordenadas originales?")) {
        Object.keys(coordOverrides).forEach((k) => delete coordOverrides[k]);
        saveCoords();
        refreshSpots();
        renderCalibPanel();
      }
    });
    panelBody.querySelectorAll(".crev").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        delete coordOverrides[b.dataset.id];
        saveCoords();
        refreshSpots();
        renderCalibPanel();
      })
    );
    panelBody.querySelectorAll(".calib-row").forEach((row) =>
      row.addEventListener("click", () => {
        const s = SPOTS.find((x) => x.id === row.dataset.goto);
        if (s) map.panTo(spotLL(s));
      })
    );
  }
  window.SM.renderCalibPanel = renderCalibPanel;

  // wiring de la barra de herramientas
  document.querySelectorAll("[data-base]").forEach((b) =>
    b.addEventListener("click", () => applyBaseMode(b.dataset.base))
  );
  document.getElementById("calib-btn").addEventListener("click", () =>
    setCalibrate(!state.calibrate)
  );

  // ---------- METEO EN VIVO (Windy embed) ----------
  const windOverlay = document.getElementById("wind-overlay");
  const windFrame   = document.getElementById("wind-frame");
  const windBtn     = document.getElementById("wind-btn");
  const windSeg     = document.getElementById("wind-seg");
  let windOn = false;
  let windLayer = "wind"; // wind | rain | waves

  function buildWindy() {
    const c = map.getCenter();
    const z = Math.min(11, Math.max(4, Math.round(map.getZoom())));
    const lat = c.lat.toFixed(3), lon = c.lng.toFixed(3);
    // parámetros mínimos: sin menú, sin mensaje, sin panel de detalle, sin presión,
    // nivel fijo en superficie (sin selector de altitud), tipo mapa
    const url =
      "https://embed.windy.com/embed2.html?" +
      `lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}` +
      `&zoom=${z}&level=surface&overlay=${windLayer}` +
      "&menu=&message=&marker=&calendar=now&pressure=&type=map" +
      "&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1";
    windFrame.innerHTML =
      `<iframe title="Meteo en vivo" width="100%" height="100%" src="${url}" frameborder="0" loading="lazy"></iframe>`;
  }

  function setWind(on) {
    windOn = on;
    windBtn.classList.toggle("active", on);
    windOverlay.classList.toggle("visible", on);
    document.body.classList.toggle("wind-mode", on);
    if (on) buildWindy();
    else windFrame.innerHTML = "";
  }

  windSeg.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", () => {
      windLayer = b.dataset.ov;
      windSeg.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      buildWindy();
    })
  );

  windBtn.addEventListener("click", () => setWind(!windOn));
  document.getElementById("wind-close").addEventListener("click", () => setWind(false));
  map.on("moveend", () => { if (windOn) buildWindy(); });

  // ---------- AÑADIR SPOT ----------
  const addBtn = document.getElementById("addspot-btn");
  let addMode = false;
  function setAddMode(on) {
    addMode = on;
    addBtn.classList.toggle("active", on);
    document.body.classList.toggle("adding", on);
  }
  addBtn.addEventListener("click", () => setAddMode(!addMode));
  map.on("click", (e) => {
    if (!addMode) return;
    setAddMode(false);
    openSpotForm(e.latlng.lat, e.latlng.lng);
  });

  function escapeHtml(str) {
    return String(str == null ? "" : str).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function openSpotForm(lat, lng, existing) {
    const editing = !!existing;
    const cur = existing || {};
    const selArea = editing ? cur.area : state.areaId;
    const zoneOpts = AREAS.map((a) => {
      const z = ZONES.find((x) => x.id === a.zone);
      const sel = a.id === selArea ? "selected" : "";
      return `<option value="${a.id}" ${sel}>${z ? z.name : "?"} — ${a.name}</option>`;
    }).join("");
    const iconOpt = (val, label) =>
      `<option value="${val}" ${cur.icon === val ? "selected" : ""}>${label}</option>`;
    const wgVal = editing ? (wgIdFor(existing) || "") : "";
    const F = (id, label, ph, val) =>
      `<label class="ff"><span>${label}</span><input id="f-${id}" placeholder="${ph}" value="${escapeHtml(val == null ? "" : val)}"></label>`;

    let ov = document.getElementById("spot-form-ov");
    if (ov) ov.remove();
    ov = document.createElement("div");
    ov.className = "export-overlay";
    ov.id = "spot-form-ov";
    ov.innerHTML = `
      <div class="export-box form-box">
        <div class="export-head">
          <span>${editing ? "EDITAR SPOT" : "NUEVO SPOT"} · <span id="sf-coord">${lat.toFixed(5)}, ${lng.toFixed(5)}</span></span>
          <button class="export-close" id="sf-close">✕</button>
        </div>
        <div class="form-grid">
          ${F("name","Nombre","Ej. La Caleta", cur.name)}
          <label class="ff"><span>Área / isla</span><select id="f-zone">${zoneOpts}</select></label>
          <label class="ff"><span>Icono</span><select id="f-icon">
            ${iconOpt("consistent","Consistente (azul)")}
            ${iconOpt("occasional","Ocasional (amarillo)")}
            ${iconOpt("easter-egg","Top spot (estrella)")}
          </select></label>
          ${F("lat","Latitud","28.14419", lat.toFixed(5))}
          ${F("lng","Longitud","-15.59898", lng.toFixed(5))}
          <label class="ff ff-wide"><span>Windguru · id o URL del spot (pronóstico de olas)</span><input id="f-wg" placeholder="p.ej. 168621 o www.windguru.cz/168621 — déjalo vacío si no hay" value="${escapeHtml(wgVal)}"></label>
          ${F("wave","Tipo de ola","Derecha de reef, beach break…", cur.wave)}
          ${F("bottom","Fondo","Arena, roca, coral…", cur.bottom)}
          ${F("swell","Swell ideal","NW · 1–2,5 m · 10–14 s", cur.swell)}
          ${F("wind","Viento favorable","S / SE offshore", cur.wind)}
          ${F("tide","Marea","Baja, media, alta…", cur.tide)}
          ${F("level","Nivel","Principiante / Intermedio / Pro", cur.level)}
          ${F("crowd","Concurrencia","Bajo, medio, alto…", cur.crowd)}
          ${F("season","Mejor época","Oct – Mar", cur.season)}
          ${F("hazards","Peligros","Roca, corriente…", cur.hazards)}
          <label class="ff ff-wide"><span>Notas</span><textarea id="f-notes" placeholder="Descripción del spot, accesos, consejos…">${escapeHtml(cur.notes || "")}</textarea></label>
        </div>
        <div class="form-actions">
          <button class="calib-btn-copy" id="sf-save">${editing ? "Guardar cambios" : "Guardar spot"}</button>
          <button class="calib-btn-reset" id="sf-cancel">Cancelar</button>
        </div>
      </div>`;
    document.body.appendChild(ov);
    const close = () => ov.remove();
    ov.querySelector("#sf-close").addEventListener("click", close);
    ov.querySelector("#sf-cancel").addEventListener("click", close);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    ov.querySelector("#f-name").focus();

    // refleja en la cabecera las coordenadas que se vayan tecleando
    const latI = ov.querySelector("#f-lat");
    const lngI = ov.querySelector("#f-lng");
    const coordSpan = ov.querySelector("#sf-coord");
    const updCoord = () => { coordSpan.textContent = `${latI.value || "?"}, ${lngI.value || "?"}`; };
    latI.addEventListener("input", updCoord);
    lngI.addEventListener("input", updCoord);

    ov.querySelector("#sf-save").addEventListener("click", () => {
      const g = (id) => (ov.querySelector("#f-" + id).value || "").trim();
      const name = g("name");
      if (!name) { ov.querySelector("#f-name").focus(); return; }
      const nlat = parseFloat(g("lat"));
      const nlng = parseFloat(g("lng"));
      const validLL = !isNaN(nlat) && !isNaN(nlng);

      const fields = {
        name, area: ov.querySelector("#f-zone").value,
        icon: ov.querySelector("#f-icon").value,
        wave: g("wave") || "—", bottom: g("bottom") || "—", swell: g("swell") || "—",
        wind: g("wind") || "—", tide: g("tide") || "—", level: g("level") || "Intermedio",
        crowd: g("crowd") || "—", season: g("season") || "—", hazards: g("hazards") || "—",
        notes: g("notes") || ""
      };
      if (validLL) { fields.lat = +nlat.toFixed(5); fields.lng = +nlng.toFixed(5); }

      if (editing) {
        Object.assign(existing, fields);
        if (existing.custom) {
          const ce = customSpots.find((x) => x.id === existing.id);
          if (ce) Object.assign(ce, fields);
          saveCustomSpots();
        } else {
          spotEdits[existing.id] = Object.assign(spotEdits[existing.id] || {}, fields);
          saveSpotEdits();
        }
        setWgId(existing.id, parseWgId(g("wg")));
        // si se han tecleado coordenadas, manda lo nuevo: retira la calibración previa
        if (validLL && coordOverrides[existing.id]) {
          delete coordOverrides[existing.id]; saveCoords();
        }
        close();
        enterSpot(existing.id);
      } else {
        const id = "custom-" + Date.now().toString(36);
        const spot = Object.assign({
          id, lat: +(validLL ? nlat : lat).toFixed(5), lng: +(validLL ? nlng : lng).toFixed(5),
          tags: [], custom: true
        }, fields);
        SPOTS.push(spot);
        customSpots.push(spot);
        saveCustomSpots();
        const wgv = parseWgId(g("wg"));
        if (wgv) setWgId(id, wgv);
        close();
        enterSpot(id);
      }
    });
  }

  // ---------- EXPORTAR DATOS ----------
  document.getElementById("export-data-btn").addEventListener("click", () => {
    const payload = {
      customSpots: customSpots,
      coordOverrides: coordOverrides,
      spotEdits: spotEdits,
      windguru: wgPersist
    };
    const text = JSON.stringify(payload, null, 2);
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
    const nPhotos = Object.values(photos).reduce((a, o) => a + Object.keys(o).length, 0);
    const nEdits = Object.keys(spotEdits).length;
    const nWg = Object.keys(wgPersist).filter((k) => wgPersist[k]).length;

    let ov = document.getElementById("export-overlay");
    if (ov) ov.remove();
    ov = document.createElement("div");
    ov.id = "export-overlay";
    ov.className = "export-overlay";
    const has = customSpots.length || Object.keys(coordOverrides).length || nEdits || nWg;
    ov.innerHTML = `
      <div class="export-box">
        <div class="export-head">
          <span>EXPORTAR CAMBIOS · ${customSpots.length} spots · ${nEdits} editados · ${nWg} Windguru · ${Object.keys(coordOverrides).length} recolocados</span>
          <button class="export-close">✕</button>
        </div>
        <p class="export-note">${has
          ? "Copiado al portapapeles. Pégamelo en el chat y lo dejo fijado en la base de datos.<br><b>Fotos:</b> tienes " + nPhotos + " guardadas en este navegador. Para incrustarlas de forma permanente, envíame los archivos de imagen y las añado a las fichas."
          : "Aún no has añadido spots, editado fichas ni recolocado pines. Usa ＋ Spot, ✎ Editar o el modo Calibrar y vuelve a exportar."}</p>
        <textarea class="export-ta" readonly>${has ? escapeHtml(text) : "{}"}</textarea>
      </div>`;
    document.body.appendChild(ov);
    const ta = ov.querySelector(".export-ta"); ta.focus(); ta.select();
    ov.querySelector(".export-close").addEventListener("click", () => ov.remove());
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.remove(); });
  });

  // ---------- ocultar/mostrar panel lateral (mapa a pantalla completa) ----------
  const panelToggle = document.getElementById("panel-toggle");
  panelToggle.addEventListener("click", () => {
    document.body.classList.toggle("panel-hidden");
    const hidden = document.body.classList.contains("panel-hidden");
    panelToggle.textContent = hidden ? "‹" : "›";
    panelToggle.title = hidden ? "Mostrar panel" : "Ocultar panel";
    // re-encajar las tiles durante y al final de la transición
    const iv = setInterval(() => map.invalidateSize({ animate: false }), 60);
    setTimeout(() => { clearInterval(iv); map.invalidateSize({ animate: false }); }, 420);
  });

  // ---------- ampliar/reducir el ancho del panel (solo desktop) ----------
  const panelExpand = document.getElementById("panel-expand");
  if (panelExpand) {
    if (localStorage.getItem("sm-panel-expanded") === "1") {
      document.body.classList.add("panel-expanded");
    }
    const syncExpand = () => {
      const ex = document.body.classList.contains("panel-expanded");
      panelExpand.textContent = ex ? "⤡" : "⤢";
      panelExpand.title = ex ? "Reducir panel" : "Ampliar panel";
    };
    syncExpand();
    panelExpand.addEventListener("click", () => {
      const ex = document.body.classList.toggle("panel-expanded");
      localStorage.setItem("sm-panel-expanded", ex ? "1" : "0");
      syncExpand();
      const iv = setInterval(() => map.invalidateSize({ animate: false }), 60);
      setTimeout(() => { clearInterval(iv); map.invalidateSize({ animate: false }); }, 420);
    });
  }

  // ---------- bottom-sheet móvil (tirador: tap para abrir/cerrar + arrastre) ----------
  (function () {
    const handle = document.getElementById("sheet-handle");
    const panelEl = document.querySelector(".panel");
    const hint = document.getElementById("sheet-hint");
    if (!handle || !panelEl) return;
    const isMobile = () => window.matchMedia("(max-width: 768px)").matches;
    const PEEK = 116;

    function reflowMap() {
      const iv = setInterval(() => map.invalidateSize({ animate: false }), 60);
      setTimeout(() => { clearInterval(iv); map.invalidateSize({ animate: false }); }, 440);
    }
    function setSheet(open) {
      document.body.classList.toggle("sheet-open", open);
      if (hint) hint.textContent = open ? "Cerrar" : "Explorar";
      reflowMap();
    }

    let dragging = false, startY = 0, baseOpen = false, sheetH = 0, moved = 0;
    handle.addEventListener("pointerdown", (e) => {
      if (!isMobile()) return;
      dragging = true; moved = 0; startY = e.clientY;
      baseOpen = document.body.classList.contains("sheet-open");
      sheetH = panelEl.getBoundingClientRect().height;
      document.body.classList.add("sheet-dragging");
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    });
    handle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dy = e.clientY - startY; moved = Math.max(moved, Math.abs(dy));
      const peekT = sheetH - PEEK;
      let t = (baseOpen ? 0 : peekT) + dy;
      t = Math.max(0, Math.min(peekT, t));
      panelEl.style.transform = `translateY(${t}px)`;
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      document.body.classList.remove("sheet-dragging");
      panelEl.style.transform = "";
      const dy = (e.clientY || startY) - startY;
      if (moved < 6) { setSheet(!baseOpen); return; }   // tap
      if (baseOpen) setSheet(dy < 90);                  // arrastrado hacia abajo → cerrar
      else setSheet(dy < -40);                          // arrastrado hacia arriba → abrir
    }
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);

    // al enfocar el buscador en móvil, abre la hoja para ver los resultados
    const si = document.getElementById("search-input");
    if (si) si.addEventListener("focus", () => { if (isMobile()) setSheet(true); });
  })();

  // ---------- HUD coords (sigue el cursor) ----------
  const coordLat = document.getElementById("coord-lat");
  const coordLng = document.getElementById("coord-lng");
  const coordZ   = document.getElementById("coord-z");
  map.on("mousemove", (e) => {
    coordLat.textContent = e.latlng.lat.toFixed(4) + "°";
    coordLng.textContent = e.latlng.lng.toFixed(4) + "°";
  });
  // atenúa progresivamente las líneas/pills de zona al hacer zoom in
  function fadeZoneByZoom() {
    const z = map.getZoom();
    // factor: 1 (visible) hasta z<=12 → 0 (oculto) en z>=14.5
    let f = 1;
    if (z >= 12) f = Math.max(0, 1 - (z - 12) / 2.5);
    zoneLayer.eachLayer((l) => {
      if (l._smZoneLine === "core") l.setStyle({ opacity: 0.5 * f });
      else if (l._smZoneLine === "glow") l.setStyle({ opacity: 0.07 * f });
      else if (l.setStyle) l.setStyle({ opacity: 0.35 * f }); // conectores dashed
    });
    const op = (0.3 + 0.7 * f);
    document.querySelectorAll(".zone-pill").forEach((p) => {
      p.style.opacity = f < 0.05 ? 0 : op;
      p.style.pointerEvents = f < 0.05 ? "none" : "auto";
    });
  }
  map.on("zoom", () => { coordZ.textContent = "Z" + map.getZoom().toFixed(1); fadeZoneByZoom(); });
  map.on("zoomend", fadeZoneByZoom);

  // ---------- arranque ----------
  applyBaseMode(baseMode);
  setTimeout(() => map.invalidateSize(), 0);
  showWorld();   // raíz = España (incluye Canarias y Baleares en el encuadre)
  coordZ.textContent = "Z" + map.getZoom().toFixed(1);

  // Fix tamaño de contenedor (grid/flex no estaba en su anchura final al iniciar)
  function fixSize() { map.invalidateSize({ animate: false }); }
  requestAnimationFrame(fixSize);
  setTimeout(fixSize, 200);
  setTimeout(fixSize, 600);
  window.addEventListener("resize", fixSize);
})();
