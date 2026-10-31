# TrackGuard — Railway Track Monitoring Dashboard

Next.js 14 · React 18 · Tailwind CSS · Recharts · Zustand · Lucide icons (no emoji)

Top-view track video, IMU sensor graphs, AI-style defect detection, journey tracking,
dark + light themes, and a Radxa hardware connect flow. Runs fully in **simulator mode**
today; flip to hardware when the Radxa is ready.

## Run it

Requirements: Node.js 18.18+ (20 or 22 recommended) and npm.

```bash
unzip trackguard.zip
cd trackguard
npm install
npm run dev          # http://localhost:3000
```

Production build:

```bash
npm run build
npm start            # http://localhost:3000
```

## App flow

1. `/setup` – operator information (name, ID, role, division, shift, safety acknowledgement)
2. `/connect` – hardware: Simulator or Radxa (IP, port, endpoints, connection check)
3. `/journeys` – main page: 5 live journey video tiles with routes, progress, health
4. `/journeys/[id]` – full tracking: video + floating sensor graphs, route map, station timeline, defect log
5. Sidebar (collapsible): Dashboard, Live Monitoring, Detections, Sensor Data, Journey Map,
   Video Analysis, Alerts, Reports, Hardware, Settings

Theme toggle is in the top bar. Everything (operator, settings, journeys, alerts) persists in
the browser's localStorage. Settings → Reset everything restarts onboarding.

## Connecting the Radxa

1. Copy `hardware/radxa_server.py` to the Radxa, then `pip install flask opencv-python` and run
   `python3 radxa_server.py` (port 8080).
2. Replace `read_imu()` with your real IMU reads.
3. In the app: `/connect` → Radxa hardware → enter the Radxa IP → Test connection → Launch.

Endpoints the dashboard expects:

| Endpoint | Returns |
|---|---|
| `GET /api/status` | `{"ok": true}` |
| `GET /api/sensors` | `{"speed", "vibration", "accel":[x,y,z], "orientation":{"roll","pitch","yaw"}, "temperature"}` |
| `GET /stream.mjpg` | MJPEG video of the top-view camera |

In hardware mode the active journey shows the live stream and real IMU values. Defect boxes and
alerts still come from the simulator until your model reports detections (see below).
Browsers block `http://` device calls from an `https://` page, so run the dashboard locally
(`npm run dev`) while testing with the Radxa.

## Plugging in your model

- **Live detections:** `lib/sim.ts` → `stepSim()` creates events. Replace that with detections
  from your Radxa (e.g. poll `/api/detections`) and call `useStore.setState` to push `TrackEvent`s.
- **Video analysis page:** `app/(app)/video-analysis/page.tsx` — replace the random generator
  inside the `setInterval` with a call to your inference endpoint.

## Project layout

```
app/            routes (setup, connect, (app)/* pages)
components/     Shell (nav), TrackCanvas (top-view renderer), maps, charts, cards
lib/            store, simulator, journeys data, defect metadata, canvas rendering
hardware/       radxa_server.py reference server
```

Add or edit journeys in `lib/journeys.ts`. Tune simulation speed, defect frequency and the
vibration threshold in Settings.
