/* Frame-by-frame trace of one car in a full field, around a time window.

     node tools/dbg-field.js desert BowieKnife99 180 200
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;

var track = process.argv[2] || "desert";
var car = process.argv[3] || "BowieKnife99";
var from = Number(process.argv[4] || 0);
var to = Number(process.argv[5] || 1e9);

probe.buildTrack(track);
sim.setSeed(1);
sim.setTraceCar(car);
var field = sim.runField(probe.FIELD, 620, { s: sim.trackLen() - 6 });
sim.setTraceCar("");

console.log(track, car, "len", sim.trackLen().toFixed(0));
field.resetLog.forEach(function (e) {
  console.log("  reset t=" + e.t.toFixed(1) + " " + e.name + " s=" + e.s.toFixed(0) + " " + e.name2 + " dist=" + e.dist.toFixed(1));
});
var every = Number(process.env.EVERY || (car === "*" ? 15 : 5));
var frame = -1;
var lastT = -1;
field.carLog.forEach(function (q) {
  if (q.t < from || q.t > to) return;
  if (q.t !== lastT) {
    frame += 1;
    lastT = q.t;
  }
  if (frame % every) return;
  console.log(
    "t=" + q.t.toFixed(1),
    ("              " + q.who).slice(-13),
    "lap" + q.lap,
    "s=" + ("    " + q.s.toFixed(0)).slice(-4),
    "v=" + ("     " + q.v.toFixed(1)).slice(-6),
    "d=" + ("    " + q.dist.toFixed(1)).slice(-5),
    "stuck=" + q.stuckT.toFixed(1),
    "rev=" + q.revT.toFixed(1),
    "hit=" + q.hitT.toFixed(1),
    "res=" + q.resets,
    ("        " + q.name2).slice(-9),
    q.grass ? "GRASS" : "     ",
    q.blocked ? "BLOCK" : "     ",
    q.wrong < 0 ? "WRONG" : "     ",
    q.wantPit ? "WANT" : "    ",
    q.inLane ? "LANE" : "    ",
    q.serv ? "SERV" : ""
  );
});
