"use strict";
var sim = require("../server/ai-sim.js").buildSim();
var track = process.argv[2] || "harbor";
var from = Number(process.argv[3] || 0);
var to = Number(process.argv[4] || 1e9);
sim.buildBuiltin(track);
sim.setFuelOverride(100);
var tr = sim.runTrace(process.env.DRIVER || "Hall Monitor", 620);
console.log(track, "len", sim.trackLen().toFixed(0), "laps", tr.laps, "lapLog", JSON.stringify(tr.lapLog));
var sm = tr.samples;
var i;
for (i = 0; i < sm.length; i += 1) {
  var t = i / 30;
  if (t < from || t > to) continue;
  var q = sm[i];
  if (i % 15) continue;
  console.log(
    "t=" + t.toFixed(1),
    "lap" + q.lap,
    "s=" + ("    " + q.s.toFixed(0)).slice(-4),
    "v=" + ("    " + q.v.toFixed(1)).slice(-5),
    "prof=" + ("    " + q.prof.toFixed(1)).slice(-5),
    "mouthD=" + ("      " + q.mouthD.toFixed(0)).slice(-6),
    "fuel=" + q.fuel.toFixed(0),
    "dist=" + q.dist.toFixed(1),
    "res=" + q.resets,
    q.wantPit ? "WANT" : "    ",
    q.inLane ? "LANE" : "    ",
    q.serv ? "SERV" : "    ",
    q.grass ? "GRASS" : "",
    q.blocked ? "BLOCK" : ""
  );
}
