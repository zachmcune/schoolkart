/* Prove custom tile maps are flush, on-track, and not Campus Loop geometry. */
"use strict";

var fs = require("fs");
var path = require("path");
var src = fs.readFileSync(path.join(__dirname, "..", "js", "game.js"), "utf8");

function sliceFn(name) {
  var needle = "function " + name + "(";
  var idx = src.indexOf(needle);
  if (idx < 0) throw new Error("missing " + name);
  var i = src.indexOf("{", idx);
  var depth = 0;
  for (var j = i; j < src.length; j++) {
    if (src[j] === "{") depth += 1;
    else if (src[j] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(idx, j + 1);
    }
  }
  throw new Error("unclosed " + name);
}

function sliceFromTo(start, endName) {
  var a = src.indexOf(start);
  if (a < 0) throw new Error("missing start " + start);
  var endNeedle = "function " + endName + "(";
  var b = src.indexOf(endNeedle, a + start.length);
  if (b < 0) throw new Error("missing end " + endName);
  return src.slice(a, b);
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var code = [
  "var ASPHALT = 8.6;",
  "var RUNOFF = 3.8;",
  "var KERB_NAMES = ['the90', 'hairpin', 'chicane', 'sweeper', 'kink'];",
  "var GRASS_MAX = 8.5;",
  "var GRASS_ROLL = 4;",
  "var GRASS_DUMP = 40;",
  "var TIRE_FLOOR = 22;",
  "var MAX_SPEED = 48;",
  "var ACCEL = 26;",
  "var BRAKE_DECEL = 26;",
  "var COAST = 8;",
  "var REVERSE_ACCEL = 18;",
  "var REVERSE_MAX = 12;",
  "var LIMP_SPEED = 13;",
  "var LIMP_ACCEL = 6;",
  "var STEER_RATE = 2.35;",
  "var MAX_LAT = 28;",
  "var IDLE_FUEL = 0.46;",
  "var THROTTLE_FUEL = 0.12;",
  "var GETAWAY_T = 1.5;",
  "var SF_Z = -80;",
  "var PIT_LANE = { x0: 8, x1: 118, z0: -67.4, z1: -56.6 };",
  "var PIT_GRAB = { x0: 58, x1: 90, z0: -67.4, z1: -56.6 };",
  "var PIT_PAVE = [];",
  "var PIT_META = { ax: 8, az: -62, bx: 118, bz: -62, on: true };",
  "var PATH = [];",
  "var TRACK_LEN = 0;",
  "var _x = -200;",
  "var _z = SF_Z;",
  "var _h = 0;",
  "var stampTrees = [];",
  "var RIBBON_SEGS = 360;",
  "var trackCode = '';",
  "var state = 'racing';",
  "var raceTime = 3;",
  "var launchT = 0;",
  "var launchMul = 1;",
  sliceFn("clamp"),
  sliceFn("inRect"),
  sliceFn("onPitPavement"),
  sliceFn("closestOnSeg"),
  sliceFn("closestOnArc"),
  sliceFn("addLine"),
  sliceFn("addArc"),
  sliceFn("pathLine"),
  sliceFn("pathArc"),
  sliceFn("pathSnap"),
  sliceFn("resetPathCursor"),
  sliceFn("setDefaultPit"),
  sliceFn("clearPit"),
  sliceFn("placePitHere"),
  sliceFn("autoClosePath"),
  sliceFn("buildCampusPath"),
  sliceFn("buildCodePath"),
  sliceFromTo("var MAP_SURF = [];", "rebuildPath"),
  sliceFn("rebuildPath"),
  sliceFn("projectTrack"),
  sliceFn("applyMotion"),
  "function poseCar(r) { if (r.mesh && r.mesh.position) r.mesh.position.set(r.x, 0, r.z); }",
  "return {",
  "  rebuildPath: rebuildPath,",
  "  encodeMap: encodeMap,",
  "  parseMap: parseMap,",
  "  portList: portList,",
  "  edgeMid: edgeMid,",
  "  pieceSegs: pieceSegs,",
  "  footprint: footprint,",
  "  projectTrack: projectTrack,",
  "  applyMotion: applyMotion,",
  "  MAP_DXY: MAP_DXY,",
  "  MAP_CELL: MAP_CELL,",
  "  get TRACK_LEN() { return TRACK_LEN; },",
  "  get MAP_SURF() { return MAP_SURF; },",
  "  get PATH() { return PATH; },",
  "  get trackCode() { return trackCode; },",
  "  setTrack: function (c) { trackCode = c; }",
  "};",
].join("\n");

var sim;
try {
  sim = new Function(code)();
} catch (e) {
  console.error(e);
  throw e;
}

function rectPieces() {
  return [
    { t: "r", x: 1, y: 1, r: 0 },
    { t: "F", x: 2, y: 1, r: 0 },
    { t: "s", x: 3, y: 1, r: 0 },
    { t: "r", x: 4, y: 1, r: 1 },
    { t: "s", x: 4, y: 2, r: 1 },
    { t: "r", x: 4, y: 3, r: 2 },
    { t: "s", x: 3, y: 3, r: 0 },
    { t: "s", x: 2, y: 3, r: 0 },
    { t: "r", x: 1, y: 3, r: 3 },
    { t: "s", x: 1, y: 2, r: 1 },
  ];
}

function portPoint(p, i) {
  var ports = sim.portList(p);
  return sim.edgeMid(ports[i].x, ports[i].y, ports[i].dir);
}

function countFlush(pieces) {
  var n = 0;
  var i;
  var a;
  var b;
  var pa;
  var pb;
  for (i = 0; i < pieces.length; i++) {
    pa = sim.portList(pieces[i]);
    for (a = 0; a < pa.length; a++) {
      for (b = 0; b < pieces.length; b++) {
        if (i === b) continue;
        pb = sim.portList(pieces[b]);
        var j;
        for (j = 0; j < pb.length; j++) {
          var nx = pa[a].x + sim.MAP_DXY[pa[a].dir][0];
          var ny = pa[a].y + sim.MAP_DXY[pa[a].dir][1];
          if (nx !== pb[j].x || ny !== pb[j].y) continue;
          if (pb[j].dir !== ((pa[a].dir + 2) & 3)) continue;
          var A = sim.edgeMid(pa[a].x, pa[a].y, pa[a].dir);
          var B = sim.edgeMid(pb[j].x, pb[j].y, pb[j].dir);
          var d = Math.hypot(A.x - B.x, A.z - B.z);
          assert(d < 0.001, "ports not flush " + d + " at " + pieces[i].t + pieces[i].x + pieces[i].y);
          n += 1;
        }
      }
    }
  }
  return n / 2;
}

function blankCar(x, z, h, spd) {
  return {
    x: x,
    z: z,
    heading: h,
    speed: spd,
    slide: 0,
    fuel: 100,
    tires: 100,
    brakeHold: 0,
    launchT: 0,
    launchMul: 1,
    mesh: {
      position: { set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } },
      rotation: { set: function () {}, x: 0, y: 0, z: 0 },
      userData: {},
    },
  };
}

