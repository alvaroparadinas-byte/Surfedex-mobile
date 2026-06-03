// Catálogo de spots para el backend, con las REGLAS de puntuación por spot.
// En producción esto vendría de la base de datos (modelo Spot). Para el piloto
// definimos aquí Salinas; añade más cuando valides el sistema.
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
  }
];
