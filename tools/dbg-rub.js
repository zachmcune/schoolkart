/* What shape is a pack's contact? Races a board and buckets every frame
   a car is touching another by where the rival sat in its own frame, so
   a nose-to-tail queue can be told from two cars fighting for one lane.

     node tools/dbg-rub.js sweepers
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;
var name = process.argv[2] || "sweepers";
var seed = Number(process.env.SEED || 1);

probe.buildTrack(name);
var len = sim.trackLen();
sim.setSeed(seed);
sim.setTraceCar("*");
var grid = seed > 1 ? probe.gridFor(seed) : probe.FIELD;
var field = sim.runField(grid, 620, { s: len - 6 });
sim.setTraceCar(null);
var log = field.carLog;

console.log("\n" + name + " seed=" + seed + "  frames=" + log.length);

// A contact frame is one where the bodywork is touching. Where was the
// other car? Nose-to-tail means the queue is too tight; alongside means
// two cars want the same tarmac.
var kind = { tail: 0, nose: 0, hip: 0 };
var rub = log.filter(function (e) {
  return e.hitT > 0 && e.near;
});
rub.forEach(function (e) {
  var f = e.near.fwd;
  if (f > 2.2) kind.nose += 1;
  else if (f < -2.2) kind.tail += 1;
  else kind.hip += 1;
});
console.log(
  "  contact frames " +
    rub.length +
    "  ahead-of-us " +
    ((100 * kind.nose) / rub.length).toFixed(0) +
    "%  behind-us " +
    ((100 * kind.tail) / rub.length).toFixed(0) +
    "%  alongside " +
    ((100 * kind.hip) / rub.length).toFixed(0) +
    "%"
);

// Per driver: how much of the race in contact, how far off its own line,
// and how often it was committed to a pass.
var who = {};
log.forEach(function (e) {
  var w = (who[e.who] = who[e.who] || { n: 0, hit: 0, offLine: 0, commit: 0, side: 0, v: 0 });
  w.n += 1;
  if (e.hitT > 0) w.hit += 1;
  w.offLine += Math.abs(e.off - e.line);
  if (e.commit > 0) w.commit += 1;
  w.side += Math.abs(e.side);
  w.v += e.v;
});
console.log("\n  driver          rub%   offLine  |nudge|  commit%   avg v");
Object.keys(who).forEach(function (k) {
  var w = who[k];
  console.log(
    "  " +
      k.padEnd(15) +
      ((100 * w.hit) / w.n).toFixed(1).padStart(5) +
      (w.offLine / w.n).toFixed(2).padStart(9) +
      (w.side / w.n).toFixed(2).padStart(9) +
      ((100 * w.commit) / w.n).toFixed(1).padStart(9) +
      (w.v / w.n).toFixed(1).padStart(8)
  );
});

// A pass that never completes is the expensive kind. How long does a
// commitment last, and does the car actually get by?
var runs = {};
var open = {};
log.forEach(function (e) {
  if (e.commit > 0) {
    if (!open[e.who]) open[e.who] = { t0: e.t, side: e.passSide };
  } else if (open[e.who]) {
    var r = (runs[e.who] = runs[e.who] || []);
    r.push(e.t - open[e.who].t0);
    open[e.who] = null;
  }
});
console.log("\n  driver          passAttempts  medianLen  longest");
Object.keys(runs).forEach(function (k) {
  var r = runs[k].slice().sort(function (a, b) {
    return a - b;
  });
  console.log("  " + k.padEnd(15) + String(r.length).padStart(8) + r[Math.floor(r.length / 2)].toFixed(1).padStart(12) + r[r.length - 1].toFixed(1).padStart(9));
});
