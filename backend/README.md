# Surfedex · Backend de previsiones (Stormglass)

Servicio mínimo que **sincroniza** previsiones desde [Stormglass](https://stormglass.io)
y las **sirve** al frontend. La clave de Stormglass vive **solo aquí** (variable de
entorno) y **nunca** llega al navegador.

```
Frontend  ──HTTP──▶  Este backend  ──▶  Base de datos  ──▶  Stormglass
                     (GET /api/...)      (forecasts)         (sync cada 4 h)
```

El frontend **nunca** llama a Stormglass directamente.

## Endpoints

- `GET /api/spots/:id/forecast` → `{ spotId, updatedAt, units, current, next24h, next7days }`
  Lee **exclusivamente** de la base de datos (no llama a Stormglass en caliente).
- `GET /api/health` → estado y spots almacenados.

## Puesta en marcha (local)

```bash
cd backend
cp .env.example .env          # y pon tu STORMGLASS_API_KEY
npm install
npm start                     # arranca el servidor + 1ª sync + cron
# o, para sincronizar a mano una vez:
npm run sync
```

Requiere **Node 18+** (usa `fetch` nativo).

Prueba:
```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/spots/salinas/forecast
```

## Variables de entorno (`.env`)

| Variable | Por defecto | Descripción |
|---|---|---|
| `STORMGLASS_API_KEY` | — | **Obligatoria.** Tu clave de Stormglass. |
| `PORT` | `8080` | Puerto HTTP. |
| `CORS_ORIGIN` | `*` | Origen(es) del frontend, coma-separado. |
| `SYNC_CRON` | `0 */4 * * *` | Frecuencia de sync (cron). Cada 3–6 h recomendado. |
| `FORECAST_DAYS` | `7` | Días de previsión a pedir. |
| `SG_SOURCE` | `sg` | Fuente Stormglass (`sg` = media de modelos). |

> ⚠️ **Seguridad:** no subas el `.env` real al repositorio. Si la clave se ha
> compartido alguna vez en texto plano, **rótala** en el panel de Stormglass.

## Despliegue

Cualquier host de Node sirve (Render, Railway, Fly.io, un VPS, etc.):

1. Sube la carpeta `backend/`.
2. Define las variables de entorno en el panel del host (incl. `STORMGLASS_API_KEY`).
3. Comando de arranque: `npm start`.
4. En el **frontend**, antes de `forecast.js`, apunta a tu backend:
   ```html
   <script>window.SURFEDEX_FORECAST_API = "https://tu-backend.ejemplo.com";</script>
   ```
   Sin esa línea, el frontend muestra **datos de ejemplo** (modo validación).

## Cuota de Stormglass

El plan gratuito tiene un límite diario de peticiones. Por eso **no** se llama a
Stormglass por visita: se sincroniza en bloque cada pocas horas (1 petición por
spot) y el frontend lee siempre de la BD. Con 1 spot (Salinas) y sync cada 4 h son
~6 peticiones/día.

## Persistencia

El MVP guarda en `data/forecasts.json` (archivo en disco) — ver `src/db.js`.
Para producción, sustituye **solo** ese módulo por tu base de datos real
(Postgres/Mongo); el resto del backend no cambia. Las interfaces del dominio
(`Spot`, `Forecast`, respuesta del endpoint) están en `models.ts`.

## Puntuación (`spotScore`)

`src/spotScore.js` implementa `spotScore(spot, forecast) → 0..100` con las bandas:

| Rango | Banda |
|---|---|
| 0–20 | Malo |
| 21–40 | Surfable |
| 41–60 | Bueno |
| 61–80 | Muy bueno |
| 81–100 | Épico |

Depende de dirección/tamaño/periodo del swell y dirección/intensidad del viento.
Cada spot trae sus reglas en `src/spots.js` (`bestSwellDirection`,
`bestWindDirection` y, opcional, `score.swellIdeal` / `score.periodIdeal`).
Afina los pesos en `spotScore.js` cuando valides resultados reales.

## Añadir más spots

Cuando el piloto de Salinas convenza, añade spots a `src/spots.js` (con sus
reglas) y, en el frontend, amplía `PILOT_SPOTS` en `forecast.js` (o pásalo a
"todos"). La estructura ya está preparada para ello.
