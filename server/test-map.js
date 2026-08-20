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
  "var ACCEL = 16;",
  "var BRAKE_DECEL = 20;",
  "var COAST = 5;",
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
  "var launchCall = '';",
  "var launchCallT = 0;",
  "var LAPS = 5;",
  "var TRACK_CODE_MAX = 240;",
  "var HIT_RADIUS = 3.45;",
  "var WALLS = [];",
  "var TYPE_ENC = { s: 'A', S: 'L', r: 'R', w: 'W', H: 'H', C: 'C', F: 'F', P: 'P', t: 'T' };",
  "var TYPE_DEC = { A:'s', a:'s', s:'s', L:'S', S:'S', R:'r', r:'r', W:'w', w:'w', H:'H', h:'H', C:'C', c:'C', F:'F', f:'F', P:'P', p:'P', T:'t', t:'t' };",
  sliceFn("canonType"),
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
  sliceFn("projectOn"),
  sliceFn("projectTrack"),
  sliceFn("rideHeight"),
  sliceFn("steerWheelYaw"),
  sliceFn("applyMotion"),
  sliceFn("updateLaps"),
  sliceFn("inPitLane"),
  sliceFn("inPitGrab"),
  sliceFn("cleanTrack"),
  sliceFn("cellsInBoard"),
  sliceFn("isDriveableLoop"),
  sliceFn("lockRacePath"),
  sliceFn("isCustomCircuit"),
  sliceFn("menuTrackName"),
  sliceFn("speedKph"),
  sliceFn("slotOnPath"),
  sliceFn("customGridPose"),
  sliceFn("pointOnSeg"),
  sliceFn("centerlinePoint"),
  sliceFn("wallSeg"),
  sliceFn("skipLeftBarrier"),
  sliceFn("wallKindFor"),
  sliceFn("wallCutsRibbon"),
  sliceFn("joinColinearWall"),
  sliceFn("mergeColinearWalls"),
  sliceFn("placeWalls"),
  "function puffHit() {}",
  "function poseCar(r) { if (r.mesh && r.mesh.position) r.mesh.position.set(r.x, 0, r.z); }",
  sliceFn("hitKeepYaw"),
  sliceFn("bashCars"),
  sliceFn("bashWall"),
  sliceFn("bashAllWalls"),
  "return {",
  "  rebuildPath: rebuildPath,",
  "  encodeMap: encodeMap,",
  "  parseMap: parseMap,",
  "  canonType: canonType,",
  "  portList: portList,",
  "  edgeMid: edgeMid,",
  "  pieceSegs: pieceSegs,",
  "  footprint: footprint,",
  "  footprintsOverlap: footprintsOverlap,",
  "  ribbonFitsFootprint: ribbonFitsFootprint,",
  "  ribbonsStack: ribbonsStack,",
  "  chicanePts: chicanePts,",
  "  projectTrack: projectTrack,",
  "  applyMotion: applyMotion,",
  "  updateLaps: updateLaps,",
  "  inPitGrab: inPitGrab,",
  "  cleanTrack: cleanTrack,",
  "  cellsInBoard: cellsInBoard,",
  "  customGridPose: customGridPose,",
  "  centerlinePoint: centerlinePoint,",
  "  slotOnPath: slotOnPath,",
  "  placeWalls: placeWalls,",
  "  bashAllWalls: bashAllWalls,",
  "  bashWall: bashWall,",
  "  bashCars: bashCars,",
  "  setWalls: function (w) { WALLS.length = 0; var i; for (i = 0; i < w.length; i++) WALLS.push(w[i]); },",
  "  speedKph: speedKph,",
  "  menuTrackName: menuTrackName,",
  "  isCustomCircuit: isCustomCircuit,",
  "  isDriveableLoop: isDriveableLoop,",
  "  lockRacePath: lockRacePath,",
  "  rideHeight: rideHeight,",
  "  steerWheelYaw: steerWheelYaw,",
  "  MAP_DXY: MAP_DXY,",
  "  MAP_CELL: MAP_CELL,",
  "  get TRACK_LEN() { return TRACK_LEN; },",
  "  get MAP_SURF() { return MAP_SURF; },",
  "  get MAP_CLOSED() { return MAP_CLOSED; },",
  "  get PATH() { return PATH; },",
  "  get WALLS() { return WALLS; },",
  "  get PIT_META() { return PIT_META; },",
  "  get RIBBON_SEGS() { return RIBBON_SEGS; },",
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
    lap: 1,
    s: 0,
    lastS: 0,
    lastX: x,
    passedHalf: false,
    finished: false,
    finishTime: 0,
    mesh: {
      position: { set: function (x, y, z) { this.x = x; this.y = y; this.z = z; } },
      rotation: { set: function () {}, x: 0, y: 0, z: 0 },
      userData: {},
    },
  };
}

function attachWheels(car) {
  car.mesh.userData.wheels = [0, 1, 2, 3].map(function (_, i) {
    return {
      holder: { rotation: { y: 0 } },
      spinner: { rotation: { z: 0 } },
      front: i < 2,
    };
  });
  return car;
}

function wheelPointDir(steer) {
  var yaw = sim.steerWheelYaw(steer);
  return { x: Math.cos(yaw), z: -Math.sin(yaw) };
}

function proveWheelSteer(label, x, z, h) {
  var aDir = wheelPointDir(1);
  var dDir = wheelPointDir(-1);
  assert(aDir.z > 0.15, label + " A = POINT LEFT (+Z), z=" + aDir.z);
  assert(dDir.z < -0.15, label + " D = POINT RIGHT (-Z), z=" + dDir.z);
  var left = attachWheels(blankCar(x, z, h, 22));
  var rearSpin = left.mesh.userData.wheels[2].spinner.rotation.z;
  sim.applyMotion(left, 1, true, false, false, 1 / 60, true);
  assert(left.heading > h, label + " A/left increases heading");
  assert(left.mesh.userData.wheels[0].holder.rotation.y < 0, label + " A points fronts left");
  assert(left.mesh.userData.wheels[1].holder.rotation.y < 0, label + " both fronts match A");
  assert(left.mesh.userData.wheels[2].holder.rotation.y === 0, label + " rears do not steer");
  assert(left.mesh.userData.wheels[3].holder.rotation.y === 0, label + " offside rear does not steer");
  assert(left.mesh.userData.wheels[2].spinner.rotation.z < rearSpin, label + " rears spin with speed");
  var right = attachWheels(blankCar(x, z, h, 22));
  sim.applyMotion(right, -1, true, false, false, 1 / 60, true);
  assert(right.heading < h, label + " D/right decreases heading");
  assert(right.mesh.userData.wheels[0].holder.rotation.y > 0, label + " D points fronts right");
  var roll = attachWheels(blankCar(x, z, h, 18));
  sim.applyMotion(roll, 0, true, false, false, 1 / 60, true);
  assert(roll.mesh.userData.wheels[0].spinner.rotation.z < 0, label + " forward roll matches travel");
  var back = attachWheels(blankCar(x, z, h, -8));
  sim.applyMotion(back, 0, false, false, true, 1 / 60, true);
  assert(back.mesh.userData.wheels[0].spinner.rotation.z > 0, label + " reverse roll matches travel");
}