assert(countFlush([{ t: "S", x: 1, y: 1, r: 0 }, { t: "r", x: 3, y: 1, r: 1 }]) === 1, "long straight meets a 90 flush");
assert(
  countFlush([
    { t: "w", x: 1, y: 1, r: 0 },
    { t: "s", x: 3, y: 1, r: 0 },
    { t: "s", x: 1, y: 3, r: 1 },
  ]) === 2,
  "sweeper meets neighbor straights flush"
);
assert(
  countFlush([
    { t: "H", x: 2, y: 1, r: 0 },
    { t: "s", x: 2, y: 2, r: 1 },
    { t: "s", x: 3, y: 2, r: 1 },
  ]) === 2,
  "hairpin U meets two south straights flush"
);

var pieces = rectPieces();
var joins = countFlush(pieces);
assert(joins === 10, "rectangle has 10 flush joins, got " + joins);

var i;
for (i = 0; i < pieces.length; i++) {
  if (pieces[i].t !== "r") continue;
  var before = { t: pieces[i].t, x: pieces[i].x, y: pieces[i].y, r: pieces[i].r };
  pieces[i].r = (pieces[i].r + 1) & 3;
  var broken = countFlush(pieces);
  assert(broken < 10, "rotated 90 must break a join");
  pieces[i].r = (before.r + 4) & 3;
  pieces[i].r = before.r;
  assert(countFlush(pieces) === 10, "4-step rotate restores flush 90");
}

