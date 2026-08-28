/* Headless Campus Loop bot-AI smoke: same path + motion + updateCpu as js/game.js. */
"use strict";

var harness = require("./ai-sim.js");
var src = harness.src;
var sim = harness.buildSim();

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
assert(sim.AI_AGGRO.pace >= 1, "Bowie winds the longs at the cap");
assert(sim.AI_AGGRO.overshoot === 1 && sim.AI_SMART.overshoot === 1, "the field can overshoot the 180");
assert(sim.AI_SMART.craft === 1 && !sim.AI_SMART.hunter, "smart craft, no hunt");

// The field used to be nine names sharing one set of numbers, which read
// as a train of clones. Every table now has to be its own driver, and
// Bowie has to be the one at the sharp end of it.
var TABLES = {
  AI_AGGRO: sim.AI_AGGRO,
  AI_SMART: sim.AI_SMART,
  AI_TIDY: sim.AI_TIDY,
  AI_MESSY: sim.AI_MESSY,
  AI_SHY: sim.AI_SHY,
  AI_BEAT: sim.AI_BEAT,
  AI_LAB: sim.AI_LAB,
  AI_WILD: sim.AI_WILD,
  AI_WIDE: sim.AI_WIDE,
};
var seen = {};
Object.keys(TABLES).forEach(function (key) {
  var t = TABLES[key];
  var print = [t.pace, t.grip, t.brake, t.look, t.lineOff, t.aggro, t.defend, t.draft].join("/");
  assert(!seen[print], key + " is a clone of " + seen[print]);
  seen[print] = key;
  assert(t.pace > 0.9 && t.pace <= 1, key + " pace is a real fraction of Bowie's (" + t.pace + ")");
  assert(t.grip > 0.9 && t.grip <= 1, key + " grip is a real fraction of Bowie's (" + t.grip + ")");
  assert(t.brake <= sim.AI_AGGRO.brake, key + " does not brake later than Bowie (" + t.brake + ")");
  assert(t.pace <= sim.AI_AGGRO.pace, key + " does not out-pace Bowie (" + t.pace + ")");
  assert(t.pitFuel > 20 && t.pitFuel < 45, key + " boxes on a sane fuel window (" + t.pitFuel + ")");
  assert(t.pitTires > 15 && t.pitTires < 40, key + " boxes on a sane tire window (" + t.pitTires + ")");
  assert(t.lineOff > 0.3 && t.lineOff < 0.7, key + " runs a believable line offset (" + t.lineOff + ")");
  assert(t.wobble >= 0 && t.wobble <= 0.1, key + " wobble is a twitch, not a swerve (" + t.wobble + ")");
});
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
assert(sim.AI_WILD.aggro > sim.AI_SHY.aggro, "Detention leans on people, Sub Teacher does not");
assert(sim.AI_WILD.wobble > sim.AI_LAB.wobble, "Detention is the scruffy one, Lab Partner the surgical one");
assert(sim.AI_TIDY.defend > sim.AI_SHY.defend, "Hall Monitor shuts the door, Sub Teacher leaves it open");

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

var longCatch = sim.runLongCatch("BowieKnife99", 8.0);
console.log(
  "longCatch Bowie d0=" +
    longCatch.d0.toFixed(1) +
    " end=" +
    longCatch.endD.toFixed(1) +
    " min=" +
    longCatch.minD.toFixed(1) +
    " v=" +
    longCatch.speed.toFixed(1)
);
assert(longCatch.d0 > 180, "long catch starts from a 200m ribbon lead");
assert(longCatch.endD < longCatch.d0 - 28, "Bowie reels a 200m lead, not only cars he can see (" + longCatch.endD.toFixed(1) + ")");
assert(longCatch.speed > 40, "Bowie winds while closing a long gap");
assert(sim.catchBonus(sim.AI_AGGRO, 180) > sim.catchBonus(sim.AI_SMART, 180), "Bowie's reel is nastier than the field");
assert(sim.AI_AGGRO.reel === 1, "Bowie is the reeler");

