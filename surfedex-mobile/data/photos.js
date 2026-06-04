// SurfMach — fotos fijadas en el proyecto (permanentes, por spot/hueco)
// Estructura: { spotId: { main|lineup|drone: "ruta" } }
// Estas se muestran siempre; si el usuario sube una foto desde la ficha,
// su versión local (navegador) tiene prioridad sobre estas.
window.SURFMACH_PHOTOS = {
  // --- Asturias ---
  "verdicio":          { main: "photos/verdicio.jpg", lineup: "photos/verdicio-lineup.jpg" },
  "xago":              { main: "photos/xago.jpg", lineup: "photos/xago-lineup.jpg" },
  "salinas":           { main: "photos/salinas.jpg", lineup: "photos/salinas-lineup.jpg" },
  "san-juan-nieva":    { main: "photos/san-juan-nieva.jpg", lineup: "photos/san-juan-nieva-lineup.jpg", drone: "photos/san-juan-nieva-drone.jpg" },
  "bayas":             { main: "photos/bayas.jpg" },
  "quebrantos":        { main: "photos/quebrantos.jpg", lineup: "photos/quebrantos-lineup.jpg" },
  "aguilar":           { main: "photos/aguilar.jpg", lineup: "photos/aguilar-lineup.jpg" },
  "cadavedo":          { main: "photos/cadavedo.jpg", lineup: "photos/cadavedo-lineup.jpg" },
  "barayo":            { main: "photos/barayo.png", lineup: "photos/barayo-lineup.jpg" },
  "frejulfe":          { main: "photos/frejulfe.jpg", lineup: "photos/frejulfe-lineup.png" },
  "navia":             { main: "photos/navia.jpg", lineup: "photos/navia-lineup.png" },
  "tapia":             { main: "photos/tapia.jpg", lineup: "photos/tapia-lineup.png" },
  "penarronda":        { main: "photos/penarronda.jpg", lineup: "photos/penarronda-lineup.png" },
  "custom-mpsrsykc":   { main: "photos/cueva.jpg" },          // Cueva
  "custom-mpsrz0k3":   { main: "photos/concha-artedo.jpg" },  // La Concha de Artedo
  "custom-mpss0cx1":   { main: "photos/san-pedro.jpg" },      // San Pedro
  "custom-mpsud51b":   { main: "photos/vega.jpg" },           // Vega
  "la-nora":           { main: "photos/la-nora.jpg" },
  "san-lorenzo":       { main: "photos/san-lorenzo.jpg" },
  "otur":              { main: "photos/otur.png", lineup: "photos/otur-lineup.jpg" },
  // --- Gran Canaria ---
  "vagabundo":         { main: "photos/vagabundo.jpg" },
  "el-circo":          { main: "photos/el-circo.jpg" },
  "bunker":            { main: "photos/el-bunker.jpg" },
  "enanos":            { main: "photos/los-enanos.jpg" },
  "puertillo":         { main: "photos/el-puertillo.jpg" },
  "pozo":              { main: "photos/mosca-point.jpg" },    // Mosca Point
  "fronton":           { main: "photos/el-fronton.jpg" },
  "agujero":           { main: "photos/el-agujero.jpg" },
  "bocabarranco":      { main: "photos/bocabarranco.jpg" }
};
