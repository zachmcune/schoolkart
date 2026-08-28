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

// Physics constants come out of game.js verbatim. Hand-copied numbers
// drifted once already: #29 raised MAX_SPEED to 200 and the stub kept
// 48, so every handling test here was quietly grading old physics.
function constFrom(name) {
  var m = src.match(new RegExp("^\\s*var " + name + " = ([^;\\n]+);", "m"));
  if (!m) throw new Error("missing const " + name);
  return "var " + name + " = " + m[1] + ";";
}

var code = [
  "var ASPHALT = 8.6;",
  "var RUNOFF = 3.8;",
  "var KERB_NAMES = ['the90', 'hairpin', 'chicane', 'sweeper', 'kink'];",
  "var KERB_RAISE = 0.055;",
  "var GRASS_MAX = 8.5;",
  "var GRASS_ROLL = 4;",
  "var GRASS_DUMP = 40;",
  "var TIRE_FLOOR = 22;",
  constFrom("WORN_FEEL"),
  constFrom("KPH_PER_UNIT"),
  constFrom("TOP_KPH"),
  constFrom("PIT_HALF"),
  // The map sandbox keeps the old 48 cap and the old quick accel on
  // purpose (#29): these tests drive 10s of W down short editor boards.
  // SPEED_LIMIT has to follow the sandbox cap, not the shipped 200, or
  // every handling sample here runs 30% faster than it was written for.
  "var MAX_SPEED = 48;",
  "var SPEED_LIMIT = MAX_SPEED;",
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
  "var GRID_OUT_A = -2.4;",
  "var GRID_OUT_B = -5.2;",
  "var PIT_ENTRY = { x0: 8, x1: 28, z0: -70.0, z1: -61.0 };",
  "var PIT_EXIT = { x0: 128, x1: 160, z0: -68.0, z1: -58.0 };",
  "var PIT_LANE = { x0: 28, x1: 136, z0: -61.5, z1: -52.5 };",
  "var PIT_GRAB = { x0: 64, x1: 98, z0: -61.0, z1: -53.2 };",
  "var PIT_PAVE = [];",
  "var PIT_PATH = [];",
  "var PIT_HALF = 4.5;",
  "var PIT_META = { ax: 28, az: -57, bx: 136, bz: -57, on: true };",
  "var PATH = [];",
  "var TRACK_LEN = 0;",
  "var _x = -200;",
  "var _z = SF_Z;",
  "var _h = 0;",
  "var _y = 0;",
  "var activeBuiltin = 'campus';",
  "var CAMPUS_KERBS = ['the90', 'hairpin', 'chicane', 'sweeper', 'kink'];",
  "var BUILTIN_KERBS = { campus: CAMPUS_KERBS, harbor: ['devote','casino','hairpin','chicane','pool','rascasse','harbor'], park: ['rettifilo','roggia','lesmo','ascari','parabola'], desert: ['t1','oasis','kink','sweeper'], forest: ['source','eau','raidillon','busstop'] };",
  "var stampTrees = [];",
  "var RIBBON_SEGS = 360;",
  "var DRESS_KEEP = ASPHALT + RUNOFF + 4;",
  "var trackCode = '';",
  "var state = 'racing';",
  "var raceTime = 3;",
  "var launchT = 0;",
  "var launchMul = 1;",
  "var launchCall = '';",
  "var launchCallT = 0;",
  "var LAPS = 5;",
  "var TRACK_CODE_MAX = 800;",
  "var MESH_NOSE = 3.55;",
  "var MESH_TAIL = 2.1;",
  "var MESH_HALF_W = 1.2;",
  "var WALLS = [];",
  // These tests are about geometry, not strategy, so the tank burns at
  // the stock rate rather than one sized to a particular board.
  "var RACE = { burn: 1 };",
  "var TYPE_ENC = { s: 'A', S: 'L', r: 'R', w: 'W', H: 'H', C: 'C', F: 'F', P: 'P', t: 'T' };",
  "var TYPE_DEC = { A:'s', a:'s', s:'s', L:'S', S:'S', R:'r', r:'r', W:'w', w:'w', H:'H', h:'H', C:'C', c:'C', F:'F', f:'F', P:'P', p:'P', T:'t', t:'t' };",
  sliceFn("canonType"),
  sliceFn("clamp"),
  sliceFn("inRect"),
  sliceFn("pitSegLine"),
  sliceFn("pitSegArc"),
  sliceFn("pitLine"),
  sliceFn("pitArc"),
  sliceFn("pitSBend"),
  sliceFn("onPitPath"),
  sliceFn("pointOnPitPath"),
  sliceFn("pitPathAhead"),
  sliceFn("buildCampusPitPath"),
  sliceFn("buildCustomPitPath"),
  sliceFn("rebuildPitPath"),
  sliceFn("onPitPavement"),
  sliceFn("closestOnSeg"),
  sliceFn("carCorners"),
  sliceFn("projectCorners"),
  sliceFn("meshOverlap"),
  sliceFn("closestOnArc"),
  sliceFn("addLine"),
  sliceFn("addArc"),
  sliceFn("pathLine"),
  sliceFn("pathArc"),
  sliceFn("pathSnap"),
  sliceFn("resetPathCursor"),
  sliceFn("parkPitMouths"),
  sliceFn("setDefaultPit"),
  sliceFn("clearPit"),
  sliceFn("placePitHere"),
  sliceFn("turnWrap"),
  sliceFn("joinPlan"),
  sliceFn("emitJoin"),
  src.match(/var JOIN_APART = [0-9.]+;/)[0],
  sliceFn("joinClearance"),
  sliceFn("autoClosePath"),
  sliceFn("cornerKind"),
  sliceFn("builtinSpec"),
  sliceFn("isBuiltinCode"),
  sliceFn("setTrackKerbs"),
  sliceFn("buildCampusPath"),
  sliceFn("flattenCloseToZero"),
  sliceFn("goTo"),
  sliceFn("closeWithSweeper"),
  sliceFn("buildHarborPath"),
  sliceFn("buildParkPath"),
  sliceFn("buildDesertPath"),
  sliceFn("buildForestPath"),
  sliceFn("buildCodePath"),
  sliceFromTo("var MAP_SURF = [];", "rebuildPath"),
  sliceFn("rebuildPath"),
  sliceFn("projectOn"),
  sliceFn("raceDeltaS"),
  sliceFn("trackInfoAt"),
  src.match(/var HINT_SLACK = [0-9.]+;/)[0],
  sliceFn("projectTrackNear"),
  sliceFn("projectTrack"),
  sliceFn("inPitBox"),
  sliceFn("dressClear"),
  sliceFn("faceRaceAt"),
  sliceFn("rideHeight"),
  sliceFn("steerWheelYaw"),
  sliceFn("kerbDepthAt"),
  sliceFn("sampleWheelKerbs"),
  sliceFn("wheelWorld"),
  sliceFn("hitCarFeel"),
  sliceFn("applyMotion"),
  sliceFn("isDriveableLoop"),
  src.match(/var LAP_ORIGIN = \{[^}]*\};/)[0],
  sliceFn("lapOriginS"),
  sliceFn("scoreLap"),
  sliceFn("updateLaps"),
  sliceFn("pitRoadDist"),
  sliceFn("raceRoadDist"),
  sliceFn("pitClaims"),
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
  sliceFn("gridSlot"),
  sliceFn("slotHeading"),
  sliceFn("customGridPose"),
  sliceFn("pointOnSeg"),
  sliceFn("centerlinePoint"),
  sliceFn("onLongStraight"),
  sliceFn("pathSegAt"),
  sliceFn("inChicaneS"),
  sliceFn("wallSeg"),
  sliceFn("skipLeftBarrier"),
  sliceFn("wallKindFor"),
  src.match(/var DECK_APART = [0-9.]+;/)[0],
  sliceFn("carDeckY"),
  sliceFn("sameDeck"),
  sliceFn("wallCutsRibbon"),
  sliceFn("joinColinearWall"),
  sliceFn("mergeColinearWalls"),
  sliceFn("placeWalls"),
  "function puffHit() {}",
  "function poseCar(r) { if (r.mesh && r.mesh.position) r.mesh.position.set(r.x, 0, r.z); }",
  "var gridHeading = 1.57;",
  sliceFn("pinGrid"),
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
  "  footprintBox: footprintBox,",
  "  pointOnSeg: pointOnSeg,",
  "  footprintsOverlap: footprintsOverlap,",
  "  ribbonFitsFootprint: ribbonFitsFootprint,",
  "  ribbonsStack: ribbonsStack,",
  "  chicanePts: chicanePts,",
  "  projectTrack: projectTrack,",
  "  applyMotion: applyMotion,",
  "  updateLaps: updateLaps,",
  "  inPitGrab: inPitGrab,",
  "  inPitLane: inPitLane,",
  "  pitClaims: pitClaims,",
  "  cleanTrack: cleanTrack,",
  "  cellsInBoard: cellsInBoard,",
  "  customGridPose: customGridPose,",
  "  centerlinePoint: centerlinePoint,",
  "  pathLine: pathLine,",
  "  pathArc: pathArc,",
  "  autoClosePath: autoClosePath,",
  "  resetPathCursor: function () { PATH.length = 0; TRACK_LEN = 0; _x = -200; _z = SF_Z; _h = 0; _y = 0; },",
  "  sealCustom: function () { MAP_CLOSED = true; MAP_SURF = PATH.slice(); setTrackKerbs('campus'); },",
  "  clearPit: function () { PIT_META.on = false; PIT_PATH.length = 0; },",
  "  slotOnPath: slotOnPath,",
  "  gridSlot: gridSlot,",
  "  slotHeading: slotHeading,",
  "  onPitPavement: onPitPavement,",
  "  placeWalls: placeWalls,",
  "  bashAllWalls: bashAllWalls,",
  "  bashWall: bashWall,",
  "  bashCars: bashCars,",
  "  faceRaceAt: faceRaceAt,",
  "  pinGrid: pinGrid,",
  "  setWalls: function (w) { WALLS.length = 0; var i; for (i = 0; i < w.length; i++) WALLS.push(w[i]); },",
  "  speedKph: speedKph,",
  "  menuTrackName: menuTrackName,",
  "  isCustomCircuit: isCustomCircuit,",
  "  isDriveableLoop: isDriveableLoop,",
  "  lockRacePath: lockRacePath,",
  "  rideHeight: rideHeight,",
  "  dressClear: dressClear,",
  "  inPitBox: inPitBox,",
  "  steerWheelYaw: steerWheelYaw,",
  "  hitCarFeel: hitCarFeel,",
  "  MAP_DXY: MAP_DXY,",
  "  MAP_CELL: MAP_CELL,",
  "  get TRACK_LEN() { return TRACK_LEN; },",
  "  get MAP_SURF() { return MAP_SURF; },",
  "  get MAP_CLOSED() { return MAP_CLOSED; },",
  "  get PATH() { return PATH; },",
  "  get WALLS() { return WALLS; },",
  "  get PIT_META() { return PIT_META; },",
  "  get PIT_PAVE() { return PIT_PAVE; },",
  "  get PIT_PATH() { return PIT_PATH; },",
  "  get PIT_LANE() { return PIT_LANE; },",
  "  get PIT_GRAB() { return PIT_GRAB; },",
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
      rotation: {
        set: function (x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
        },
        x: 0,
        y: 0,
        z: 0,
      },
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
assert(Math.abs(sim.TRACK_LEN - 1997.74) < 2, "open/junk bounces the 3D world to Campus Loop");
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
var earlyIn = 0;
var earlyOut = 0;
var pe;
for (pe = 0; pe < sim.PIT_PATH.length; pe++) {
  if (sim.PIT_PATH[pe].name === "pitin" && sim.PIT_PATH[pe].type === "arc") earlyIn += 1;
  if (sim.PIT_PATH[pe].name === "pitout" && sim.PIT_PATH[pe].type === "arc") earlyOut += 1;
}
assert(earlyIn >= 2 && earlyOut >= 2, "P piece has a track curving in and out");

