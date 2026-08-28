/* Dump centreline coordinates around a span, to see what the ribbon does.

     node tools/dbg-plot.js forest 2080 2266 6
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;

var name = process.argv[2] || "forest";
var from = Number(process.argv[3] || 0);
var to = Number(process.argv[4] || 200);
var step = Number(process.argv[5] || 8);

probe.buildTrack(name);
console.log(name, "len", sim.trackLen().toFixed(0));
var s;
for (s = from; s <= to; s += step) {
  var p = sim.centerlinePoint(s % sim.trackLen());
  console.log(
    "s=" + s.toFixed(0).padStart(5),
    "x=" + p.x.toFixed(1).padStart(8),
    "z=" + p.z.toFixed(1).padStart(8),
    "h=" + ((p.h * 180) / Math.PI).toFixed(0).padStart(5),
    p.name
  );
}
