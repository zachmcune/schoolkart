/* Headless Campus Loop bot-AI smoke: same path + motion + updateCpu as js/game.js. */
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
    var c = src[j];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(idx, j + 1);
    }
  }
  throw new Error("unclosed " + name);
}

function sliceAssign(name) {
  var needle = "var " + name + " = {";
  var idx = src.indexOf(needle);
  if (idx < 0) throw new Error("missing " + name);
  var i = src.indexOf("{", idx);
  var depth = 0;
  for (var j = i; j < src.length; j++) {
    if (src[j] === "{") depth += 1;
    else if (src[j] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(idx, j + 1) + ";";
    }
  }
  throw new Error("unclosed " + name);
}

var code = [
  "var LAPS = 5;",
  "var MAX_SPEED = 200;",
  "var ACCEL = 5;",
  "var BRAKE_DECEL = 6;",
  "var COAST = 2;",
  "var REVERSE_ACCEL = 7;",
  "var REVERSE_MAX = 12;",
  "var LIMP_SPEED = 13;",
  "var LIMP_ACCEL = 2;",
  "var STEER_RATE = 2.35;",
  "var MAX_LAT = 28;",
  "var IDLE_FUEL = 0.46;",
  "var THROTTLE_FUEL = 0.12;",
  "var PIT_HOLD = 2.5;",
  "var GETAWAY_T = 1.5;",
  "var REV_SWEET_LO = 0.58;",
  "var REV_SWEET_HI = 0.8;",
  "var REV_GREAT_LO = 0.64;",
  "var REV_GREAT_HI = 0.74;",
  "var ASPHALT = 8.6;",
  "var RUNOFF = 3.8;",
  "var KERB_NAMES = ['the90', 'hairpin', 'chicane', 'sweeper', 'kink'];",
  "var KERB_RAISE = 0.055;",
  "var GRASS_MAX = 8.5;",
  "var GRASS_ROLL = 4;",
  "var GRASS_DUMP = 40;",
  "var TIRE_FLOOR = 22;",
  "var SF_Z = -80;",
  "var PIT_ENTRY = { x0: 8, x1: 28, z0: -70.0, z1: -61.0 };",
  "var PIT_EXIT = { x0: 128, x1: 160, z0: -68.0, z1: -58.0 };",
  "var PIT_LANE = { x0: 28, x1: 136, z0: -61.5, z1: -52.5 };",
  "var PIT_GRAB = { x0: 64, x1: 98, z0: -61.0, z1: -53.2 };",
  "var PIT_PAVE = [PIT_ENTRY, PIT_LANE, PIT_GRAB, PIT_EXIT];",
  "var PIT_PATH = [];",
  "var PIT_HALF = 4.5;",
  "var PIT_META = { ax: 28, az: -57, bx: 136, bz: -57, on: true };",
  "var PATH = [];",
  "var MAP_SURF = [];",
  "var MAP_CLOSED = false;",
  "var TRACK_LEN = 0;",
  "var _x = -200;",
  "var _z = SF_Z;",
  "var _h = 0;",
  "var _y = 0;",
  "var stampTrees = [];",
  "var RIBBON_SEGS = 360;",
  "var trackCode = '';",
  "var state = 'racing';",
  "var raceTime = 0;",
  "var launchT = 0;",
  "var launchMul = 1;",
  "var mpMode = false;",
  "var remotes = {};",
  "var hostBots = {};",
  "var player = { x: -9999, z: -9999, heading: 0, speed: 0, kind: 'player', mesh: { visible: false }, finished: false, pitServicing: false };",
  "var cpus = [];",
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
  sliceFn("autoClosePath"),
  sliceFn("cornerKind"),
  sliceFn("buildCampusPath"),
  sliceFn("pointOnSeg"),
  sliceFn("centerlinePoint"),
  sliceFn("projectOn"),
  sliceFn("projectTrack"),
  "var WALLS = [];",
  sliceFn("wallSeg"),
  sliceFn("skipLeftBarrier"),
  sliceFn("wallKindFor"),
  sliceFn("wallCutsRibbon"),
  sliceFn("joinColinearWall"),
  sliceFn("mergeColinearWalls"),
  sliceFn("placeWalls"),
  sliceFn("onRaceRibbon"),
  sliceFn("inPitLane"),
  sliceFn("inPitGrab"),
  sliceFn("isDriveableLoop"),
  sliceFn("updateLaps"),
  sliceFn("rideHeight"),
  sliceFn("steerWheelYaw"),
  sliceFn("onLongStraight"),
  sliceFn("pathSegAt"),
  sliceFn("inChicaneS"),
  sliceFn("wheelWorld"),
  sliceFn("kerbDepthAt"),
  sliceFn("sampleWheelKerbs"),
  sliceFn("applyMotion"),
  sliceAssign("AI_AGGRO"),
  sliceAssign("AI_SMART"),
  sliceAssign("AI_TIDY"),
  sliceAssign("AI_MESSY"),
  sliceAssign("AI_SHY"),
  sliceAssign("AI_BEAT"),
  sliceAssign("AI_LAB"),
  sliceAssign("AI_WILD"),
  sliceAssign("AI_WIDE"),
  "var _scan = { dHair: 999, dChi: 999, dSweep: 999, d90: 999, dKink: 999, dTight: 999, tightR: 99, hairLeft: 0, chiLeft: 0, sweepLeft: 0, d90Left: 0, dBend: 999, bendR: 99, inside: 1 };",
  sliceFn("aiOf"),
  sliceFn("scanAhead"),
  sliceFn("approachWant"),
  sliceFn("unwindWant"),
  sliceFn("brakeWindow"),
  sliceFn("planSpeed"),
  sliceFn("apexFromRadius"),
  sliceFn("eachRival"),
  sliceFn("avoidRams"),
  "var _prey = { r: null, d: 999, fwd: 0, lat: 0 };",
  "var _hunt = { on: false, tx: 0, tz: 0, want: 0, noLift: false, dive: false, catchUp: false, block: false, pass: false, cover: 0 };",
  sliceFn("gripApex"),
  sliceFn("namedApex"),
  sliceFn("pickPrey"),
  sliceFn("passSide"),
  sliceFn("planHunt"),
  sliceFn("gradeLaunch"),
  "function spawnFx() {}",
  "function dumpLaunch() {}",
  "function applyCpuLaunch(r) { r.launchArmed = true; r.launchMul = 1; r.launchT = 0; }",
  sliceFn("updateCpu"),
  sliceFn("isDriveableLoop"),
  "function poseCar(r) { if (r.mesh) { r.mesh.position.x = r.x; r.mesh.position.z = r.z; } }",
  "function trackLen() { return TRACK_LEN; }",
  "function sealCustom() { MAP_CLOSED = true; MAP_SURF = PATH.slice(); }",
  "function restoreCampus() {",
  "  MAP_CLOSED = false;",
  "  MAP_SURF = [];",
  "  resetPathCursor();",
  "  setDefaultPit();",
  "  buildCampusPath();",
  "}",
  "setDefaultPit();",
  "buildCampusPath();",
  "return {",
  "  TRACK_LEN: TRACK_LEN,",
  "  PATH: PATH,",
  "  runBot: runBot,",
  "  runHunt: runHunt,",
  "  runCatch: runCatch,",
  "  runBlock: runBlock,",
  "  runPass: runPass,",
  "  buildWideLoop: buildWideLoop,",
  "  resetPathCursor: resetPathCursor,",
  "  pathLine: pathLine,",
  "  pathArc: pathArc,",
  "  clearPit: clearPit,",
  "  setDefaultPit: setDefaultPit,",
  "  buildCampusPath: buildCampusPath,",
  "  apexFromRadius: apexFromRadius,",
  "  gradeLaunch: gradeLaunch,",
  "  centerlinePoint: centerlinePoint,",
  "  projectTrack: projectTrack,",
  "  scanAhead: scanAhead,",
  "  namedApex: namedApex,",
  "  gripApex: gripApex,",
  "  trackLen: trackLen,",
  "  sealCustom: sealCustom,",
  "  restoreCampus: restoreCampus,",
  "  isDriveableLoop: isDriveableLoop,",
  "  WALLS: WALLS,",
  "  placeWalls: placeWalls,",
  "  AI_AGGRO: AI_AGGRO,",
  "  AI_SMART: AI_SMART,",
  "  AI_TIDY: AI_TIDY,",
  "  AI_MESSY: AI_MESSY,",
  "  AI_SHY: AI_SHY,",
  "  AI_BEAT: AI_BEAT,",
  "  AI_LAB: AI_LAB,",
  "  AI_WILD: AI_WILD,",
  "  AI_WIDE: AI_WIDE",
  "};",
  "function runBot(name, gridX, gridZ, s0, seconds, heading) {",
  "  var r = {",
  "    kind: 'cpu', name: name,",
  "    x: gridX, z: gridZ, heading: heading || 0, speed: 0, slide: 0,",
  "    fuel: 100, tires: 100, lap: 1, passedHalf: false, lastX: gridX, s: s0, lastS: s0,",
  "    brakeHold: 0, finished: false, finishTime: 0,",
  "    wantPit: false, didPit: false, pitServicing: false, pitTimer: 0, pitUsedVisit: false,",
  "    launchMul: 1, launchT: 0, launchArmed: true, aiT: 0,",
  "    mesh: { visible: true, position: { x: gridX, y: 0, z: gridZ, set: function(x,y,z){ this.x=x; this.y=y; this.z=z; } }, rotation: { set: function(){}, x:0, y:0, z:0 }, userData: {} }",
  "  };",
  "  var dt = 1/30;",
  "  var grass = 0, asphalt = 0, emptyT = 0, pitStops = 0, maxOff = 0;",
  "  var hairFast = 0, reverseT = 0, boxT = 0;",
  "  var wasBox = false;",
  "  var grassBy = {};",
  "  var pitAt = null;",
  "  raceTime = 0;",
  "  for (var t = 0; t < seconds; t += dt) {",
  "    raceTime = t;",
  "    updateCpu(r, dt);",
  "    if (r.pitServicing) boxT += dt;",
  "    if (r.pitServicing && !wasBox) { pitStops += 1; pitAt = { t: t, lap: r.lap, fuel: r.fuel }; }",
  "    wasBox = r.pitServicing;",
  "    var info = projectTrack(r.x, r.z);",
  "    if (info.grass) { grass += dt; grassBy[info.name] = (grassBy[info.name] || 0) + dt; }",
  "    else asphalt += dt;",
  "    if (info.dist > maxOff) maxOff = info.dist;",
  "    if (info.name === 'hairpin' && !info.grass && r.speed > 17) hairFast += dt;",
  "    if (r.fuel <= 0) emptyT += dt;",
  "    if (r.speed < 0) reverseT += dt;",
  "    if (r.finished) break;",
  "  }",
  "  return {",
  "    name: name, finished: r.finished, finishTime: r.finishTime || raceTime,",
  "    lap: r.lap, fuel: r.fuel, tires: r.tires, didPit: r.didPit, pitStops: pitStops, pitAt: pitAt,",
  "    grass: grass, asphalt: asphalt, maxOff: maxOff, emptyT: emptyT, grassBy: grassBy,",
  "    hairFast: hairFast, reverseT: reverseT, boxT: boxT, x: r.x, z: r.z, speed: r.speed",
  "  };",
  "}",
  "function blankBot(name, x, z, spd) {",
  "  return {",
  "    kind: 'cpu', name: name, x: x, z: z, heading: 0, speed: spd, slide: 0,",
  "    fuel: 100, tires: 100, lap: 1, passedHalf: false, lastX: x, s: TRACK_LEN - 14, lastS: TRACK_LEN - 14,",
  "    brakeHold: 0, finished: false, finishTime: 0,",
  "    wantPit: false, didPit: false, pitServicing: false, pitTimer: 0, pitUsedVisit: false,",
  "    launchMul: 1, launchT: 0, launchArmed: true, aiT: 0,",
  "    mesh: { visible: true, position: { x: x, y: 0, z: z, set: function(a,b,c){ this.x=a; this.y=b; this.z=c; } }, rotation: { set: function(){}, x:0, y:0, z:0 }, userData: {} }",
  "  };",
  "}",
  "function runHunt(name, seconds) {",
  "  player.x = 10; player.z = SF_Z; player.heading = 0; player.speed = 20;",
  "  player.kind = 'player'; player.finished = false; player.pitServicing = false;",
  "  player.mesh = { visible: true };",
  "  var r = blankBot(name, -4, SF_Z + 0.2, 26);",
  "  var d0 = Math.hypot(player.x - r.x, player.z - r.z);",
  "  var minD = d0;",
  "  var hitT = 0;",
  "  var dt = 1/30;",
  "  raceTime = 2;",
  "  for (var t = 0; t < seconds; t += dt) {",
  "    player.x += Math.cos(player.heading) * player.speed * dt;",
  "    player.z += Math.sin(player.heading) * player.speed * dt;",
  "    updateCpu(r, dt);",
  "    var d = Math.hypot(player.x - r.x, player.z - r.z);",
  "    if (d < minD) minD = d;",
  "    if (d < 2.55) hitT += dt;",
  "  }",
  "  var endD = Math.hypot(player.x - r.x, player.z - r.z);",
  "  player.x = -9999; player.z = -9999; player.mesh.visible = false;",
  "  return { name: name, d0: d0, minD: minD, endD: endD, hitT: hitT };",
  "}",
  "function runCatch(name, seconds) {",
  "  player.x = 52; player.z = SF_Z; player.heading = 0; player.speed = 30;",
  "  player.kind = 'player'; player.finished = false; player.pitServicing = false;",
  "  player.mesh = { visible: true };",
  "  var r = blankBot(name, -6, SF_Z + 0.2, 28);",
  "  var d0 = Math.hypot(player.x - r.x, player.z - r.z);",
  "  var minD = d0;",
  "  var dt = 1/30;",
  "  raceTime = 2;",
  "  for (var t = 0; t < seconds; t += dt) {",
  "    player.x += Math.cos(player.heading) * player.speed * dt;",
  "    player.z += Math.sin(player.heading) * player.speed * dt;",
  "    updateCpu(r, dt);",
  "    var d = Math.hypot(player.x - r.x, player.z - r.z);",
  "    if (d < minD) minD = d;",
  "  }",
  "  var endD = Math.hypot(player.x - r.x, player.z - r.z);",
  "  player.x = -9999; player.z = -9999; player.mesh.visible = false;",
  "  return { name: name, d0: d0, minD: minD, endD: endD, speed: r.speed };",
  "}",
  "function runBlock(name, seconds) {",
  "  player.x = 4; player.z = SF_Z + 2.4; player.heading = 0; player.speed = 38;",
  "  player.kind = 'player'; player.finished = false; player.pitServicing = false;",
  "  player.mesh = { visible: true };",
  "  var r = blankBot(name, 18, SF_Z, 32);",
  "  var h0 = r.heading;",
  "  var x0 = r.x;",
  "  var z0 = r.z;",
  "  var maxAbsH = 0;",
  "  var dt = 1/30;",
  "  raceTime = 2;",
  "  for (var t = 0; t < seconds; t += dt) {",
  "    player.x += Math.cos(player.heading) * player.speed * dt;",
  "    player.z += Math.sin(player.heading) * player.speed * dt;",
  "    updateCpu(r, dt);",
  "    var ah = Math.abs(r.heading);",
  "    if (ah > Math.PI) ah = Math.abs(ah - Math.PI * 2);",
  "    if (ah > maxAbsH) maxAbsH = ah;",
  "  }",
  "  player.x = -9999; player.z = -9999; player.mesh.visible = false;",
  "  return { name: name, x0: x0, z0: z0, x: r.x, z: r.z, heading: r.heading, maxAbsH: maxAbsH, speed: r.speed, h0: h0 };",
  "}",
  "function runPass(name, seconds) {",
  "  player.x = 18; player.z = SF_Z; player.heading = 0; player.speed = 22;",
  "  player.kind = 'player'; player.finished = false; player.pitServicing = false;",
  "  player.mesh = { visible: true };",
  "  var r = blankBot(name, -8, SF_Z + 0.15, 34);",
  "  var d0 = Math.hypot(player.x - r.x, player.z - r.z);",
  "  var minD = d0;",
  "  var maxAbsLat = 0;",
  "  var dt = 1/30;",
  "  raceTime = 2;",
  "  for (var t = 0; t < seconds; t += dt) {",
  "    player.x += Math.cos(player.heading) * player.speed * dt;",
  "    player.z += Math.sin(player.heading) * player.speed * dt;",
  "    updateCpu(r, dt);",
  "    var rx = player.x - r.x;",
  "    var rz = player.z - r.z;",
  "    var d = Math.hypot(rx, rz);",
  "    if (d < minD) minD = d;",
  "    var lat = -rx * Math.sin(r.heading) + rz * Math.cos(r.heading);",
  "    if (Math.abs(lat) > maxAbsLat) maxAbsLat = Math.abs(lat);",
  "  }",
  "  var endD = Math.hypot(player.x - r.x, player.z - r.z);",
  "  var fx = Math.cos(r.heading);",
  "  var fz = Math.sin(r.heading);",
  "  var endFwd = (player.x - r.x) * fx + (player.z - r.z) * fz;",
  "  player.x = -9999; player.z = -9999; player.mesh.visible = false;",
  "  return { name: name, d0: d0, minD: minD, endD: endD, maxAbsLat: maxAbsLat, endFwd: endFwd, x: r.x, speed: r.speed };",
  "}",
  "function buildWideLoop() {",
  "  resetPathCursor();",
  "  clearPit();",
  "  pathLine(160, 'start');",
  "  pathArc(44, 90, 'the90');",
  "  pathLine(90, 'short');",
  "  pathArc(44, 180, 'hairpin');",
  "  pathLine(160, 'north');",
  "  pathArc(44, 90, 'the90');",
  "  pathLine(90, 'short');",
  "  pathArc(22, 90, 'the90');",
  "  autoClosePath();",
  "}",
].join("\n");

