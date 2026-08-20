# SchoolKart

Arcade F1 for school Chromebooks. Share a Chrome link — no install.

Creative lead: **Zachary McUne**. Feel spec: Pit Crew Designer.

## Play

Public URL after GitHub Pages is on:

**https://zachmcune.github.io/schoolkart/**

Local: open `index.html` via any static server (Chrome blocks some module-free file opens depending on school policy). From this folder:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Campus Loop (locked feel)

5 laps, ~2–3 minutes. This is **not** a kart racer and **not** a sim.

| Thing | Rule |
| --- | --- |
| Handling | Brake or you run wide. Stab **the 90**, a **short**, a **kink**, slow for the **hairpin**, carry the **sweeper** only if tires are fresh. Holding W the whole way loses. Not a ring. |
| Fuel | The **clock**. Ticks even while coasting. One forced box in 5 laps. Skip it and limp home. |
| Tires | **Handling** (sloppy, run wide) — never a speed cap. Worn tires can still crawl to the box. Only **empty fuel** limps. |
| Grass | A **crawl** plus extra wear. Never faster than asphalt, never parked at 0. Miss the peel and you can still roll back on. Holding W on the lawn loses. Readable green / sandy runoff — not a black void. |
| Pit | Peel **LEFT** onto a lane that splits off the south straight. Drive **halfway IN the lane** — then the car is grabbed and serviced (~2.5s, fuel + tires) and released. Clipping the entry ramp does **not** count. No Space, no sit-still. One service per visit. |

**Controls:** W / ↑ throttle (also revs on the grid) · **Space = brake** · **S / ↓ reverse** · A D / ← → steer · Enter or Space on the title to grid up.

**Start:** skip formation lap. Blue PRE-START flash, five reds one-by-one (~1s), random hold (0.2–3s) with all five ON, lights out = GO. Fuel clock starts at lights-out. **Space plants** the marks. **W revs** (no creep if Space is held). Dump W without Space and the car can roll = flash **JUMP**, dead ~1.5s, still race (no DNF). Stay on Space for a clean start.

**Hits:** cars bash — shove, spin, no ghosting through each other.

Car **#7** is white/teal. Campus is golden-hour brick with **one** clock tower. Original IP only.

## Multiplayer (Chromebook lunch)

Friends open the Pages URL. One **Create room**, others type the 4–6 character code and **Join**. Host hits **Grid up** (or Enter). Max 8 cars. Same handling / fuel / tires as solo — no extra grip, no rubber-band speed.

Late join and refresh rejoin the same code. A dropped car goes **ghost**; they can come back. Tab blur does not wipe the room. If the server is down, **Solo** still works.

### Point Pages at Railway

After you deploy the server, either:

1. Edit `js/config.js`:

```js
window.SCHOOLKART_SERVER = "wss://YOUR-APP.up.railway.app";
```

2. Or share a query param (no rebuild):

`https://zachmcune.github.io/schoolkart/?server=wss://YOUR-APP.up.railway.app`

### Run the server locally

```bash
npm install
npm start
```

Listens on `PORT` (default **8787**). Health: `GET /health`.

Then open the static game with `?server=ws://localhost:8787` (use two browser windows to create + join).

```bash
python3 -m http.server 8080
# http://localhost:8080/?server=ws://localhost:8787
```

### Railway

- **Start command:** `npm start` (or `node server/index.js`)
- **Env:** `PORT` is set by Railway — do not hardcode it
- No database. Rooms live in memory (fine for lunch races)
- Root `package.json` is the server manifest

Protocol smoke test:

```bash
npm test
```

## GitHub Pages

Repo is a static site (HTML + CSS + JS + Three.js from CDN). Public Pages currently deploys from this branch (`cursor/campus-loop-playable-f645`). Hard-refresh after a push.

No bundler. Keyboard only. Light enough for school Chrome / integrated graphics.
