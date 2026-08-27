/* Bot pace telemetry. Runs the real brain headlessly over Campus, the
   five built-in circuits and a set of editor-style custom loops, and
   prints what the field actually did.

     node tools/ai-probe.js              every track, full field
     node tools/ai-probe.js campus       one track
     node tools/ai-probe.js --profile    speed profile for one track
*/
"use strict";

var sim = require("../server/ai-sim.js").buildSim();

var FIELD = (process.env.FIELD || "BowieKnife99,Hall Monitor,Sub Teacher,Library Kid,Band Kid,Lab Partner,Detention").split(",");

// Editor-style loops, built from the same path primitives the tile
// editor emits, so "custom track" coverage is not just Campus again.
var CUSTOM = {
  "rect-90-44": function () {
    sim.pathLine(180, "start");
    sim.pathArc(44, 90, "the90");
    sim.pathLine(140, "short");
    sim.pathArc(44, 90, "the90");
    sim.pathLine(180, "short");
    sim.pathArc(44, 90, "the90");
    sim.pathLine(140, "short");
    sim.pathArc(44, 90, "the90");
  },
  "rect-90-22": function () {
    sim.pathLine(180, "start");
    sim.pathArc(22, 90, "the90");
    sim.pathLine(140, "short");
    sim.pathArc(22, 90, "the90");
    sim.pathLine(180, "short");
    sim.pathArc(22, 90, "the90");
    sim.pathLine(140, "short");
    sim.pathArc(22, 90, "the90");
  },
  "hairpins-44": function () {
    sim.pathLine(170, "start");
    sim.pathArc(44, 180, "hairpin");
    sim.pathLine(170, "short");
    sim.pathArc(44, 180, "hairpin");
  },
  "hairpins-11": function () {
    sim.pathLine(220, "start");
    sim.pathArc(11, 180, "hairpin");
    sim.pathLine(220, "short");
    sim.pathArc(11, 180, "hairpin");
  },
  sweepers: function () {
    sim.pathLine(90, "start");
    sim.pathArc(132, 90, "sweeper");
    sim.pathLine(90, "short");
    sim.pathArc(132, 90, "sweeper");
    sim.pathLine(90, "short");
    sim.pathArc(132, 90, "sweeper");
    sim.pathLine(90, "short");
    sim.pathArc(132, 90, "sweeper");
  },
  "chicane-mix": function () {
    sim.pathLine(300, "start");
    sim.pathArc(12, 88, "chicane");
    sim.pathLine(40, "chicane");
    sim.pathArc(9, -100, "chicane");
    sim.pathLine(12, "chicane");
    sim.pathArc(13, 60, "chicane");
    sim.pathLine(200, "short");
    sim.pathArc(16, -90, "kink");
    sim.pathLine(120, "short");
    sim.pathArc(22, -90, "the90");
    sim.pathLine(60, "short");
  },
  "tight-twisty": function () {
    sim.pathLine(120, "start");
    sim.pathArc(14, -95, "the90");
    sim.pathLine(70, "short");
    sim.pathArc(18, -70, "the90");
    sim.pathLine(50, "short");
    sim.pathArc(16, 78, "the90");
    sim.pathLine(90, "short");
    sim.pathArc(11, 176, "hairpin");
    sim.pathLine(70, "short");
    sim.pathArc(20, -60, "kink");
    sim.pathLine(40, "short");
  },
};

if (process.env.NOFUEL) sim.setFuelOverride(1e6);

function buildTrack(name) {
  if (CUSTOM[name]) {
    sim.resetPathCursor();
    sim.clearPit();
    CUSTOM[name]();
    sim.autoClosePath();
    sim.sealCustom();
    // buildTrackMeshes() does this for every rebuild in the game. Skip it
    // here and a custom loop inherits the last track's barriers, which
    // reads as the brain jamming when it is really the harness lying.
    sim.placeWalls();
    return;
  }
  sim.buildBuiltin(name);
  if (process.env.NOPIT) sim.clearPit();
}

function trackNames() {
  return ["campus", "harbor", "park", "desert", "forest"].concat(Object.keys(CUSTOM));
}

function profileReport() {
  var R = sim.RACE;
  sim.bakeRaceBrain();
  var lo = Infinity;
  var hi = -Infinity;
  var sum = 0;
  var i;
  var atCap = 0;
  for (i = 0; i < R.n; i++) {
    if (R.v[i] < lo) lo = R.v[i];
    if (R.v[i] > hi) hi = R.v[i];
    sum += R.v[i];
    if (R.v[i] > sim.SPEED_LIMIT - 0.5) atCap += 1;
  }
  var ideal = 0;
  for (i = 0; i < R.n; i++) ideal += R.ds / Math.max(1, R.v[i]);
  return {
    n: R.n,
    ds: +R.ds.toFixed(2),
    vMin: +lo.toFixed(1),
    vMax: +hi.toFixed(1),
    vAvg: +(sum / R.n).toFixed(1),
    flatOutPct: Math.round((atCap / R.n) * 100),
    lapIdeal: +ideal.toFixed(1),
  };
}

