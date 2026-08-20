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
| Pit | Peel **LEFT**. Paved pit lane + open painted **teal** box, connected to the main straight (no grass gap). No wall, no clamp. Drive in, **hold Space 2.5s** to refill fuel **and** reset tires. The stop costs enough that you pick **when** (lap 2 vs 3), not whether. |

Controls: **WASD** or arrows. Space starts the race, and later holds the pit.

Car **#7** is white/teal. Campus is golden-hour brick with **one** clock tower. Original IP only.

## GitHub Pages

Repo is a static site (HTML + CSS + JS + Three.js from CDN). Workflow: `.github/workflows/pages.yml`.

If the URL 404s, a repo admin enables Pages once:

1. GitHub → **Settings → Pages**
2. Source: **GitHub Actions**
3. Merge this branch to `main` (or run the workflow)

No bundler. Keyboard only. Light enough for school Chrome / integrated graphics.
