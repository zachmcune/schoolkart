/* Is the rival actually a rival? Wins depend mostly on grid slot, so
   this reports places gained instead: where each driver started, where
   it finished, and how much of the field it got past.

     node tools/dbg-bowie.js               every board, 10 grids
     node tools/dbg-bowie.js campus park   named boards
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;
var nSeeds = Number(process.env.NSEEDS || 10);
var args = process.argv.slice(2);
var list = args.length ? args : probe.trackNames();

var tally = {};
probe.FIELD.forEach(function (who) {
  tally[who] = { grid: 0, fin: 0, gain: 0, n: 0, wins: 0, solo: 0 };
});

list.forEach(function (name) {
  var seed;
  for (seed = 1; seed <= nSeeds; seed++) {
    probe.buildTrack(name);
    sim.setSeed(seed);
    var grid = seed > 1 ? probe.gridFor(seed) : probe.FIELD;
    var field = sim.runField(grid, 620, { s: sim.trackLen() - 6 });
    field.forEach(function (f, place) {
      var t = tally[f.name];
      var slot = grid.indexOf(f.name);
      t.grid += slot;
      t.fin += place;
      t.gain += slot - place;
      t.n += 1;
      if (place === 0) t.wins += 1;
    });
  }
});

console.log("\n" + list.length + " boards x " + nSeeds + " grids = " + list.length * nSeeds + " races");
console.log("  driver          avgGrid  avgFinish  placesGained   wins");
Object.keys(tally)
  .map(function (k) {
    var t = tally[k];
    return { name: k, grid: t.grid / t.n, fin: t.fin / t.n, gain: t.gain / t.n, wins: t.wins, n: t.n };
  })
  .sort(function (a, b) {
    return a.fin - b.fin;
  })
  .forEach(function (t) {
    console.log(
      "  " +
        t.name.padEnd(15) +
        (t.grid + 1).toFixed(2).padStart(6) +
        (t.fin + 1).toFixed(2).padStart(10) +
        (t.gain > 0 ? "+" : "") +
        t.gain.toFixed(2).padStart(13) +
        String(t.wins + "/" + t.n).padStart(9)
    );
  });
