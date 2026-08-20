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
  "var PIT_HOLD = 2.5;",
  "var GETAWAY_T = 1.5;",
  "var REV_SWEET_LO = 0.58;",
  "var REV_SWEET_HI = 0.8;",
  "var REV_GREAT_LO = 0.64;",
  "var REV_GREAT_HI = 0.74;",
  "var ASPHALT = 8.6;",
  "var RUNOFF = 3.8;",
  "var KERB_NAMES = ['the90', 'hairpin', 'chicane', 'sweeper', 'kink'];",
  "var GRASS_MAX = 8.5;",
  "var GRASS_ROLL = 4;",
  "var GRASS_DUMP = 40;",
  "var TIRE_FLOOR = 22;",
  "var SF_Z = -80;",
  "var PIT_LANE = { x0: 8, x1: 118, z0: -67.4, z1: -56.6 };",
  "var PIT_GRAB = { x0: 58, x1: 90, z0: -67.4, z1: -56.6 };",
  "var PIT_PAVE = [",
  "  { x0: -90, x1: 36, z0: -74.0, z1: -58.0 },",
  "  { x0: -20, x1: 50, z0: -71.6, z1: -56.0 },",
  "  { x0: 8, x1: 118, z0: -71.6, z1: -56.0 },",
  "  PIT_LANE, PIT_GRAB,",
  "  { x0: 96, x1: 160, z0: -71.6, z1: -56.0 },",
  "  { x0: 124, x1: 185, z0: -74.0, z1: -62.0 }",
  "];",
  "var PIT_META = { ax: 8, az: -62, bx: 118, bz: -62, on: true };",
  "var PATH = [];",
  "var MAP_SURF = [];",
  "var MAP_CLOSED = false;",
  "var TRACK_LEN = 0;",
  "var _x = -200;",
  "var _z = SF_Z;",
  "var _h = 0;",
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
  sliceFn("buildCampusPath"),
  sliceFn("pointOnSeg"),
  sliceFn("centerlinePoint"),
  sliceFn("projectOn"),
  sliceFn("projectTrack"),
  "var WALLS = [];",
  sliceFn("wallSeg"),
  sliceFn("skipLeftBarrier"),
  sliceFn("wallKindFor"),
  sliceFn("placeWalls"),
  sliceFn("inPitLane"),
  sliceFn("inPitGrab"),
  sliceFn("isDriveableLoop"),
  sliceFn("updateLaps"),
  sliceFn("rideHeight"),
  sliceFn("applyMotion"),
  sliceAssign("AI_AGGRO"),
  sliceAssign("AI_TIDY"),
  sliceAssign("AI_MESSY"),
  "var _scan = { dHair: 999, dChi: 999, dSweep: 999, d90: 999, dKink: 999, dTight: 999, tightR: 99 };",
  sliceFn("aiOf"),
  sliceFn("scanAhead"),
  sliceFn("approachWant"),
  sliceFn("eachRival"),
  sliceFn("avoidRams"),
  "var _prey = { r: null, d: 999, fwd: 0, lat: 0 };",
  "var _hunt = { on: false, tx: 0, tz: 0, want: 0, noLift: false, dive: false };",
  sliceFn("pickPrey"),
  sliceFn("planHunt"),
  sliceFn("gradeLaunch"),
  "function spawnFx() {}",
  "function dumpLaunch() {}",
  "function applyCpuLaunch(r) { r.launchArmed = true; r.launchMul = 1; r.launchT = 0; }",
  sliceFn("updateCpu"),
  "function poseCar(r) { if (r.mesh) { r.mesh.position.x = r.x; r.mesh.position.z = r.z; } }",
  "setDefaultPit();",
  "buildCampusPath();",
  "return {",
  "  TRACK_LEN: TRACK_LEN,",
  "  PATH: PATH,",
  "  runBot: runBot,",
  "  runHunt: runHunt,",
  "  gradeLaunch: gradeLaunch,",
  "  centerlinePoint: centerlinePoint,",
  "  projectTrack: projectTrack,",
  "  WALLS: WALLS,",
  "  placeWalls: placeWalls,",
  "  AI_AGGRO: AI_AGGRO,",
  "  AI_TIDY: AI_TIDY,",
  "  AI_MESSY: AI_MESSY",
  "};",
  "function runBot(name, gridX, gridZ, s0, seconds) {",
  "  var r = {",
  "    kind: 'cpu', name: name,",
  "    x: gridX, z: gridZ, heading: 0, speed: 0, slide: 0,",
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

assert(Math.abs(sim.TRACK_LEN - 1978.98) < 2, "Campus Loop length " + sim.TRACK_LEN);
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
  if (mx > 8 && mx < 118 && mz > -68 && mz < -56) pitHit += 1;
  if (mx > -20 && mx < 40 && mz < -88) rightSF += 1;
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

var bowie = sim.runBot("BowieKnife99", -6, -80 + 2.7, sim.TRACK_LEN - 6, 420);
var tidy = sim.runBot("Hall Monitor", -22, -80 + 2.7, sim.TRACK_LEN - 22, 420);
var messy = sim.runBot("Sub Teacher", -30, -80 - 2.7, sim.TRACK_LEN - 30, 420);

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
assert(tidy.grass <= bowie.grass + 4, "tidy should not be sloppier than Bowie");
assert(bowie.grass < 12, "Bowie should recover, not beach (" + bowie.grass.toFixed(1) + "s grass)");
assert(tidy.grass < 8, "Hall Monitor stays on asphalt");
assert(messy.grass < 16, "messy recovers from wide entries");
assert(bowie.emptyT < 1, "Bowie should not run dry on the straight");
assert(tidy.emptyT < 1, "tidy should not run dry");
assert(messy.emptyT < 4, "messy may limp briefly but not sit empty forever");
assert(bowie.finishTime < tidy.finishTime, "Bowie beats the tidy bot");
assert(tidy.finishTime < messy.finishTime, "messy is slower, pack stays alive");
assert(bowie.hairFast > 0.2, "Bowie commits late into the 180");
assert(tidy.hairFast < bowie.hairFast, "Hall Monitor brakes earlier than Bowie");
assert(bowie.finishTime > 270, "beatable — not 1st-every-lap robots (" + bowie.finishTime.toFixed(1) + ")");
assert(bowie.pitAt && tidy.pitAt && bowie.pitAt.t < messy.pitAt.t, "tidy/Bowie box before the messy late stop");
assert(sim.AI_AGGRO.brake < sim.AI_TIDY.brake, "Bowie brakes later");
assert(sim.AI_AGGRO.pitFuel < sim.AI_TIDY.pitFuel, "Bowie pits later");
assert(sim.AI_MESSY.lineOff > 0.8, "messy runs wide");
assert(sim.AI_AGGRO.overshoot === 1, "Bowie can overshoot the 180");
assert(sim.gradeLaunch(0.2) === "SLUGGISH", "below green is sluggish");
assert(sim.gradeLaunch(0.6) === "GOOD", "green is GOOD");
assert(sim.gradeLaunch(0.69) === "GREAT", "sweet spot is GREAT");
assert(sim.gradeLaunch(0.81) === "DUMP", "past the mark dumps");
assert(sim.gradeLaunch(1) === "DUMP", "at max is a fail");
assert(sim.AI_AGGRO.hunter === 1, "BowieKnife99 is the hunter");
assert(!sim.AI_TIDY.hunter && !sim.AI_MESSY.hunter, "only Bowie hunts");

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

console.log("OK bot AI Campus Loop", sim.TRACK_LEN.toFixed(1));
