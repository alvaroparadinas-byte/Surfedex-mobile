// Catálogo de spots para el backend, con las REGLAS de puntuación por spot.
// En producción esto vendría de la base de datos (modelo Spot). Aquí definimos
// el piloto: Asturias (West + East + spots propios) y Gran Canaria — 68 spots.
//
// IMPORTANTE: cada vez que añadas/quites spots aquí hay que REDESPLEGAR el backend
// (Render) para que el sync los recoja. Vigila la cuota de Stormglass (ver .env.example).
//
// Modelo Spot (ver ../models.ts):
//   id, name, latitude, longitude, country, region, waveType,
//   bestSwellDirection[], bestWindDirection[], description?
//   + score: reglas finas opcionales (swellIdeal [min,max] m, periodIdeal s)

module.exports = [
  {
    id: "salinas",
    name: "Salinas",
    latitude: 43.5792,
    longitude: -5.95774,
    country: "ES",
    region: "Asturias",
    waveType: "Beach break",
    bestSwellDirection: ["NW", "NNW", "N"],
    bestWindDirection: ["S", "SSW", "SW", "SE"],
    description: "La playa de surf por excelencia de Asturias.",
    score: { swellIdeal: [1.2, 2.5], periodIdeal: 12 }
  },

  // ============ ASTURIAS EAST (oriente) ============
  // IDs idénticos a los del frontend (data/spots.js, area "ast-este").
  {
    id: "san-lorenzo",
    name: "San Lorenzo",
    latitude: 43.5421,
    longitude: -5.6511,
    country: "ES",
    region: "Asturias",
    waveType: "Beach break",
    bestSwellDirection: ["N", "NNW", "NW"],
    bestWindDirection: ["S", "SSW", "SW"],
    description: "La playa urbana de Gijón. Muy consistente, varios picos.",
    score: { swellIdeal: [1, 2.5], periodIdeal: 12 }
  },
  {
    id: "la-nora",
    name: "La Ñora",
    latitude: 43.5476,
    longitude: -5.5901,
    country: "ES",
    region: "Asturias",
    waveType: "Beach break (desembocadura)",
    bestSwellDirection: ["N", "NNW", "NW"],
    bestWindDirection: ["S", "SSW", "SW"],
    description: "Beach break en la desembocadura del río Ñora.",
    score: { swellIdeal: [1, 2.5], periodIdeal: 12 }
  },
  {
    id: "custom-mpsuiolb",
    name: "Rodiles",
    latitude: 43.53463,
    longitude: -5.3802,
    country: "ES",
    region: "Asturias",
    waveType: "Beach break / desembocadura",
    bestSwellDirection: ["NW", "NNW", "N"],
    bestWindDirection: ["S", "SSW", "SSE"],
    description: "Derecha de desembocadura, referencia del oriente asturiano.",
    score: { swellIdeal: [1, 3], periodIdeal: 13 }
  },
  {
    id: "custom-mpsud51b",
    name: "Vega",
    latitude: 43.48101,
    longitude: -5.13779,
    country: "ES",
    region: "Asturias",
    waveType: "Beach break",
    bestSwellDirection: ["NW", "NNW", "N"],
    bestWindDirection: ["S", "SSE", "SE"],
    description: "Playa de 1,5 km en Ribadesella. Muy consistente y expuesta.",
    score: { swellIdeal: [1, 3], periodIdeal: 13 }
  },
  {
    id: "custom-mpsu7cla",
    name: "Andrín",
    latitude: 43.41102,
    longitude: -4.70807,
    country: "ES",
    region: "Asturias",
    waveType: "Beach break",
    bestSwellDirection: ["N", "NNW", "NW"],
    bestWindDirection: ["S", "SSE", "SE"],
    description: "Izquierda y derecha que chocan en el centro; spot de bodyboard.",
    score: { swellIdeal: [1, 2.5], periodIdeal: 12 }
  },

  // ---- Asturias East · spots propios (del editor, area "ast-este") ----
  // Todos NW, viento offshore del S/SE. (En el modelo actual la dirección de swell
  // no puntúa; lo que importa para el viento es bestWindDirection.)
  { id: "custom-mpswn3ha", name: "Playa de España", latitude: 43.54599, longitude: -5.52907, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2.5], periodIdeal: 12 } },
  { id: "custom-mpswt1ni", name: "Merón", latitude: 43.54432, longitude: -5.49411, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2], periodIdeal: 11 } },
  { id: "custom-mpsxedcm", name: "La Espasa", latitude: 43.47486, longitude: -5.21639, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2], periodIdeal: 11 } },
  { id: "custom-mpsxgbby", name: "Arenal de Moris", latitude: 43.47539, longitude: -5.1731, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2], periodIdeal: 12 } },
  { id: "custom-mpsxiv0u", name: "Santa Marina", latitude: 43.46614, longitude: -5.06612, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2.5], periodIdeal: 12 } },
  { id: "custom-mpsxmluu", name: "San Antolín", latitude: 43.44631, longitude: -4.87852, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1.5, 3], periodIdeal: 13 } },
  { id: "custom-mpsxq9cm", name: "Torimbia", latitude: 43.45101, longitude: -4.87129, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1.5, 2], periodIdeal: 11 } },
  { id: "custom-mpsxulha", name: "Playa de Barro", latitude: 43.44087, longitude: -4.8337, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1.5, 2.5], periodIdeal: 11 } },
  { id: "custom-mpsxxjw6", name: "Ballota", latitude: 43.41391, longitude: -4.71493, country: "ES", region: "Asturias", waveType: "Beach break / mixto", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2], periodIdeal: 11 } },
  { id: "custom-mpsy1puu", name: "Vidiago", latitude: 43.40772, longitude: -4.6685, country: "ES", region: "Asturias", waveType: "Beach break / mixto", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2.5], periodIdeal: 11 } },
  { id: "custom-mpsy4a66", name: "La Franca", latitude: 43.39864, longitude: -4.58227, country: "ES", region: "Asturias", waveType: "Beach break (desembocadura)", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2.5], periodIdeal: 12 } },
  // IDs idénticos al frontend (data/spots.js, area "ast-oeste"). Costa abierta
  // al NW; viento offshore del sur. Beach breaks salvo donde se indica.
  { id: "verdicio", name: "Verdicio", latitude: 43.62723, longitude: -5.87636, country: "ES", region: "Asturias", waveType: "Beach break / reef", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [1, 3], periodIdeal: 12 } },
  { id: "xago", name: "Xagó", latitude: 43.6053, longitude: -5.9177, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2.5], periodIdeal: 11 } },
  { id: "san-juan-nieva", name: "San Juan de Nieva", latitude: 43.59007, longitude: -5.94056, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [1.5, 3], periodIdeal: 12 } },
  { id: "bayas", name: "Playón de Bayas", latitude: 43.5791, longitude: -6.03814, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 3.5], periodIdeal: 12 } },
  { id: "quebrantos", name: "Los Quebrantos", latitude: 43.56613, longitude: -6.06485, country: "ES", region: "Asturias", waveType: "Beach break (desembocadura)", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [1, 3], periodIdeal: 13 } },
  { id: "aguilar", name: "Aguilar", latitude: 43.55817, longitude: -6.09306, country: "ES", region: "Asturias", waveType: "Beach break / reef", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 3], periodIdeal: 12 } },
  { id: "cadavedo", name: "Cadavedo (La Ribeirona)", latitude: 43.5523, longitude: -6.3725, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [1, 2.5], periodIdeal: 12 } },
  { id: "otur", name: "Otur", latitude: 43.55351, longitude: -6.5979, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2.5], periodIdeal: 12 } },
  { id: "barayo", name: "Barayo", latitude: 43.56122, longitude: -6.61413, country: "ES", region: "Asturias", waveType: "Beach break (desembocadura)", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [1, 3], periodIdeal: 12 } },
  { id: "frejulfe", name: "Freijulfe", latitude: 43.5593, longitude: -6.6762, country: "ES", region: "Asturias", waveType: "Beach break (desembocadura)", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [1, 2.5], periodIdeal: 12 } },
  { id: "navia", name: "Navia", latitude: 43.5549, longitude: -6.7231, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2.5], periodIdeal: 12 } },
  { id: "tapia", name: "Tapia de Casariego", latitude: 43.5678, longitude: -6.9490, country: "ES", region: "Asturias", waveType: "Beach break / reef", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [1, 3], periodIdeal: 13 } },
  { id: "penarronda", name: "Peñarronda", latitude: 43.5533, longitude: -6.9970, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [1, 3], periodIdeal: 12 } },
  { id: "custom-mpsrsykc", name: "Cueva", latitude: 43.55096, longitude: -6.47364, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2.5], periodIdeal: 12 } },
  { id: "custom-mpsrz0k3", name: "La Concha de Artedo", latitude: 43.56445, longitude: -6.18839, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2.5], periodIdeal: 11 } },
  { id: "custom-mpss0cx1", name: "San Pedro", latitude: 43.57877, longitude: -6.22118, country: "ES", region: "Asturias", waveType: "Beach break", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1, 2.5], periodIdeal: 11 } },

  // ============ GRAN CANARIA ============
  // IDs idénticos al frontend (data/spots.js, area "gran-canaria").
  // -- Norte (cara N/NW, offshore del sur) --
  { id: "vagabundo", name: "Vagabundo", latitude: 28.14419, longitude: -15.59898, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["N","NNW","NW"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1.2, 2.5], periodIdeal: 12 } },
  { id: "el-circo", name: "El Circo", latitude: 28.14626, longitude: -15.59057, country: "ES", region: "Canarias", waveType: "Reef (izquierda)", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1.5, 3], periodIdeal: 13 } },
  { id: "bunker", name: "Bunker", latitude: 28.14419, longitude: -15.57906, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["N","NNW","NW"], bestWindDirection: ["S","SSW","SSE"], score: { swellIdeal: [1, 2], periodIdeal: 11 } },
  { id: "derecha-roque", name: "La Derecha del Roque", latitude: 28.14619, longitude: -15.56726, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [1.5, 2.5], periodIdeal: 12 } },
  { id: "boquines", name: "Boquines", latitude: 28.14651, longitude: -15.56066, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["N","NNW","NNE"], bestWindDirection: ["S","SSW","SSE"], score: { swellIdeal: [1, 2], periodIdeal: 11 } },
  { id: "molokai", name: "Molokai", latitude: 28.14658, longitude: -15.55794, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["N","NNE","NE"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [1.5, 3], periodIdeal: 13 } },
  { id: "enanos", name: "Los Enanos", latitude: 28.14597, longitude: -15.55227, country: "ES", region: "Canarias", waveType: "Reef", bestSwellDirection: ["N","NNE","NNW"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [1, 1.8], periodIdeal: 10 } },
  { id: "quintanilla", name: "Quintanilla", latitude: 28.14627, longitude: -15.54617, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["NE","NNE","N"], bestWindDirection: ["S","SSW","SSE"], score: { swellIdeal: [1.5, 2.5], periodIdeal: 11 } },
  { id: "puertillo", name: "El Puertillo", latitude: 28.15139, longitude: -15.53804, country: "ES", region: "Canarias", waveType: "Beach / reef", bestSwellDirection: ["NE","N","NNE"], bestWindDirection: ["S","SSW","SW"], score: { swellIdeal: [0.8, 1.5], periodIdeal: 10 } },
  // -- Las Palmas (cara N/NW, offshore del sur) --
  { id: "cicer", name: "La Cicer", latitude: 28.13299, longitude: -15.44536, country: "ES", region: "Canarias", waveType: "Beach break", bestSwellDirection: ["N","NNW","NW"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [0.8, 2], periodIdeal: 10 } },
  { id: "muellitos", name: "Los Muellitos", latitude: 28.13146, longitude: -15.44853, country: "ES", region: "Canarias", waveType: "Reef / arena", bestSwellDirection: ["N","NNW","NNE"], bestWindDirection: ["S","SSW","SSE"], score: { swellIdeal: [1, 2], periodIdeal: 11 } },
  { id: "lloret", name: "El Lloret", latitude: 28.12957, longitude: -15.4522, country: "ES", region: "Canarias", waveType: "Reef (izquierda)", bestSwellDirection: ["N","NNW","NW"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [1.2, 2.5], periodIdeal: 12 } },
  { id: "confital", name: "El Confital", latitude: 28.15847, longitude: -15.43608, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["S","SSW","SE"], score: { swellIdeal: [1.5, 3.5], periodIdeal: 14 } },
  // -- Este (cara NE/E, offshore del NW/W) --
  { id: "san-cristobal", name: "San Cristóbal (slabs)", latitude: 28.07947, longitude: -15.41529, country: "ES", region: "Canarias", waveType: "Slab", bestSwellDirection: ["NE","ENE","E"], bestWindDirection: ["W","WNW","NW"], score: { swellIdeal: [1.5, 3], periodIdeal: 12 } },
  { id: "la-laja", name: "La Laja", latitude: 28.06357, longitude: -15.41877, country: "ES", region: "Canarias", waveType: "Beach / reef", bestSwellDirection: ["NE","ENE","E"], bestWindDirection: ["NW","WNW","W"], score: { swellIdeal: [0.8, 2], periodIdeal: 11 } },
  { id: "playa-la-laja", name: "Playa de la Laja", latitude: 28.06065, longitude: -15.4198, country: "ES", region: "Canarias", waveType: "Beach break", bestSwellDirection: ["NE","ENE","E"], bestWindDirection: ["NW","WNW","W"], score: { swellIdeal: [0.8, 1.8], periodIdeal: 10 } },
  { id: "terrazas", name: "Las Terrazas / Media Luna", latitude: 28.02954, longitude: -15.39207, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["NE","NNE","ENE"], bestWindDirection: ["NW","WNW","W"], score: { swellIdeal: [1, 2], periodIdeal: 11 } },
  { id: "playa-hombre", name: "Playa del Hombre", latitude: 27.99689, longitude: -15.37422, country: "ES", region: "Canarias", waveType: "Beach / reef", bestSwellDirection: ["NE","ENE","E"], bestWindDirection: ["NW","WNW","W"], score: { swellIdeal: [1, 1.8], periodIdeal: 10 } },
  { id: "burrero", name: "Playa del Burrero", latitude: 27.91047, longitude: -15.38708, country: "ES", region: "Canarias", waveType: "Beach break", bestSwellDirection: ["NE","NNE","ENE"], bestWindDirection: ["NW","WNW","W"], score: { swellIdeal: [1, 2], periodIdeal: 11 } },
  { id: "ojos-garza", name: "Ojos de Garza", latitude: 27.94994, longitude: -15.38056, country: "ES", region: "Canarias", waveType: "Slab", bestSwellDirection: ["NE","ENE","NNE"], bestWindDirection: ["W","NW","SW"], score: { swellIdeal: [1.5, 2.5], periodIdeal: 11 } },
  { id: "vargas", name: "Playa de Vargas", latitude: 27.88541, longitude: -15.3928, country: "ES", region: "Canarias", waveType: "Olas de viento", bestSwellDirection: ["NE","ENE","E"], bestWindDirection: ["W","WNW","WSW"], score: { swellIdeal: [1, 2], periodIdeal: 8 } },
  { id: "arinaga", name: "Arinaga / Muelle", latitude: 27.84986, longitude: -15.403, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["E","ESE","SE"], bestWindDirection: ["W","WNW","NW"], score: { swellIdeal: [1, 2], periodIdeal: 10 } },
  { id: "pozo", name: "Mosca Point", latitude: 27.83416, longitude: -15.41852, country: "ES", region: "Canarias", waveType: "Reef / viento", bestSwellDirection: ["E","ESE","SE"], bestWindDirection: ["W","WSW","NW"], score: { swellIdeal: [1, 2], periodIdeal: 9 } },
  { id: "pozo-izquierdo", name: "Pozo Izquierdo", latitude: 27.82668, longitude: -15.42223, country: "ES", region: "Canarias", waveType: "Olas de viento", bestSwellDirection: ["NE","ENE","E"], bestWindDirection: ["W","WSW","SW"], score: { swellIdeal: [1, 2], periodIdeal: 8 } },
  { id: "juangrande", name: "Juan Grande / Ketchup", latitude: 27.79382, longitude: -15.47665, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["S","SSW","SW"], bestWindDirection: ["N","NNE","NE"], score: { swellIdeal: [1, 2], periodIdeal: 11 } },
  // -- Sur (cara S/SW, offshore del NE/N) --
  { id: "arguineguin", name: "Cement Factory / Arguineguín", latitude: 27.75277, longitude: -15.67612, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["S","SSW","SW"], bestWindDirection: ["N","NNE","NE"], score: { swellIdeal: [1.5, 3], periodIdeal: 13 } },
  { id: "patalavaca", name: "Patalavaca", latitude: 27.77046, longitude: -15.68885, country: "ES", region: "Canarias", waveType: "Reef (derecha)", bestSwellDirection: ["S","SSW","SW"], bestWindDirection: ["N","NNE","NE"], score: { swellIdeal: [1.5, 2.5], periodIdeal: 12 } },
  { id: "pasito", name: "Pasito Blanco", latitude: 27.74989, longitude: -15.62136, country: "ES", region: "Canarias", waveType: "Reef (izquierda)", bestSwellDirection: ["S","SSW","SW"], bestWindDirection: ["N","NNE","NE"], score: { swellIdeal: [2, 3], periodIdeal: 13 } },
  { id: "maspalomas", name: "Faro de Maspalomas", latitude: 27.73546, longitude: -15.59768, country: "ES", region: "Canarias", waveType: "Beach break", bestSwellDirection: ["S","SSW","SW"], bestWindDirection: ["N","NNE","NE"], score: { swellIdeal: [1, 2], periodIdeal: 11 } },
  { id: "playa-ingles", name: "Playa del Inglés", latitude: 27.75616, longitude: -15.56723, country: "ES", region: "Canarias", waveType: "Beach break", bestSwellDirection: ["SW","SSW","S"], bestWindDirection: ["N","NNE","NE"], score: { swellIdeal: [1, 1.8], periodIdeal: 10 } },
  // -- NW / Gáldar (cara N/NW, offshore del SE/S) --
  { id: "fronton", name: "El Frontón", latitude: 28.1659, longitude: -15.65329, country: "ES", region: "Canarias", waveType: "Reef (izquierda)", bestSwellDirection: ["N","NNW","NW"], bestWindDirection: ["S","SSE","SE"], score: { swellIdeal: [2, 4], periodIdeal: 14 } },
  { id: "agujero", name: "El Agujero", latitude: 28.16109, longitude: -15.66187, country: "ES", region: "Canarias", waveType: "Reef", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["SE","SSE","S"], score: { swellIdeal: [1.5, 2.5], periodIdeal: 12 } },
  { id: "bocabarranco", name: "Bocabarranco", latitude: 28.15839, longitude: -15.66616, country: "ES", region: "Canarias", waveType: "Beach / reef", bestSwellDirection: ["NW","NNW","N"], bestWindDirection: ["SE","SSE","S"], score: { swellIdeal: [1, 2], periodIdeal: 11 } },
  // -- Oeste (cara W/NW, offshore del E) --
  { id: "agaete", name: "Puerto de las Nieves / Agaete", latitude: 28.10333, longitude: -15.71277, country: "ES", region: "Canarias", waveType: "Reef", bestSwellDirection: ["NW","WNW","N"], bestWindDirection: ["E","ESE","SE"], score: { swellIdeal: [1.5, 2.5], periodIdeal: 12 } },
  { id: "aldea", name: "La Aldea de San Nicolás", latitude: 28.00125, longitude: -15.81879, country: "ES", region: "Canarias", waveType: "Beach break", bestSwellDirection: ["W","WNW","NW"], bestWindDirection: ["E","ESE","ENE"], score: { swellIdeal: [1, 2.5], periodIdeal: 11 } }
];