var recB = sim.runRecover("BowieKnife99", 7.0);
var recH = sim.runRecover("Hall Monitor", 7.0);
console.log(
  "recover Bowie d0=" +
    recB.d0.toFixed(1) +
    " end=" +
    recB.dist.toFixed(1) +
    " min=" +
    recB.minDist.toFixed(1) +
    " rev=" +
    recB.reverseT.toFixed(2) +
    " on=" +
    recB.onAsphalt +
    " hall end=" +
    recH.dist.toFixed(1)
);
assert(recB.d0 > 10, "recover starts off the ribbon");
assert(recB.reverseT > 0.2, "Bowie reverses off the weeds, not a wall-pin (" + recB.reverseT.toFixed(2) + ")");
assert(recB.minDist < 6 || recB.onAsphalt, "Bowie finds the ribbon again (min " + recB.minDist.toFixed(1) + ")");
assert(recH.minDist < 6 || recH.onAsphalt, "Hall Monitor finds the ribbon again");

var wallB = sim.runWallStuck("BowieKnife99", 6.0);
console.log(
  "wallStuck Bowie d0=" +
    wallB.d0.toFixed(1) +
    " end=" +
    wallB.dist.toFixed(1) +
    " min=" +
    wallB.minDist.toFixed(1) +
    " rev=" +
    wallB.reverseT.toFixed(2)
);
assert(wallB.reverseT > 0.15, "Bowie backs off a barrier instead of pinning it (" + wallB.reverseT.toFixed(2) + ")");
assert(wallB.minDist < wallB.d0 - 1.2, "Bowie leaves the wall and heads inward (" + wallB.minDist.toFixed(1) + ")");

sim.bakeRaceBrain();
assert(sim.RACE.n > 40, "race brain samples the ribbon");
var hairS = null;
var hairI;
for (hairI = 0; hairI < sim.TRACK_LEN; hairI += 6) {
  if (sim.centerlinePoint(hairI).name === "hairpin") {
    hairS = hairI;
    break;
  }
}
assert(hairS != null, "campus hairpin exists for the brain");
var lineHair = sim.raceAt(hairS);
var lineStart = sim.raceAt(40);
assert(lineStart.v > lineHair.v + 8, "speed profile lifts on the straight and drops for the 180");
var wantHair = sim.raceWantAhead(hairS, 30, sim.AI_AGGRO);
var wantStart = sim.raceWantAhead(40, 40, sim.AI_AGGRO);
assert(wantStart > wantHair + 6, "want-ahead is slower at the hairpin than on the start straight");
var left90s = null;
var left90r = 99;
for (hairI = 0; hairI < sim.TRACK_LEN; hairI += 4) {
  var cp = sim.centerlinePoint(hairI);
  if (cp.name === "the90" && cp.left > 0 && cp.r < left90r) {
    left90s = hairI;
    left90r = cp.r;
  }
}
assert(left90s != null && left90r < 20, "campus decreasing 90 has a tight apex");
var apexOff = sim.raceAt(left90s).off;
var entryOff = sim.raceAt(left90s - 40).off;
assert(apexOff > 0.2, "tight left 90 apex sits on the inside (" + apexOff.toFixed(2) + ")");
assert(entryOff < apexOff - 0.2, "left 90 is out-in-out (entry " + entryOff.toFixed(2) + " apex " + apexOff.toFixed(2) + ")");

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
// Apex speeds come out of the arc, not a table of tuned corner names, so
// the same maths has to tell a fat editor hairpin apart from Campus's 180.
var wideApex = sim.apexLimit(wideHair.r, wideHair.r, "hairpin", 1);
var tightApex = sim.apexLimit(11, 11, "hairpin", 1);
assert(wideApex > 26, "wide hairpin uses grip, not a campus crawl (" + wideApex.toFixed(1) + ")");
assert(tightApex < 20, "campus 180 is still a slow corner (" + tightApex.toFixed(1) + ")");
assert(wideApex > tightApex + 8, "the two hairpins are not the same corner");
assert(sim.apexFromRadius(44, 1) > 30, "44m tile corners carry race speed");
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

