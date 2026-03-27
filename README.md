# AgroCompanion Demo Suite

This repository contains a three-part demo system intended to be run together:

- `AgroCompanion` — Expo (React Native) app that can run on mobile (Expo Go) and on web (Expo Web).
- `demo-controller` — Vite + React web UI used to drive demo scenarios and sensor values.
- `simulation-server` — Node.js server that provides a Simulation API and runs an MQTT WebSocket broker used by the system.

## Architecture (Local)

- Simulation API: `http://localhost:3000`
- MQTT WebSocket Broker: `ws://localhost:1884`
- Demo Controller UI: `http://localhost:5173` (Vite default)
- AgroCompanion (Web): `http://localhost:8081` (Expo dev server for web)

`demo-controller` sends commands to `simulation-server` over HTTP, and subscribes to telemetry over MQTT (WebSocket). `AgroCompanion` also connects to the same MQTT broker and can fetch external data (weather / satellite) depending on configuration.

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
cd application
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

Open `AgroCompanion/.env` and set values as needed for your environment.

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

Open:

- `http://localhost:5173`

Use the Control Panel and Scenario Runner to send events and sensor updates to the simulation server.

### AgroCompanion

If running on web:

- Start Expo with `python start.py`
- In the Expo terminal UI, press `w` to open the web version (or open the URL printed by Expo)
- Default is `http://localhost:8081`

If running on a device:

- Install Expo Go
- Scan the QR code shown by Expo (LAN must be reachable)
- If `simulation-server` runs on your computer and AgroCompanion runs on your phone, `localhost` will not work from the phone. Set `EXPO_PUBLIC_MQTT_BROKER_URL` in `AgroCompanion/.env` to your computer’s LAN IP, for example: `ws://192.168.1.10:1884`, then restart Expo.

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

- Port already in use:
  - Simulation API uses port `3000`
  - MQTT broker uses port `1884`
  - Vite uses port `5173`
  - Expo Web commonly uses port `8081`
- If the Demo Controller shows “Waiting for mobile app connection…”, verify:
  - `simulation-server` is running (for MQTT broker and telemetry)
  - `AgroCompanion/.env` has `EXPO_PUBLIC_MQTT_BROKER_URL=ws://localhost:1884`
- If Expo web opens but shows stale bundles, rerun with `npx expo start -c` (cache cleared).


