# SchoolKart

Arcade F1 for school Chromebooks. Share a Chrome link — no install.

Creative lead: **Zachary McUne**. Feel spec: Pit Crew Designer.

## Play

**One URL (Railway — use this at school):**

**https://zachf1.up.railway.app/**

Same host serves the game and the rooms. No GitHub Pages, no `?server=` required.

GitHub Pages still works as a fallback: https://zachmcune.github.io/schoolkart/ (it talks to the same Railway rooms).

Local: `npm start`, then open `http://localhost:8787` (or whatever `PORT` is). Same-origin WSS.

## Campus Loop (locked feel)

5 laps. Measured centerline **1979** world units (about 2 km at 1 unit ≈ 1 m). This is **not** a kart racer and **not** a sim.

| Thing | Rule |
| --- | --- |
| Handling | Brake or you run wide. Wind the two long straights. Decreasing-radius **90**, left-right **chicane** (lift or clip grass), real **180 hairpin** (late brake = dump), **sweeper** only on fresh tires. Holding W the whole way loses. |
| Fuel | The **clock**. Ticks even while coasting. Burn is tuned so **5 laps still force one box** — never a second stop. Skip it and limp home. |
| Tires | **Handling** (sloppy, run wide) — never a speed cap. Worn tires can still crawl to the box. Only **empty fuel** limps. |
| Grass | A **crawl** plus extra wear. Never faster than asphalt, never parked at 0. Miss the peel and you can still roll back on. Holding W on the lawn loses. Readable green / sandy runoff — not a black void. |
| Pit | Peel **LEFT** onto a lane that splits off the south straight. Drive **halfway IN the lane** — then the car is grabbed and serviced (~2.5s, fuel + tires) and released. Clipping the entry ramp does **not** count. No Space, no sit-still. One service per visit. |

**Controls:** W / ↑ throttle (also revs on the grid) · **Space = brake** · **S / ↓ reverse** · A D / ← → steer · Enter or Space on the title to grid up.

**Start:** skip formation lap. Blue PRE-START flash, five reds one-by-one (~1s), random hold (0.2–3s) with all five ON, lights out = GO. Fuel clock starts at lights-out. **Space plants** the marks. **W revs** (no creep if Space is held). Dump W without Space and the car can roll = flash **JUMP**, dead ~1.5s, still race (no DNF). Stay on Space for a clean start.

**Hits:** cars bash — shove, spin, no ghosting through each other.

Car **#7** is white/teal. Campus is golden-hour brick with **one** clock tower. Original IP only.

## Multiplayer (Chromebook lunch)

Friends open the Railway URL. One **Create room**, others type the 4–6 character code and **Join**. Host hits **Grid up** (or Enter). Max 8 cars. Same handling / fuel / tires as solo — no extra grip, no rubber-band speed.

Late join after lights-out drops them into the live race and **says so** (no silent fail). Refresh **rejoins the same room and the same race** — same clock, fuel, tires, lap, and the other cars. It does not spawn a fresh 0:00 / full-tank solo. A dropped car goes **ghost**; they can come back. Tab blur does not wipe the room. If the server is down, **Solo** still works.

`?server=` still overrides the socket (only needed for odd setups). Pages falls back to this Railway host on its own.

### Run locally

```bash
npm install
npm start
```

Listens on `PORT` (default **8787**). Open `http://localhost:8787`. Health: `GET /health`.

Two browser windows: Create + Join. Same origin — no second static server.

### Railway

- **Start command:** `npm start` (or `node server/index.js`)
- **Env:** `PORT` is set by Railway — do not hardcode it
- Same process serves `index.html` / `js` / `css` and the WebSocket
- No database. Rooms live in memory (fine for lunch races)
- Root `package.json` is the server manifest

Protocol smoke test (includes `GET /` returning SchoolKart HTML):

```bash
npm test
```

## GitHub Pages (fallback)

Repo is also a static site (HTML + CSS + JS + Three.js from CDN). Public Pages currently deploys from this branch (`cursor/campus-loop-playable-f645`). Use Railway as the school link.

`index.html` is marked `no-store`. JS/CSS are versioned (`?v=mp11`) so a **normal reload** picks up the lobby.

No bundler. Keyboard only. Light enough for school Chrome / integrated graphics.
