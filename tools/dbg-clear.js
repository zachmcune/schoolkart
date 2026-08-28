/* Does the ribbon run into itself? For every pair of centreline samples
   that are far apart along the lap, report the closest they come in the
   world. Anything under two half-widths means two bits of road share the
   same tarmac, which breaks projection, walls and car-to-car contact.

     node tools/dbg-clear.js
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;
var ASPHALT = 8.6;

probe.trackNames().forEach(function (name) {
  probe.buildTrack(name);
  var len = sim.trackLen();
  var step = 4;
  var pts = [];
  var s;
  for (s = 0; s < len; s += step) pts.push(sim.centerlinePoint(s));
  var worst = 1e9;
  var at = null;
  var i;
  var j;
  for (i = 0; i < pts.length; i++) {
    for (j = i + 1; j < pts.length; j++) {
      var along = Math.min((j - i) * step, len - (j - i) * step);
      if (along < 60) continue;
      // Road over road at a different height is a bridge, not shared tarmac.
      if (Math.abs((pts[i].y || 0) - (pts[j].y || 0)) > 4) continue;
      var d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
      if (d < worst) {
        worst = d;
        at = [i * step, j * step, along];
      }
    }
  }
  var tag = worst < ASPHALT * 2 ? "  OVERLAP" : worst < ASPHALT * 2 + 6 ? "  tight" : "";
  console.log(
    (name + "               ").slice(0, 15) +
      "len " + len.toFixed(0).padStart(5) +
      "  closest " + worst.toFixed(1).padStart(6) +
      "  at s=" + at[0].toFixed(0) + " / s=" + at[1].toFixed(0) +
      " (" + at[2].toFixed(0) + "m apart along the lap)" +
      tag
  );
});