var codeMap = sim.encodeMap(pieces);
assert(codeMap.charAt(0) === "M", "share-string starts with M");
assert(codeMap.indexOf("F") !== -1, "share-string has start piece");
sim.setTrack(codeMap);
sim.rebuildPath(codeMap);
assert(sim.MAP_SURF.length >= 10, "surface rebuilt from pieces, got " + sim.MAP_SURF.length);
assert(sim.TRACK_LEN > 400 && sim.TRACK_LEN < 1200, "rectangle length is the placed loop, not Campus ~1979: " + sim.TRACK_LEN);

var onN = 0;
var offN = 0;
for (i = 0; i < pieces.length; i++) {
  var segs = sim.pieceSegs(pieces[i]);
  var s;
  for (s = 0; s < segs.length; s++) {
    var seg = segs[s];
    var u;
    for (u = 0.08; u <= 0.92; u += 0.14) {
      var px;
      var pz;
      if (seg.type === "line") {
        px = seg.ax + (seg.bx - seg.ax) * u;
        pz = seg.az + (seg.bz - seg.az) * u;
      } else {
        var ang = seg.a0 + (seg.a1 - seg.a0) * u;
        px = seg.cx + Math.cos(ang) * seg.r;
        pz = seg.cz + Math.sin(ang) * seg.r;
      }
      var hit = sim.projectTrack(px, pz);
      assert(hit.onAsphalt && !hit.grass, "centerline of " + pieces[i].t + " must be on asphalt dist=" + hit.dist);
      onN += 1;
      var nx = -Math.sin(hit.h);
      var nz = Math.cos(hit.h);
      var shoulder = sim.projectTrack(px + nx * 20, pz + nz * 20);
      assert(shoulder.grass && !shoulder.onAsphalt, "20m off ribbon must be grass");
      offN += 1;
    }
  }
}
assert(onN > 40, "sampled enough on-track points");
assert(offN > 40, "sampled enough off-track points");

var campus = sim.projectTrack(0, -80);
assert(!campus.onAsphalt, "Campus S/F is not asphalt on a custom rectangle");

var startSeg = sim.pieceSegs(pieces[1])[0];
var sx = (startSeg.ax + startSeg.bx) * 0.5;
var sz = (startSeg.az + startSeg.bz) * 0.5;
var sh = Math.atan2(startSeg.bz - startSeg.az, startSeg.bx - startSeg.ax);
var car = blankCar(sx, sz, sh, 30);
var t;
for (t = 0; t < 2; t += 1 / 30) {
  sim.applyMotion(car, 0, true, false, false, 1 / 30, false);
}
assert(car.speed > 22, "asphalt keeps race pace, speed=" + car.speed);
assert(car.tires > 96, "asphalt does not eat tires like grass, tires=" + car.tires);
var onAfter = sim.projectTrack(car.x, car.z);
assert(onAfter.onAsphalt && !onAfter.grass, "driven car stayed on placed asphalt");

var grassCar = blankCar(sx + 40, sz + 50, 0, 30);
assert(sim.projectTrack(grassCar.x, grassCar.z).grass, "offset start is off the placed ribbon");
for (t = 0; t < 2.2; t += 1 / 30) {
  sim.applyMotion(grassCar, 0, true, false, false, 1 / 30, false);
}
assert(grassCar.speed <= 8.7, "leaving the ribbon dumps to grass crawl, speed=" + grassCar.speed);
assert(grassCar.tires < 90, "leaving the ribbon eats tires, tires=" + grassCar.tires);

var customLen = sim.TRACK_LEN;
sim.setTrack("");
sim.rebuildPath("");
assert(sim.MAP_SURF.length === 0, "Campus Loop clears custom surface");
assert(Math.abs(sim.TRACK_LEN - 1978.98) < 2, "Default Campus Loop length " + sim.TRACK_LEN);
var line = sim.projectTrack(0, -80);
assert(line.onAsphalt && !line.grass, "Campus S/F is asphalt again");

console.log(
  "OK map rectangle joins=" +
    joins +
    " on=" +
    onN +
    " off=" +
    offN +
    " customLen=" +
    customLen.toFixed(1)
);
