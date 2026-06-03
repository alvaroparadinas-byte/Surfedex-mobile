// Modelos del dominio (referencia · TypeScript). El scaffold corre en Node/JS,
// pero estas interfaces documentan EXACTAMENTE las formas de datos del brief.

export interface Spot {
  id: string;
  name: string;

  latitude: number;
  longitude: number;

  country: string;
  region: string;

  waveType: string;

  bestSwellDirection: string[];   // p.ej. ["NW", "NNW"]
  bestWindDirection: string[];    // p.ej. ["S", "SE"]  (offshore)

  description?: string;

  // Reglas finas opcionales para spotScore
  score?: {
    swellIdeal?: [number, number]; // rango ideal de altura de swell (m)
    periodIdeal?: number;          // periodo ideal (s)
  };
}

// Una observación/predicción horaria (SI, tal cual Stormglass).
export interface Forecast {
  id: string;

  spotId: string;

  timestamp: Date;

  waveHeight: number;       // m
  wavePeriod: number;       // s
  waveDirection: number;    // grados (de dónde viene)

  swellHeight: number;      // m
  swellPeriod: number;      // s
  swellDirection: number;   // grados

  windSpeed: number;        // m/s  (el frontend lo muestra en nudos)
  windDirection: number;    // grados

  waterTemperature: number; // °C

  createdAt: Date;
}

// Respuesta del endpoint GET /api/spots/:id/forecast
export interface ForecastResponse {
  spotId: string;
  updatedAt: string;
  units: { wave: "m"; period: "s"; wind: "m/s"; temp: "C"; direction: "deg" };
  current: ForecastPoint;
  next24h: ForecastPoint[];
  next7days: DailySummary[];
}

export interface ForecastPoint {
  timestamp: string;
  waveHeight: number; wavePeriod: number; waveDirection: number;
  swellHeight: number; swellPeriod: number; swellDirection: number;
  windSpeed: number; windDirection: number;
  waterTemperature: number;
  score: number;            // 0..100 (spotScore)
}

export interface DailySummary {
  date: string;
  waveMin: number; waveMax: number;
  periodDom: number;
  windAvg: number; windDirection: number;
  score: number;            // mejor puntuación del día
  bestWindow: string | null; // hora de la mejor franja, p.ej. "09:00"
}

// Sistema de puntuación (para implementar/afinar):
//   spotScore(spot, forecast): number  → 0..100
//   0-20 Malo · 21-40 Surfable · 41-60 Bueno · 61-80 Muy bueno · 81-100 Épico
export type SpotScore = (spot: Spot, forecast: Forecast) => number;