var trees = [];
var tx;
var ty;
for (ty = 0; ty < 12; ty++) {
  for (tx = 0; tx < 16; tx++) trees.push({ t: "t", x: tx, y: ty, r: 0 });
}
var packed = sim.encodeMap(trees);
assert(packed.length > 120 && packed.length <= 800, "full 16x12 board share-string fits 800, got " + packed.length);
assert(sim.cleanTrack(packed) === packed, "cleanTrack keeps a full-board code");
assert(sim.parseMap(packed).length === 192, "reload/parse keeps every tree");
var farCode = sim.encodeMap([{ t: "F", x: 14, y: 10, r: 1 }]);
var farBack = sim.parseMap(farCode);
assert(farBack.length === 1 && farBack[0].x === 14 && farBack[0].y === 10 && farBack[0].r === 1, "far 16x12 cell survives share-string");
assert(/[a-z]/i.test(farCode.slice(2, 4)), "cells past 9 encode as letters");
var oldEight = sim.parseMap("MF210");
assert(oldEight.length === 1 && oldEight[0].t === "F" && oldEight[0].x === 2 && oldEight[0].y === 1, "old 8x6 digit share-string still parses");
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
    assert(Math.abs(sim.TRACK_LEN - 1997.74) < 2, label + " bounces to Campus Loop, len=" + sim.TRACK_LEN);
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
assert(Math.abs(sim.TRACK_LEN - 1997.74) > 40, "yell 4-piece is not Campus Loop, len=" + sim.TRACK_LEN);
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
assert(Math.hypot(aCar.x - bCar.x, aCar.z - bCar.z) >= 2.0, "bots/player cannot occupy the same space");

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
assert(src.indexOf("function bashOtherCars") !== -1, "room Bowie is bashed from the race tick");
assert(src.indexOf("function meshOverlap") !== -1 && src.indexOf("var MESH_HALF_W = 1.2") !== -1, "hit box is the visible mesh box, not a sausage");
assert(src.indexOf("Speed-weighted inelastic crash") !== -1, "max-speed ram plows through, does not bounce back");
assert(sliceFn("bashCars").indexOf("rel * 0.72") === -1, "car-car is not the old equal-mass bounce");
assert(src.indexOf("var KERB_RAISE = 0.055") !== -1 && src.indexOf("function makeRaisedKerbBand") !== -1, "kerbs are raised steps, not flat ribbons");
assert(src.indexOf("function sampleWheelKerbs") !== -1, "kerb feel samples all four wheels");
assert(sliceFn("applyMotion").indexOf("-bump * 3.4") === -1, "kerb dive does not world-pitch the car");
assert(sliceFn("applyMotion").indexOf("rotation.set(0, -r.heading, 0)") !== -1, "kerb pose is yaw only, not a ramp");
assert(sliceFn("applyMotion").indexOf("Math.pow(0.1, dt) + bumpTarget") === -1, "kerb bump eases, does not slam");
assert(sliceFn("applyMotion").indexOf("Dive wiggles, not a ramp") !== -1, "kerb feel stays a wiggle");

sim.lockRacePath("");
var kerbHit = null;
var knames = ["the90", "hairpin", "chicane", "sweeper", "kink"];
var ks;
for (ks = 0; ks < sim.TRACK_LEN && !kerbHit; ks += 4) {
  var kp = sim.centerlinePoint(ks);
  if (knames.indexOf(kp.name) === -1) continue;
  var knx = -Math.sin(kp.h);
  var knz = Math.cos(kp.h);
  var kinfo = sim.projectTrack(kp.x + knx * 9.0, kp.z + knz * 9.0);
  if (kinfo.kerb) kerbHit = { p: kp, nx: knx, nz: knz };
}
assert(kerbHit, "named-corner kerb is on Campus Loop");
var kPark = blankCar(kerbHit.p.x + kerbHit.nx * 9.0, kerbHit.p.z + kerbHit.nz * 9.0, kerbHit.p.h, 0);
sim.applyMotion(kPark, 0, false, false, false, 1 / 60, true);
assert((kPark.kerbBump || 0) < 0.01, "first frame eases onto the step, does not slam, bump=" + (kPark.kerbBump || 0));
assert(Math.abs(kPark.mesh.rotation.x) < 1e-6 && Math.abs(kPark.mesh.rotation.z) < 1e-6, "parked kerb clip has no pitch/roll bounce");
var kCar = blankCar(kerbHit.p.x + kerbHit.nx * 9.0, kerbHit.p.z + kerbHit.nz * 9.0, kerbHit.p.h, 28);
var kH0 = kCar.heading;
var kI;
for (kI = 0; kI < 20; kI++) sim.applyMotion(kCar, 0, true, false, false, 1 / 60, true);
assert(kCar.speed > 24, "kerb clip keeps pace, does not bounce off, spd=" + kCar.speed.toFixed(2));
assert(Math.abs(kCar.mesh.rotation.x) < 1e-6, "moving kerb clip does not world-pitch, rx=" + kCar.mesh.rotation.x);
assert(Math.abs(kCar.mesh.rotation.z) < 1e-6, "moving kerb clip does not roll-bounce, rz=" + kCar.mesh.rotation.z);
assert((kCar.kerbBump || 0) <= 0.055 + 1e-6, "kerb sit is the step height, not an overshoot hop");
assert(Math.abs(kCar.heading - kH0) < 0.35, "kerb is a wiggle, not a yaw bounce, dh=" + Math.abs(kCar.heading - kH0).toFixed(3));

