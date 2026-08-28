/* Why does a pack lose time? Runs each driver alone on a board for its
   clean-air pace, then races the field and prints where the gaps opened,
   so traffic losses can be told apart from a slow personality.

     node tools/dbg-pack.js sweepers
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;
var name = process.argv[2] || "sweepers";
var seed = Number(process.env.SEED || 1);

probe.buildTrack(name);
var len = sim.trackLen();
sim.setFuelOverride(1e6);
var solo = {};
probe.FIELD.forEach(function (who) {
  probe.buildTrack(name);
  var tr = sim.runTrace(who, 620);
  solo[who] = tr.best;
});
sim.setFuelOverride(0);

probe.buildTrack(name);
sim.setSeed(seed);
sim.setTraceCar("*");
var grid = seed > 1 ? probe.gridFor(seed) : probe.FIELD;
var field = sim.runField(grid, 620, { s: len - 6 });
sim.setTraceCar(null);

console.log("\n" + name + " len=" + len.toFixed(0) + " seed=" + seed);
console.log("  driver          solo   race   x5     lost   hits    rub");
field.forEach(function (f) {
  var ideal = solo[f.name] * 5;
  console.log(
    "  " +
      f.name.padEnd(15) +
      solo[f.name].toFixed(1).padStart(5) +
      f.finishTime.toFixed(1).padStart(7) +
      ideal.toFixed(1).padStart(7) +
      (f.finishTime - ideal).toFixed(1).padStart(7) +
      String(f.contacts).padStart(6) +
      f.contactT.toFixed(1).padStart(7)
  );
});

// Where on the lap is the pack losing it? Bucket contact time by ribbon
// position, so a corner that traps cars shows up against one that does not.
var log = field.carLog;
var bucket = 40;
var nb = Math.ceil(len / bucket);
var hit = [];
var slow = [];
var n = [];
var i;
for (i = 0; i < nb; i++) {
  hit[i] = 0;
  slow[i] = 0;
  n[i] = 0;
}
log.forEach(function (e) {
  var b = Math.min(nb - 1, Math.floor(e.gs / bucket));
  n[b] += 1;
  if (e.hitT > 0) hit[b] += 1 / 30;
  slow[b] += e.v;
});
console.log("\n  contact time by ribbon bucket (whole field)");
var rows = [];
for (i = 0; i < nb; i++) if (n[i]) rows.push({ s: i * bucket, hit: hit[i], v: slow[i] / n[i], name: sim.centerlinePoint(i * bucket).name });
rows
  .slice()
  .sort(function (a, b) {
    return b.hit - a.hit;
  })
  .slice(0, 12)
  .forEach(function (rw) {
    console.log("    s=" + String(rw.s).padStart(5) + "  " + String(rw.name).padEnd(10) + " rub " + rw.hit.toFixed(1).padStart(6) + "s  avg v " + rw.v.toFixed(1));
  });