function pad(s, n) {
  s = String(s);
  while (s.length < n) s += " ";
  return s;
}

function padL(s, n) {
  s = String(s);
  while (s.length < n) s = " " + s;
  return s;
}

function runTrack(name, seconds, seed, quiet) {
  buildTrack(name);
  sim.setSeed(seed || 1);
  var len = sim.trackLen();
  var prof = profileReport();
  var spawn = { s: len - 6 };
  var field = sim.runField(FIELD, seconds || 620, spawn);
  if (quiet) return summarise(name, len, field, seed);
  console.log(
    "\n" +
      name +
      "  len=" +
      len.toFixed(0) +
      "  profile v " +
      prof.vMin +
      "-" +
      prof.vMax +
      " avg " +
      prof.vAvg +
      "  flat-out " +
      prof.flatOutPct +
      "%  samples " +
      prof.n
  );
  console.log(
    "  " +
      pad("driver", 14) +
      padL("time", 7) +
      padL("lap", 5) +
      padL("avg v", 7) +
      padL("top v", 7) +
      padL("pit", 5) +
      padL("grass", 7) +
      padL("off", 7) +
      padL("rev", 6) +
      padL("still", 7) +
      padL("reset", 6) +
      padL("hits", 6) +
      padL("dry", 6) +
      padL("fuel", 6) +
      padL("rub", 6) +
      padL("peel", 6)
  );
  var i;
  for (i = 0; i < field.length; i++) {
    var f = field[i];
    var laps = f.finished ? 5 : f.lap - 1;
    var avg = f.finishTime > 0 ? (laps * len) / f.finishTime : 0;
    console.log(
      "  " +
        pad(f.name, 14) +
        padL(f.finishTime.toFixed(1), 7) +
        padL(f.finished ? "5" : String(f.lap), 5) +
        padL(avg.toFixed(1), 7) +
        padL(f.maxSpeed.toFixed(1), 7) +
        padL(f.pitStops, 5) +
        padL(f.grass.toFixed(1), 7) +
        padL(f.offTrack.toFixed(1), 7) +
        padL(f.reverseT.toFixed(1), 6) +
        padL(f.still.toFixed(1), 7) +
        padL(f.resets, 6) +
        padL(f.contacts, 6) +
        padL(f.emptyT.toFixed(1), 6) +
        padL(f.fuel.toFixed(0), 6) +
        padL(f.contactT.toFixed(1), 6) +
        padL(f.peelT.toFixed(1), 6)
    );
  }
  if (process.env.RESETS && field.resetLog && field.resetLog.length) {
    console.log("  resets:");
    field.resetLog.slice(0, 24).forEach(function (e) {
      console.log(
        "    t=" +
          padL(e.t.toFixed(1), 6) +
          " lap" +
          e.lap +
          " " +
          pad(e.name, 14) +
          " s=" +
          padL(e.s.toFixed(0), 5) +
          " " +
          pad(e.name2, 10) +
          " dist=" +
          padL(e.dist.toFixed(1), 5) +
          " v=" +
          padL(e.speed.toFixed(1), 6) +
          (e.wantPit ? " wantPit" : "") +
          (e.didPit ? " didPit" : "") +
          (e.pit ? " inPit" : "")
      );
    });
  }
  return summarise(name, len, field, seed);
}

function summarise(name, len, field, seed) {
  var fastest = field[0];
  var slowest = field[field.length - 1];
  return {
    track: name,
    len: len,
    seed: seed || 1,
    spread: +(slowest.finishTime - fastest.finishTime).toFixed(1),
    winner: fastest.name,
    worst: slowest.name,
    reverseT: +field
      .reduce(function (a, f) {
        return a + f.reverseT;
      }, 0)
      .toFixed(1),
    stillT: +field
      .reduce(function (a, f) {
        return a + f.still;
      }, 0)
      .toFixed(1),
    allFinished: field.every(function (f) {
      return f.finished;
    }),
    resets: field.reduce(function (a, f) {
      return a + f.resets;
    }, 0),
  };
}