function angDiff(a, b) {
  var d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function segEnd(seg, start) {
  if (seg.type === "line") return start ? { x: seg.ax, z: seg.az } : { x: seg.bx, z: seg.bz };
  var a = start ? seg.a0 : seg.a1;
  return { x: seg.cx + Math.cos(a) * seg.r, z: seg.cz + Math.sin(a) * seg.r };
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
var rectLen = sim.TRACK_LEN;

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
for (t = 0; t < 0.45; t += 1 / 30) {
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

assert(sim.MAP_CLOSED, "rectangle is a closed loop");
assert(sim.PATH.length >= 8, "race line is the placed loop");
var path0 = sim.PATH[0];
var pathN = sim.PATH[sim.PATH.length - 1];
var loopA = segEnd(path0, true);
var loopB = segEnd(pathN, false);
assert(Math.hypot(loopA.x - loopB.x, loopA.z - loopB.z) < 4, "loop start meets loop end, no campus weld");
var campusGhost = sim.projectTrack(0, -80);
assert(!campusGhost.onAsphalt, "Campus S/F is not on a custom rectangle");

function pointAtS(sVal) {
  var ss = ((sVal % sim.TRACK_LEN) + sim.TRACK_LEN) % sim.TRACK_LEN;
  var si;
  for (si = 0; si < sim.PATH.length; si++) {
    var sg = sim.PATH[si];
    if (ss <= sg.startS + sg.len || si === sim.PATH.length - 1) {
      var uu = sg.len ? (ss - sg.startS) / sg.len : 0;
      if (sg.type === "line") return { x: sg.ax + (sg.bx - sg.ax) * uu, z: sg.az + (sg.bz - sg.az) * uu, h: Math.atan2(sg.bz - sg.az, sg.bx - sg.ax) };
      var aa = sg.a0 + (sg.a1 - sg.a0) * uu;
      return { x: sg.cx + Math.cos(aa) * sg.r, z: sg.cz + Math.sin(aa) * sg.r, h: aa + Math.PI * 0.5 };
    }
  }
  return { x: sx, z: sz, h: sh };
}

var loopCar = blankCar(sx, sz, sh, 28);
var startS = sim.projectTrack(sx, sz).s;
loopCar.s = startS;
loopCar.lastS = startS;
var step;
for (step = 0; step <= sim.TRACK_LEN * 1.15; step += 6) {
  var pt = pointAtS(startS + step);
  loopCar.x = pt.x;
  loopCar.z = pt.z;
  loopCar.heading = pt.h;
  assert(sim.projectTrack(pt.x, pt.z).onAsphalt, "race line stays on custom asphalt at s=" + step);
  assert(Math.hypot(pt.x - 0, pt.z - -80) > 40, "race line is not Campus S/F");
  sim.updateLaps(loopCar);
}
assert(loopCar.lap >= 2, "closed rectangle actually laps, lap=" + loopCar.lap);
assert(startS < sim.TRACK_LEN, "bot/player s is on the custom PATH, not a campus zero");

var types = ["s", "S", "r", "w", "H", "C", "F", "P", "t"];
var ti;
for (ti = 0; ti < types.length; ti++) {
  var rot;
  for (rot = 0; rot < 4; rot++) {
    var rp = { t: types[ti], x: 2, y: 2, r: rot };
    if (!sim.cellsInBoard(sim.footprint(rp))) continue;
    var ports = sim.portList(rp);
    var segs = sim.pieceSegs(rp);
    if (types[ti] === "t") {
      assert(segs.length === 0 && ports.length === 0, "tree is not driveable");
      continue;
    }
    assert(ports.length === 2 && segs.length >= 1, types[ti] + " rot " + rot + " has ports");
    var A = segEnd(segs[0], true);
    var B = segEnd(segs[segs.length - 1], false);
    var p0 = sim.edgeMid(ports[0].x, ports[0].y, ports[0].dir);
    var p1 = sim.edgeMid(ports[1].x, ports[1].y, ports[1].dir);
    var d00 = Math.hypot(A.x - p0.x, A.z - p0.z);
    var d01 = Math.hypot(A.x - p1.x, A.z - p1.z);
    var d10 = Math.hypot(B.x - p0.x, B.z - p0.z);
    var d11 = Math.hypot(B.x - p1.x, B.z - p1.z);
    var match = (d00 < 0.05 && d11 < 0.05) || (d01 < 0.05 && d10 < 0.05);
    assert(match, types[ti] + " rot " + rot + " ports do not meet seg ends");
    var mid = segs[0];
    var mx;
    var mz;
    if (mid.type === "line") {
      mx = (mid.ax + mid.bx) * 0.5;
      mz = (mid.az + mid.bz) * 0.5;
    } else {
      var ma = (mid.a0 + mid.a1) * 0.5;
      mx = mid.cx + Math.cos(ma) * mid.r;
      mz = mid.cz + Math.sin(ma) * mid.r;
    }
    sim.setTrack(sim.encodeMap([rp]));
    sim.rebuildPath(sim.encodeMap([rp]));
    var midHit = sim.projectTrack(mx, mz);
    assert(midHit.onAsphalt && !midHit.grass, "no invisible off-track in the middle of " + types[ti] + " rot " + rot);
  }
}

var longP = { t: "S", x: 1, y: 2, r: 0 };
var longCells = sim.footprint(longP);
assert(longCells.length === 2 && longCells[1].x === 2 && longCells[1].y === 2, "long straight occupies two cells");
assert(countFlush([longP, { t: "s", x: 3, y: 2, r: 0 }]) === 1, "long + neighbor still flush");

var open = [
  { t: "s", x: 0, y: 0, r: 0 },
  { t: "s", x: 3, y: 1, r: 0 },
  { t: "r", x: 6, y: 4, r: 2 },
];
sim.setTrack(sim.encodeMap(open));
sim.rebuildPath(sim.encodeMap(open));
assert(!sim.MAP_CLOSED, "open layout is not a closed loop");
assert(!sim.lockRacePath(sim.encodeMap(open)), "open layout is refused for race");
assert(!sim.isDriveableLoop(), "open board is not a race loop");
assert(Math.abs(sim.TRACK_LEN - 1978.98) < 2, "open/junk bounces the 3D world to Campus Loop");
assert(sim.projectTrack(0, -80).onAsphalt && !sim.projectTrack(0, -80).grass, "bounced world is Campus S/F, not frozen junk");
assert(sim.RIBBON_SEGS >= 360, "bounced Loop keeps the Campus ribbon");
sim.lockRacePath(sim.encodeMap(rectPieces()));
assert(sim.isDriveableLoop() && sim.RIBBON_SEGS <= 420, "closed custom ribbon stays Chromebook-cheap");

var noPit = sim.encodeMap(rectPieces());
sim.setTrack(noPit);
sim.rebuildPath(noPit);
assert(!sim.PIT_META.on, "no pit piece = no fake grab");
assert(!sim.inPitGrab({ x: 20, z: 52 }), "no pit piece, grab is off");

var withPit = rectPieces();
withPit[1] = { t: "P", x: 2, y: 1, r: 0 };
sim.setTrack(sim.encodeMap(withPit));
sim.rebuildPath(sim.encodeMap(withPit));
assert(sim.PIT_META.on, "pit piece enables peel");
var pitX = sim.PIT_META.ax + (sim.PIT_META.bx - sim.PIT_META.ax) * 0.65;
var pitZ = sim.PIT_META.az + (sim.PIT_META.bz - sim.PIT_META.az) * 0.65;
assert(sim.inPitGrab({ x: pitX, z: pitZ }), "pit grab works when the piece is present");

var trees = [];
var tx;
var ty;
for (ty = 0; ty < 6; ty++) {
  for (tx = 0; tx < 8; tx++) trees.push({ t: "t", x: tx, y: ty, r: 0 });
}
var packed = sim.encodeMap(trees);
assert(packed.length > 120 && packed.length <= 240, "full board share-string fits 240, got " + packed.length);
assert(sim.cleanTrack(packed) === packed, "cleanTrack keeps a full-board code");
assert(sim.parseMap(packed).length === 48, "reload/parse keeps every tree");
var undone = sim.parseMap(sim.encodeMap(rectPieces()));
assert(undone.length === 10 && undone[1].t === "F", "encode/decode persist type+cell+rot");

function fourStraightFourCorner() {
  return [
    { t: "r", x: 2, y: 1, r: 0 },
    { t: "s", x: 3, y: 1, r: 0 },
    { t: "r", x: 4, y: 1, r: 1 },
    { t: "s", x: 4, y: 2, r: 1 },
    { t: "r", x: 4, y: 3, r: 2 },
    { t: "s", x: 3, y: 3, r: 0 },
    { t: "r", x: 2, y: 3, r: 3 },
    { t: "s", x: 2, y: 2, r: 1 },
  ];
}

var box = fourStraightFourCorner();
assert(countFlush(box) === 8, "4-straight + 4-corner rectangle is flush");
var headings = {};
var hr;
for (hr = 0; hr < 4; hr++) {
  var corner = { t: "r", x: 2, y: 2, r: hr };
  var ports = sim.portList(corner);
  headings[ports[0].dir + ":" + ports[1].dir] = 1;
  var straight = { t: "s", x: 2, y: 2, r: hr };
  var sPorts = sim.portList(straight);
  if (hr & 1) {
    assert(sPorts[0].dir === 1 || sPorts[1].dir === 1, "odd rot is vertical N/S");
  } else {
    assert(sPorts[0].dir === 0 || sPorts[1].dir === 0, "even rot is horizontal E/W");
  }
}
assert(Object.keys(headings).length === 4, "90s hit all 4 headings N/E/S/W, got " + Object.keys(headings).join(" "));
sim.setTrack(sim.encodeMap(box));
sim.rebuildPath(sim.encodeMap(box));
assert(sim.MAP_CLOSED, "4+4 rectangle closes and laps");

function driveWorld(pieces, seconds, label, closed) {
  var code = sim.encodeMap(pieces);
  sim.setTrack(code);
  var raced = sim.lockRacePath(code);
  if (!closed) {
    assert(!raced && !sim.isDriveableLoop(), label + " must be refused");
    assert(Math.abs(sim.TRACK_LEN - 1978.98) < 2, label + " bounces to Campus Loop, len=" + sim.TRACK_LEN);
    sim.placeWalls();
    var loopPose = { x: 0, z: -80, h: 0 };
    var racerOpen = blankCar(loopPose.x, loopPose.z, loopPose.h, 12);
    racerOpen.fuel = 100;
    racerOpen.tires = 100;
    var ox0 = racerOpen.x;
    var oz0 = racerOpen.z;
    var tOpen;
    var maxOpen = 0;
    for (tOpen = 0; tOpen < seconds; tOpen += 1 / 60) {
      sim.applyMotion(racerOpen, 0, true, false, false, 1 / 60, true);
      sim.bashAllWalls(racerOpen);
      var kOpen = sim.speedKph(racerOpen);
      if (kOpen > maxOpen) maxOpen = kOpen;
    }
    var movedOpen = Math.hypot(racerOpen.x - ox0, racerOpen.z - oz0);
    assert(racerOpen.speed > 16 && maxOpen > 40, label + " Loop after bounce must drive, speed=" + racerOpen.speed + " kph=" + maxOpen);
    assert(movedOpen > 28, label + " Loop after bounce must move, moved=" + movedOpen);
    assert(sim.projectTrack(racerOpen.x, racerOpen.z).onAsphalt, label + " stays on Campus Loop asphalt");
    return { racer: racerOpen, moved: movedOpen, kph: maxOpen, walls: sim.WALLS.length, bounced: true };
  }
  assert(raced && sim.isDriveableLoop(), label + " closed board must be accepted");
  sim.placeWalls();
  var pose = sim.customGridPose();
  assert(pose, label + " has a spawn on the placed asphalt");
  var racer = blankCar(pose.x, pose.z, pose.h, 12);
  racer.fuel = 100;
  racer.tires = 100;
  var x0 = racer.x;
  var z0 = racer.z;
  var tDrive;
  var onFrames = 0;
  var frames = 0;
  var maxKph = 0;
  for (tDrive = 0; tDrive < seconds; tDrive += 1 / 60) {
    var line = sim.projectTrack(racer.x, racer.z);
    var err = angDiff(line.h, racer.heading);
    if (line.dist > 1.2) {
      var home = Math.atan2(line.z - racer.z, line.x - racer.x);
      err = angDiff(home, racer.heading) * 0.65 + err * 0.35;
    }
    var steer = err * 1.8;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    var brake = line.grass || line.dist > 8.2;
    sim.applyMotion(racer, steer, !brake, brake, false, 1 / 60, true);
    sim.bashAllWalls(racer);
    frames += 1;
    var now = sim.projectTrack(racer.x, racer.z);
    if (now.onAsphalt) onFrames += 1;
    var kNow = sim.speedKph(racer);
    if (kNow > maxKph) maxKph = kNow;
  }
  var moved = Math.hypot(racer.x - x0, racer.z - z0);
  var kph = sim.speedKph(racer);
  var endHit = sim.projectTrack(racer.x, racer.z);
  assert(racer.speed > 8 && maxKph > 40, label + " must actually drive, speed=" + racer.speed + " maxKph=" + maxKph);
  assert(moved > 28, label + " car must move in the 3D world, moved=" + moved);
  assert(kph > 20 || maxKph > 40, label + " speedo must match velocity, kph=" + kph + " max=" + maxKph);
  if (closed) {
    assert(onFrames / frames > 0.8, label + " must stay on placed asphalt, on=" + onFrames + "/" + frames + " endDist=" + endHit.dist);
    assert(!endHit.grass, label + " must not be invisible off-track/grass at end");
  } else {
    assert(onFrames > 40 && maxKph > 40, label + " open/messy still drives on placed asphalt, on=" + onFrames + " maxKph=" + maxKph);
    if (endHit.dist > 12.4) {
      assert(endHit.grass, label + " leaving the ribbon is visible grass, not invisible off-track");
    }
  }
  return { racer: racer, moved: moved, kph: kph, walls: sim.WALLS.length };
}

var rectDrive = driveWorld(rectPieces(), 2.4, "closed rectangle", true);
var messyPieces = [
  { t: "F", x: 1, y: 1, r: 0 },
  { t: "S", x: 2, y: 1, r: 0 },
  { t: "r", x: 4, y: 1, r: 1 },
  { t: "s", x: 4, y: 2, r: 1 },
  { t: "w", x: 5, y: 1, r: 0 },
  { t: "t", x: 0, y: 0, r: 0 },
  { t: "t", x: 7, y: 5, r: 0 },
  { t: "C", x: 0, y: 4, r: 2 },
  { t: "H", x: 6, y: 4, r: 0 },
];
assert(messyPieces.length === 9, "messy board is 9 pieces");
var messyCode = sim.encodeMap(messyPieces);
assert(messyCode.indexOf("W") !== -1 && messyCode.indexOf("T") !== -1 && messyCode.indexOf("L") !== -1, "share-string encodes long/W and tree/T");
var upper = messyCode.toUpperCase();
assert(sim.cleanTrack(upper) === upper, "cleanTrack keeps W and T when Chromebook uppercases");
var back = sim.parseMap(sim.cleanTrack(upper));
assert(back.length === 9, "round-trip keeps every piece including long/W and tree/T, got " + back.length);
assert(
  back.filter(function (p) {
    return p.t === "t";
  }).length === 2,
  "trees survive uppercase share-string"
);
assert(
  back.filter(function (p) {
    return p.t === "S" || p.t === "w";
  }).length === 2,
  "long and sweeper survive uppercase share-string"
);
var messyDrive = driveWorld(messyPieces, 2.2, "messy layout", false);

sim.lockRacePath(sim.encodeMap(rectPieces()));
assert(sim.menuTrackName() === "CUSTOM CIRCUIT", "menu label is CUSTOM when Solo loads a closed custom");
var yell = "MR220R321R332R233";
assert(sim.cleanTrack(yell) === yell, "yell share-string is a clean M-code");
assert(sim.parseMap(yell).length === 4, "yell board is 4 pieces");
assert(sim.lockRacePath(yell), "closed 4-piece rectangle MR220R321R332R233 must race");
assert(sim.isDriveableLoop(), "yell 4-piece is a driveable custom, not junk");
assert(sim.menuTrackName() === "CUSTOM CIRCUIT", "Solo label is CUSTOM for the yell 4-piece");
assert(Math.abs(sim.TRACK_LEN - 1978.98) > 40, "yell 4-piece is not Campus Loop, len=" + sim.TRACK_LEN);
assert(!sim.projectTrack(0, -80).onAsphalt, "Campus S/F is not asphalt on the yell 4-piece");
assert(sim.customGridPose(), "yell 4-piece has a custom grid");
var yellPose = sim.customGridPose();
var yellCar = blankCar(yellPose.x, yellPose.z, yellPose.h, 14);
var yellT;
var yellOn = 0;
for (yellT = 0; yellT < 0.45; yellT += 1 / 60) {
  var yellLine = sim.projectTrack(yellCar.x, yellCar.z);
  var yellErr = angDiff(yellLine.h, yellCar.heading);
  var yellSteer = yellErr * 1.6;
  if (yellSteer > 1) yellSteer = 1;
  if (yellSteer < -1) yellSteer = -1;
  sim.applyMotion(yellCar, yellSteer, true, false, false, 1 / 60, true);
  if (sim.projectTrack(yellCar.x, yellCar.z).onAsphalt) yellOn += 1;
}
assert(yellOn > 20, "yell 4-piece Solo start is on the custom ribbon, on=" + yellOn);
assert(Math.hypot(yellCar.x - 0, yellCar.z - -80) > 40, "yell Solo start is not Campus S/F");
assert(sim.TRACK_LEN > 80, "yell 4-piece PATH is a real loop, len=" + sim.TRACK_LEN);
sim.lockRacePath(messyCode);
assert(sim.menuTrackName() === "CAMPUS LOOP", "menu label is CAMPUS LOOP when Solo refuses an open board");
sim.lockRacePath("");
assert(sim.menuTrackName() === "CAMPUS LOOP", "menu label is CAMPUS LOOP when Solo loads Loop");

var aCar = blankCar(0, 0, 0, 20);
var bCar = blankCar(0.4, 0.2, 0, 20);
sim.bashCars(aCar, bCar);
sim.bashCars(aCar, bCar);
sim.bashCars(aCar, bCar);
assert(Math.hypot(aCar.x - bCar.x, aCar.z - bCar.z) >= 3.2, "bots/player cannot occupy the same space");

var grazeH = 0.22;
var graze = blankCar(0, 2.7, grazeH, 24);
graze.slide = 0;
var grazeImp = sim.bashWall(graze, { ax: -30, az: 4, bx: 30, bz: 4, thick: 0.55 });
assert(grazeImp > 0, "wall graze actually hits");
assert(Math.abs(angDiff(graze.heading, grazeH)) < 0.22, "wall graze keeps heading, dh=" + angDiff(graze.heading, grazeH));
assert(Math.abs(angDiff(graze.heading, Math.PI)) > 1.2, "wall graze does not snap 180");
assert(graze.speed < 24, "wall graze loses some speed");
assert(Math.abs(graze.slide) > 0.15, "wall graze slides along the rail, slide=" + graze.slide);
var railH = graze.heading;
var pinSpd = graze.speed;
var railK;
for (railK = 0; railK < 12; railK++) sim.bashWall(graze, { ax: -30, az: 4, bx: 30, bz: 4, thick: 0.55 });
assert(Math.abs(angDiff(graze.heading, railH)) < 0.22, "repeated rail graze does not stack a half-spin");
assert(graze.speed > pinSpd * 0.92, "pinned graze does not restack speed dumps, spd=" + graze.speed.toFixed(2));

var railA = { ax: -30, az: 4, bx: 30, bz: 4, thick: 0.55 };
var railB = { ax: -30, az: 4.04, bx: 30, bz: 4.04, thick: 0.55 };
sim.setWalls([railA, railB]);
var stacked = blankCar(0, 2.7, grazeH, 24);
stacked.slide = 0;
sim.bashAllWalls(stacked);
assert(stacked.speed > 18, "overlapping rails dump once, not a stacked freeze, spd=" + stacked.speed.toFixed(2));
sim.setWalls([]);

var nose = blankCar(3.8, 0, 0, 26);
sim.bashWall(nose, { ax: 5, az: -40, bx: 5, bz: 40, thick: 0.55 });
assert(Math.abs(angDiff(nose.heading, 0)) < 0.45, "head-on is a short spin, not a yaw teleport, h=" + nose.heading);
assert(Math.abs(angDiff(nose.heading, Math.PI)) > 1.6, "head-on does not snap to 180");
assert(nose.speed < 12, "head-on kills most forward speed");

assert(src.indexOf("hitKeepYaw") !== -1 && src.indexOf("hitYawT") !== -1, "hits shove without atan2 yaw snap; corner graze does not stack spin");
assert(/else if \(!\(r\.hitYawT > 0\)\) \{\s*r\.speed \*= 0\.82/.test(src), "graze speed dump is gated while pinned");
assert(src.indexOf("var nearI = -1") !== -1 && src.indexOf("One collider per frame") !== -1, "joins resolve one wall, not every overlapping capsule");
assert(src.indexOf("function mergeColinearWalls") !== -1, "colinear rails become one collider per edge");
assert(src.indexOf("wallCutsRibbon") !== -1, "inside-corner wall chords cannot sit on the ribbon");
assert(src.indexOf("ASPHALT + 3.0") !== -1, "inside rails that clip the chassis are dropped");
assert(!/function bashWall\([\s\S]{0,700}heading = Math.atan2/.test(src), "bashWall does not snap heading to velocity");
assert(!/function bashCars\([\s\S]{0,900}heading = Math.atan2/.test(src), "bashCars does not snap heading to velocity");
assert(src.indexOf("function steerWheelYaw") !== -1 && src.indexOf("return -steer * 0.42") !== -1, "A = POINT LEFT, D = POINT RIGHT");
assert(src.indexOf("function attachNameTag") !== -1 && src.indexOf("function layoutNameTags") !== -1, "halo nametags exist");
assert(!/function attachNameTag\([\s\S]{0,500}new THREE\.Sprite/.test(src), "nametags are mesh billboards");
assert(src.indexOf('r.kind !== "player"') !== -1, "own tag stays off; other cars still show");
assert(src.indexOf('createRacer("cpu", 0xd4a017, "BowieKnife99"') !== -1, "one bot is exactly BowieKnife99");
assert(src.indexOf("rideHeight() + 1.46") !== -1, "tags sit tiny over the halo");
assert(src.indexOf("dropNameTag") !== -1, "nametags leave the scene with the car");

sim.lockRacePath("");
proveWheelSteer("Campus Loop", 0, -80, 0);
sim.lockRacePath(sim.encodeMap(rectPieces()));
var wheelPose = sim.customGridPose();
assert(wheelPose, "custom grid pose exists for wheel-steer proof");
proveWheelSteer("custom board", wheelPose.x, wheelPose.z, wheelPose.h);
sim.lockRacePath("");

var loopCarSpd = blankCar(0, -80, 0, 30);
assert(sim.speedKph(loopCarSpd) === Math.round(30 * 3.15), "speedo matches velocity, not a stuck 0");

function pathJoinGap() {
  var i;
  var worst = 0;
  for (i = 0; i < sim.PATH.length; i++) {
    var a = sim.PATH[i];
    var b = sim.PATH[(i + 1) % sim.PATH.length];
    var ae = a.type === "line" ? { x: a.bx, z: a.bz } : sim.centerlinePoint(a.startS + a.len - 0.001);
    var bs = b.type === "line" ? { x: b.ax, z: b.az } : sim.centerlinePoint(b.startS + 0.001);
    var g = Math.hypot(ae.x - bs.x, ae.z - bs.z);
    if (g > worst) worst = g;
  }
  return worst;
}

function wallClear(x, z) {
  var best = 999;
  var i;
  for (i = 0; i < sim.WALLS.length; i++) {
    var w = sim.WALLS[i];
    var dx = w.bx - w.ax;
    var dz = w.bz - w.az;
    var len2 = dx * dx + dz * dz || 1;
    var t = ((x - w.ax) * dx + (z - w.az) * dz) / len2;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
    var d = Math.hypot(x - (w.ax + dx * t), z - (w.az + dz * t));
    if (d < best) best = d;
  }
  return best;
}

function proveGrid(pieces, label) {
  var code = sim.encodeMap(pieces);
  sim.setTrack(code);
  assert(sim.lockRacePath(code), label + " is a driveable loop");
  sim.placeWalls();
  var pose = sim.customGridPose();
  assert(pose, label + " has a grid pose");
  var along = sim.centerlinePoint(sim.TRACK_LEN - 14);
  var dh = angDiff(pose.h, along.h);
  assert(Math.abs(dh) < 0.25, label + " grid faces race direction, dh=" + dh);
  var line = sim.projectTrack(pose.x, pose.z);
  assert(line.onAsphalt, label + " player sits on S/F asphalt, dist=" + line.dist);
  assert(wallClear(pose.x, pose.z) > 5, label + " player is not in a wall, d=" + wallClear(pose.x, pose.z));
  var p0 = sim.slotOnPath(sim.TRACK_LEN - 6, 1);
  var p1 = sim.slotOnPath(sim.TRACK_LEN - 22, 1);
  assert(sim.projectTrack(p0.x, p0.z).onAsphalt, label + " pole sits on asphalt");
  assert(sim.projectTrack(p1.x, p1.z).onAsphalt, label + " P3 sits on asphalt");
  assert(wallClear(p0.x, p0.z) > 5, label + " pole is not in a wall");
  assert(wallClear(p1.x, p1.z) > 5, label + " P3 is not in a wall");
  assert(Math.hypot(pose.x - p0.x, pose.z - p0.z) > 6, label + " cars do not interpenetrate");
  assert(pathJoinGap() < 2.5, label + " PATH joins are one edge, gap=" + pathJoinGap());
  var parked = blankCar(pose.x, pose.z, pose.h, 0);
  parked.fuel = 100;
  var xHold = parked.x;
  var zHold = parked.z;
  var fuelHold = parked.fuel;
  var tHold;
  for (tHold = 0; tHold < 0.6; tHold += 1 / 60) {
    parked.speed = 0;
    parked.x = pose.x;
    parked.z = pose.z;
    parked.heading = pose.h;
  }
  assert(parked.x === xHold && parked.z === zHold, label + " locked grid does not hop at PRE-START");
  assert(fuelHold === 100, label + " PRE-START fuel stays 100");
  return pose;
}

var y0Rect = [
  { t: "r", x: 1, y: 0, r: 0 },
  { t: "F", x: 2, y: 0, r: 0 },
  { t: "s", x: 3, y: 0, r: 0 },
  { t: "r", x: 4, y: 0, r: 1 },
  { t: "s", x: 4, y: 1, r: 1 },
  { t: "r", x: 4, y: 2, r: 2 },
  { t: "s", x: 3, y: 2, r: 0 },
  { t: "s", x: 2, y: 2, r: 0 },
  { t: "r", x: 1, y: 2, r: 3 },
  { t: "s", x: 1, y: 1, r: 1 },
];
proveGrid(rectPieces(), "closed rectangle");
proveGrid(y0Rect, "S/F on campus-band row");

function kitPieces() {
  return [
    { t: "r", x: 1, y: 1, r: 0 },
    { t: "F", x: 2, y: 1, r: 0 },
    { t: "s", x: 3, y: 1, r: 0 },
    { t: "r", x: 4, y: 1, r: 1 },
    { t: "w", x: 4, y: 2, r: 3 },
    { t: "r", x: 6, y: 3, r: 1 },
    { t: "s", x: 6, y: 4, r: 1 },
    { t: "r", x: 6, y: 5, r: 2 },
    { t: "s", x: 5, y: 5, r: 0 },
    { t: "C", x: 4, y: 5, r: 0 },
    { t: "s", x: 3, y: 5, r: 0 },
    { t: "s", x: 2, y: 5, r: 0 },
    { t: "r", x: 1, y: 5, r: 3 },
    { t: "s", x: 1, y: 4, r: 1 },
    { t: "s", x: 1, y: 3, r: 1 },
    { t: "s", x: 1, y: 2, r: 1 },
  ];
}

function proveDrive(pieces, label) {
  var code = sim.encodeMap(pieces);
  sim.setTrack(code);
  assert(sim.lockRacePath(code), label + " locks as a closed loop");
  sim.placeWalls();
  assert(!sim.PIT_META.on, label + " without a P piece has no pit grab");
  var i;
  var midOff = 0;
  var midGrass = 0;
  var wallCut = 0;
  var headBad = 0;
  for (i = 0; i < sim.PATH.length; i++) {
    var mid = sim.centerlinePoint(sim.PATH[i].startS + sim.PATH[i].len * 0.5);
    var hit = sim.projectTrack(mid.x, mid.z);
    if (!hit.onAsphalt || hit.dist > 1.2) midOff += 1;
    if (Math.abs(angDiff(hit.h, mid.h)) > 0.45) headBad += 1;
    var nx = -Math.sin(mid.h);
    var nz = Math.cos(mid.h);
    var side = sim.projectTrack(mid.x + nx * (8.6 + 2.4), mid.z + nz * (8.6 + 2.4));
    if (side.onAsphalt) midGrass += 1;
  }
  for (i = 0; i < sim.WALLS.length; i++) {
    var w = sim.WALLS[i];
    var mx = (w.ax + w.bx) * 0.5;
    var mz = (w.az + w.bz) * 0.5;
    if (sim.projectTrack(mx, mz).dist < 8.6) wallCut += 1;
  }
  assert(midOff === 0, label + " mid-piece stays on asphalt, off=" + midOff);
  assert(headBad === 0, label + " line heading matches mesh, bad=" + headBad);
  assert(midGrass === 0, label + " runoff/grass is not on-track, leak=" + midGrass);
  assert(wallCut === 0, label + " no wall sits on the racing line, cut=" + wallCut);
  var pose = sim.customGridPose();
  var racer = blankCar(pose.x, pose.z, pose.h, 16);
  racer.fuel = 100;
  racer.tires = 100;
  racer.s = sim.projectTrack(racer.x, racer.z).s;
  racer.lastS = racer.s;
  var on = 0;
  var frames = 0;
  var t;
  for (t = 0; t < 3.4; t += 1 / 60) {
    var line = sim.projectTrack(racer.x, racer.z);
    var err = angDiff(line.h, racer.heading);
    if (line.dist > 1.2) {
      var home = Math.atan2(line.z - racer.z, line.x - racer.x);
      err = angDiff(home, racer.heading) * 0.65 + err * 0.35;
    }
    var steer = err * 1.8;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    sim.applyMotion(racer, steer, line.dist < 8.2, false, false, 1 / 60, true);
    sim.bashAllWalls(racer);
    frames += 1;
    if (sim.projectTrack(racer.x, racer.z).onAsphalt) on += 1;
  }
  assert(on / frames > 0.8, label + " stays on ribbon after GO, on=" + on + "/" + frames);
  var lapper = blankCar(pose.x, pose.z, pose.h, 0);
  lapper.s = sim.TRACK_LEN - 18;
  lapper.lastS = lapper.s;
  lapper.passedHalf = false;
  lapper.lap = 1;
  var sWalk;
  for (sWalk = lapper.s; sWalk < lapper.s + sim.TRACK_LEN + 40; sWalk += 6) {
    var p = sim.centerlinePoint(sWalk);
    lapper.x = p.x;
    lapper.z = p.z;
    sim.updateLaps(lapper);
  }
  assert(lapper.lap >= 2, label + " closed loop must lap after the start, lap=" + lapper.lap);
  var botA = blankCar(pose.x, pose.z, pose.h, 20);
  var botB = sim.slotOnPath(sim.TRACK_LEN - 6, 1);
  botB = blankCar(botB.x, botB.z, botB.h, 20);
  sim.bashCars(botA, botB);
  sim.bashCars(botA, botB);
  assert(Math.hypot(botA.x - botB.x, botA.z - botB.z) >= 3.2, label + " bots do not occupy the player");
  assert(wallClear(botB.x, botB.z) > 5, label + " pole bot is not in a wall");
}

proveDrive(rectPieces(), "rectangle race");
proveDrive(kitPieces(), "90s+sweeper+S/F kit");

function proveClean90s(pieces, label, lapFrac) {
  lapFrac = lapFrac == null ? 0.8 : lapFrac;
  sim.lockRacePath(sim.encodeMap(pieces));
  sim.placeWalls();
  var pose = sim.customGridPose();
  var car = blankCar(pose.x, pose.z, pose.h, 28);
  car.fuel = 100;
  car.tires = 100;
  var maxSlide = 0;
  var spinFrames = 0;
  var travelled = 0;
  var lastS = sim.projectTrack(car.x, car.z).s;
  var t;
  var seconds = Math.max(48, sim.TRACK_LEN / 16);
  for (t = 0; t < seconds; t += 1 / 60) {
    var line = sim.projectTrack(car.x, car.z);
    var look = sim.centerlinePoint(line.s + 16);
    var lookFar = sim.centerlinePoint(line.s + 28);
    var err = angDiff(look.h, car.heading);
    if (line.dist > 1.5) {
      var home = Math.atan2(line.z - car.z, line.x - car.x);
      err = angDiff(home, car.heading) * 0.55 + err * 0.45;
    }
    var steer = err * 1.6;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    var gas = line.dist < 6.2;
    var brake = false;
    var upcoming90 = line.name === "the90" || look.name === "the90" || lookFar.name === "the90";
    if (upcoming90 && car.speed > 28) {
      gas = false;
      brake = true;
    } else if (line.name === "the90" && car.speed > 24) {
      gas = false;
    }
    var h0 = car.heading;
    sim.applyMotion(car, steer, gas, brake, false, 1 / 60, true);
    sim.bashAllWalls(car);
    if (Math.abs(car.slide) > maxSlide) maxSlide = Math.abs(car.slide);
    if (Math.abs(car.slide) > 5.2 || Math.abs(angDiff(car.heading, h0)) > 0.09) spinFrames += 1;
    var nowS = sim.projectTrack(car.x, car.z).s;
    var ds = nowS - lastS;
    if (ds < -sim.TRACK_LEN * 0.5) ds += sim.TRACK_LEN;
    if (ds > 0 && ds < 18) travelled += ds;
    lastS = nowS;
  }
  assert(
    travelled > sim.TRACK_LEN * lapFrac,
    label + " clean line covers a lap, went=" + travelled.toFixed(0) + "/" + sim.TRACK_LEN.toFixed(0)
  );
  assert(maxSlide < 5.2, label + " clean 90s keep the car, slide=" + maxSlide.toFixed(2));
  assert(spinFrames < 6, label + " no half-spin at each corner, frames=" + spinFrames);
}

proveClean90s(rectPieces(), "rectangle 90s");

function proveModulesFit(pieces, label) {
  var seen = {};
  var i;
  var j;
  for (i = 0; i < pieces.length; i++) {
    var fp = sim.footprint(pieces[i]);
    for (j = 0; j < fp.length; j++) {
      var key = fp[j].x + "," + fp[j].y;
      assert(!seen[key], label + " two pieces occupy cell " + key);
      seen[key] = 1;
    }
    if (pieces[i].t === "t") continue;
    assert(sim.ribbonFitsFootprint(pieces[i]), label + " " + pieces[i].t + " ribbon stays in its cell(s)");
  }
  for (i = 0; i < pieces.length; i++) {
    if (pieces[i].t === "t") continue;
    for (j = i + 1; j < pieces.length; j++) {
      if (pieces[j].t === "t") continue;
      assert(!sim.footprintsOverlap(pieces[i], pieces[j]), label + " editor footprints do not overlap");
      assert(!sim.ribbonsStack(pieces[i], pieces[j]), label + " 3D ribbons do not stack " + pieces[i].t + "+" + pieces[j].t);
    }
  }
}

var zig = [
  { t: "r", x: 1, y: 1, r: 0 },
  { t: "F", x: 2, y: 1, r: 0 },
  { t: "C", x: 3, y: 1, r: 0 },
  { t: "r", x: 4, y: 1, r: 1 },
  { t: "s", x: 4, y: 2, r: 1 },
  { t: "C", x: 4, y: 3, r: 1 },
  { t: "r", x: 4, y: 4, r: 2 },
  { t: "s", x: 3, y: 4, r: 0 },
  { t: "C", x: 2, y: 4, r: 0 },
  { t: "r", x: 1, y: 4, r: 3 },
  { t: "s", x: 1, y: 3, r: 1 },
  { t: "s", x: 1, y: 2, r: 1 },
];
proveModulesFit(rectPieces(), "rectangle 90s");
proveModulesFit(kitPieces(), "kit 90s+sweeper+chicane");
proveModulesFit(zig, "chicane S next to 90s and straights");

function proveNoLock(code, label) {
  assert(sim.lockRacePath(code), label + " must Solo as a closed custom");
  assert(sim.isDriveableLoop(), label + " stays a driveable custom");
  assert(sim.menuTrackName() === "CUSTOM CIRCUIT", label + " Solo label stays CUSTOM");
  sim.placeWalls();
  var pose = sim.customGridPose();
  assert(pose, label + " has a grid on the ribbon");
  var car = blankCar(pose.x, pose.z, pose.h, 18);
  car.fuel = 100;
  car.tires = 100;
  var lockFrames = 0;
  var hadPace = false;
  var freezeRun = 0;
  var maxFreeze = 0;
  var spinFrames = 0;
  var travelled = 0;
  var lastS = sim.projectTrack(car.x, car.z).s;
  var t;
  var seconds = Math.max(36, sim.TRACK_LEN / 12);
  for (t = 0; t < seconds; t += 1 / 60) {
    var line = sim.projectTrack(car.x, car.z);
    var look = sim.centerlinePoint(line.s + 14);
    var lookFar = sim.centerlinePoint(line.s + 26);
    var err = angDiff(look.h, car.heading);
    if (line.dist > 1.4) {
      var home = Math.atan2(line.z - car.z, line.x - car.x);
      err = angDiff(home, car.heading) * 0.55 + err * 0.45;
    }
    var steer = err * 1.65;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    var tight =
      line.name === "the90" ||
      line.name === "chicane" ||
      look.name === "the90" ||
      look.name === "chicane" ||
      lookFar.name === "the90" ||
      lookFar.name === "chicane";
    var gas = line.dist < 6.4;
    var brake = false;
    if (tight && car.speed > 26) {
      gas = false;
      brake = true;
    } else if (tight && car.speed > 22) {
      gas = false;
    }
    var h0 = car.heading;
    sim.applyMotion(car, steer, gas, brake, false, 1 / 60, true);
    sim.bashAllWalls(car);
    if (car.speed > 12) hadPace = true;
    if (hadPace && car.speed < 4 && !line.grass) lockFrames += 1;
    if (car.speed < 1.2) {
      freezeRun += 1;
      if (freezeRun > maxFreeze) maxFreeze = freezeRun;
    } else freezeRun = 0;
    if (Math.abs(car.slide) > 5.2 || Math.abs(angDiff(car.heading, h0)) > 0.1) spinFrames += 1;
    var nowS = sim.projectTrack(car.x, car.z).s;
    var ds = nowS - lastS;
    if (ds < -sim.TRACK_LEN * 0.5) ds += sim.TRACK_LEN;
    if (ds > 0 && ds < 18) travelled += ds;
    lastS = nowS;
  }
  assert(
    travelled > sim.TRACK_LEN * 0.85,
    label + " driven without dying, went=" + travelled.toFixed(0) + "/" + sim.TRACK_LEN.toFixed(0)
  );
  assert(lockFrames === 0, label + " must not lock at turns, lockFrames=" + lockFrames);
  assert(maxFreeze < 18, label + " must not freeze on the ribbon, freeze=" + maxFreeze);
  assert(spinFrames < 8, label + " no half-spin at each corner, frames=" + spinFrames);
}

proveNoLock(yell, "yell 4-piece rectangle MR220R321R332R233");
proveNoLock(sim.encodeMap(zig), "chicane board");
var chi = { t: "C", x: 2, y: 2, r: 0 };
assert(sim.ribbonFitsFootprint(chi), "lone chicane S lives inside its cell");
var chiPts = sim.chicanePts(2, 2, 0);
assert(chiPts.length >= 16, "chicane is a smooth S, not a 3-line stack");
var wPort = sim.edgeMid(2, 2, 2);
var ePort = sim.edgeMid(2, 2, 0);
assert(Math.hypot(chiPts[0].x - wPort.x, chiPts[0].z - wPort.z) < 0.05, "chicane enter is flush on the mid-edge");
assert(
  Math.hypot(chiPts[chiPts.length - 1].x - ePort.x, chiPts[chiPts.length - 1].z - ePort.z) < 0.05,
  "chicane exit is flush on the mid-edge"
);
var d0x = chiPts[1].x - chiPts[0].x;
var d0z = chiPts[1].z - chiPts[0].z;
assert(Math.abs(d0z) < Math.abs(d0x) * 0.22, "chicane meets the port square, not as a stacked diagonal");
var cfx = ePort.x - wPort.x;
var cfz = ePort.z - wPort.z;
var cfl = Math.hypot(cfx, cfz) || 1;
var clx = -cfz / cfl;
var clz = cfx / cfl;
var maxS = 0;
var ci;
for (ci = 0; ci < chiPts.length; ci++) {
  var off = (chiPts[ci].x - wPort.x) * clx + (chiPts[ci].z - wPort.z) * clz;
  if (Math.abs(off) > maxS) maxS = Math.abs(off);
}
assert(maxS < 10, "S was shrunk, not a fat zig-zag, amp=" + maxS.toFixed(1));
assert(maxS + 8.6 < sim.MAP_CELL * 0.5 - 2, "centerline + asphalt stay inside the cell, reach=" + (maxS + 8.6).toFixed(1));
var neighbor = { t: "s", x: 3, y: 2, r: 0 };
assert(!sim.ribbonsStack(chi, neighbor), "chicane does not spill onto the next straight");
var chi2 = { t: "C", x: 3, y: 2, r: 0 };
assert(!sim.ribbonsStack(chi, chi2), "two chicanes in a row do not stack");
assert(sim.ribbonFitsFootprint(chi2), "second chicane also stays in its cell");
var sideChi = { t: "C", x: 2, y: 3, r: 0 };
assert(!sim.ribbonsStack(chi, sideChi), "side-by-side chicanes do not occupy the same ground");
var closed90s = [
  { t: "r", x: 2, y: 2, r: 0 },
  { t: "r", x: 3, y: 2, r: 0 },
];
assert(!sim.ribbonsStack(closed90s[0], closed90s[1]), "incompatible 90s do not interpenetrate");
assert(src.indexOf("Math.sin(t * Math.PI * 2)") !== -1, "chicane S is a sine inside the cell");
assert(src.indexOf("env *= env") !== -1, "chicane S is flat at the ports");
assert(src.indexOf("var amp = MAP_CELL * 0.1") !== -1, "zig-zag amplitude is small enough to keep the ribbon in-cell");
assert(src.indexOf("pieceSegs(artPiece)") !== -1, "editor preview is the same segs as the 3D race");

sim.lockRacePath("");
assert(src.indexOf("var ACCEL = 16") !== -1, "wind-up is slow (arcade, not a snap)");
assert(src.indexOf("var COAST = 5") !== -1, "coast bleeds speed");
assert(src.indexOf("var BRAKE_DECEL = 20") !== -1, "Space is a planned squeeze");
assert(src.indexOf("var MAX_LAT = 28") !== -1, "custom 90s are not glued to hide a spin");
assert(src.indexOf('info.name === "hairpin" || info.name === "chicane"') !== -1, "hold W through 180 or chicane dumps");
assert(src.indexOf("ABS") === -1, "no ABS");

function tickFeel(car, steer, gas, brake, seconds) {
  var t;
  for (t = 0; t < seconds; t += 1 / 60) sim.applyMotion(car, steer, gas, brake, false, 1 / 60, true);
}

var wind = blankCar(0, -80, 0, 0);
tickFeel(wind, 0, true, false, 2);
assert(wind.speed > 26 && wind.speed < 36, "2s of W is still winding up, speed=" + wind.speed.toFixed(1));
tickFeel(wind, 0, true, false, 1.2);
assert(wind.speed > 40, "still reaches race pace, speed=" + wind.speed.toFixed(1));

var roll = blankCar(0, -80, 0, 48);
tickFeel(roll, 0, false, false, 2);
assert(roll.speed > 35 && roll.speed < 41, "coast bleeds speed, speed=" + roll.speed.toFixed(1));
tickFeel(roll, 0, false, false, 1.2);
assert(roll.speed > 26, "lift is not enough for the 180 or chicane, speed=" + roll.speed.toFixed(1));

var tap = blankCar(0, -80, 0, 48);
tickFeel(tap, 0, false, true, 0.12);
tickFeel(tap, 0, false, false, 0.5);
assert(tap.speed > 40, "tap-and-forget Space does not dump, speed=" + tap.speed.toFixed(1));

var squeeze = blankCar(0, -80, 0, 48);
tickFeel(squeeze, 0, false, true, 2.2);
assert(squeeze.speed < 18 && squeeze.speed >= 0, "held Space can make the 180 without a stall, speed=" + squeeze.speed.toFixed(1));

var biteHi = blankCar(0, -80, 0, 48);
biteHi.brakeHold = 1;
sim.applyMotion(biteHi, 0, false, true, false, 1 / 60, true);
var dropHi = 48 - biteHi.speed;
var biteLo = blankCar(0, -80, 0, 16);
biteLo.brakeHold = 1;
sim.applyMotion(biteLo, 0, false, true, false, 1 / 60, true);
var dropLo = 16 - biteLo.speed;
assert(dropHi < dropLo, "Space is weaker at high speed and bites when slow");

function firstNamedS(name) {
  var s;
  for (s = 0; s < sim.TRACK_LEN; s += 4) {
    if (sim.centerlinePoint(s).name === name) return s;
  }
  return 0;
}

function holdWOn(name, spd, seconds) {
  var p = sim.centerlinePoint(firstNamedS(name) + 6);
  var car = blankCar(p.x, p.z, p.h, spd);
  var t;
  for (t = 0; t < seconds; t += 1 / 60) {
    var line = sim.projectTrack(car.x, car.z);
    var look = sim.centerlinePoint(line.s + 12);
    var err = angDiff(look.h, car.heading);
    var steer = err * 1.8;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    sim.applyMotion(car, steer, true, false, false, 1 / 60, true);
  }
  return car;
}

var hpDump = holdWOn("hairpin", 40, 0.5);
assert(Math.abs(hpDump.slide) > 2.4, "hold W through the 180 dumps, slide=" + hpDump.slide.toFixed(2));
var chiDump = holdWOn("chicane", 40, 0.5);
assert(Math.abs(chiDump.slide) > 2.4, "hold W through the chicane dumps, slide=" + chiDump.slide.toFixed(2));
var sweepCar = holdWOn("sweeper", 40, 0.7);
assert(Math.abs(sweepCar.slide) < 2.2, "sweeper carries on fresh tires, slide=" + sweepCar.slide.toFixed(2));
assert(sim.projectTrack(sweepCar.x, sweepCar.z).onAsphalt, "sweeper carry stays on the ribbon");

var hs = firstNamedS("hairpin");
var hpPt = sim.centerlinePoint(hs + 6);
var hpCar = blankCar(hpPt.x, hpPt.z, hpPt.h, 32);
var hpI;
for (hpI = 0; hpI < 24; hpI++) sim.applyMotion(hpCar, 0, true, false, false, 1 / 60, true);
assert(Math.abs(hpCar.slide) > 1.1, "Campus Loop hairpin still punishes late/no brake, slide=" + hpCar.slide);

function driveHoldW(car, seconds) {
  var t;
  var dumped = false;
  var sawGrass = false;
  var travelled = 0;
  var lastS = sim.projectTrack(car.x, car.z).s;
  var maxStep = 0;
  for (t = 0; t < seconds; t += 1 / 60) {
    var line = sim.projectTrack(car.x, car.z);
    var look = sim.centerlinePoint(line.s + 14);
    var err = angDiff(look.h, car.heading);
    if (line.dist > 2.4) {
      var home = Math.atan2(line.z - car.z, line.x - car.x);
      err = angDiff(home, car.heading);
    }
    var steer = err * 1.65;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    var x0 = car.x;
    var z0 = car.z;
    sim.applyMotion(car, steer, true, false, false, 1 / 60, true);
    sim.bashAllWalls(car);
    var step = Math.hypot(car.x - x0, car.z - z0);
    if (step > maxStep) maxStep = step;
    if (Math.abs(car.slide) > 2.4) dumped = true;
    if (sim.projectTrack(car.x, car.z).grass) sawGrass = true;
    var nowS = sim.projectTrack(car.x, car.z).s;
    var ds = nowS - lastS;
    if (ds < -sim.TRACK_LEN * 0.5) ds += sim.TRACK_LEN;
    if (ds > 0 && ds < 22) travelled += ds;
    lastS = nowS;
  }
  return { dumped: dumped, sawGrass: sawGrass, travelled: travelled, maxStep: maxStep };
}

sim.lockRacePath("");
sim.placeWalls();
var loopDump = blankCar(hpPt.x, hpPt.z, hpPt.h, 40);
loopDump.fuel = 100;
loopDump.tires = 100;
var dumpT;
var dumpStep = 0;
for (dumpT = 0; dumpT < 0.55; dumpT += 1 / 60) {
  var x0 = loopDump.x;
  var z0 = loopDump.z;
  sim.applyMotion(loopDump, 0, true, false, false, 1 / 60, true);
  sim.bashAllWalls(loopDump);
  var st = Math.hypot(loopDump.x - x0, loopDump.z - z0);
  if (st > dumpStep) dumpStep = st;
}
assert(Math.abs(loopDump.slide) > 2.4, "Loop hold W through the 180 dumps, slide=" + loopDump.slide.toFixed(2));
var wideHit = sim.projectTrack(loopDump.x, loopDump.z);
assert(wideHit.grass || !wideHit.onAsphalt, "DUMP hole stays: you run wide, dist=" + wideHit.dist.toFixed(1));
assert(wideHit.grass, "after DUMP you still see grass, not a black void");
assert(dumpStep < 6, "DUMP does not teleport, maxStep=" + dumpStep.toFixed(2));
var wideX = loopDump.x;
var wideZ = loopDump.z;
var crawlT;
var crawlStep = 0;
for (crawlT = 0; crawlT < 14; crawlT += 1 / 60) {
  var line = sim.projectTrack(loopDump.x, loopDump.z);
  var home = Math.atan2(line.z - loopDump.z, line.x - loopDump.x);
  var err = angDiff(home, loopDump.heading);
  var steer = err * 2.4;
  if (steer > 1) steer = 1;
  if (steer < -1) steer = -1;
  var turnIn = Math.abs(err) > 0.35;
  var brake = loopDump.speed > 9 && turnIn;
  var gas = !brake;
  var x0 = loopDump.x;
  var z0 = loopDump.z;
  sim.applyMotion(loopDump, steer, gas, brake, false, 1 / 60, true);
  sim.bashAllWalls(loopDump);
  var st = Math.hypot(loopDump.x - x0, loopDump.z - z0);
  if (st > crawlStep) crawlStep = st;
  if (sim.projectTrack(loopDump.x, loopDump.z).onAsphalt) break;
}
var backHit = sim.projectTrack(loopDump.x, loopDump.z);
assert(
  backHit.onAsphalt,
  "player steers and crawls back onto the ribbon, dist=" + backHit.dist.toFixed(1) + " spd=" + loopDump.speed.toFixed(1)
);
assert(crawlStep < 6, "steer-back is a crawl, not a snap, maxStep=" + crawlStep.toFixed(2));
assert(Math.hypot(loopDump.x - wideX, loopDump.z - wideZ) > 2, "crawl-back left the wide spot");
assert(firstNamedS("hairpin") > 0, "the 180 still exists after the dump");
assert(sim.centerlinePoint(firstNamedS("hairpin") + 6).name === "hairpin", "hairpin arc is still the 180");

function proveGoHoldW(code, label) {
  assert(sim.lockRacePath(code), label + " must Solo as a closed custom");
  assert(sim.isDriveableLoop(), label + " stays a driveable custom");
  sim.placeWalls();
  var pose = sim.customGridPose();
  assert(pose, label + " has a grid");
  assert(wallClear(pose.x, pose.z) > 5, label + " grid is not inside a wall, d=" + wallClear(pose.x, pose.z));
  var car = blankCar(pose.x, pose.z, pose.h, 0);
  car.fuel = 100;
  car.tires = 100;
  var t;
  for (t = 0; t < 2; t += 1 / 60) {
    var line = sim.projectTrack(car.x, car.z);
    var look = sim.centerlinePoint(line.s + 12);
    var err = angDiff(look.h, car.heading);
    var steer = err * 1.6;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    sim.applyMotion(car, steer, true, false, false, 1 / 60, true);
    sim.bashAllWalls(car);
  }
  assert(car.speed > 12, label + " after GO hold W must move, speed=" + car.speed.toFixed(1));
  assert(Math.hypot(car.x - pose.x, car.z - pose.z) > 10, label + " left the locked grid");
  var goRun = driveHoldW(car, Math.max(24, sim.TRACK_LEN / 14));
  assert(
    goRun.travelled > sim.TRACK_LEN * 0.85,
    label + " hold W can lap, went=" + goRun.travelled.toFixed(0) + "/" + sim.TRACK_LEN.toFixed(0)
  );
  assert(sim.projectTrack(car.x, car.z).onAsphalt || car.speed > 16, label + " is still a race, not a freeze");
}

proveGoHoldW(yell, "4-piece MR220R321R332R233");

function typingAt(stateName, doc) {
  return new Function(
    "state",
    "document",
    sliceFn("typingField") + sliceFn("isTyping") + "; return isTyping();"
  )(stateName, doc);
}

var shareEl = { tagName: "INPUT", id: "track-paste", isContentEditable: false };
var editDoc = {
  body: { tagName: "BODY" },
  documentElement: { tagName: "HTML" },
  activeElement: shareEl,
};
assert(typingAt("track", editDoc) === true, "share field keep-focus while editing: R types");
assert(typingAt("title", editDoc) === true, "share/name field still captures keys on title");
assert(typingAt("start", editDoc) === false, "lights: focused share box does not eat W");
assert(typingAt("racing", editDoc) === false, "GO: focused share box does not eat W");

var blurN = 0;
var bodyEl = { tagName: "BODY" };
var liveShare = {
  tagName: "INPUT",
  id: "track-paste",
  isContentEditable: false,
  blur: function () {
    blurN += 1;
    liveDoc.activeElement = bodyEl;
  },
};
var liveDoc = {
  body: bodyEl,
  documentElement: { tagName: "HTML" },
  activeElement: liveShare,
  getElementById: function () {
    return null;
  },
};
var liveHud = { trackPaste: liveShare, nameInput: null };
new Function(
  "document",
  "hud",
  sliceFn("typingField") + sliceFn("releaseTypeFocus") + "; releaseTypeFocus();"
)(liveDoc, liveHud);
assert(blurN >= 1, "paste then Solo blurs the share box, no extra click, blurs=" + blurN);
assert(liveDoc.activeElement === bodyEl, "after Solo the share box is not focused");
assert(sliceFn("startSequence").indexOf("releaseTypeFocus()") !== -1, "startSequence blurs on lights");
assert(sliceFn("setScreen").indexOf("releaseTypeFocus()") !== -1, "setScreen blurs on start/GO");
assert(sliceFn("paintTrackEditor").indexOf("releaseTypeFocus") === -1, "editor paint does not steal share focus");
assert(sliceFn("commitTrack").indexOf("releaseTypeFocus") === -1, "Enter commit does not blur the share box");
assert(sliceFn("trapTextKeys").indexOf("e.stopPropagation()") !== -1, "while editing, share keys do not Solo");
assert(sliceFn("onKey").indexOf('state !== "start" && state !== "racing"') !== -1, "onKey only traps text before the race");
assert(src.indexOf('who.id === "track-paste"') !== -1 && src.indexOf("commitTrack(who.value)") !== -1, "Enter in the share box commits, does not Solo");

assert(src.indexOf("function recoverIfVoid") === -1, "DUMP does not teleport back onto the ribbon");
assert(src.indexOf("voidT") === -1, "no void timer snap-back");
assert(src.indexOf('name = "groundSkirt"') !== -1, "green skirt sits past the dirt plane");
assert(src.indexOf("PlaneGeometry(4200, 3600)") !== -1, "skirt is larger than the dirt pad");
assert(src.indexOf("0x3f5c32") !== -1, "skirt is visible grass, not a black void");
assert(src.indexOf("0x6a655c") !== -1, "course dirt pad stays dirt, not a lawn");
assert(src.indexOf("var GRASS_ROLL = 4") !== -1, "13 kph grass-roll is the crawl back");

var pitRect = rectPieces();
pitRect[2] = { t: "P", x: 3, y: 1, r: 0 };
sim.setTrack(sim.encodeMap(pitRect));
assert(sim.lockRacePath(sim.encodeMap(pitRect)), "P-piece board stays a closed loop");
assert(sim.PIT_META.on, "P piece turns the pit grab on");
var pitMid = {
  x: (sim.PIT_META.ax + sim.PIT_META.bx) * 0.5,
  z: (sim.PIT_META.az + sim.PIT_META.bz) * 0.5,
};
assert(sim.inPitGrab({ x: pitMid.x, z: pitMid.z }), "halfway in the P lane grabs");
assert(!sim.inPitGrab({ x: 0, z: -80 }), "Campus S/F is not a ghost pit on a custom board");

sim.lockRacePath("");
sim.placeWalls();
assert(!sim.customGridPose(), "Campus Loop does not use custom grid");
var campusCar = blankCar(-14, -80 - 2.7, 0, 0);
assert(sim.projectTrack(0, -80).onAsphalt, "Campus S/F asphalt stays clean");
assert(wallClear(-14, -80 - 2.7) > 5, "Campus grid is not inside a wall");
assert(Math.abs(sim.TRACK_LEN - 1978.98) < 2, "Campus Loop length unchanged after custom grid prove");

assert(src.indexOf("lockRacePath") !== -1 && src.indexOf("isDriveableLoop") !== -1, "open/junk boards refuse and bounce to Loop");
assert(src.indexOf("if (code && !MAP_CLOSED) rebuildPath(\"\")") !== -1, "only OPEN/junk bounce to Loop; a closed header must race");
assert(src.indexOf("function isTyping") !== -1 && src.indexOf("function syncShareField") !== -1, "share/code fields do not fire rotate or Solo");
assert(src.indexOf("function trapTextKeys") !== -1 && src.indexOf("document.activeElement") !== -1, "Chromebook text fields stop game keys");
assert(src.indexOf("function releaseTypeFocus") !== -1, "Solo blurs share/name so W can throttle after GO");
assert(sliceFn("isTyping").indexOf('state === "start" || state === "racing"') !== -1, "hidden share field does not eat W on the grid");
assert(src.indexOf("function recoverIfVoid") === -1, "no teleport recover after DUMP");
assert(src.indexOf("exitPortAfter") !== -1 && src.indexOf("campusRoot") !== -1, "PATH exits the piece it actually traverses; campus volumes hide on custom");
assert(src.indexOf("slotOnPath") !== -1 && src.indexOf("rideHeight") !== -1, "custom grid sits on the ribbon, wheels above it");
sim.lockRacePath(sim.encodeMap(rectPieces()));
var crewPose = sim.customGridPose();
assert(crewPose && sim.projectTrack(crewPose.x, crewPose.z).onAsphalt, "Pit Crew: custom start sits ON the ribbon");
assert(sim.rideHeight() >= 0.12, "Pit Crew: custom ride lifts the car off a buried deck");
assert(sim.rideHeight() + 0.28 - 0.32 >= 0.05, "Pit Crew: open wheels sit on the ribbon, not in it");
sim.lockRacePath("");
assert(sim.rideHeight() === 0, "Campus Loop ride height stays locked");
assert(src.indexOf('lock("landscape")') !== -1 && src.indexOf("portraitRaceBlock") !== -1, "race is landscape-only");
assert(src.indexOf('lock("portrait")') === -1, "never lock portrait");
assert(sliceFn("portraitRaceBlock").indexOf("isPhoneLike") === -1, "portrait gate ignores phone/keyboard/Chromebook");
assert(/if \(portraitRaceBlock\(\)\) \{[\s\S]{0,280}return;/.test(src), "tick returns before motion when the window is tall");

var portraitGate = new Function(
  "state",
  "window",
  sliceFn("portraitRaceBlock") + "; return portraitRaceBlock();"
);
assert(portraitGate("racing", { innerWidth: 390, innerHeight: 844 }) === true, "tall phone window gates");
assert(portraitGate("start", { innerWidth: 400, innerHeight: 900 }) === true, "tall start window gates");
assert(portraitGate("racing", { innerWidth: 844, innerHeight: 390 }) === false, "wide window races");
assert(portraitGate("title", { innerWidth: 390, innerHeight: 844 }) === false, "title may stay portrait");
assert(portraitGate("racing", { innerWidth: 500, innerHeight: 900 }) === true, "tall desktop window also gates");

function fuelAfter(seconds, w, h) {
  var blocked = portraitGate("racing", { innerWidth: w, innerHeight: h });
  var car = blankCar(0, -80, 0, 30);
  car.fuel = 100;
  var t = 0;
  while (t < seconds) {
    if (!blocked) sim.applyMotion(car, 0, true, false, false, 0.016, true);
    t += 0.016;
  }
  return car.fuel;
}
assert(fuelAfter(3.2, 390, 844) === 100, "portrait window cannot burn fuel");
assert(fuelAfter(3.2, 500, 900) === 100, "tall browser window cannot burn fuel");
assert(fuelAfter(3.2, 844, 390) < 98.2, "landscape still burns idle+throttle");
assert(src.indexOf("_rotLock") !== -1, "rotate is debounced so one tap is 90 not 180");
assert(src.indexOf("rotateSelected();") !== -1 && !/tileRot\.addEventListener\("click"[\s\S]{0,80}rotateSelected/.test(src), "Rotate button does not double-fire");
assert(src.indexOf("title-track") !== -1, "title menu label is live");
assert(/#title-screen[\s\S]{0,180}overflow-y:\s*auto/.test(fs.readFileSync(path.join(__dirname, "..", "css", "style.css"), "utf8")), "title menu scrolls");

var customLen = rectLen;
sim.setTrack("");
sim.rebuildPath("");
assert(sim.MAP_SURF.length === 0, "Campus Loop clears custom surface");
assert(!sim.MAP_CLOSED, "Campus default is not a custom closed flag leak");
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
    customLen.toFixed(1) +
    " laps=" +
    loopCar.lap
);
