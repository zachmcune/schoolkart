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
| Handling | Brake or you run wide. Stab **the 90**, slow for the **hairpin**, carry the **sweeper** only if tires are fresh. Holding W the whole way loses. |
| Fuel | The **clock**. Ticks even while coasting. One forced box in 5 laps. Skip it and limp home. |
| Tires | **Handling**, not a second clock. Push and they go loose — not shredded. |
| Grass | A **crawl** plus extra wear. Never faster than asphalt, never parked at 0. Miss the peel and you can still roll back on. Holding W on the lawn loses. |
| Pit | Real pull-off: peel **LEFT** into a separate pit lane (IN), stop in the teal **BOX**, then pull **OUT**. Service is automatic when you are in the box **and** below a walk for 2.5s. Timer **pauses** if you creep, **resets** if you leave the box or hit **W**. Space is **brake**, not pit hold. One service per visit. **S** reverse unsticks an overshoot. Blur does not zero the timer. |

**Controls:** W / ↑ throttle (also revs on the grid) · **Space = brake** · **S / ↓ reverse** · A D / ← → steer · Enter or Space on the title to grid up.

**Start:** skip formation lap. Blue PRE-START flash, five reds one-by-one (~1s), random hold (0.2–3s) with all five ON, lights out = GO. Fuel clock starts at lights-out. **Space plants** the marks. **W revs** (no creep if Space is held). Dump W without Space and the car can roll = flash **JUMP**, dead ~1.5s, still race (no DNF). Stay on Space for a clean start.

**Hits:** cars bash — shove, spin, no ghosting through each other.

Car **#7** is white/teal. Campus is golden-hour brick with **one** clock tower. Original IP only.

## GitHub Pages

Repo is a static site (HTML + CSS + JS + Three.js from CDN). Public Pages currently deploys from this branch (`cursor/campus-loop-playable-f645`). Hard-refresh after a push.

No bundler. Keyboard only. Light enough for school Chrome / integrated graphics.
