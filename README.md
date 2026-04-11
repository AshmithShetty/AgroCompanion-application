# AgroCompanion Demo Suite

This repository contains a three-part demo system intended to be run together:

- `AgroCompanion` — Expo (React Native) app that can run on mobile (Expo Go) and on web (Expo Web).
- `demo-controller` — Vite + React web UI used to drive demo scenarios and monitor live sensor and AI activity.
- `simulation-server` — Node.js server that provides a Simulation API and runs an MQTT WebSocket broker used by the system.

## Architecture (Local)

- Simulation API & MQTT WebSocket Broker: `http://localhost:3000` / `ws://localhost:3000`
- Demo Controller UI: `http://localhost:5173` (Vite default)
- AgroCompanion (Web): `http://localhost:8081` (Expo dev server for web)

`demo-controller` sends commands to `simulation-server` over HTTP, subscribes to live sensor telemetry over MQTT (WebSocket), and polls `/farm/state` every 3 seconds as a reliability fallback. `AgroCompanion` (the mobile/web app) also connects to the same MQTT broker to receive IoT data and publishes AI action logs back to `agri/demo_farm/app/log`, which the demo controller displays in its Live AI & App Actions panel.

## Prerequisites

- Git
- Node.js 18+ (LTS recommended) and npm
- Python 3.10+ (used for `start.py`)

Optional (for running on a phone/emulator):

- Expo Go on a physical device, or Android Studio Emulator / iOS Simulator (macOS)

## Repository Layout

- `AgroCompanion/` — Expo project
- `demo-controller/` — Vite project
- `simulation-server/` — Node.js simulation server + MQTT broker
- `start.py` — convenience launcher that starts all three processes together

## Setup (Step-by-step)

### 1) Clone

```bash
git clone <your-repo-url>
cd AgroCompanion-application
```

### 2) Install dependencies

Install dependencies in each project directory:

Windows (Command Prompt):

```bash
cd AgroCompanion
npm install
cd ..\simulation-server
npm install
cd ..\demo-controller
npm install
cd ..
```

macOS / Linux (bash/zsh):

```bash
cd AgroCompanion
npm install
cd ../simulation-server
npm install
cd ../demo-controller
npm install
cd ..
```

### 3) Configure environment variables (AgroCompanion)

This repo uses Expo public environment variables. Anything named `EXPO_PUBLIC_*` is bundled into the client app for web/mobile, so treat it as non-secret for real deployments.

Create a local env file from the example:

Windows:

```bash
copy AgroCompanion\.env.example AgroCompanion\.env
```

macOS / Linux:

```bash
cp AgroCompanion/.env.example AgroCompanion/.env
```

Open `AgroCompanion/.env` and fill in the values you need.

Key variables:

- `EXPO_PUBLIC_MQTT_BROKER_URL` — MQTT WebSocket broker URL. On a phone, set this to your computer's LAN IP (for example `ws://192.168.1.10:3000`). Defaults to `ws://localhost:3000` if left blank.
- `EXPO_PUBLIC_GROQ_API_KEY` — Groq API key used by the app for text generation, speech summarization, and STT capabilities.
- `EXPO_PUBLIC_OPENWEATHER_KEY` — OpenWeatherMap API key for 5-day forecast data.
- `EXPO_PUBLIC_DATA_GOV_KEY` — data.gov.in API key for mandi price lookups.
- `EXPO_PUBLIC_AGROMONITORING_API_KEY` — Agromonitoring API key for satellite NDVI data.

The `demo-controller` does not require its own `.env` to be created — it reads `VITE_API_BASE_URL` and `VITE_MQTT_BROKER_URL` from `demo-controller/.env`, which is already present in the repository pointing to `localhost:3000`.

### 4) Run everything

From the repo root:

```bash
python start.py
```

If your system uses `python3`:

```bash
python3 start.py
```

This starts:

- AgroCompanion: `npx expo start -c` (from `AgroCompanion/`)
- Simulation server: `node server.js` (from `simulation-server/`)
- Demo controller: `npm run dev` (from `demo-controller/`)

To stop all processes, press `Ctrl+C` in the terminal running `start.py`.

## Using the Demo

### Demo Controller

Open `http://localhost:5173`.

The header shows an **MQTT status badge** (green = connected). If it shows red/offline, verify the simulation server is running.

Panels:
- **State Dashboard** — Live sensor readings. Refreshes every 3 seconds via REST polling and instantly via MQTT when values change.
- **Control Panel** — Sliders to set individual sensor values. Buttons to start/stop rain or drop nutrients. Time speed multiplier for the simulation loop.
- **Scenario Runner** — Pre-built scenarios that set multiple sensors at once.
- **Live AI & App Actions** — Log stream of AI decisions and task actions published by AgroCompanion.
- **Raw Sensor Telemetry** — Raw MQTT message log showing every sensor key/value as it arrives.

### AgroCompanion

If running on web:

- Start Expo with `python start.py`
- In the Expo terminal UI, press `w` to open the web version (or open the URL printed by Expo)
- Default is `http://localhost:8081`

If running on a device:

- Install Expo Go
- Scan the QR code shown by Expo (LAN must be reachable)
- If `simulation-server` runs on your computer and AgroCompanion runs on your phone, `localhost` will not work from the phone. Set `EXPO_PUBLIC_MQTT_BROKER_URL` in `AgroCompanion/.env` to your computer's LAN IP, for example: `ws://192.168.1.10:3000`, then restart Expo.

## Manual Run (Three Terminals)

If you prefer not to use `start.py`:

```bash
cd simulation-server
node server.js
```

```bash
cd demo-controller
npm run dev
```

```bash
cd AgroCompanion
npx expo start -c
```

## Troubleshooting

- **Port already in use:**
  - Simulation API & MQTT broker use port `3000`
  - Vite uses port `5173`
  - Expo Web commonly uses port `8081`

- **Demo Controller MQTT badge shows red/offline:**
  - Verify `simulation-server` is running (`node server.js` from `simulation-server/`)
  - Both the API and the MQTT WebSocket broker run on port `3000`. The demo controller connects to `ws://localhost:3000`.

- **State Dashboard not updating after slider change:**
  - The dashboard polls `/farm/state` every 3 seconds and also listens for MQTT messages. If MQTT is connected (green badge), values update instantly. If MQTT is offline, the 3-second poll will still reflect the latest state.

- **Live AI & App Actions shows "Waiting for mobile app connection...":**
  - This panel only fills when `AgroCompanion` is running and connected to the MQTT broker. Start `AgroCompanion` with `python start.py` or `npx expo start -c`, then trigger a sensor anomaly via the Control Panel to see AI decisions appear.

- **Expo web opens but shows stale bundles:**
  - Rerun with `npx expo start -c` (clears the Metro cache).

- **AI tasks duplicate on repeated threshold breach:**
  - The system checks for an existing pending task with the same IoT source (`iot_<sensor>`) before calling the AI. Tasks are auto-resolved when sensor values return to within threshold bounds.


