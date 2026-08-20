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
| Pit | Peel **LEFT** off the south straight onto a real side lane (bypass) that runs parallel and merges back. Drive **halfway IN that lane** — then the car is grabbed and serviced (~2.5s, fuel + tires) and you drive out. Clipping the entry ramp does **not** count. One service per visit. |

**Controls:** W / ↑ throttle (also revs on the grid) · **Space = brake** · **S / ↓ reverse** · A D / ← → steer · Enter or Space on the title to grid up.

**Phones (landscape):** right half = gas · left half = brake · tilt to steer with a **fat deadzone** (calibrated to held landscape). Tiny **R** is reverse for a pit overshoot. iPhone needs a **Tap for tilt steer** the first time. First phone load shows: `Right gas · Left brake · Tilt to steer`.

**Chromebooks stay WASD / Space only.** A touchscreen lid does not get the phone overlay. If a keyboard is in play, no touch driving.

**Start:** skip formation lap. Blue PRE-START flash, five reds one-by-one (~1s), random hold (0.2–3s) with all five ON, lights out = GO. Fuel clock starts at lights-out. The car is **locked to the grid** until GO — no creep, no jump-roll. **W** is a timing game: hold it to park the needle in the green sweet-spot. Hit it at lights-out = launch. Miss low = sluggish. Miss high = wheelspin. Space is brake after GO.

**Hits:** cars bash — shove, spin, no ghosting through each other. **Walls** sit at the misses that should hurt (hairpin outside, chicane, the 90, pit entry) — same shove/spin as car-on-car, not a box around the map.

**FX (cheap, must read):** orange heat at the rears when you light them up from a standstill / on the grid; sandy dust when tires are worn and sliding; grey smoke on a spin-out; a wisp on a hard turn; sparks + one puff on a bash. 36-plane pool so Chromebooks stay alive.

Car **#7** is white/teal by default. Title-screen garage picks body + wing colors (saved on the device). Friends see your paint in the room. Campus is golden-hour brick with **one** clock tower. Original IP only.

**Track editor:** title **Track** button. Stamp short / long / left 90 / right 90 / hairpin / chicane / pit / tree. Empty code is **Campus Loop** (~1979). Copy the short string (max 80) and paste to rebuild — no account. Host’s code rides with the room.

## Multiplayer (Chromebook lunch)

Friends open the Railway URL. One **name field**, then **Create** / **Join**. The in-room list shows names with a **★** on the host. Host-only buttons under the list: **Kick** (tap a name first), **+Bot −Bot**, and **1x · 1.25x** (cycles, 0.75x too). Speed is the same for everyone. Host hits **Grid up** (or Enter). Max 8 cars including CPUs. Same handling / fuel / tires as solo — no extra grip, no rubber-band.

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

`index.html` is marked `no-store`. JS/CSS are versioned (`?v=mp21`) so a **normal reload** picks up the lobby.

No bundler. Keyboard on Chromebooks. Phones get tilt + halves. Light enough for school Chrome / integrated graphics.
