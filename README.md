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
| Handling | Brake or you run wide. Wind the two long straights. Decreasing-radius **90**, left-right **chicane** (lift or clip the kerb / sand), real **180 hairpin** (late brake = dump), **sweeper** only on fresh tires. Holding W the whole way loses. |
| Fuel | The **clock**. Ticks even while coasting. Burn is tuned so **5 laps still force one box** — never a second stop. Skip it and limp home. |
| Tires | **Handling** (sloppy, run wide) — never a speed cap. Worn tires can still crawl to the box. Only **empty fuel** limps. |
| Grass | A **crawl** plus extra wear — only if you get past the runoff onto infield patches. Never faster than asphalt, never parked at 0. The 180 and chicane use painted runoff / sand, not a grass beach. Holding W off-course loses. |
| Pit | Peel **LEFT** off the south straight onto a real side lane (bypass) that runs parallel and merges back. Drive **halfway IN that lane** — then the car is grabbed and serviced (~2.5s, fuel + tires) and you drive out. Clipping the entry ramp does **not** count. One service per visit. |

**Controls:** W / ↑ throttle (also revs on the grid) · **Space = brake** · **S / ↓ reverse** · A D / ← → steer · Enter or Space on the title to grid up.

**Phones (landscape):** right half = gas · left half = brake · tilt to steer with a **fat deadzone** (calibrated to held landscape). Tiny **R** is reverse for a pit overshoot. iPhone needs a **Tap for tilt steer** the first time. First phone load shows: `Right gas · Left brake · Tilt to steer`.

**Chromebooks stay WASD / Space only.** A touchscreen lid does not get the phone overlay. If a keyboard is in play, no touch driving.

**Start:** skip formation lap. Blue PRE-START flash, five reds one-by-one (~1s), random hold (0.2–3s) with all five ON, lights out = GO. Fuel clock starts at lights-out. The car is **locked to the grid** until GO — no creep, no jump-roll. Room grid sits on the **asphalt ribbon** (outside the south straight), not the open pit peel, and **keeps the slot heading**. **W** climbs the needle through the green — lift to catch the mark. In the green at GO = GOOD / GREAT. Below or past the mark = SLUGGISH getaway on asphalt (~1.5s), not a spin onto grass. The 180 dump hole is mid-race if you run wide. Space is brake after GO.

**Course (chase-cam read):** asphalt ribbon → red/white kerbs → painted/asphalt runoff → barrier. Asphalt is the darker grey; runoff is a lighter/cooler painted grey — they must read apart, never black-on-black. Kerbs on every named corner (90 / hairpin / chicane / sweeper / kink) pop red/white. Discrete green infield patches sit past the runoff, not a lawn. Concrete wall bases are light grey under dark two-rail steel. Kerbs are mountable; a dive wiggles, not a ramp.

**Hits:** cars bash — shove, spin, no ghosting through each other. **Barriers** run both sides, continuous except the **LEFT pit peel** (stays open, no clip-grab). Low grey concrete + dark two-rail steel. Taller only outside the 180 / chicane / sweeper. They collide. Not a go-kart cage.

**Nametags:** tiny halo billboards on **other** cars (humans + bots). Own tag can stay off. Other humans use their lobby name. One bot is exactly **BowieKnife99**; others are Hall Monitor / Sub Teacher / campus kids. Tags shrink with distance and fade down the racing line — no flicker, no HUD plaques.

**Bots:** same physics as you — no extra grip. Cheap look-ahead on **every** map: they read **ribbon radius and which way it turns** (Campus names or a custom 4-piece), brake on the real heavy-car marks, hold the **inside**, and peel LEFT for one box on lap 3–4. The whole field runs **Bowie's racecraft** — cap pace, smart passing (off-line, not through you), and **pass blocking** (cover the lane, keep racing, never a U-turn ram). **BowieKnife99** is still the hunter — if you pull a gap he reels you in on the ribbon (no teleport, no extra grip). Close up he divebombs (still makes the corner). Everyone else skips the ram. Locked to the grid until GO. A clean player can win; it should not be easy.

**FX (designer lock, few, short, readable at 30fps):** two fat tire puffs at lights-out · thin grey streaks from the rears when tires are bad · short white slip off the outside wheels on a hard turn · one dust burst on a spin-out · one sharp spark at a hit (not a cloud). Launch puffs and hit sparks do not look the same.

Car **#7** is white/teal by default. Title-screen garage picks body + wing colors (saved on the device). Friends see your paint in the room. Campus is golden-hour brick with **one** clock tower. Original IP only.

**Track editor:** title **Track** button. Regular tile grid. Kit: straight, long straight, 90, wide sweeper, hairpin, chicane, start/finish, pit, tree. Pieces snap to cell centers and meet flush. Driveable asphalt and the race line are rebuilt from the placed pieces — a closed loop laps; open layouts stay driveable. Bots follow the custom ribbon. Share-string (up to 240) encodes type + cell + rotation. **Default · Campus Loop** restores the real ~2km loop and clears the save / room code.

## Multiplayer (Chromebook lunch)

Friends open the Railway URL. One **name field**, then **Create** / **Join**. The in-room list shows names with a **★** on the host. Host-only buttons under the list: **Kick** (tap a name first), **+Bot −Bot**, **Add Bowie knife** (seats the hunter once; disables if they’re already in), and **1x · 1.25x** (cycles, 0.75x too). Speed is the same for everyone. Host hits **Grid up** (or Enter). Max 8 cars including CPUs. Same handling / fuel / tires as solo — no extra grip, no rubber-band.

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
- Same process serves `index.html` / `js` / `css` / the PWA manifest + icons and the WebSocket
- No database. Rooms live in memory (fine for lunch races)
- Root `package.json` is the server manifest

Protocol smoke test (includes `GET /` returning SchoolKart HTML):

```bash
npm test
```

## Deploy

Ship from **`main` only**. Railway and GitHub Pages should both track `main`. Do not merge playable work onto a long-lived side branch — that is how zachf1 froze on old tiles.

## GitHub Pages (fallback)

Repo is also a static site (HTML + CSS + JS + Three.js from CDN). Pages deploys from `main`. Use Railway as the school link.

`index.html` is marked `no-store`. JS/CSS are versioned (`?v=mp90`) so a **normal reload** picks up the lobby.

**Install (PWA):** on phone Safari / Chrome, Add to Home Screen. Standalone landscape chrome, dark splash (`#1a120e`). Original teal/cream mark (192 + 512 + apple-touch-icon). The service worker is network-first and does **not** cache the race or the websocket — a new Railway deploy is not a trapped old build. Offline play is not required.

No bundler. Keyboard on Chromebooks. Phones get tilt + halves. Light enough for school Chrome / integrated graphics.
