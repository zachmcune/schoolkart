/* Draw the ribbon as ASCII so a shape change is visible at a glance.

     node tools/dbg-map.js harbor
*/
"use strict";

var probe = require("./ai-probe.js");
var sim = probe.sim;

var names = process.argv.slice(2);
if (!names.length) names = ["campus", "harbor", "park", "desert", "forest"];

var W = 78;
var H = 30;

names.forEach(function (name) {
  probe.buildTrack(name);
  var len = sim.trackLen();
  var pts = [];
  var s;
  for (s = 0; s < len; s += 2) pts.push(sim.centerlinePoint(s));
  var minX = 1e9;
  var maxX = -1e9;
  var minZ = 1e9;
  var maxZ = -1e9;
  pts.forEach(function (p) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  });
  var sx = (W - 1) / Math.max(1, maxX - minX);
  var sz = (H - 1) / Math.max(1, maxZ - minZ);
  var sc = Math.min(sx, sz);
  var grid = [];
  var r;
  for (r = 0; r < H; r++) grid.push(new Array(W).fill(" "));
  pts.forEach(function (p, i) {
    var cx = Math.round((p.x - minX) * sc);
    var cy = Math.round((p.z - minZ) * sc);
    if (cy < 0 || cy >= H || cx < 0 || cx >= W) return;
    var mark = grid[cy][cx];
    var ch = i === 0 ? "S" : (p.y || 0) > 4 ? "^" : "#";
    if (mark === "S") return;
    grid[cy][cx] = mark === " " || ch === "S" ? ch : mark === ch ? ch : "X";
  });
  console.log("");
  console.log(name + "  len " + len.toFixed(0) + "  " + (maxX - minX).toFixed(0) + "x" + (maxZ - minZ).toFixed(0) + "m");
  grid.forEach(function (row) {
    console.log("  " + row.join("").replace(/\s+$/, ""));
  });
});
