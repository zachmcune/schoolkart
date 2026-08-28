/* Which named pieces of a circuit share tarmac? Lists every pair of
   centreline samples that come closer than two road widths while being a
   long way apart round the lap, grouped by the segments they belong to.

     node tools/dbg-cross.js desert
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;
var ASPHALT = 8.6;

function segAt(s) {
  var segs = sim.pathNow();
  var i;
  for (i = 0; i < segs.length; i++) {
    var g = segs[i];
    if (s >= (g.startS || 0) && s <= (g.startS || 0) + (g.len || 0)) return g.name + "#" + i;
  }
  return "?";
}

(process.argv.length > 2 ? process.argv.slice(2) : probe.trackNames()).forEach(function (name) {
  probe.buildTrack(name);
  var len = sim.trackLen();
  var step = 4;
  var pts = [];
  var s;
  for (s = 0; s < len; s += step) pts.push(sim.centerlinePoint(s));
  var seen = {};
  var i;
  var j;
  for (i = 0; i < pts.length; i++) {
    for (j = i + 1; j < pts.length; j++) {
      var along = Math.min((j - i) * step, len - (j - i) * step);
      if (along < 60) continue;
      // Road over road at a different height is a bridge, not shared tarmac.
      if (Math.abs((pts[i].y || 0) - (pts[j].y || 0)) > 4) continue;
      var d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
      if (d > ASPHALT * 2) continue;
      var key = segAt(i * step) + " x " + segAt(j * step);
      if (!seen[key] || d < seen[key].d) seen[key] = { d: d, a: i * step, b: j * step };
    }
  }
  var keys = Object.keys(seen);
  console.log("\n" + name + "  len " + len.toFixed(0) + (keys.length ? "" : "  clean"));
  keys.forEach(function (k) {
    var v = seen[k];
    console.log("  " + k + "  closest " + v.d.toFixed(1) + "m  at s=" + v.a + " / s=" + v.b);
  });
});
