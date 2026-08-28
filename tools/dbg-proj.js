/* Ask the projector the same question the car asks, at a spot where two
   bits of harbor ribbon cross, and print every candidate segment.

     node tools/dbg-proj.js harbor 312.86 -40.12 853
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;

var track = process.argv[2] || "harbor";
var px = Number(process.argv[3]);
var pz = Number(process.argv[4]);
var hint = Number(process.argv[5]);

probe.buildTrack(track);
console.log(track, "len", sim.trackLen().toFixed(1));
console.log("near(hint=" + hint + ") s=" + sim.projectTrackNear(px, pz, hint).s.toFixed(1));
console.log("global        s=" + sim.projectTrack(px, pz).s.toFixed(1));
sim.pathNow().forEach(function (seg) {
  var hit =
    seg.type === "line"
      ? sim.closestOnSeg(px, pz, seg.ax, seg.az, seg.bx, seg.bz)
      : sim.closestOnArc(px, pz, seg.cx, seg.cz, seg.r, seg.a0, seg.a1);
  var s = (seg.startS || 0) + hit.t * (seg.len != null ? seg.len : 0);
  var d = Math.sqrt(hit.d2);
  if (d > 40) return;
  console.log(
    "  " + (seg.name + "         ").slice(0, 10),
    seg.type,
    "startS=" + (seg.startS || 0).toFixed(0),
    "len=" + (seg.len || 0).toFixed(0),
    "t=" + hit.t.toFixed(3),
    "s=" + s.toFixed(1),
    "d=" + d.toFixed(2),
    "dS=" + sim.raceDeltaS(s, hint).toFixed(1)
  );
});
