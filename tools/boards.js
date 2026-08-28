/* Tile-editor boards, as the editor's own piece lists. encodeMap() turns
   each into the M-string a player would actually paste, so the probe and
   the tests race the editor's output rather than a stand-in for it.

   Pieces: s/S straight (S spans two cells), r 90 corner, w sweeper (2x2),
   H hairpin (two cells), C chicane, F start line, P pit, t tree. Rotation
   r is 0-3 in 90 degree steps. The board is 16 x 12 cells of 88 units. */
"use strict";

// A ring of 90 corners with the top and bottom rows filled by whatever
// the caller wants, so one helper covers most player-drawn boards.
function ring(x0, y0, x1, y1, top, bottom) {
  var pieces = [{ t: "r", x: x0, y: y0, r: 0 }];
  var x;
  var y;
  pieces = pieces.concat(top || []);
  pieces.push({ t: "r", x: x1, y: y0, r: 1 });
  for (y = y0 + 1; y < y1; y++) pieces.push({ t: "s", x: x1, y: y, r: 1 });
  pieces.push({ t: "r", x: x1, y: y1, r: 2 });
  pieces = pieces.concat(bottom || []);
  pieces.push({ t: "r", x: x0, y: y1, r: 3 });
  for (y = y0 + 1; y < y1; y++) pieces.push({ t: "s", x: x0, y: y, r: 1 });
  for (x = 0; x < pieces.length; x++) if (!pieces[x].r) pieces[x].r = pieces[x].r || 0;
  return pieces;
}

function row(y, x0, x1, kinds) {
  var out = [];
  var x;
  var i = 0;
  for (x = x0; x <= x1; x++) {
    var t = kinds ? kinds[i % kinds.length] : "s";
    out.push({ t: t, x: x, y: y, r: 0 });
    i += 1;
  }
  return out;
}

module.exports = {
  // The smallest thing the editor will accept: four corners, no straight
  // at all, and a 276m lap. Seven cars on that is nose to tail for the
  // whole race, and there is nowhere for a bot in trouble to go.
  "board-min": function () {
    return [
      { t: "r", x: 2, y: 2, r: 0 },
      { t: "r", x: 3, y: 2, r: 1 },
      { t: "r", x: 3, y: 3, r: 2 },
      { t: "r", x: 2, y: 3, r: 3 },
    ];
  },
  // The smallest board with straights in it: a 4x3 rectangle of 90s.
  // Short lap, so the field is never spread out and traffic is constant.
  "board-rect": function () {
    return ring(1, 1, 4, 3, [{ t: "F", x: 2, y: 1, r: 0 }, { t: "s", x: 3, y: 1, r: 0 }], [
      { t: "s", x: 3, y: 3, r: 0 },
      { t: "s", x: 2, y: 3, r: 0 },
    ]);
  },
  // Most of the 16x12 board, with long straights: the top-speed case.
  "board-big": function () {
    return ring(
      1,
      1,
      12,
      8,
      [
        { t: "F", x: 2, y: 1, r: 0 },
        { t: "S", x: 3, y: 1, r: 0 },
        { t: "S", x: 5, y: 1, r: 0 },
        { t: "S", x: 7, y: 1, r: 0 },
        { t: "S", x: 9, y: 1, r: 0 },
        { t: "s", x: 11, y: 1, r: 0 },
      ],
      [
        { t: "S", x: 10, y: 8, r: 0 },
        { t: "S", x: 8, y: 8, r: 0 },
        { t: "C", x: 7, y: 8, r: 0 },
        { t: "S", x: 5, y: 8, r: 0 },
        { t: "s", x: 4, y: 8, r: 0 },
        { t: "C", x: 3, y: 8, r: 0 },
        { t: "s", x: 2, y: 8, r: 0 },
      ]
    );
  },
  // A board whose only corners are the editor's 2x2 sweepers.
  "board-sweep": function () {
    return [
      { t: "w", x: 1, y: 1, r: 0 },
      { t: "F", x: 3, y: 1, r: 0 },
      { t: "w", x: 4, y: 1, r: 1 },
      { t: "s", x: 5, y: 3, r: 1 },
      { t: "w", x: 4, y: 4, r: 2 },
      { t: "s", x: 3, y: 5, r: 0 },
      { t: "w", x: 1, y: 4, r: 3 },
      { t: "s", x: 1, y: 3, r: 1 },
    ];
  },
  // A paperclip: two hairpins, one at each end of a pair of straights a
  // single cell apart. The slowest corner the editor has, taken twice a
  // lap, and the board most likely to leave a bot stalled across the
  // road with the field arriving behind it.
  "board-hair": function () {
    var pieces = [
      { t: "H", x: 2, y: 1, r: 0 },
      { t: "H", x: 3, y: 8, r: 2 },
    ];
    var y;
    for (y = 2; y <= 7; y++) {
      pieces.push({ t: y === 4 ? "F" : "s", x: 2, y: y, r: 1 });
      pieces.push({ t: "s", x: 3, y: y, r: 1 });
    }
    return pieces;
  },
  // Chicanes back to back, plus a tree so the prop path is exercised.
  "board-chicane": function () {
    return ring(
      1,
      1,
      6,
      4,
      [
        { t: "F", x: 2, y: 1, r: 0 },
        { t: "C", x: 3, y: 1, r: 0 },
        { t: "C", x: 4, y: 1, r: 0 },
        { t: "s", x: 5, y: 1, r: 0 },
      ],
      [
        { t: "s", x: 5, y: 4, r: 0 },
        { t: "C", x: 4, y: 4, r: 0 },
        { t: "s", x: 3, y: 4, r: 0 },
        { t: "C", x: 2, y: 4, r: 0 },
      ]
    ).concat([{ t: "t", x: 4, y: 2, r: 0 }]);
  },
  // board-hair's hairpins open north and south and board-big's long
  // straights run east and west, which leaves half of each piece's
  // rotations never driven. This is the same paperclip turned ninety
  // degrees, so the other half gets raced too.
  "board-turn": function () {
    return [
      { t: "H", x: 8, y: 2, r: 1 },
      { t: "H", x: 2, y: 3, r: 3 },
      { t: "S", x: 3, y: 2, r: 0 },
      { t: "F", x: 5, y: 2, r: 0 },
      { t: "S", x: 6, y: 2, r: 0 },
      { t: "S", x: 6, y: 3, r: 0 },
      { t: "s", x: 5, y: 3, r: 0 },
      { t: "S", x: 3, y: 3, r: 0 },
    ];
  },
  // A board with the editor's pit piece, so the custom pit road and the
  // peel-off are exercised on geometry nobody hand-tuned.
  "board-pit": function () {
    return ring(
      1,
      1,
      7,
      5,
      [
        { t: "F", x: 2, y: 1, r: 0 },
        { t: "P", x: 3, y: 1, r: 0 },
        { t: "s", x: 4, y: 1, r: 0 },
        { t: "s", x: 5, y: 1, r: 0 },
        { t: "s", x: 6, y: 1, r: 0 },
      ],
      row(5, 2, 6).reverse()
    );
  },
};