// Where does a lap actually go? Bucket the ribbon and compare what the
// bot did against what the profile said it could do.
function traceTrack(name, driver) {
  buildTrack(name);
  var len = sim.trackLen();
  var prof = profileReport();
  var trace = sim.runTrace(driver || "Hall Monitor", 400);
  var bucket = 40;
  var nb = Math.ceil(len / bucket);
  var tGot = [];
  var tCap = [];
  var i;
  for (i = 0; i < nb; i++) {
    tGot[i] = 0;
    tCap[i] = 0;
  }
  // Time cost per bucket, actual against profile. Distance is fixed, so
  // seconds lost is the honest unit and slow moments cannot double-count.
  for (i = 0; i < trace.samples.length; i++) {
    var sm = trace.samples[i];
    if (sm.pit) continue;
    var b = Math.min(nb - 1, Math.floor(sm.s / bucket));
    tGot[b] += sm.dt;
    tCap[b] += sm.ds / Math.max(1, sm.prof);
  }
  var rows = [];
  for (i = 0; i < nb; i++) {
    if (!tGot[i]) continue;
    rows.push({ s: i * bucket, got: tGot[i], cap: tCap[i], loss: tGot[i] - tCap[i], name: trace.names[i] || "" });
  }
  rows.sort(function (a, b) {
    return b.loss - a.loss;
  });
  var tg = 0;
  var tc = 0;
  rows.forEach(function (rw) {
    tg += rw.got;
    tc += rw.cap;
  });
  console.log(
    "\n" +
      name +
      " " +
      (driver || "Hall Monitor") +
      "  best lap " +
      trace.best.toFixed(1) +
      "s vs profile ideal " +
      prof.lapIdeal +
      "s  (" +
      Math.round((prof.lapIdeal / trace.best) * 100) +
      "% of plan)  clean-running loss " +
      (tg - tc).toFixed(1) +
      "s over " +
      trace.laps +
      " laps"
  );
  rows.slice(0, 10).forEach(function (rw) {
    console.log(
      "  s=" +
        padL(rw.s, 5) +
        pad("  " + rw.name, 12) +
        " took " +
        padL(rw.got.toFixed(1), 6) +
        "s  plan " +
        padL(rw.cap.toFixed(1), 6) +
        "s  lost " +
        padL(rw.loss.toFixed(1), 6) +
        "s"
    );
  });
}

// One bot, alone, real fuel: what does a race actually cost lap by lap?
function lapsTrack(name, driver) {
  buildTrack(name);
  var prof = profileReport();
  sim.setFuelOverride(100);
  var tr = sim.runTrace(driver || "Hall Monitor", 620);
  sim.setFuelOverride(process.env.NOFUEL ? 1e6 : 0);
  var total = 0;
  var line = tr.lapLog
    .map(function (l) {
      total += l.t;
      return l.t.toFixed(1) + (l.pit ? "*" : "") + "(t" + l.tires.toFixed(0) + "/f" + l.fuel.toFixed(0) + ")";
    })
    .join("  ");
  console.log(
    "\n" +
      pad(name, 14) +
      (driver || "Hall Monitor") +
      "  ideal " +
      prof.lapIdeal +
      "s  laps: " +
      line +
      "  total " +
      total.toFixed(1) +
      "s  (* = pit lap)  fuel left " +
      tr.fuel.toFixed(0)
  );
}

var args = process.argv.slice(2);
var which = args.filter(function (a) {
  return a.charAt(0) !== "-";
});
var list = which.length ? which : trackNames();

if (args.indexOf("--laps") !== -1) {
  list.forEach(function (name) {
    lapsTrack(name, process.env.DRIVER);
  });
} else if (args.indexOf("--trace") !== -1) {
  list.forEach(function (name) {
    traceTrack(name, process.env.DRIVER);
  });
} else if (args.indexOf("--profile") !== -1) {
  list.forEach(function (name) {
    buildTrack(name);
    console.log(pad(name, 16), sim.trackLen().toFixed(0), JSON.stringify(profileReport()));
  });
} else {
  // A single race is one roll of the dice on a jam. Run a few seeds so a
  // regression cannot hide behind a lucky start.
  var seeds = (process.env.SEEDS || "1").split(",").map(Number);
  var quiet = args.indexOf("--quiet") !== -1;
  var summary = [];
  list.forEach(function (name) {
    seeds.forEach(function (seed) {
      summary.push(runTrack(name, 0, seed, quiet));
    });
  });
  console.log("\nsummary");
  summary.forEach(function (s) {
    console.log(
      "  " +
        pad(s.track, 14) +
        "seed " +
        s.seed +
        padL(s.len.toFixed(0), 6) +
        "  spread " +
        padL(s.spread, 6) +
        "  rev " +
        padL(s.reverseT, 6) +
        "  still " +
        padL(s.stillT, 6) +
        "  won by " +
        pad(s.winner, 13) +
        "  last " +
        pad(s.worst, 13) +
        (s.allFinished ? "" : "  DNF") +
        (s.resets ? "  resets=" + s.resets : "")
    );
  });
}
