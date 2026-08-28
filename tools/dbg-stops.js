/* Why did that car box twice? Races a board and prints, for one driver,
   every frame where the pit plan changed, with the numbers the decision
   was made on.

     node tools/dbg-stops.js park Detention
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;
var name = process.argv[2] || "park";
var driver = process.argv[3] || "Detention";
var seed = Number(process.env.SEED || 1);

probe.buildTrack(name);
var len = sim.trackLen();
sim.setSeed(seed);
sim.setTraceCar(driver);
var grid = seed > 1 ? probe.gridFor(seed) : probe.FIELD;
var field = sim.runField(grid, 620, { s: len - 6 });
sim.setTraceCar(null);

console.log("\n" + name + " seed=" + seed + " " + driver + "  len=" + len.toFixed(0));
var log = field.carLog;
var lastWant = null;
var lastServ = null;
log.forEach(function (e) {
  var flip = e.wantPit !== lastWant || e.serv !== lastServ;
  if (!flip) return;
  lastWant = e.wantPit;
  lastServ = e.serv;
  console.log(
    "  t=" +
      e.t.toFixed(1).padStart(6) +
      " lap" +
      e.lap +
      "  " +
      (e.wantPit ? "WANT" : "    ") +
      (e.serv ? " BOX" : "    ") +
      "  fuel " +
      e.fuel.toFixed(1).padStart(5) +
      "  tires " +
      e.tires.toFixed(0).padStart(4) +
      "  per " +
      e.per.toFixed(1).padStart(5) +
      "  lapsLeft " +
      e.lapsLeft.toFixed(2).padStart(5) +
      "  mouthD " +
      e.mouthD.toFixed(0).padStart(6) +
      "  need " +
      (e.per * e.lapsLeft).toFixed(1).padStart(5)
  );
});
var fin = field.filter(function (f) {
  return f.name === driver;
})[0];
console.log("  finished t=" + fin.finishTime.toFixed(1) + " stops=" + fin.pitStops + " fuel=" + fin.fuel.toFixed(0) + " tires=" + fin.tires.toFixed(0));
