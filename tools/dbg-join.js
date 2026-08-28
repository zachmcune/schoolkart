/* What does the loop closer have to choose from? Prints every arc-line-arc
   candidate that actually closes the ribbon, with the room it leaves
   against the road that was already there.

     node tools/dbg-join.js park
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;

var track = process.argv[2] || "park";
probe.buildTrack(track);
console.log(track, "final len", sim.trackLen().toFixed(1));
var rows = sim.joinReport();
if (!rows) {
  console.log("  ribbon already closed, no join needed");
} else {
  console.log("  base len before the join", rows.len0.toFixed(1));
  rows.plans.forEach(function (p) {
    console.log(
      "  R=" + ("   " + p.R).slice(-3),
      "d1=" + (p.d1 > 0 ? "+" : "-"),
      "d2=" + (p.d2 > 0 ? "+" : "-"),
      "br=" + (p.branch ? 1 : 0),
      "cost=" + ("      " + p.cost.toFixed(0)).slice(-6),
      "clear=" + ("      " + p.clear.toFixed(1)).slice(-6),
      p.closes ? "" : "  (does not close)"
    );
  });
}