// A lone bot on an empty circuit proves nothing about a race. Put the
// whole field on each shipped board and check they all get home: every
// jam this brain has had came from cars in each other's way, and every
// one of them showed up as reverse time and resets, never as a slow lap.
var FIELD = ["BowieKnife99", "Hall Monitor", "Sub Teacher", "Library Kid", "Band Kid", "Lab Partner", "Detention"];

function raceBuiltin(id, label) {
  sim.buildBuiltin(id);
  sim.setSeed(1);
  var len = sim.trackLen();
  var field = sim.runField(FIELD, 620, { s: len - 6 });
  var rev = 0;
  var resets = 0;
  var stops = 0;
  var slowest = 0;
  var i;
  for (i = 0; i < field.length; i++) {
    var f = field[i];
    assert(f.finished, label + ": " + f.name + " never finished (lap " + f.lap + ")");
    rev += f.reverseT;
    resets += f.resets;
    if (f.pitStops > stops) stops = f.pitStops;
    if (f.finishTime > slowest) slowest = f.finishTime;
  }
  assert(resets === 0, label + ": " + resets + " cars had to be put back on the road");
  assert(rev < 4, label + ": " + rev.toFixed(1) + "s spent reversing out of trouble");
  assert(stops <= 2, label + ": someone boxed " + stops + " times");
  assert(slowest < 400, label + ": last car took " + slowest.toFixed(0) + "s");
  return { len: Math.round(len), last: Math.round(slowest), win: field[0].name };
}

var circuits = {};
["harbor", "park", "desert", "forest"].forEach(function (id) {
  circuits[id] = raceBuiltin(id, id);
});
// Forest bridges over its own start straight. Plan view cannot tell the
// two apart, so the bridge's barriers used to read as a wall across the
// straight and the whole field piled into a phantom nine metres up.
sim.buildBuiltin("forest");
var underBridge = sim.centerlinePoint(22);
assert(Math.abs(underBridge.y || 0) < 0.5, "forest start straight is at valley height");
var overhead = 0;
for (wi = 0; wi < sim.WALLS.length; wi++) {
  var wb = sim.WALLS[wi];
  if ((wb.y || 0) < 4) continue;
  if (Math.hypot((wb.ax + wb.bx) * 0.5 - underBridge.x, (wb.az + wb.bz) * 0.5 - underBridge.z) < 14) overhead += 1;
}
assert(overhead > 0, "the bridge keeps its barriers over the start straight");
assert(
  !sim.noseBlocked({ x: underBridge.x, z: underBridge.z, heading: underBridge.h, roadY: 0 }),
  "a car under the bridge is not blocked by the bridge"
);
assert(
  sim.carDeckY({ x: underBridge.x, z: underBridge.z, roadY: 9.1 }) > 4,
  "a car on the bridge reads the bridge's height, not the road beneath it"
);

sim.restoreCampus();
assert(!sim.isDriveableLoop(), "Campus uses the locked S/F, not MAP_CLOSED");
assert(Math.abs(sim.trackLen() - sim.TRACK_LEN) < 1, "Campus path restored");

console.log("OK bot AI all tracks", {
  circuits: circuits,
  campus: Math.round(bowie.finishTime),
  campusGrass: +bowie.grass.toFixed(1),
  left90: Math.round(left90.finishTime),
  right90: Math.round(right90.finishTime),
  hairL: Math.round(hairL.finishTime),
  hairR: Math.round(hairR.finishTime),
  sweepL: Math.round(sweepL.finishTime),
  sweepR: Math.round(sweepR.finishTime),
});
