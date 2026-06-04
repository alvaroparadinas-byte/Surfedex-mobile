# Surfedex · Surf Mach

Atlas interactivo de spots de surf (frontend estático) + backend de previsiones
(Stormglass). Pensado para un único repositorio: el frontend en la raíz y el
servidor en `backend/`.

## Estructura

```
.
├── index.html          ← app (mapa + panel + fichas de spots)
├── app.js              ← lógica del frontend (mapa, panel, webcams…)
├── forecast.js         ← panel de previsión (consume el backend)
├── styles.css
├── surfedex-logo.png
├── data/               ← spots.js · photos.js · baked.js (estado horneado)
├── photos/             ← imágenes de los spots
└── backend/            ← servidor Node (Stormglass → BD → API)
```

## Frontend

Es estático: se puede servir con GitHub Pages, Netlify, etc. Ya está conectado al
backend en `index.html`:

```html
<script>window.SURFEDEX_FORECAST_API = "https://surfedex-mobile.onrender.com";</script>
```

Si despliegas el backend en otra URL, cámbiala ahí.

## Backend (Render)

Ajustes del servicio en Render:

| Ajuste | Valor |
|---|---|
| **Root Directory** | `backend` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Environment** | `STORMGLASS_API_KEY` = tu clave (obligatoria) |

`CORS_ORIGIN` por defecto es `*` (acepta cualquier origen). Si quieres restringirlo
a tu dominio del frontend, añádelo como variable de entorno.

> ⚠️ No subas nunca un `.env` real con la clave. La clave va solo en el panel de
> Environment de Render. En el repo solo va `backend/.env.example` (plantilla).

Más detalle del backend en `backend/README.md`.

## Spots con previsión real (piloto)

Ahora mismo el parte real (Stormglass vía backend) está activo para **Salinas**.
Para añadir más: amplía `PILOT_SPOTS` en `forecast.js` y añade el spot (con sus
reglas) en `backend/src/spots.js`.