assert(src.indexOf("var impact = Math.max(rel, 0, pace * 0.34, 2.6)") !== -1, "overlap at a crawl still yaws");
assert(src.indexOf("if (impact < 1.1 && pace < 3)") === -1, "slow side-by-side does not skip feel");
assert(/function pinGrid\([\s\S]{0,400}faceRaceAt/.test(src), "grid pin faces the ribbon, not leftover yaw");
assert(src.indexOf("if (!isDriveableLoop()) return 0;") !== -1, "Campus grid is east, not a pit-peel left yaw");
assert(src.indexOf("pinGrid(player, playerGridX, playerGridZ, gridHeading)") !== -1, "lights pin the stored race heading");
assert(src.indexOf("if (rev > REV_SWEET_HI) return \"DUMP\"") !== -1, "past the mark still grades DUMP");
assert(src.indexOf("if (launchCall === \"DUMP\") launchCall = \"SLUGGISH\"") !== -1, "start DUMP is a SLUGGISH getaway on asphalt");
assert(!/function applyLaunch\([\s\S]{0,500}dumpLaunch/.test(src), "lights-out does not spin onto grass");
assert(!/function applyCpuLaunch\([\s\S]{0,900}dumpLaunch/.test(src), "room Bowie does not dump-spin at GO");
assert(src.indexOf("function slotHeading") !== -1 && src.indexOf("gridHeading = slotHeading(g)") !== -1, "room grid keeps the slot heading");
assert(src.indexOf("function pitClaims") !== -1, "one nearer-road test is shared by lane and grab");
assert(src.indexOf("return rd > ASPHALT && pd < rd;") !== -1, "the pit only owns a spot off the asphalt, where it is the nearer road");
assert(/function inPitLane\([\s\S]{0,120}return pitClaims/.test(src), "PIT LANE is the pit ribbon, not an axis-aligned box");
assert(/function inPitGrab\([\s\S]{0,120}if \(!pitClaims/.test(src), "the grab box is on the pit ribbon too");
assert(src.indexOf("var inBox = inPitGrab(player)") !== -1, "PIT LANE banner is the halfway box, not the peel mouth");
assert(src.indexOf("inBox = inPitLane(player) || inPitGrab(player)") === -1, "peel mouth does not paint PIT LANE");
assert(src.indexOf("z0: -74.0") === -1, "campus pit pave is not painted on the racing line");
assert(src.indexOf("z0: -71.6") === -1, "campus pit pave does not clip the asphalt edge");
assert(src.indexOf("z0: -69.0") === -1, "campus pit is not a same-color strip beside the ribbon");
assert(src.indexOf("function paintCampusPitLane") !== -1, "campus paints a visible left pit lane");
assert(src.indexOf("function paintPitRibbon") !== -1, "pit path paints as a real asphalt ribbon");
assert(src.indexOf("function fillPitGore") !== -1, "asphalt gore fills the fork so the peel is a clean Y");
assert(src.indexOf("function buildCampusPitPath") !== -1 && src.indexOf("pitSBend") !== -1, "pit entry and exit are S-bends, not a slab");
assert(src.indexOf("Actual track curves IN") !== -1, "pit has a track curving in and out");
assert(src.indexOf("FORK. TWO ROADS.") !== -1, "pit is a fork of two roads, not a slide");
assert(src.indexOf("Grass median") !== -1, "grass median sits between ribbon and pit lane");
assert(src.indexOf('pathLine(680, "start")') !== -1, "start road is long enough for W-only stay-right past 10s");
assert(src.indexOf("The racing ribbon stays whole") !== -1, "second road is added beside the ribbon, not a hole");
assert(src.indexOf("z0: -61.5") !== -1, "second asphalt road starts past the grass median");
assert(src.indexOf("function stampPitBand") !== -1 && src.indexOf("stampPitBand(PIT_HALF, 0.09, 0.08, asphaltMat, endS)") !== -1, "pit lane is the same asphalt as the race track, just smaller");
assert(src.indexOf("if (pd > PIT_HALF) return false") !== -1, "grab requires the visible left lane, not the median");
assert(src.indexOf("inRect(wx, wz, PIT_ENTRY) || inRect(wx, wz, PIT_EXIT)") !== -1, "left wall opens only at IN/OUT mouths");
assert(src.indexOf("player.heading = slotHeading({ h: gridHeading })") !== -1, "campus GO snaps heading east");
assert(src.indexOf("return t >= 0.42 && t <= 0.98") !== -1, "pit grab is the middle of the lane, not the mouths");
assert(src.indexOf("var onRace = ribbon && ribbon.dist <= ASPHALT") !== -1, "full racing ribbon is on-race");
assert(src.indexOf("r.z > leftOfRace && r.z < PIT_LANE.z1 + 4") === -1, "pit grab does not eat toward the racing line");
assert(src.indexOf("launchT = GETAWAY_T") !== -1 && src.indexOf("var GETAWAY_T = 1.5") !== -1, "SLUGGISH is a 1.5s getaway, not a grass limp");
assert(src.indexOf("mpMode && playerGridX != null") !== -1, "room grid keeps the slot, not Campus P2");
assert(src.indexOf("z: SF_Z + (i % 2 ? GRID_OUT_B : GRID_OUT_A), h: 0") !== -1, "campus room grid is outside the pit peel");
assert(src.indexOf("x: -6 - Math.floor(i / 2) * 8") !== -1, "campus grid is 2-wide so Add Bowie parks beside the host");
assert(src.indexOf("x: -6 - i * 8") === -1, "campus no longer stacks cars single-file behind the chase cam");
assert(src.indexOf("var gxs = [-6, -6, -14, -14, -22, -22, -30, -30]") !== -1, "painted boxes match the 2-wide 8-car grid");
assert(src.indexOf("for (var gb = 0; gb < 8; gb++)") !== -1, "all eight grid boxes are painted");
assert(src.indexOf("function roomBotLook") !== -1 && src.indexOf('p.name === "BowieKnife99"') !== -1, "room Bowie is gold #12, not a skin-slot ghost");
assert(src.indexOf("hostBots[p.id].mesh.visible = true") !== -1, "Add Bowie parks a visible mesh");
assert(src.indexOf("var GRID_OUT_A = -2.4") !== -1 && src.indexOf("var GRID_OUT_B = -5.2") !== -1, "campus slots sit on the outside ribbon");
assert(src.indexOf("function steerWheelYaw") !== -1 && src.indexOf("return -steer * 0.42") !== -1, "A = POINT LEFT, D = POINT RIGHT");
assert(src.indexOf("function attachNameTag") !== -1 && src.indexOf("function layoutNameTags") !== -1, "halo nametags exist");
assert(!/function attachNameTag\([\s\S]{0,500}new THREE\.Sprite/.test(src), "nametags are mesh billboards");
assert(src.indexOf('r.kind !== "player"') !== -1, "own tag stays off; other cars still show");
assert(src.indexOf('createRacer("cpu", 0xd4a017, "BowieKnife99"') !== -1, "one bot is exactly BowieKnife99");
assert(src.indexOf('createRacer("cpu", 0x3d8cff, "Library Kid"') !== -1, "Library Kid is on the solo grid");
assert(src.indexOf('createRacer("cpu", 0x9b59b6, "Band Kid"') !== -1, "Band Kid is on the solo grid");
assert(src.indexOf('createRacer("cpu", 0x2ecc71, "Lab Partner"') !== -1, "Lab Partner is on the solo grid");
assert(src.indexOf('createRacer("cpu", 0xe67e22, "Detention"') !== -1, "Detention is on the solo grid");
assert(src.indexOf('createRacer("cpu", 0x1abc9c, "Yearbook"') !== -1, "Yearbook is on the solo grid");
assert((src.match(/createRacer\("cpu", 0x[0-9a-f]+, "/g) || []).length === 7, "solo races field seven CPUs");
assert(src.indexOf("slot: 3,") === -1, "no CPU sits in the player's GRID_P2 slot");
assert(src.indexOf("rideHeight(r.x, r.z, r) + 1.46") !== -1, "tags sit tiny over the halo, on the car's own deck");
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
  assert(Math.hypot(botA.x - botB.x, botA.z - botB.z) >= 1.95, label + " bots do not occupy the player");
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
assert(src.indexOf("function tileArt") !== -1, "editor still paints chips");
assert(src.indexOf("function tileIconPts") !== -1 && src.indexOf("function tileIconSvg") !== -1, "90/sweeper/hairpin/chicane are in-square SVG silhouettes");
var artSrc = src.slice(src.indexOf("function tileIconPts"), src.indexOf("function paintTrackEditor"));
assert(artSrc.indexOf("pieceSegs(") === -1, "chips are not clipped world-ribbon");
assert(artSrc.indexOf("createElement(\"canvas\")") === -1, "chips are SVG in the tile, not a canvas data-URL");
assert(artSrc.indexOf("tileIconSvg") !== -1, "palette injects SVG into the square");
assert(src.indexOf("function editorBoardBox") !== -1 && src.indexOf("function layoutTrackEditor") !== -1, "editor sizes the 16x12 board to the leftover screen");
var editorFit = new Function(
  "clamp",
  "MAP_W",
  "MAP_H",
  sliceFn("editorTilePx") + ";" + sliceFn("editorBoardBox") + "; return { tile: editorTilePx, box: editorBoardBox };"
)(
  function (v, a, b) {
    return Math.max(a, Math.min(b, v));
  },
  16,
  12
);
var wideBox = editorFit.box(400, 900);
assert(wideBox.cell === 25 && wideBox.w === 400 && wideBox.h === 300, "width-limited board is 16 square cells by 12");
var shortBox = editorFit.box(900, 240);
assert(shortBox.cell === 20 && shortBox.w === 320 && shortBox.h === 240, "height-limited board shrinks width so cells stay square");
assert(shortBox.w / 16 === shortBox.h / 12, "short screens do not squash tiles into rectangles");
assert(editorFit.tile(1280, 800) === 72, "desktop palette chips stay 72px squares");
assert(editorFit.tile(360, 640) >= 40, "phone palette chips stay wide enough for names");
assert(editorFit.tile(667, 375) >= 28 && editorFit.tile(667, 375) <= 36, "landscape phone palette tiles scale down as squares");

sim.lockRacePath("");
assert(src.indexOf("function viewBox") !== -1 && src.indexOf("visualViewport") !== -1, "canvas follows the painted viewport");
assert(src.indexOf("Math.abs(gamma) > 40") === -1, "tilt does not swap beta/gamma mid-roll");
assert(src.indexOf("var TILT_DEAD = 4") !== -1, "tilt deadzone is 4deg not 18");
assert(src.indexOf("var dead = 18") === -1, "fat tilt deadzone is gone");
assert(src.indexOf("gyroCenter += d * 0.08") === -1, "rest pose does not chase a slow lean");
assert(src.indexOf("var TILT_LEVEL = 2.5") !== -1 && src.indexOf("var TILT_CAL_MAX = 8") !== -1, "level phone is straight; big leans are not the rest");
assert(src.indexOf("window.screen.orientation") !== -1, "orientation reads window.screen not a bare global");

function proveViewBox() {
  var fn = new Function("window", sliceFn("viewBox") + "; return viewBox();");
  var box = fn({
    innerWidth: 800,
    innerHeight: 600,
    visualViewport: { width: 720, height: 390, offsetLeft: 12, offsetTop: 44 },
  });
  assert(box.w === 720 && box.h === 390 && box.x === 12 && box.y === 44, "viewBox uses visualViewport including offset");
  box = fn({ innerWidth: 844, innerHeight: 390 });
  assert(box.w === 844 && box.h === 390 && box.x === 0 && box.y === 0, "viewBox falls back to inner size");
}
proveViewBox();

function proveTiltFeel() {
  var fn = new Function(
    "window",
    "touchCtl",
    "var TILT_DEAD = 4; var TILT_SPAN = 18; var TILT_LEVEL = 2.5; var TILT_CAL_MAX = 8;" +
      sliceFn("clamp") +
      sliceFn("isLandscape") +
      sliceFn("screenAngle") +
      sliceFn("tiltNum") +
      sliceFn("tiltSide") +
      sliceFn("tiltRaw") +
      sliceFn("applyGyro") +
      "; return { tiltRaw: tiltRaw, applyGyro: applyGyro };"
  );
  function pack(ang, w, h, ctl) {
    return fn(
      {
        innerWidth: w,
        innerHeight: h,
        orientation: ang,
        screen: { orientation: { angle: ang } },
      },
      ctl
    );
  }
  var ctl = { gyroNeedCal: true, gyroCenter: 0, gyroFilt: 0, steer: 0, tiltSide: 0 };
  var api = pack(90, 844, 390, ctl);
  assert(api.tiltRaw({ beta: 12, gamma: 8 }) === 12, "landscape 90 roll is beta");
  ctl = { gyroNeedCal: true, gyroCenter: 0, gyroFilt: 0, steer: 0, tiltSide: 0 };
  api = pack(270, 844, 390, ctl);
  assert(api.tiltRaw({ beta: 12, gamma: 8 }) === -12, "landscape 270 inverts beta");
  ctl = { gyroNeedCal: true, gyroCenter: 0, gyroFilt: 0, steer: 0, tiltSide: 0 };
  api = pack(0, 844, 390, ctl);
  var low = api.tiltRaw({ beta: 10, gamma: 10 });
  var high = api.tiltRaw({ beta: 10, gamma: 50 });
  assert(low === high, "stale angle 0 does not swap axes when gamma crosses 40, low=" + low + " high=" + high);
  assert(low === 10, "landscape with stale 0 uses signed beta, got " + low);

  ctl = { gyroNeedCal: true, gyroCenter: 0, gyroFilt: 0, steer: 0, tiltSide: 0, tiltAng: null };
  api = pack(90, 844, 390, ctl);
  api.applyGyro(4);
  assert(ctl.steer === 0 && ctl.gyroNeedCal === false && ctl.gyroCenter === 4, "first sample is the held center");
  var i;
  for (i = 0; i < 10; i++) api.applyGyro(6);
  assert(Math.abs(ctl.steer) < 0.04, "inside the small deadzone stays straight, steer=" + ctl.steer);
  ctl.gyroNeedCal = true;
  api.applyGyro(0);
  for (i = 0; i < 14; i++) api.applyGyro(12);
  assert(Math.abs(ctl.steer) > 0.35, "a modest 12deg lean now steers, steer=" + ctl.steer);
  ctl.gyroNeedCal = true;
  api.applyGyro(0);
  for (i = 0; i < 14; i++) api.applyGyro(18);
  assert(Math.abs(ctl.steer) > 0.7, "18deg is near full lock, steer=" + ctl.steer);
  ctl.gyroNeedCal = true;
  api.applyGyro(0);
  for (i = 0; i < 14; i++) api.applyGyro(3);
  assert(Math.abs(ctl.steer) < 0.04, "tiny 3deg wobble does not twitch the wheel");

  ctl = { gyroNeedCal: true, gyroCenter: 0, gyroFilt: 0, steer: 0, tiltSide: 0, tiltAng: 90 };
  api = pack(90, 844, 390, ctl);
  api.applyGyro(0);
  var deg;
  for (deg = 0; deg <= 16; deg += 0.25) {
    for (i = 0; i < 5; i++) api.applyGyro(deg);
  }
  assert(ctl.steer < -0.35, "a slow right lean still turns right, steer=" + ctl.steer);
  assert(Math.abs(ctl.gyroCenter) <= 2.5, "center does not crawl onto the lean, center=" + ctl.gyroCenter);
  for (i = 0; i < 8; i++) api.applyGyro(0);
  assert(Math.abs(ctl.steer) < 0.04, "back to level is straight, not the opposite turn, steer=" + ctl.steer);

  ctl = { gyroNeedCal: true, gyroCenter: 0, gyroFilt: 0, steer: 0, tiltSide: 0, tiltAng: 90 };
  api = pack(90, 844, 390, ctl);
  api.applyGyro(16);
  assert(ctl.gyroCenter === 0 && ctl.gyroNeedCal === false, "a big first lean is not the rest pose");
  for (i = 0; i < 10; i++) api.applyGyro(16);
  assert(ctl.steer < -0.5, "first-sample lean still steers, steer=" + ctl.steer);

  ctl = { gyroNeedCal: false, gyroCenter: 0, gyroFilt: 0, steer: 0, tiltSide: 0, tiltAng: 0 };
  api = pack(0, 844, 390, ctl);
  api.tiltRaw({ beta: 10, gamma: 10 });
  api.tiltRaw({ beta: 10, gamma: -10 });
  assert(ctl.gyroNeedCal === false, "gamma sign change does not recapture rest");
  api = pack(270, 844, 390, ctl);
  api.tiltRaw({ beta: 10, gamma: -10 });
  assert(ctl.gyroNeedCal === true, "a real screen-angle change does recapture");
}
proveTiltFeel();

assert(src.indexOf("var MAX_SPEED = 200") !== -1, "cars wind out to 200");
assert(src.indexOf("var ACCEL = 5") !== -1, "wind-up is slow (arcade, not a snap)");
assert(src.indexOf("var COAST = 2") !== -1, "coast bleeds speed");
assert(src.indexOf("var BRAKE_DECEL = 6") !== -1, "Space is a planned squeeze");
assert(src.indexOf("var MAX_LAT = 28") !== -1, "custom 90s are not glued to hide a spin");
assert(src.indexOf("function inChicaneS") !== -1, "chicane S is the S, not the approach slab");
assert(src.indexOf('info.name === "hairpin" || info.name === "chicane"') === -1, "name alone does not lock A/D on hairpin/chicane");
assert(src.indexOf('pathArc(12, 88, "the90")') !== -1, "Loop 88 before the S is a 90, not a named chicane");
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

function firstNamedS(name, maxR) {
  var s;
  for (s = 0; s < sim.TRACK_LEN; s += 4) {
    var pt = sim.centerlinePoint(s);
    if (pt.name !== name) continue;
    if (maxR != null && !(pt.r > 0 && pt.r < maxR)) continue;
    return s;
  }
  return 0;
}

function holdWOn(name, spd, seconds, maxR) {
  var p = sim.centerlinePoint(firstNamedS(name, maxR) + 6);
  var car = blankCar(p.x, p.z, p.h, spd);
  var t;
  var peak = 0;
  for (t = 0; t < seconds; t += 1 / 60) {
    var line = sim.projectTrack(car.x, car.z);
    var look = sim.centerlinePoint(line.s + 12);
    var err = angDiff(look.h, car.heading);
    var steer = err * 1.8;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    sim.applyMotion(car, steer, true, false, false, 1 / 60, true);
    if (Math.abs(car.slide) > peak) peak = Math.abs(car.slide);
  }
  car.peakSlide = peak;
  return car;
}

var hpDump = holdWOn("hairpin", 40, 0.5);
assert(hpDump.peakSlide > 2.4, "hold W through the 180 dumps, slide=" + hpDump.peakSlide.toFixed(2));
var chiFast = holdWOn("chicane", 40, 0.5, 11);
assert(chiFast.peakSlide < 2.2, "hold W through the S does not inject a dump, slide=" + chiFast.peakSlide.toFixed(2));
var sweepCar = holdWOn("sweeper", 40, 0.7);
assert(sweepCar.peakSlide < 2.2, "sweeper carries on fresh tires, slide=" + sweepCar.peakSlide.toFixed(2));
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
for (crawlT = 0; crawlT < 22; crawlT += 1 / 60) {
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

function pace90(car, line) {
  var d;
  var upcoming = line.name === "the90" || line.name === "hairpin";
  for (d = 8; d <= 80 && !upcoming; d += 8) {
    var n = sim.centerlinePoint(line.s + d).name;
    if (n === "the90" || n === "hairpin") upcoming = true;
  }
  var gas = line.dist < 6.2;
  var brake = false;
  if (upcoming && car.speed > 24) {
    gas = false;
    brake = true;
  } else if ((line.name === "the90" || line.name === "hairpin") && car.speed > 20) {
    gas = false;
  }
  return { gas: gas, brake: brake };
}

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
  var travelled = 0;
  var lastS = sim.projectTrack(car.x, car.z).s;
  var seconds = Math.max(24, sim.TRACK_LEN / 14);
  for (t = 0; t < seconds; t += 1 / 60) {
    var raceLine = sim.projectTrack(car.x, car.z);
    var raceLook = sim.centerlinePoint(raceLine.s + 14);
    var raceErr = angDiff(raceLook.h, car.heading);
    if (raceLine.dist > 2) {
      var home = Math.atan2(raceLine.z - car.z, raceLine.x - car.x);
      raceErr = angDiff(home, car.heading);
    }
    var raceSteer = raceErr * 1.65;
    if (raceSteer > 1) raceSteer = 1;
    if (raceSteer < -1) raceSteer = -1;
    var pace = pace90(car, raceLine);
    sim.applyMotion(car, raceSteer, pace.gas, pace.brake, false, 1 / 60, true);
    sim.bashAllWalls(car);
    var nowS = sim.projectTrack(car.x, car.z).s;
    var ds = nowS - lastS;
    if (ds < -sim.TRACK_LEN * 0.5) ds += sim.TRACK_LEN;
    if (ds > 0 && ds < 22) travelled += ds;
    lastS = nowS;
  }
  assert(
    travelled > sim.TRACK_LEN * 0.85,
    label + " Space into 90s can lap, went=" + travelled.toFixed(0) + "/" + sim.TRACK_LEN.toFixed(0)
  );
  assert(sim.projectTrack(car.x, car.z).onAsphalt || car.speed > 16, label + " is still a race, not a freeze");
}

proveGoHoldW(yell, "4-piece MR220R321R332R233");

function copyCar(c) {
  var o = blankCar(c.x, c.z, c.heading, c.speed);
  o.slide = c.slide || 0;
  o.hitYawT = c.hitYawT || 0;
  o.fuel = 100;
  o.tires = 100;
  return o;
}

function proveFour90sSteer(code) {
  assert(sim.cleanTrack(code) === code, "paste share-string stays a clean M-code");
  assert(sim.lockRacePath(code), "Solo loads the pasted 4-piece");
  assert(sim.isDriveableLoop() && sim.menuTrackName() === "CUSTOM CIRCUIT", "pasted board races as CUSTOM");
  sim.placeWalls();
  var pose = sim.customGridPose();
  var car = blankCar(pose.x, pose.z, pose.h, 0);
  car.fuel = 100;
  car.tires = 100;
  var t;
  for (t = 0; t < 1.6; t += 1 / 60) {
    var line0 = sim.projectTrack(car.x, car.z);
    var err0 = angDiff(sim.centerlinePoint(line0.s + 12).h, car.heading);
    var st0 = err0 * 1.6;
    if (st0 > 1) st0 = 1;
    if (st0 < -1) st0 = -1;
    sim.applyMotion(car, st0, true, false, false, 1 / 60, true);
    sim.bashAllWalls(car);
  }
  assert(car.speed > 10, "after GO hold W the car rolls, speed=" + car.speed.toFixed(1));
  var corners = {};
  var liveA = 0;
  var liveD = 0;
  var spin = 0;
  var lock = 0;
  var hadPace = false;
  var travelled = 0;
  var lastS = sim.projectTrack(car.x, car.z).s;
  for (t = 0; t < 36; t += 1 / 60) {
    var line = sim.projectTrack(car.x, car.z);
    var look = sim.centerlinePoint(line.s + 14);
    var err = angDiff(look.h, car.heading);
    if (line.dist > 2) {
      var home = Math.atan2(line.z - car.z, line.x - car.x);
      err = angDiff(home, car.heading);
    }
    var steer = err * 1.7;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    if (line.name === "the90") corners[Math.floor((line.s / (sim.TRACK_LEN + 0.001)) * 4)] = 1;
    if (line.name === "the90" && car.speed > 8 && (liveA < 6 || liveD < 6)) {
      var probeA = copyCar(car);
      var hA = probeA.heading;
      sim.applyMotion(probeA, 1, true, false, false, 1 / 60, true);
      sim.bashAllWalls(probeA);
      if (Math.abs(angDiff(probeA.heading, hA)) > 0.008) liveA += 1;
      var probeD = copyCar(car);
      var hD = probeD.heading;
      sim.applyMotion(probeD, -1, true, false, false, 1 / 60, true);
      sim.bashAllWalls(probeD);
      if (Math.abs(angDiff(probeD.heading, hD)) > 0.008) liveD += 1;
    }
    var h0 = car.heading;
    var pace = pace90(car, line);
    sim.applyMotion(car, steer, pace.gas, pace.brake, false, 1 / 60, true);
    sim.bashAllWalls(car);
    if (Math.abs(angDiff(car.heading, h0)) > 0.22) spin += 1;
    if (car.speed > 12) hadPace = true;
    if (hadPace && car.speed < 4 && !line.grass) lock += 1;
    var nowS = sim.projectTrack(car.x, car.z).s;
    var ds = nowS - lastS;
    if (ds < -sim.TRACK_LEN * 0.5) ds += sim.TRACK_LEN;
    if (ds > 0 && ds < 18) travelled += ds;
    lastS = nowS;
  }
  assert(travelled > sim.TRACK_LEN * 0.85, "Space into 90s covers the four 90s, went=" + travelled.toFixed(0));
  assert(Object.keys(corners).length >= 4, "all four 90s were taken, corners=" + Object.keys(corners).join(","));
  assert(liveA >= 4 && liveD >= 4, "A/D stay live through the 90s, A=" + liveA + " D=" + liveD);
  assert(spin < 5, "no half-spin / yaw freeze at the 90s, spin=" + spin);
  assert(lock === 0, "no 0-steer lock, lockFrames=" + lock);
}

proveFour90sSteer(yell);
assert(src.indexOf("along < 0.42") !== -1, "90 chord graze is a slide, not a square yaw lock");
assert(src.indexOf("return -steer * 0.42") !== -1, "A = fronts left, D = fronts right");
assert(src.indexOf("maxYaw *= 1 / (1 + over * 5)") === -1, "chicane dump does not kill A/D yaw");
assert(src.indexOf('pathLine(150, "chicane")') === -1, "Loop approach slab is not named chicane");
assert(src.indexOf('pathLine(150, "short")') !== -1, "Loop approach slab steers like a straight");
assert(src.indexOf("function inChicaneS") !== -1 && src.indexOf("seg.len > 40") !== -1, "S identity does not cover a long approach slab");
assert(src.indexOf("yawFromSpeed") !== -1, "A/D yaw comes from speed, not a tank spin");
assert(src.indexOf("var wash = 1 - 0.7 * speed01") !== -1, "max W washes yaw out so 90s need Space");
assert(src.indexOf("clamp(roll / 14, 0.42, 1)") === -1, "yaw no longer saturates at crawl pace");
assert(src.indexOf("function hitCarFeel") !== -1, "car-car: tap wiggles, ram spins, front shoves");

assert(src.indexOf("inChicaneS(info) && r.speed") === -1, "S never speed-dumps or steer-locks");
assert(src.indexOf("chiOver") === -1, "no named chicane overspeed slide");
var hpDumpAt = src.indexOf("if (!info.grass && (info.name === \"hairpin\"");
assert(hpDumpAt !== -1, "180 still dumps if you hold W");
var dumpBlk = src.slice(hpDumpAt, src.indexOf("if (latDemand > maxLat", hpDumpAt));
assert(dumpBlk.indexOf("maxYaw") === -1, "hairpin dump does not crush yaw");
assert(dumpBlk.indexOf('info.name === "chicane"') === -1, "hairpin dump does not also lock the S");

function steerLiveBoth(car, label) {
  var a = copyCar(car);
  var hA = a.heading;
  sim.applyMotion(a, 1, true, false, false, 1 / 60, true);
  sim.bashAllWalls(a);
  var dA = Math.abs(angDiff(a.heading, hA));
  var d = copyCar(car);
  var hD = d.heading;
  sim.applyMotion(d, -1, true, false, false, 1 / 60, true);
  sim.bashAllWalls(d);
  var dD = Math.abs(angDiff(d.heading, hD));
  assert(dA > 0.008 && dD > 0.008, label + " A/D live, dA=" + dA.toFixed(4) + " dD=" + dD.toFixed(4));
  return dA;
}

function yawProbe(car, steer) {
  var c = copyCar(car);
  var h = c.heading;
  sim.applyMotion(c, steer, true, false, false, 1 / 60, true);
  return Math.abs(angDiff(c.heading, h));
}

function chicaneApproachSeg() {
  var segs = sim.PATH;
  var i;
  var best = null;
  for (i = 0; i < segs.length; i++) {
    if (segs[i].type !== "line" || segs[i].len < 80) continue;
    var prev = segs[i - 1];
    var next = segs[i + 1];
    if ((prev && prev.name === "chicane") || (next && next.name === "chicane")) {
      if (!best || segs[i].len > best.len) best = segs[i];
    }
  }
  return best;
}

function firstTightChicane() {
  var s;
  var found = -1;
  for (s = 0; s < sim.TRACK_LEN; s += 2) {
    var pt = sim.centerlinePoint(s);
    if (pt.name !== "chicane") continue;
    if (found < 0) found = s;
    if (pt.r && pt.r < 11) return s;
  }
  return found;
}

function driveChicaneS(label) {
  var cs = firstTightChicane();
  assert(cs >= 0 && sim.centerlinePoint(cs).name === "chicane", label + " has the S");
  var p = sim.centerlinePoint(cs + 2);
  var start = sim.centerlinePoint(24);
  var speeds = [12, 24, 40];
  var si;
  for (si = 0; si < speeds.length; si++) {
    var spd = speeds[si];
    var onS = blankCar(p.x, p.z, p.h, spd);
    onS.fuel = 100;
    onS.tires = 100;
    var onStr = blankCar(start.x, start.z, start.h, spd);
    onStr.fuel = 100;
    onStr.tires = 100;
    var yS = yawProbe(onS, 1);
    var yStr = yawProbe(onStr, 1);
    assert(yS > 0.008, label + " A/D yaws on the S at " + spd + ", dH=" + yS.toFixed(4));
    assert(
      Math.abs(yS - yStr) < 0.006,
      label + " S steers like a straight at " + spd + ", S=" + yS.toFixed(4) + " str=" + yStr.toFixed(4)
    );
    steerLiveBoth(onS, label + " S at " + spd);
  }
  var coast = blankCar(p.x, p.z, p.h, 40);
  coast.fuel = 100;
  coast.tires = 100;
  var ct;
  for (ct = 0; ct < 0.22; ct += 1 / 60) {
    sim.applyMotion(coast, 0, true, false, false, 1 / 60, true);
  }
  assert(Math.abs(coast.slide) < 1.2, label + " no-steer on the S does not inject a dump, slide=" + coast.slide.toFixed(2));
  var wide = blankCar(p.x, p.z, p.h, 40);
  wide.fuel = 100;
  wide.tires = 100;
  var wt;
  for (wt = 0; wt < 0.28; wt += 1 / 60) {
    sim.applyMotion(wide, 0, true, false, false, 1 / 60, true);
    sim.bashAllWalls(wide);
  }
  steerLiveBoth(wide, label + " A/D still live while missing the S");
  for (wt = 0.28; wt < 0.9; wt += 1 / 60) {
    sim.applyMotion(wide, 0, true, false, false, 1 / 60, true);
    sim.bashAllWalls(wide);
  }
  if (label.indexOf("Campus Loop") !== -1) {
    var wideHit = sim.projectTrack(wide.x, wide.z);
    assert(
      wideHit.dist > 3.2 || wideHit.grass || !wideHit.onAsphalt,
      label + " no-steer at pace runs wide, dist=" + wideHit.dist.toFixed(2)
    );
  }
  var car = blankCar(p.x, p.z, p.h, 40);
  car.fuel = 100;
  car.tires = 100;
  assert(sim.projectTrack(car.x, car.z).name === "chicane", label + " starts on the S");
  steerLiveBoth(car, label + " S entry");
  var t;
  var live = 0;
  var spin = 0;
  var dumped = 0;
  for (t = 0; t < 1.4; t += 1 / 60) {
    var line = sim.projectTrack(car.x, car.z);
    var look = sim.centerlinePoint(line.s + 10);
    var err = angDiff(look.h, car.heading);
    var steer = err * 1.7;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    var h0 = car.heading;
    sim.applyMotion(car, steer, true, false, false, 1 / 60, true);
    sim.bashAllWalls(car);
    if (Math.abs(car.slide) > 2.4) dumped += 1;
    if (Math.abs(angDiff(car.heading, h0)) > 0.22) spin += 1;
    if (line.name === "chicane" && car.speed > 6) {
      var probe = copyCar(car);
      var ph = probe.heading;
      sim.applyMotion(probe, 1, true, false, false, 1 / 60, true);
      sim.bashAllWalls(probe);
      if (Math.abs(angDiff(probe.heading, ph)) > 0.008) live += 1;
    }
  }
  assert(dumped < 64, label + " following the S does not get a dump shoved in, dump=" + dumped);
  steerLiveBoth(car, label + " after the S");
  assert(live >= 8, label + " A/D stays live through the S, live=" + live);
  assert(spin < 6, label + " no half-spin lock in the S, spin=" + spin);
  var timed = blankCar(p.x, p.z, p.h, 16);
  timed.fuel = 100;
  timed.tires = 100;
  var on = 0;
  var n = 0;
  for (t = 0; t < 1.6; t += 1 / 60) {
    line = sim.projectTrack(timed.x, timed.z);
    look = sim.centerlinePoint(line.s + 8);
    err = angDiff(look.h, timed.heading);
    steer = err * 1.8;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    sim.applyMotion(timed, steer, true, false, false, 1 / 60, true);
    sim.bashAllWalls(timed);
    n += 1;
    if (sim.projectTrack(timed.x, timed.z).onAsphalt) on += 1;
  }
  assert(on / n > 0.78, label + " a timed line through the S stays on asphalt, on=" + on + "/" + n);
}

function proveLoopApproach() {
  sim.lockRacePath("");
  sim.placeWalls();
  var slab = chicaneApproachSeg();
  assert(slab, "Loop has a long slab into the chicane S");
  assert(slab.name !== "chicane", "approach slab is not named chicane, name=" + slab.name);
  var mid = sim.centerlinePoint(slab.startS + slab.len * 0.5);
  var onSlab = blankCar(mid.x, mid.z, mid.h, 40);
  onSlab.fuel = 100;
  onSlab.tires = 100;
  assert(sim.projectTrack(onSlab.x, onSlab.z).name !== "chicane", "standing on the approach is not the S");
  var start = sim.centerlinePoint(20);
  var onStart = blankCar(start.x, start.z, start.h, 40);
  onStart.fuel = 100;
  onStart.tires = 100;
  var ySlab = yawProbe(onSlab, 1);
  var yStart = yawProbe(onStart, 1);
  assert(ySlab > 0.008, "approach A/D yaws, dH=" + ySlab.toFixed(4));
  assert(Math.abs(ySlab - yStart) < 0.004, "approach steers like a straight, slab=" + ySlab.toFixed(4) + " start=" + yStart.toFixed(4));
  var hold = copyCar(onSlab);
  var ht;
  for (ht = 0; ht < 0.45; ht += 1 / 60) {
    sim.applyMotion(hold, 0, true, false, false, 1 / 60, true);
  }
  assert(Math.abs(hold.slide) < 1.2, "hold W on the approach does not dump like the S, slide=" + hold.slide.toFixed(2));
  steerLiveBoth(onSlab, "Loop chicane approach");
  var i;
  var entry = null;
  for (i = 0; i < sim.PATH.length; i++) {
    if (sim.PATH[i].type === "arc" && sim.PATH[i].name === "the90" && Math.abs(sim.PATH[i].r - 12) < 0.05) {
      entry = sim.PATH[i];
    }
  }
  assert(entry, "Loop 88 before the S is a 90");
  var ep = sim.centerlinePoint(entry.startS + entry.len * 0.5);
  var onEntry = blankCar(ep.x, ep.z, ep.h, 40);
  onEntry.fuel = 100;
  onEntry.tires = 100;
  assert(sim.projectTrack(onEntry.x, onEntry.z).name !== "chicane", "88 before the S is not the chicane dump");
  steerLiveBoth(onEntry, "Loop 88 before the S");
  var holdE = copyCar(onEntry);
  for (ht = 0; ht < 0.45; ht += 1 / 60) {
    sim.applyMotion(holdE, 0, true, false, false, 1 / 60, true);
  }
  assert(Math.abs(holdE.slide) < 1.2, "hold W on the 88 before the S does not dump, slide=" + holdE.slide.toFixed(2));
}

function proveSpaceThroughS() {
  sim.lockRacePath("");
  sim.placeWalls();
  var cs = firstTightChicane();
  assert(cs > 80, "S is after the approach");
  var p = sim.centerlinePoint(cs - 40);
  var car = blankCar(p.x, p.z, p.h, 32);
  car.fuel = 100;
  car.tires = 100;
  assert(sim.projectTrack(car.x, car.z).name !== "chicane", "Space prove starts on the approach");
  var t;
  var on = 0;
  var n = 0;
  var sawS = 0;
  var dumpOnS = 0;
  for (t = 0; t < 3.2; t += 1 / 60) {
    var line = sim.projectTrack(car.x, car.z);
    var look = sim.centerlinePoint(line.s + 12);
    var lookFar = sim.centerlinePoint(line.s + 36);
    var err = angDiff(look.h, car.heading);
    var steer = err * 1.7;
    if (steer > 1) steer = 1;
    if (steer < -1) steer = -1;
    var inS = line.name === "chicane";
    var upcoming = inS || look.name === "chicane" || lookFar.name === "chicane";
    var brake = upcoming && car.speed > 16;
    sim.applyMotion(car, steer, !brake, brake, false, 1 / 60, true);
    sim.bashAllWalls(car);
    n += 1;
    if (sim.projectTrack(car.x, car.z).onAsphalt) on += 1;
    if (inS) {
      sawS += 1;
      if (Math.abs(car.slide) > 2.4) dumpOnS += 1;
    }
  }
  assert(sawS > 12, "Space prove actually enters the S, frames=" + sawS);
  assert(on / n > 0.72, "Space through the S stays on asphalt, on=" + on + "/" + n);
  assert(dumpOnS < sawS * 0.45, "Space is what gets you through the S, dump=" + dumpOnS + "/" + sawS);
}

function proveChicaneSteer(code, label) {
  if (code) {
    assert(sim.lockRacePath(code), label + " closed board with a chicane must race");
    assert(sim.isDriveableLoop(), label + " is a custom loop");
  } else {
    sim.lockRacePath("");
  }
  sim.placeWalls();
  driveChicaneS(label);
}

function proveSpeedSteer() {
  sim.lockRacePath("");
  var start = sim.centerlinePoint(24);
  var parked = blankCar(start.x, start.z, start.h, 0);
  parked.fuel = 100;
  parked.tires = 100;
  var h0 = parked.heading;
  sim.applyMotion(parked, 1, false, false, false, 1 / 60, true);
  assert(Math.abs(angDiff(parked.heading, h0)) < 0.001, "A/D does nothing at 0 kph");
  var crawl = blankCar(start.x, start.z, start.h, 5);
  crawl.fuel = 100;
  crawl.tires = 100;
  var mid = blankCar(start.x, start.z, start.h, 16);
  mid.fuel = 100;
  mid.tires = 100;
  var top = blankCar(start.x, start.z, start.h, 48);
  top.fuel = 100;
  top.tires = 100;
  var dCrawl = yawProbe(crawl, 1);
  var dMid = yawProbe(mid, 1);
  var dTop = yawProbe(top, 1);
  assert(dCrawl > 0.006, "rolling yaw, dH=" + dCrawl.toFixed(4));
  assert(dMid > dCrawl * 1.12, "bite as you roll, crawl=" + dCrawl.toFixed(4) + " mid=" + dMid.toFixed(4));
  assert(dTop < dMid * 0.62, "max W yaws less than mid, mid=" + dMid.toFixed(4) + " top=" + dTop.toFixed(4));
  var hold = blankCar(start.x, start.z, start.h, 48);
  hold.fuel = 100;
  hold.tires = 100;
  var hHold = hold.heading;
  var tHold;
  for (tHold = 0; tHold < 0.8; tHold += 1 / 60) {
    hold.speed = 48;
    sim.applyMotion(hold, 1, true, false, false, 1 / 60, true);
  }
  var dHold = Math.abs(angDiff(hold.heading, hHold));
  assert(dHold < 0.72, "0.8s of full A at max W is not a snap 90, dH=" + dHold.toFixed(3));
  var parkRev = blankCar(start.x, start.z, start.h, 0);
  parkRev.fuel = 100;
  parkRev.tires = 100;
  var pr;
  for (pr = 0; pr < 0.35; pr += 1 / 60) sim.applyMotion(parkRev, 0, false, false, true, 1 / 60, true);
  assert(parkRev.speed < -1, "S reverse is how a parked car gets moving, speed=" + parkRev.speed.toFixed(2));
  var hR = parkRev.heading;
  sim.applyMotion(parkRev, 1, false, false, true, 1 / 60, true);
  assert(Math.abs(angDiff(parkRev.heading, hR)) > 0.006, "once reversing, A/D bites");
}

function proveUnweld() {
  sim.lockRacePath("");
  var start = sim.centerlinePoint(24);
  var go = blankCar(start.x, start.z, start.h, 0);
  go.fuel = 100;
  go.tires = 100;
  var x0 = go.x;
  var z0 = go.z;
  var t;
  for (t = 0; t < 0.45; t += 1 / 60) sim.applyMotion(go, 0, true, true, false, 1 / 60, true);
  assert(go.speed > 1.2, "stop then W launches even if Space is down, speed=" + go.speed.toFixed(2));
  assert(Math.hypot(go.x - x0, go.z - z0) > 0.25, "W from 0 moves the car");
  var back = blankCar(start.x, start.z, start.h, 0);
  back.fuel = 100;
  back.tires = 100;
  for (t = 0; t < 0.45; t += 1 / 60) sim.applyMotion(back, 0, false, true, true, 1 / 60, true);
  assert(back.speed < -1.2, "stop then S reverses even if Space is down, speed=" + back.speed.toFixed(2));
  var park = blankCar(start.x, start.z, start.h, 0);
  park.fuel = 100;
  park.tires = 100;
  var h0 = park.heading;
  sim.applyMotion(park, 1, false, false, false, 1 / 60, true);
  assert(Math.abs(angDiff(park.heading, h0)) < 0.001, "parked A/D still dead");
  assert(src.indexOf("r.unweld") !== -1, "standstill W/S ignore a stuck brake");
  assert(src.indexOf("spaceBrakeArmed") !== -1, "Space must be released after a stop");
  assert(src.indexOf("fromMove * 0.92") === -1, "speedo matches motion, not a discounted guess");
  assert(src.indexOf("function noteDriveKey") !== -1 && src.indexOf("function motionKph") !== -1, "W/S are captured; speedo follows translation");
}

function proveLoopRibbonNotPit() {
  sim.lockRacePath("");
  var s;
  for (s = 0; s <= sim.TRACK_LEN; s += 8) {
    var p = sim.centerlinePoint(s);
    var hx = Math.cos(p.h);
    var hz = Math.sin(p.h);
    var sx = -hz;
    var sz = hx;
    var sides = [0, 2.4, 5.2, 8.2, -2.4, -5.2, -8.2];
    var i;
    for (i = 0; i < sides.length; i++) {
      var car = blankCar(p.x + sx * sides[i], p.z + sz * sides[i], p.h, 0);
      assert(!sim.inPitGrab(car), "ribbon/right-of-peel is not a pit grab s=" + s + " lat=" + sides[i]);
      assert(!sim.inPitLane(car), "ribbon/right-of-peel is not PIT LANE s=" + s + " lat=" + sides[i]);
    }
  }
  assert(sim.inPitGrab({ x: 81, z: -57 }), "halfway into the LEFT pit lane still grabs");
  assert(sim.inPitLane({ x: 81, z: -57 }), "halfway box is in the pit lane");
  assert(sim.onPitPavement(81, -57), "halfway into the visible left lane is on the peel");
  assert(!sim.inPitGrab({ x: 74, z: -80 }) && !sim.inPitLane({ x: 74, z: -80 }), "centerline at pit-x is not PIT LANE");
  assert(!sim.inPitGrab({ x: 74, z: -82.4 }) && !sim.inPitLane({ x: 74, z: -82.4 }), "right of the peel is not PIT LANE");
  assert(!sim.inPitGrab({ x: 20, z: -80 }) && !sim.inPitLane({ x: 20, z: -80 }), "peel mouth on the ribbon is not PIT LANE");
  assert(!sim.inPitGrab({ x: 20, z: -59 }), "peel entry is not halfway");
  assert(!sim.inPitGrab({ x: 38, z: -67.4 }), "peel mouth at 16 kph / 8s is not a grab or PIT LANE banner");
  assert(!sim.inPitGrab({ x: 74, z: -62 }) && !sim.onPitPavement(74, -66.5), "grass median / old strip is not the pit box");
  provePitPaintOffRibbon();
}

function provePitPaintOffRibbon() {
  sim.lockRacePath("");
  var ribbonZ = [-80, -82.4, -85.2, -71.4];
  var ribbonX = [-6, 8, 20, 38, 74, 100];
  var i;
  var j;
  for (i = 0; i < ribbonX.length; i++) {
    for (j = 0; j < ribbonZ.length; j++) {
      var x = ribbonX[i];
      var z = ribbonZ[j];
      var car = blankCar(x, z, 0, 0);
      assert(!sim.onPitPavement(x, z), "racing-line paint is not pit pave x=" + x + " z=" + z);
      assert(!sim.inPitGrab(car) && !sim.inPitLane(car), "racing-line sample is not PIT LANE x=" + x + " z=" + z);
    }
  }
  var pave = sim.PIT_PAVE;
  assert(pave && pave.length, "campus pit pave exists as a left lane");
  var edge = -80 + 8.6;
  for (i = 0; i < pave.length; i++) {
    var b = pave[i];
    assert(b.z0 > edge - 0.01, "pit rect " + i + " starts left of asphalt, z0=" + b.z0);
  }
  assert(sim.onPitPavement(81, -57) && sim.inPitGrab({ x: 81, z: -57 }), "halfway into the visible left lane still grabs");
  assert(!sim.onPitPavement(74, -66.5), "grass median between ribbon and pit is not pit paint");
  assert(sim.PIT_LANE.z0 >= -61.51, "second asphalt road sits left of the median, z0=" + sim.PIT_LANE.z0);
  var path = sim.PIT_PATH;
  assert(path && path.length >= 5, "campus pit is a path, not a lone box, segs=" + (path ? path.length : 0));
  var inArc = 0;
  var outArc = 0;
  var lane = 0;
  for (i = 0; i < path.length; i++) {
    if (path[i].name === "pitin" && path[i].type === "arc") inArc += 1;
    if (path[i].name === "pitout" && path[i].type === "arc") outArc += 1;
    if (path[i].name === "pitlane") lane += 1;
  }
  assert(inArc >= 2, "pit entry is an S-curve, arcs=" + inArc);
  assert(outArc >= 2, "pit exit is an S-curve, arcs=" + outArc);
  assert(lane >= 1, "pit lane still has a straight");
  assert(sim.onPitPavement(23, -63), "entry curve is driveable asphalt");
  assert(sim.onPitPavement(143, -63), "exit curve is driveable asphalt");
  assert(!sim.inPitGrab({ x: 23, z: -63 }) && !sim.inPitGrab({ x: 143, z: -63 }), "in/out curves are not the grab box");
  sim.placeWalls();
  var sep = 0;
  var inLane = 0;
  var wi;
  for (wi = 0; wi < sim.WALLS.length; wi++) {
    var w = sim.WALLS[wi];
    var mx = (w.ax + w.bx) * 0.5;
    var mz = (w.az + w.bz) * 0.5;
    if (mx > 64 && mx < 98 && mz > -69.2 && mz < -64.2) sep += 1;
    if (mx > 64 && mx < 98 && mz > -61.5 && mz < -52.5) inLane += 1;
  }
  assert(sep > 0, "left wall stays between the two roads, sep=" + sep);
  assert(inLane === 0, "second road has no clip wall, hits=" + inLane);
}

function proveStayRightNoGrab() {
  sim.lockRacePath("");
  sim.placeWalls();
  var g = sim.gridSlot(0);
  var car = blankCar(g.x, g.z, sim.slotHeading(g), 0);
  car.fuel = 100;
  car.tires = 100;
  var t;
  var grabbed = 0;
  var on = 0;
  var n = 0;
  var onStraight = 0;
  var straightN = 0;
  var zRight = 0;
  for (t = 0; t < 10; t += 1 / 60) {
    sim.applyMotion(car, 0, true, false, false, 1 / 60, true);
    sim.bashAllWalls(car);
    if (sim.inPitGrab(car) || sim.inPitLane(car)) grabbed += 1;
    if (sim.onPitPavement(car.x, car.z)) grabbed += 1;
    if (car.x < 200) {
      straightN += 1;
      if (sim.projectTrack(car.x, car.z).onAsphalt) onStraight += 1;
      if (car.z <= -80 + 0.5) zRight += 1;
    }
  }
  assert(grabbed === 0, "10s hold W, no A, center/right never PIT LANE / grab, hits=" + grabbed);
  assert(straightN > 60 && onStraight / straightN > 0.92, "south straight stay-right stays on asphalt, on=" + onStraight + "/" + straightN);
  assert(zRight === straightN, "no-A on the south straight stays center/right of the peel");
  var end10 = sim.projectTrack(car.x, car.z);
  assert(end10.onAsphalt && !end10.grass, "at 10s W-only is still on asphalt, not a void/grass dump, dist=" + end10.dist.toFixed(2) + " name=" + end10.name);
  assert(!sim.inPitGrab(car) && !sim.inPitLane(car), "at 10s W-only is not serviced");
  assert(end10.name === "start", "at 10s W-only is still on the start road, not the 90");

  car = blankCar(g.x, g.z, sim.slotHeading(g), 0);
  car.fuel = 100;
  car.tires = 100;
  grabbed = 0;
  for (t = 0; t < 10; t += 1 / 60) {
    var pr = sim.projectTrack(car.x, car.z);
    var err = angDiff(pr.h, car.heading);
    var steer = 0;
    if (err > 0.05) steer = 1;
    else if (err < -0.05) steer = -1;
    sim.applyMotion(car, steer, true, false, false, 1 / 60, true);
    sim.bashAllWalls(car);
    n += 1;
    if (sim.inPitGrab(car) || sim.inPitLane(car)) grabbed += 1;
    if (sim.projectTrack(car.x, car.z).onAsphalt) on += 1;
  }
  assert(grabbed === 0, "10s on the racing line never auto-grabs, grabs=" + grabbed);
  assert(on / n > 0.88, "following the ribbon past 8s stays on asphalt, on=" + on + "/" + n);
  assert(!sim.inPitGrab(car) && !sim.inPitLane(car), "after 10s still not in the pit box");

  var crawl = blankCar(g.x, g.z, 0.35, 0);
  crawl.fuel = 100;
  crawl.tires = 100;
  grabbed = 0;
  for (t = 0; t < 9; t += 1 / 60) {
    sim.applyMotion(crawl, 0, true, false, false, 1 / 60, true);
    if (crawl.speed > 5.1) crawl.speed = 5.1;
    if (sim.inPitGrab(crawl)) grabbed += 1;
  }
  assert(grabbed === 0, "16 kph crawl with leftover left yaw hits the mouth, not the halfway banner, grabs=" + grabbed);

  var peel = blankCar(40, -57, 0, 16);
  peel.fuel = 100;
  peel.tires = 100;
  var leftHit = 0;
  for (t = 0; t < 4; t += 1 / 60) {
    sim.applyMotion(peel, 0, true, false, false, 1 / 60, true);
    if (sim.inPitGrab(peel)) leftHit += 1;
  }
  assert(leftHit > 0, "peel LEFT onto the second road grabs halfway, hits=" + leftHit);
}

function proveMeshOverlap() {
  sim.lockRacePath("");
  var p = sim.centerlinePoint(40);
  var hx = Math.cos(p.h);
  var hz = Math.sin(p.h);
  var sx = -hz;
  var sz = hx;
  var victim = blankCar(p.x + hx * 4.8, p.z + hz * 4.8, p.h, 19);
  var bumper = blankCar(p.x, p.z, p.h, 19);
  victim.fuel = bumper.fuel = 100;
  victim.tires = bumper.tires = 100;
  assert(Math.hypot(victim.x - bumper.x, victim.z - bumper.z) > 3.45, "nose-on-tail is outside the cockpit circle");
  var hV = victim.heading;
  var hB = bumper.heading;
  sim.bashCars(bumper, victim);
  var yaw = Math.max(Math.abs(angDiff(victim.heading, hV)), Math.abs(angDiff(bumper.heading, hB)));
  assert(yaw > 0.005, "first mesh overlap (nose-on-tail) yaws, dH=" + yaw.toFixed(4));
  var bowie = blankCar(p.x + hx * 3.2 + sx * 1.5, p.z + hz * 3.2 + sz * 1.5, p.h, 19);
  var me = blankCar(p.x, p.z, p.h, 19);
  bowie.fuel = me.fuel = 100;
  bowie.tires = me.tires = 100;
  assert(Math.hypot(bowie.x - me.x, bowie.z - me.z) > 3.45, "nameplate-over-cockpit pose is outside the cockpit circle");
  var h0 = bowie.heading;
  var h1 = me.heading;
  sim.bashCars(me, bowie);
  var yaw2 = Math.max(Math.abs(angDiff(bowie.heading, h0)), Math.abs(angDiff(me.heading, h1)));
  assert(yaw2 > 0.005, "broadside mesh overlap at 60 yaws, dH=" + yaw2.toFixed(4));
  var slowA = blankCar(p.x, p.z, p.h, 2.86);
  var slowB = blankCar(p.x + sx * 1.2, p.z + sz * 1.2, p.h, 2.86);
  slowA.fuel = slowB.fuel = 100;
  slowA.tires = slowB.tires = 100;
  var hsA = slowA.heading;
  var hsB = slowB.heading;
  sim.bashCars(slowA, slowB);
  var yawS = Math.max(Math.abs(angDiff(slowA.heading, hsA)), Math.abs(angDiff(slowB.heading, hsB)));
  assert(yawS > 0.005, "slow 9 kph side-by-side mesh overlap yaws, dH=" + yawS.toFixed(4));
  assert(Math.hypot(slowA.x - slowB.x, slowA.z - slowB.z) > 1.2, "slow overlap separates, d=" + Math.hypot(slowA.x - slowB.x, slowA.z - slowB.z).toFixed(2));
  var parkA = blankCar(p.x, p.z, p.h, 0);
  var parkB = blankCar(p.x + sx * 1.0, p.z + sz * 1.0, p.h, 0);
  parkA.fuel = parkB.fuel = 100;
  parkA.tires = parkB.tires = 100;
  var hpA = parkA.heading;
  var hpB = parkB.heading;
  sim.bashCars(parkA, parkB);
  var yawP = Math.max(Math.abs(angDiff(parkA.heading, hpA)), Math.abs(angDiff(parkB.heading, hpB)));
  assert(yawP > 0.005, "park alongside first visible overlap yaws, dH=" + yawP.toFixed(4));
}

function proveGridFacesRace() {
  sim.lockRacePath("");
  var g0 = sim.gridSlot(0);
  var g1 = sim.gridSlot(1);
  assert(g0.x === -6 && g0.z === -82.4, "host slot stays put, x=" + g0.x + " z=" + g0.z);
  assert(g1.x === g0.x, "Add Bowie parks beside the host, not 8m behind the lens, x=" + g1.x);
  assert(g1.z < g0.z, "second row is further outside, not on the peel");
  assert(g0.z < -80, "host slot is outside the peel, not infield +Z, z=" + g0.z.toFixed(2));
  assert(Math.abs(g1.z - ( -80 - 5.2)) < 0.01, "Bowie sits on the outside mate box");
  var pr0 = sim.projectTrack(g0.x, g0.z);
  var pr1 = sim.projectTrack(g1.x, g1.z);
  assert(pr0.onAsphalt, "host room grid is on the asphalt ribbon");
  assert(pr1.onAsphalt, "Bowie grid is on the asphalt ribbon");
  assert(!sim.onPitPavement(g0.x, g0.z) && !sim.onPitPavement(g1.x, g1.z), "room grid is not on the pit peel");
  assert(Math.abs(angDiff(sim.slotHeading(g0), 0)) < 0.05, "keep the slot heading east, h=" + sim.slotHeading(g0).toFixed(3));
  assert(Math.abs(angDiff(sim.slotHeading(g1), 0)) < 0.05, "Bowie faces the same heading as the host");
  assert(Math.abs(angDiff(sim.faceRaceAt(g0.x, g0.z), 0)) < 0.05, "campus faceRaceAt stays east");
  assert(Math.abs(angDiff(sim.faceRaceAt(g1.x, g1.z), 0)) < 0.05, "outside slot also faces east");
  var r = blankCar(g0.x, g0.z, 1.2, 8);
  r.slide = 2;
  sim.pinGrid(r, g0.x, g0.z, sim.slotHeading(g0));
  assert(Math.abs(angDiff(r.heading, 0)) < 0.05, "pinGrid keeps the slot heading, leftover yaw=" + r.heading.toFixed(3));
  assert(r.speed === 0 && r.slide === 0, "grid pin is stopped, not pre-rolling");
}

function proveBowieInChaseCam() {
  sim.lockRacePath("");
  var host = sim.gridSlot(0);
  var bowie = sim.gridSlot(1);
  var back = 5.15;
  var camX = host.x - Math.cos(host.h) * back;
  var camZ = host.z - Math.sin(host.h) * back;
  var ahead = (bowie.x - camX) * Math.cos(host.h) + (bowie.z - camZ) * Math.sin(host.h);
  var lat = (bowie.x - camX) * -Math.sin(host.h) + (bowie.z - camZ) * Math.cos(host.h);
  assert(ahead > 3, "Bowie is in front of the chase-cam lens in the first 8s, ahead=" + ahead.toFixed(2));
  assert(Math.abs(lat) < 4, "Bowie sits in the chase-cam frame, lat=" + lat.toFixed(2));
  assert(Math.abs(host.z - bowie.z) > 2.4, "2-wide pair has a gap so lights-out is not a brick");
  var parkedA = blankCar(host.x, host.z, host.h, 0);
  var parkedB = blankCar(bowie.x, bowie.z, bowie.h, 0);
  parkedA.fuel = parkedB.fuel = 100;
  parkedA.tires = parkedB.tires = 100;
  sim.bashCars(parkedA, parkedB);
  assert(parkedA.x === host.x && parkedA.z === host.z, "lights-out pair does not spawn overlapping");
  var clipA = blankCar(bowie.x - 2.2, bowie.z + 1.15, bowie.h, 18);
  var clipB = blankCar(bowie.x, bowie.z, bowie.h, 10);
  clipA.fuel = clipB.fuel = 100;
  clipA.tires = clipB.tires = 100;
  var hB = clipB.heading;
  sim.bashCars(clipA, clipB);
  var yaw = Math.abs(angDiff(clipB.heading, hB));
  assert(yaw > 0.005, "first visible rear-quarter clip yaws, dH=" + yaw.toFixed(4));
}

function proveGetawayOnRibbon() {
  sim.lockRacePath("");
  var g = sim.gridSlot(0);
  var car = blankCar(g.x, g.z, sim.slotHeading(g), 0);
  car.fuel = 100;
  car.tires = 100;
  var t;
  var on = 0;
  var n = 0;
  for (t = 0; t < 2; t += 1 / 60) {
    sim.applyMotion(car, 0, true, false, false, 1 / 60, true);
    n += 1;
    if (sim.projectTrack(car.x, car.z).onAsphalt) on += 1;
  }
  assert(on / n > 0.92, "catch-green getaway from the room grid stays on asphalt, on=" + on + "/" + n);
  assert(Math.abs(angDiff(car.heading, 0)) < 0.2, "getaway does not yaw left onto grass, h=" + car.heading.toFixed(3));
  assert(!sim.projectTrack(car.x, car.z).grass, "after 2s the car is not limping on grass");
}

function proveStartDumpOnAsphalt() {
  sim.lockRacePath("");
  var g = sim.gridSlot(0);
  var car = blankCar(g.x, g.z, sim.slotHeading(g), 0);
  car.fuel = 100;
  car.tires = 100;
  var t;
  var on = 0;
  var n = 0;
  for (t = 0; t < 2; t += 1 / 60) {
    sim.applyMotion(car, 0, true, false, false, 1 / 60, true);
    n += 1;
    if (sim.projectTrack(car.x, car.z).onAsphalt) on += 1;
  }
  assert(on / n > 0.92, "start DUMP/SLUGGISH from the host slot stays on asphalt, on=" + on + "/" + n);
  assert(!sim.projectTrack(car.x, car.z).grass, "13 kph is grass-roll; a normal start is not on grass");
  assert(Math.abs(angDiff(car.heading, sim.slotHeading(g))) < 0.2, "start dump does not spin off the slot heading");
  var peel = blankCar(-6, -77.3, 1.35, 0);
  peel.fuel = 100;
  peel.tires = 100;
  for (t = 0; t < 2; t += 1 / 60) {
    sim.applyMotion(peel, 0, true, false, false, 1 / 60, true);
  }
  var prGood = sim.projectTrack(car.x, car.z);
  var prPeel = sim.projectTrack(peel.x, peel.z);
  assert(prPeel.dist > prGood.dist + 2 || peel.z > car.z + 4, "the old peel slot is the grass dump; ribbon grid stays nearer");
}

function proveCarHits() {
  sim.lockRacePath("");
  sim.placeWalls();
  var p = sim.centerlinePoint(40);
  var hx = Math.cos(p.h);
  var hz = Math.sin(p.h);
  var sx = -hz;
  var sz = hx;
  var victim = blankCar(p.x + hx * 2.4, p.z + hz * 2.4, p.h, 18);
  var bumper = blankCar(p.x, p.z, p.h, 26);
  victim.fuel = bumper.fuel = 100;
  victim.tires = bumper.tires = 100;
  var hV = victim.heading;
  sim.bashCars(bumper, victim);
  var tap = Math.abs(angDiff(victim.heading, hV));
  assert(tap < 0.12, "straight rear tap is a wiggle, dH=" + tap.toFixed(4));
  var qn = Math.hypot(hx * 0.5 + sx * 0.86, hz * 0.5 + sz * 0.86) || 1;
  var qnx = (hx * 0.5 + sx * 0.86) / qn;
  var qnz = (hz * 0.5 + sz * 0.86) / qn;
  var qTap = blankCar(p.x, p.z, p.h, 16);
  qTap.fuel = 100;
  qTap.tires = 100;
  var hTap = qTap.heading;
  sim.hitCarFeel(qTap, hx * 14, hz * 14, qnx, qnz, 6);
  var qWiggle = Math.abs(angDiff(qTap.heading, hTap));
  assert(qWiggle < 0.08, "rear-quarter tap is a wiggle, dH=" + qWiggle.toFixed(4));
  var qRam = blankCar(p.x, p.z, p.h, 16);
  qRam.fuel = 100;
  qRam.tires = 100;
  var hRam = qRam.heading;
  sim.hitCarFeel(qRam, hx * 14, hz * 14, qnx, qnz, 18);
  var qSpin = Math.abs(angDiff(qRam.heading, hRam));
  assert(qSpin > 0.18 && qSpin > qWiggle * 2, "rear-quarter ram spins, dH=" + qSpin.toFixed(4));
  var face = blankCar(p.x, p.z, p.h, 22);
  face.fuel = 100;
  face.tires = 100;
  var hF = face.heading;
  var spd0 = face.speed;
  sim.hitCarFeel(face, hx * 10, hz * 10, -hx, -hz, 16);
  assert(Math.abs(angDiff(face.heading, hF)) < 0.06, "front hit shoves, does not spin");
  assert(face.speed < spd0, "front hit dumps speed");
}

function proveTileIcons() {
  var pair = new Function(sliceFn("tileIconPts") + ";" + sliceFn("tileIconSvg") + "; return { pts: tileIconPts, svg: tileIconSvg };")();
  var icon = pair.pts;
  function near(a, b, tol) {
    return Math.hypot(a.x - b.x, a.y - b.y) < (tol || 0.6);
  }
  function hasPort(pts, x, y) {
    var i;
    for (i = 0; i < pts.length; i++) {
      if (near(pts[i], { x: x, y: y })) return true;
    }
    return false;
  }
  function inside(type, rot, w, h, label) {
    var pts = icon(type, rot, w, h);
    assert(pts.length >= 8, label + " has a silhouette, n=" + pts.length);
    var i;
    var minX = 1e9;
    var maxX = -1e9;
    var minY = 1e9;
    var maxY = -1e9;
    for (i = 0; i < pts.length; i++) {
      assert(pts[i].x >= -0.5 && pts[i].x <= w + 0.5 && pts[i].y >= -0.5 && pts[i].y <= h + 0.5, label + " stays inside the square");
      if (pts[i].x < minX) minX = pts[i].x;
      if (pts[i].x > maxX) maxX = pts[i].x;
      if (pts[i].y < minY) minY = pts[i].y;
      if (pts[i].y > maxY) maxY = pts[i].y;
    }
    var span = Math.hypot(maxX - minX, maxY - minY);
    assert(span > Math.min(w, h) * 0.35, label + " fills the chip, span=" + span.toFixed(1));
    var svg = pair.svg(type, rot, w, h);
    assert(svg.indexOf("<path") !== -1 && svg.indexOf("#3a3e46") !== -1, label + " SVG paints asphalt in the square");
    assert(svg.indexOf("M") !== -1, label + " SVG has a silhouette path");
    assert(svg.indexOf('fill="#3a3e46"') !== -1, label + " road is a filled ribbon, not a stroked cartoon");
    return { minX: minX, maxX: maxX, minY: minY, maxY: maxY, pts: pts };
  }
  var r90 = inside("r", 0, 160, 160, "90");
  assert(r90.maxX - r90.minX > 50 && r90.maxY - r90.minY > 50, "90 is a quarter-circle, not a line");
  assert(hasPort(r90.pts, 160, 80) && hasPort(r90.pts, 80, 160), "90 rot 0 hits east and south mid-edges");
  var sweep = inside("w", 0, 160, 160, "sweeper");
  assert(hasPort(sweep.pts, 160, 40) && hasPort(sweep.pts, 40, 160), "sweeper is a wide 90, NE-east to SW-south");
  var hp = inside("H", 0, 320, 160, "hairpin");
  assert(hp.maxX - hp.minX > (hp.maxY - hp.minY) * 1.1, "hairpin is a U across the wide chip");
  assert(hasPort(hp.pts, 80, 160) && hasPort(hp.pts, 240, 160), "hairpin U opens on the two south mid-edges");
  var chi = inside("C", 0, 160, 160, "chicane");
  var above = 0;
  var below = 0;
  var ci;
  for (ci = 0; ci < chi.pts.length; ci++) {
    if (chi.pts[ci].y < 80) above += 1;
    else below += 1;
  }
  assert(above > 3 && below > 3, "chicane S is not a flat line");
  assert(hasPort(chi.pts, 0, 80) && hasPort(chi.pts, 160, 80), "chicane meets west and east mid-edges");
  var str = icon("s", 0, 80, 80);
  assert(near(str[0], { x: 0, y: 40 }) && near(str[1], { x: 80, y: 40 }), "short straight is edge-to-edge");
  var boardSvg = pair.svg("s", 0, 80, 80, true);
  assert(boardSvg.indexOf('fill="#6a655c"') === -1, "board pieces do not paint their own dirt square");
}

function provePitPctSticky() {
  assert(src.indexOf("pitHudPct") !== -1, "pit % is sticky, not a raw timer redraw");
  assert(src.indexOf("if (nextPct > pitHudPct) pitHudPct = nextPct") !== -1, "pit % only climbs during a visit");
  assert(src.indexOf("pitAwayT") !== -1, "leaving the box needs a dwell before the visit resets");
  assert(src.indexOf("if (nextBanner !== pitBanner)") !== -1, "HUD writes the pit string only when it changes");
  var grab = src.slice(src.indexOf("if (!pitServicing && !pitUsedVisit && inPitGrab(player))"), src.indexOf("updateLaps(player)"));
  assert(grab.indexOf("pitHudPct = 0") === -1, "re-grab does not restart pit %");
  assert(grab.indexOf("pitTimer = 0") === -1, "re-grab does not restart the pit clock");
}

sim.lockRacePath("");
proveLoopApproach();
proveSpaceThroughS();
proveChicaneSteer("", "Campus Loop chicane");
proveChicaneSteer(sim.encodeMap(zig), "custom zig-zag chicane board");
proveChicaneSteer(sim.encodeMap(kitPieces()), "custom kit chicane+sweeper");
proveSpeedSteer();
proveUnweld();
proveLoopRibbonNotPit();
proveStayRightNoGrab();
proveCarHits();
proveMeshOverlap();
proveGridFacesRace();
proveBowieInChaseCam();
proveGetawayOnRibbon();
proveStartDumpOnAsphalt();
proveTileIcons();
provePitPctSticky();
assert(src.indexOf("var amp = MAP_CELL * 0.1") !== -1, "chicane S stays in-cell");
assert(src.indexOf("env *= env") !== -1, "chicane S is flat at the ports");

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
assert(src.indexOf("Math.max(4200, dirtW + 1800)") !== -1 && src.indexOf("Math.max(3600, dirtD + 1600)") !== -1, "skirt is larger than the dirt pad");
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
var customPit = sim.PIT_PATH || [];
var customIn = 0;
var customOut = 0;
var ci;
for (ci = 0; ci < customPit.length; ci++) {
  if (customPit[ci].name === "pitin" && customPit[ci].type === "arc") customIn += 1;
  if (customPit[ci].name === "pitout" && customPit[ci].type === "arc") customOut += 1;
}
assert(customIn >= 2 && customOut >= 2, "custom P piece curves into the box and back out, in=" + customIn + " out=" + customOut);

sim.lockRacePath("");
sim.placeWalls();
assert(!sim.customGridPose(), "Campus Loop does not use custom grid");
var campusCar = blankCar(-14, -80 - 2.7, 0, 0);
assert(sim.projectTrack(0, -80).onAsphalt, "Campus S/F asphalt stays clean");
assert(wallClear(sim.gridSlot(0).x, sim.gridSlot(0).z) > 5, "Campus host grid is not inside a wall");
assert(wallClear(sim.gridSlot(1).x, sim.gridSlot(1).z) > 5, "Campus P2 grid is not inside a wall");
var srv = fs.readFileSync(path.join(__dirname, "index.js"), "utf8");
assert(srv.indexOf("z: -80 + lat") !== -1 && srv.indexOf("slot % 2 ? -5.2 : -2.4") !== -1, "server room grid matches the outside ribbon");
assert(srv.indexOf("x: -6 - Math.floor(slot / 2) * 8") !== -1, "server parks Add Bowie beside the host");
assert(srv.indexOf("x: -6 - slot * 8") === -1, "server no longer stacks Bowie behind the chase cam");
assert(Math.abs(sim.TRACK_LEN - 1997.74) < 2, "Campus Loop length unchanged after custom grid prove");

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
assert(src.indexOf("function openPauseMenu") !== -1 && src.indexOf("function leaveRace") !== -1, "solo pause/leave exist");
assert(src.indexOf("function worldFrozen") !== -1, "pause freezes the sim");
assert(/#title-screen[\s\S]{0,180}overflow-y:\s*auto/.test(fs.readFileSync(path.join(__dirname, "..", "css", "style.css"), "utf8")), "title menu scrolls");

var customLen = rectLen;
sim.setTrack("");
sim.rebuildPath("");
assert(sim.MAP_SURF.length === 0, "Campus Loop clears custom surface");
assert(!sim.MAP_CLOSED, "Campus default is not a custom closed flag leak");
assert(Math.abs(sim.TRACK_LEN - 1997.74) < 2, "Default Campus Loop length " + sim.TRACK_LEN);
var line = sim.projectTrack(0, -80);
assert(line.onAsphalt && !line.grass, "Campus S/F is asphalt again");

function assertBuiltin(code, label, opts) {
  sim.rebuildPath(code);
  assert(!sim.MAP_CLOSED, label + " is a built-in, not a custom closed flag");
  assert(sim.TRACK_LEN > 1500 && sim.TRACK_LEN < 2600, label + " length " + sim.TRACK_LEN);
  var a = sim.centerlinePoint(0);
  var b = sim.centerlinePoint(Math.max(0, sim.TRACK_LEN - 0.4));
  var gap = Math.hypot(a.x - b.x, a.z - b.z);
  assert(gap < 28, label + " closes near the S/F");
  var maxY = 0;
  var minY = 0;
  var s;
  for (s = 0; s < sim.TRACK_LEN; s += 8) {
    var p = sim.centerlinePoint(s);
    if (p.y > maxY) maxY = p.y;
    if (p.y < minY) minY = p.y;
  }
  if (opts.flat) {
    assert(Math.abs(maxY) < 0.8 && Math.abs(minY) < 0.8, label + " stays flat y=" + maxY);
  } else {
    assert(maxY > 10 && maxY < 24, label + " climb y=" + maxY);
    assert(Math.abs(a.y) < 0.8, label + " starts at valley height");
  }
  assert(sim.menuTrackName() === opts.menu, label + " menu is " + sim.menuTrackName());
  var clear = selfClearance();
  assert(clear > 14, label + " does not run two legs on one bit of tarmac (closest " + clear.toFixed(1) + "m)");
}

assertBuiltin("HARBOR", "Harbor Street", { flat: true, menu: "HARBOR STREET" });
assertBuiltin("PARK", "Royal Park", { flat: true, menu: "ROYAL PARK" });
assertBuiltin("DESERT", "Desert Dusk", { flat: true, menu: "DESERT DUSK" });
assertBuiltin("FOREST", "Forest Climb", { flat: false, menu: "FOREST CLIMB" });
assert(
  sliceFn("updateLaps").indexOf("PATH.length && TRACK_LEN > 80") !== -1,
  "built-in ribbons count laps by s-wrap, not only MAP_CLOSED"
);

function proveRibbonLaps(code, label) {
  sim.rebuildPath(code);
  var stripe = sim.projectTrack(0, -80);
  var startS = stripe.onAsphalt ? stripe.s - 18 : sim.TRACK_LEN - 18;
  if (startS < 0) startS += sim.TRACK_LEN;
  var pose = sim.centerlinePoint(startS);
  var first = blankCar(pose.x, pose.z, pose.h, 0);
  first.s = startS;
  first.lastS = startS;
  first.passedHalf = false;
  first.lap = 1;
  var sWalk;
  for (sWalk = startS; sWalk < startS + 40; sWalk += 4) {
    var q = sim.centerlinePoint(sWalk);
    first.x = q.x;
    first.z = q.z;
    first.heading = q.h;
    sim.updateLaps(first);
  }
  assert(first.lap === 1, label + " does not gift a lap at lights-out, lap=" + first.lap);
  var lapper = blankCar(pose.x, pose.z, pose.h, 0);
  lapper.s = startS;
  lapper.lastS = startS;
  lapper.passedHalf = false;
  lapper.lap = 1;
  for (sWalk = startS; sWalk < startS + sim.TRACK_LEN + 40; sWalk += 6) {
    var p = sim.centerlinePoint(sWalk);
    lapper.x = p.x;
    lapper.z = p.z;
    lapper.heading = p.h;
    sim.updateLaps(lapper);
  }
  assert(lapper.lap >= 2, label + " counts a lap on the ribbon, lap=" + lapper.lap);
  assert(!lapper.finished, label + " one tour is not a race finish");
}

proveRibbonLaps("", "Campus Loop");
proveRibbonLaps("HARBOR", "Harbor Street");
proveRibbonLaps("PARK", "Royal Park");
proveRibbonLaps("DESERT", "Desert Dusk");
proveRibbonLaps("FOREST", "Forest Climb");
// A loop the editor can draw but that does not come home on its own, so
// autoClosePath has to route the whole way back. It must not lay the new
// road over road the lap has already used: where two legs share tarmac
// the barriers get dropped to keep both clear, leaving a hole cars fall
// through, and a shove at the crossing puts a car on the wrong leg.
function selfClearance() {
  var pts = [];
  var s;
  for (s = 0; s < sim.TRACK_LEN; s += 4) {
    var p = sim.centerlinePoint(s);
    pts.push(p);
  }
  var worst = 1e9;
  var i;
  var j;
  for (i = 0; i < pts.length; i++) {
    for (j = i + 1; j < pts.length; j++) {
      var along = Math.min((j - i) * 4, sim.TRACK_LEN - (j - i) * 4);
      if (along < 60) continue;
      // Road over road at a different height is a bridge, and Forest is
      // built around one, so only same-level pairs count as shared tarmac.
      if (Math.abs((pts[i].y || 0) - (pts[j].y || 0)) > 4) continue;
      var d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
      if (d < worst) worst = d;
    }
  }
  return worst;
}

function assertCloses(label, lay) {
  sim.resetPathCursor();
  sim.clearPit();
  lay();
  sim.autoClosePath();
  sim.sealCustom();
  var a = sim.centerlinePoint(0);
  var b = sim.centerlinePoint(sim.TRACK_LEN - 0.2);
  assert(Math.hypot(a.x - b.x, a.z - b.z) < 3, label + " ribbon has no hole at the S/F");
  assert(Math.abs(Math.atan2(Math.sin(a.h - b.h), Math.cos(a.h - b.h))) < 0.1, label + " ribbon has no kink at the S/F");
  var clear = selfClearance();
  assert(clear > 14, label + " does not lay new road over old (closest " + clear.toFixed(1) + "m)");
}

assertCloses("tight twisty loop", function () {
  sim.pathLine(120, "start");
  sim.pathArc(14, -95, "the90");
  sim.pathLine(70, "short");
  sim.pathArc(18, -70, "the90");
  sim.pathLine(50, "short");
  sim.pathArc(16, 78, "the90");
  sim.pathLine(90, "short");
  sim.pathArc(11, 176, "hairpin");
  sim.pathLine(70, "short");
  sim.pathArc(20, -60, "kink");
  sim.pathLine(40, "short");
});
assertCloses("one long straight", function () {
  sim.pathLine(300, "start");
});
assertCloses("chicane mix", function () {
  sim.pathLine(300, "start");
  sim.pathArc(12, 88, "chicane");
  sim.pathLine(40, "chicane");
  sim.pathArc(9, -100, "chicane");
  sim.pathLine(12, "chicane");
  sim.pathArc(13, 60, "chicane");
  sim.pathLine(200, "short");
  sim.pathArc(16, -90, "kink");
  sim.pathLine(120, "short");
  sim.pathArc(22, -90, "the90");
  sim.pathLine(60, "short");
});

sim.rebuildPath("");
assert(sim.menuTrackName() === "CAMPUS LOOP", "empty code is Campus");
assert(src.indexOf("harborDressing") !== -1 && src.indexOf("dressHarbor") !== -1, "Harbor dressing group");
assert(src.indexOf("parkDressing") !== -1 && src.indexOf("dressPark") !== -1, "Park dressing group");
assert(src.indexOf("desertDressing") !== -1 && src.indexOf("dressDesert") !== -1, "Desert dressing group");
assert(src.indexOf("forestDressing") !== -1 && src.indexOf("dressForest") !== -1, "Forest dressing group");
assert(src.indexOf("function pickBuiltin") !== -1, "title circuit picker");
assert(src.indexOf("Fairmont") !== -1 && src.indexOf("Sakhir") !== -1, "real-circuit landmark comments");
assert(src.indexOf("function addRockTunnel") !== -1, "Harbor tunnel is a rock mass, not a plank");
assert(src.indexOf("function addBankingArc") !== -1, "Park old banking is an infield arc");
assert(src.indexOf("function dressClear") !== -1 && src.indexOf("function dressOffset") !== -1, "dressing stays off the ribbon and pit");
assert(src.indexOf("dressOffset(p, side, dist") !== -1, "tree belts walk off the ribbon on both sides");
assert(src.indexOf("rettifilo") !== -1, "Royal Park names the first chicane after Rettifilo");
sim.rebuildPath("PARK");
var parkNames = sim.PATH.map(function (p) { return p.name; }).join(" ");
assert(parkNames.indexOf("rettifilo") !== -1 && parkNames.indexOf("roggia") !== -1, "Park has first then Roggia chicanes");
assert(parkNames.indexOf("hairpin") === -1, "Park has no hairpin");
sim.rebuildPath("HARBOR");
var harborNames = sim.PATH.map(function (p) { return p.name; }).join(" ");
assert(harborNames.indexOf("hairpin") !== -1 && harborNames.indexOf("tunnel") !== -1 && harborNames.indexOf("pool") !== -1, "Harbor keeps Fairmont / tunnel / pool");
sim.rebuildPath("FOREST");
var forestNames = sim.PATH.map(function (p) { return p.name; }).join(" ");
assert(forestNames.indexOf("source") !== -1 && forestNames.indexOf("raidillon") !== -1 && forestNames.indexOf("busstop") !== -1, "Forest keeps Source / Raidillon / bus-stop");
sim.rebuildPath("");
var dressMaps = ["", "HARBOR", "PARK", "DESERT", "FOREST"];
var dm;
for (dm = 0; dm < dressMaps.length; dm++) {
  var dcode = dressMaps[dm];
  var dlabel = dcode || "CAMPUS";
  sim.rebuildPath(dcode);
  var onLine = sim.centerlinePoint(24);
  assert(!sim.dressClear(onLine.x, onLine.z, 2), dlabel + " centerline is not a dress spot");
  assert(sim.inPitBox(80, -57, 2), dlabel + " default pit box is live");
  assert(!sim.dressClear(80, -57, 2), dlabel + " pit lane is not a dress spot");
  assert(!sim.dressClear(40, -70, 3), dlabel + " pit-side of S/F is not a dress spot");
  assert(sim.dressClear(420, 420, 4), dlabel + " far skirt is a dress spot");
}
sim.rebuildPath("");

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
