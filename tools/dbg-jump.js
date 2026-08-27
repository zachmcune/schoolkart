/* Where does a car's arc-length reading stop making sense?

   Runs a full field, watches one car frame by frame and prints only the
   moments that matter: lap changes, pit decisions, and any frame where s
   moved further than a car possibly could.

     node tools/dbg-jump.js harbor "Band Kid"
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;

var track = process.argv[2] || "harbor";
var car = process.argv[3] || "Band Kid";

var seed = Number(process.env.SEED || 1);
probe.buildTrack(track);
sim.setSeed(seed);
sim.setTraceCar(car);
var field = sim.runField(seed > 1 ? probe.gridFor(seed) : probe.FIELD, 620, { s: sim.trackLen() - 6 });
sim.setTraceCar("");

var len = sim.trackLen();
console.log(track, car, "len", len.toFixed(0));

var prev = null;
var jumps = 0;
field.carLog.forEach(function (q) {
  if (q.who !== car) return;
  if (prev) {
    var dt = q.t - prev.t;
    var step = q.s - prev.s;
    if (step > len * 0.5) step -= len;
    else if (step < -len * 0.5) step += len;
    // A car cannot cover more ground than its own speed allows. Give it a
    // generous 3x margin so only genuine reading errors show up.
    var could = Math.max(2, prev.v * dt * 3 + 2);
    if (Math.abs(step) > could) {
      jumps += 1;
      console.log(
        "  JUMP t=" + q.t.toFixed(2),
        "s " + prev.s.toFixed(0) + " -> " + q.s.toFixed(0),
        "(" + step.toFixed(0) + "m in " + dt.toFixed(3) + "s at v=" + prev.v.toFixed(1) + ")",
        "d " + prev.dist.toFixed(1) + " -> " + q.dist.toFixed(1),
        prev.name2 + " -> " + q.name2,
        "xz " + prev.x.toFixed(1) + "," + prev.z.toFixed(1) + " -> " + q.x.toFixed(1) + "," + q.z.toFixed(1)
      );
    }
    if (q.lap !== prev.lap) {
      console.log("  LAP " + prev.lap + " -> " + q.lap + " at t=" + q.t.toFixed(1) + " s=" + q.s.toFixed(0) + " fuel=" + q.fuel.toFixed(0));
    }
    if (!!q.wantPit !== !!prev.wantPit) {
      console.log("  " + (q.wantPit ? "WANTPIT on" : "wantPit off") + " t=" + q.t.toFixed(1) + " lap" + q.lap + " s=" + q.s.toFixed(0) + " fuel=" + q.fuel.toFixed(0));
    }
    if (!!q.serv !== !!prev.serv) {
      console.log("  " + (q.serv ? "SERVICE in" : "service out") + " t=" + q.t.toFixed(1) + " lap" + q.lap + " fuel=" + q.fuel.toFixed(0));
    }
  }
  prev = q;
});
console.log("  jumps:", jumps);
