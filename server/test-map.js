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
  sliceFn("customGridPose"),
  sliceFn("pointOnSeg"),
  sliceFn("centerlinePoint"),
  sliceFn("wallSeg"),
  sliceFn("skipLeftBarrier"),
  sliceFn("wallKindFor"),
  sliceFn("placeWalls"),
  "function puffHit() {}",
  "function poseCar(r) { if (r.mesh && r.mesh.position) r.mesh.position.set(r.x, 0, r.z); }",
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
  "  projectTrack: projectTrack,",
  "  applyMotion: applyMotion,",
  "  updateLaps: updateLaps,",
  "  inPitGrab: inPitGrab,",
  "  cleanTrack: cleanTrack,",
  "  cellsInBoard: cellsInBoard,",
  "  customGridPose: customGridPose,",
  "  placeWalls: placeWalls,",
  "  bashAllWalls: bashAllWalls,",
  "  bashCars: bashCars,",
  "  speedKph: speedKph,",
  "  menuTrackName: menuTrackName,",
  "  isCustomCircuit: isCustomCircuit,",
  "  isDriveableLoop: isDriveableLoop,",
  "  lockRacePath: lockRacePath,",
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

var loopCarSpd = blankCar(0, -80, 0, 30);
assert(sim.speedKph(loopCarSpd) === Math.round(30 * 3.15), "speedo matches velocity, not a stuck 0");

assert(src.indexOf("lockRacePath") !== -1 && src.indexOf("isDriveableLoop") !== -1, "open/junk boards refuse and bounce to Loop");
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