var sim;
try {
  sim = new Function(code)();
} catch (e) {
  console.error(code.split("\n").slice(0, 40).join("\n"));
  throw e;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(Math.abs(sim.TRACK_LEN - 1997.74) < 2, "Campus Loop length " + sim.TRACK_LEN);
var line = sim.projectTrack(0, -80);
assert(line.onAsphalt && !line.grass, "racing line is asphalt");
var shoulder = sim.projectTrack(0, -80 - 8.6 - 2);
assert(!shoulder.onAsphalt && !shoulder.grass && shoulder.onRunoff, "painted runoff is not lawn");
var past = sim.projectTrack(0, -80 - 8.6 - 3.8 - 3);
assert(past.grass, "beyond runoff can crawl");
var kerbPt = null;
for (var ks = 0; ks < sim.TRACK_LEN; ks += 6) {
  var kp = sim.centerlinePoint(ks);
  if (kp.name !== "the90") continue;
  var knx = -Math.sin(kp.h);
  var knz = Math.cos(kp.h);
  kerbPt = sim.projectTrack(kp.x + knx * 9.0, kp.z + knz * 9.0);
  if (kerbPt.kerb) break;
}
assert(kerbPt && kerbPt.kerb && !kerbPt.grass, "named-corner kerb is mountable, not lawn");
sim.placeWalls();
assert(sim.WALLS.length > 200, "barriers run the circuit");
var pitHit = 0;
var rightSF = 0;
var tallN = 0;
var wi;
for (wi = 0; wi < sim.WALLS.length; wi++) {
  var ww = sim.WALLS[wi];
  var mx = (ww.ax + ww.bx) * 0.5;
  var mz = (ww.az + ww.bz) * 0.5;
  if (mx > 64 && mx < 98 && mz > -61.5 && mz < -52.5) pitHit += 1;
  var xLo = Math.min(ww.ax, ww.bx);
  var xHi = Math.max(ww.ax, ww.bx);
  var zHi = Math.max(ww.az, ww.bz);
  if (xLo < 40 && xHi > -20 && zHi < -88) rightSF += 1;
  if (ww.kind === "tall") tallN += 1;
}
assert(pitHit === 0, "left pit peel has no clip-grab wall");
assert(rightSF > 0, "right side of S/F is walled");
assert(tallN > 8 && tallN < sim.WALLS.length * 0.35, "tall only outside 180 / chicane / sweeper");
var hp = 0;
var longs = 0;
for (var d = 0; d < sim.TRACK_LEN; d += 4) {
  var p = sim.centerlinePoint(d);
  if (p.name === "hairpin") hp += 4;
  if (p.name === "start" || p.name === "north") longs += 4;
}
assert(hp > 20, "hairpin present");
assert(longs > 700, "long straights present");

var bowie = sim.runBot("BowieKnife99", -6, -80 + 2.7, sim.TRACK_LEN - 6, 520);
var tidy = sim.runBot("Hall Monitor", -6, -80 + 2.7, sim.TRACK_LEN - 6, 520);
var messy = sim.runBot("Sub Teacher", -6, -80 + 2.7, sim.TRACK_LEN - 6, 520);

function report(r) {
  console.log(
    r.name +
      " fin=" +
      r.finished +
      " t=" +
      r.finishTime.toFixed(1) +
      " lap=" +
      r.lap +
      " pit=" +
      r.didPit +
      "/" +
      r.pitStops +
      (r.pitAt ? " @lap" + r.pitAt.lap + "/" + r.pitAt.t.toFixed(0) + "s" : "") +
      " grass=" +
      r.grass.toFixed(1) +
      "s empty=" +
      r.emptyT.toFixed(1) +
      "s hairFast=" +
      r.hairFast.toFixed(1) +
      "s maxOff=" +
      r.maxOff.toFixed(1) +
      " fuel=" +
      r.fuel.toFixed(0) +
      " tires=" +
      r.tires.toFixed(0)
  );
  console.log("  grassBy", r.grassBy);
}
report(bowie);
report(tidy);
report(messy);

assert(bowie.finished, "BowieKnife99 should finish 5 laps");
assert(tidy.finished, "Hall Monitor should finish 5 laps");
assert(messy.finished, "messy bot should finish 5 laps");
assert(bowie.didPit && tidy.didPit && messy.didPit, "every personality boxes once");
assert(bowie.pitStops === 1 && tidy.pitStops === 1 && messy.pitStops === 1, "one stop, not forever");
assert(tidy.grass <= bowie.grass + 4, "Hall Monitor should not be sloppier than Bowie");
assert(messy.grass <= bowie.grass + 4, "Sub Teacher should not be sloppier than Bowie");
assert(bowie.emptyT < 1, "Bowie should not run dry on the straight");
assert(tidy.emptyT < 1, "Hall Monitor should not run dry");
assert(messy.emptyT < 1, "Sub Teacher should not run dry");
assert(Math.abs(tidy.finishTime - bowie.finishTime) < 12, "Hall Monitor keeps Bowie race pace");
assert(Math.abs(messy.finishTime - bowie.finishTime) < 12, "Sub Teacher keeps Bowie race pace");
assert(bowie.grass <= 6, "Bowie holds the ribbon, not a wide dump (" + bowie.grass.toFixed(1) + "s grass)");
assert(tidy.grass <= 6, "Hall Monitor holds the ribbon (" + tidy.grass.toFixed(1) + "s grass)");
assert(bowie.maxOff < 26, "Bowie does not take the 90/180 wide (" + bowie.maxOff.toFixed(1) + ")");
assert(sim.AI_AGGRO.lineOff > 0.4, "Bowie holds the inside");
assert(sim.AI_AGGRO.the90 < 25, "Bowie's 90 is a speed he can turn");
assert(sim.AI_AGGRO.pace >= 1, "Bowie winds the longs at the cap");
assert(sim.AI_SMART.pace >= 1 && sim.AI_TIDY.pace >= 1, "campus kids wind the longs at the cap");
assert(sim.AI_SMART.brake === sim.AI_AGGRO.brake, "everyone brakes with Bowie");
assert(sim.AI_SMART.pitFuel === sim.AI_AGGRO.pitFuel, "everyone boxes on Bowie's window");
assert(sim.AI_MESSY.lineOff === sim.AI_AGGRO.lineOff, "nobody runs a sloppy wide line");
assert(sim.AI_AGGRO.overshoot === 1 && sim.AI_SMART.overshoot === 1, "the field can overshoot the 180");
assert(sim.AI_SMART.craft === 1 && !sim.AI_SMART.hunter, "smart craft, no hunt");
assert(bowie.finishTime > 220, "beatable — heavy car, not a ghost (" + bowie.finishTime.toFixed(1) + ")");
assert(bowie.finishTime < 340, "Bowie is the car to beat, not a backmarker (" + bowie.finishTime.toFixed(1) + ")");
assert(tidy.finishTime < 340, "Hall Monitor keeps race pace (" + tidy.finishTime.toFixed(1) + ")");
assert(sim.gradeLaunch(0.2) === "SLUGGISH", "below green is sluggish");
assert(sim.gradeLaunch(0.6) === "GOOD", "green is GOOD");
assert(sim.gradeLaunch(0.69) === "GREAT", "sweet spot is GREAT");
assert(sim.gradeLaunch(0.81) === "DUMP", "past the mark dumps");
assert(sim.gradeLaunch(1) === "DUMP", "at max is a fail");
assert(sim.AI_AGGRO.hunter === 1, "BowieKnife99 is the hunter");
assert(!sim.AI_TIDY.hunter && !sim.AI_MESSY.hunter, "only Bowie hunts");
assert(sim.AI_SHY.pace === sim.AI_TIDY.pace, "Library Kid shares Hall Monitor pace");
assert(sim.AI_WILD.pace === sim.AI_BEAT.pace, "Detention shares Band Kid pace");
assert(sim.AI_WIDE.lineOff === sim.AI_LAB.lineOff, "Yearbook shares Lab Partner line");
assert(sim.AI_LAB.brake === sim.AI_BEAT.brake, "Lab Partner shares Band Kid brakes");

["Library Kid", "Band Kid", "Lab Partner", "Detention", "Yearbook"].forEach(function (name) {
  var extra = sim.runBot(name, -14, -80 + 2.7, sim.TRACK_LEN - 14, 12);
  assert(extra.asphalt > 4, name + " drives on asphalt (" + extra.asphalt.toFixed(1) + "s)");
  assert(extra.speed > 8, name + " is up to race speed (" + extra.speed.toFixed(1) + ")");
  assert(extra.maxOff < 40, name + " stays near the ribbon (" + extra.maxOff.toFixed(1) + ")");
});

var hunt = sim.runHunt("BowieKnife99", 2.6);
var dodge = sim.runHunt("Hall Monitor", 2.6);
console.log(
  "hunt Bowie minD=" +
    hunt.minD.toFixed(2) +
    " hitT=" +
    hunt.hitT.toFixed(2) +
    " tidy minD=" +
    dodge.minD.toFixed(2) +
    " hitT=" +
    dodge.hitT.toFixed(2)
);
assert(hunt.minD < 1.0, "Bowie closes to wreck range (" + hunt.minD.toFixed(2) + ")");
assert(dodge.minD > hunt.minD + 0.35, "tidy does not divebomb the player");
assert(hunt.hitT > 0, "Bowie reaches bash radius");

var catchB = sim.runCatch("BowieKnife99", 5.0);
var catchT = sim.runCatch("Hall Monitor", 5.0);
console.log(
  "catch Bowie d0=" +
    catchB.d0.toFixed(1) +
    " end=" +
    catchB.endD.toFixed(1) +
    " min=" +
    catchB.minD.toFixed(1) +
    " v=" +
    catchB.speed.toFixed(1) +
    " tidy end=" +
    catchT.endD.toFixed(1)
);
assert(catchB.d0 > 50, "catch starts from a real lead");
assert(catchB.endD < catchB.d0 - 14, "Bowie reels in a straight lead (" + catchB.endD.toFixed(1) + ")");
assert(catchT.endD < catchT.d0 - 14, "Hall Monitor reels in a straight lead (" + catchT.endD.toFixed(1) + ")");
assert(catchB.speed > 40, "Bowie winds the straight while catching up");
assert(catchT.speed > 40, "Hall Monitor winds the straight while catching up");

var blockB = sim.runBlock("BowieKnife99", 1.4);
var blockT = sim.runBlock("Hall Monitor", 1.4);
console.log(
  "block Bowie maxAbsH=" +
    blockB.maxAbsH.toFixed(2) +
    " dx=" +
    (blockB.x - blockB.x0).toFixed(1) +
    " dz=" +
    (blockB.z - blockB.z0).toFixed(2) +
    " tidy dz=" +
    (blockT.z - blockT.z0).toFixed(2)
);
assert(blockB.x > blockB.x0 + 12, "lead Bowie keeps racing forward, not a U-turn");
assert(blockB.maxAbsH < 0.7, "lead Bowie does not yaw around to ram (" + blockB.maxAbsH.toFixed(2) + ")");
assert(blockB.z - blockB.z0 > 0.55, "lead Bowie covers the pass lane (" + (blockB.z - blockB.z0).toFixed(2) + ")");
assert(blockT.x > blockT.x0 + 12, "lead Hall Monitor keeps racing forward, not a U-turn");
assert(blockT.maxAbsH < 0.7, "lead Hall Monitor does not yaw around to ram (" + blockT.maxAbsH.toFixed(2) + ")");
assert(blockT.z - blockT.z0 > 0.55, "Hall Monitor covers the pass lane (" + (blockT.z - blockT.z0).toFixed(2) + ")");
assert(blockB.speed > 28, "block still rolls, not a park");

var passT = sim.runPass("Hall Monitor", 2.2);
var passB = sim.runPass("BowieKnife99", 2.2);
console.log(
  "pass Hall minD=" +
    passT.minD.toFixed(2) +
    " lat=" +
    passT.maxAbsLat.toFixed(2) +
    " endFwd=" +
    passT.endFwd.toFixed(1) +
    " Bowie minD=" +
    passB.minD.toFixed(2)
);
assert(passT.d0 > 20, "pass starts from a real gap");
assert(passT.endFwd < 0, "Hall Monitor gets past on the pass (endFwd=" + passT.endFwd.toFixed(1) + ")");
assert(passT.maxAbsLat > 1.1, "Hall Monitor moves off-line to pass (" + passT.maxAbsLat.toFixed(2) + ")");
assert(passT.minD > 0.7, "Hall Monitor does not occupy the car (" + passT.minD.toFixed(2) + ")");
assert(passT.minD > passB.minD + 0.25, "Hall Monitor's pass is cleaner than Bowie's ram");
assert(passT.speed > 26, "pass still rolls");

sim.buildWideLoop();
var widePt = sim.centerlinePoint(0);
var hpScan = sim.scanAhead(0, 400);
var wideHair = null;
var ws;
for (ws = 0; ws < sim.trackLen(); ws += 8) {
  var wp = sim.centerlinePoint(ws);
  if (wp.name === "hairpin" && wp.r > 30) {
    wideHair = wp;
    break;
  }
}
assert(wideHair && wideHair.r > 30, "wide loop has a tile-scale hairpin");
assert(sim.namedApex(10, 17.4, wideHair.r, 1) > 28, "wide hairpin uses grip, not campus crawl apex");
assert(sim.namedApex(10, 17.4, 11, 1) < 20, "campus 180 still uses the tight apex");
assert(sim.namedApex(10, 31, 40, 1) === 31, "campus 90 entry keeps the tuned apex");
assert(sim.gripApex(44, 1) > 30, "44m tile corners carry race speed");
var wide = sim.runBot("Hall Monitor", widePt.x, widePt.z, 0, 28);
console.log(
  "wide Hall t=" +
    wide.finishTime.toFixed(1) +
    " grass=" +
    wide.grass.toFixed(1) +
    "s maxOff=" +
    wide.maxOff.toFixed(1) +
    " v=" +
    wide.speed.toFixed(1) +
    " hairFast=" +
    wide.hairFast.toFixed(1)
);
assert(wide.asphalt > 16, "Hall Monitor drives the wide custom loop");
assert(wide.grass < 8, "Hall Monitor does not beach a wide custom hairpin (" + wide.grass.toFixed(1) + "s)");
assert(wide.hairFast > 1.5, "Hall Monitor carries the fat hairpin, not a campus-180 crawl (" + wide.hairFast.toFixed(1) + ")");
assert(wide.maxOff < 28, "Hall Monitor stays near the custom ribbon (" + wide.maxOff.toFixed(1) + ")");
sim.restoreCampus();

console.log("OK bot AI Campus Loop", sim.TRACK_LEN.toFixed(1));

assert(sim.apexFromRadius(12, 0.92) < 22, "Campus decreasing 90 stays a real slow corner");
assert(sim.apexFromRadius(44, 0.92) > 28, "custom map 90 (r=44) is not crawled like a 12m Campus 90");
assert(sim.apexFromRadius(132, 0.9) > 32, "custom sweeper is a sweeper, not a 90");

function buildRectLoop(dir, r, name) {
  sim.resetPathCursor();
  sim.clearPit();
  var turn = dir * 90;
  sim.pathLine(180, "start");
  sim.pathArc(r, turn, name || "the90");
  sim.pathLine(140, "short");
  sim.pathArc(r, turn, name || "the90");
  sim.pathLine(180, "short");
  sim.pathArc(r, turn, name || "the90");
  sim.pathLine(140, "short");
  sim.pathArc(r, turn, name || "the90");
  sim.sealCustom();
}

function buildHairpinLoop(dir) {
  sim.resetPathCursor();
  sim.clearPit();
  sim.pathLine(170, "start");
  sim.pathArc(44, dir * 180, "hairpin");
  sim.pathLine(170, "short");
  sim.pathArc(44, dir * 180, "hairpin");
  sim.sealCustom();
}

function buildSweeperLoop(dir) {
  sim.resetPathCursor();
  sim.clearPit();
  var turn = dir * 90;
  sim.pathLine(90, "start");
  sim.pathArc(132, turn, "sweeper");
  sim.pathLine(90, "short");
  sim.pathArc(132, turn, "sweeper");
  sim.pathLine(90, "short");
  sim.pathArc(132, turn, "sweeper");
  sim.pathLine(90, "short");
  sim.pathArc(132, turn, "sweeper");
  sim.sealCustom();
}

function spawnRibbon() {
  var s0 = 12;
  var p = sim.centerlinePoint(s0);
  return { x: p.x, z: p.z, h: p.h, s: s0 };
}

function runCustom(name, seconds) {
  var spawn = spawnRibbon();
  return sim.runBot(name, spawn.x, spawn.z, spawn.s, seconds || 280, spawn.h);
}

function assertScan(dir, r, label) {
  var scan = sim.scanAhead(40, 260);
  assert(scan.dBend > 80 && scan.dBend < 160, label + " dBend " + scan.dBend);
  assert(Math.abs(scan.bendR - r) < 2.5, label + " bendR " + scan.bendR);
  if (dir > 0) assert(scan.inside > 0, label + " left inside " + scan.inside);
  else assert(scan.inside < 0, label + " right inside " + scan.inside);
}

function assertFight(r, label, hall) {
  report(r);
  assert(r.finished, label + " Bowie finishes 5 laps");
  assert(r.grass < 10, label + " grass " + r.grass.toFixed(1));
  assert(r.maxOff < 22, label + " stays on the ribbon, not wide (" + r.maxOff.toFixed(1) + ")");
  assert(r.reverseT < 2, label + " reverse " + r.reverseT.toFixed(1));
  assert(r.emptyT < 4, label + " fuel " + r.emptyT.toFixed(1));
  assert(r.finishTime > 60 && r.finishTime < 240, label + " pace " + r.finishTime.toFixed(1));
  if (hall) {
    report(hall);
    assert(hall.finished, label + " Hall finishes");
    assert(hall.grass < 10, label + " Hall grass " + hall.grass.toFixed(1));
    assert(Math.abs(r.finishTime - hall.finishTime) < 18, label + " Hall keeps Bowie pace (" + r.finishTime.toFixed(1) + " vs " + hall.finishTime.toFixed(1) + ")");
  }
}

buildRectLoop(1, 44, "the90");
assert(sim.isDriveableLoop(), "custom left 90s is a closed loop");
assertScan(1, 44, "custom-left-90");
var left90 = runCustom("BowieKnife99");
var leftHall = runCustom("Hall Monitor");
assertFight(left90, "custom-left-90", leftHall);

buildRectLoop(-1, 44, "the90");
assertScan(-1, 44, "custom-right-90");
var right90 = runCustom("BowieKnife99");
var rightHall = runCustom("Hall Monitor");
assertFight(right90, "custom-right-90", rightHall);

buildRectLoop(1, 22, "the90");
assertScan(1, 22, "code-left-90");
var codeL = runCustom("BowieKnife99");
assertFight(codeL, "code-left-90");

buildRectLoop(-1, 22, "the90");
assertScan(-1, 22, "code-right-90");
var codeR = runCustom("BowieKnife99");
assertFight(codeR, "code-right-90");

buildHairpinLoop(1);
var hairL = runCustom("BowieKnife99");
assertFight(hairL, "custom-left-hairpin");

buildHairpinLoop(-1);
var hairR = runCustom("BowieKnife99");
assertFight(hairR, "custom-right-hairpin");

buildSweeperLoop(1);
var sweepL = runCustom("BowieKnife99");
assertFight(sweepL, "custom-left-sweeper");

buildSweeperLoop(-1);
var sweepR = runCustom("BowieKnife99");
assertFight(sweepR, "custom-right-sweeper");

sim.restoreCampus();
assert(!sim.isDriveableLoop(), "Campus uses the locked S/F, not MAP_CLOSED");
assert(Math.abs(sim.trackLen() - sim.TRACK_LEN) < 1, "Campus path restored");

console.log("OK bot AI all tracks", {
  campus: Math.round(bowie.finishTime),
  campusGrass: +bowie.grass.toFixed(1),
  left90: Math.round(left90.finishTime),
  right90: Math.round(right90.finishTime),
  hairL: Math.round(hairL.finishTime),
  hairR: Math.round(hairR.finishTime),
  sweepL: Math.round(sweepL.finishTime),
  sweepR: Math.round(sweepR.finishTime),
});
