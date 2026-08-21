/* One-shot original SchoolKart marks: dark + teal car + cream wing. No F1 / Nintendo. */
"use strict";

var fs = require("fs");
var path = require("path");
var zlib = require("zlib");

function crc32(buf) {
  var t = crc32.table;
  if (!t) {
    t = crc32.table = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
  }
  var crc = 0xffffffff;
  for (var j = 0; j < buf.length; j++) crc = t[(crc ^ buf[j]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  var len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  var body = Buffer.concat([Buffer.from(type), data]);
  var crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function writePng(file, size, paint) {
  var raw = Buffer.alloc((size * 4 + 1) * size);
  for (var y = 0; y < size; y++) {
    var row = y * (size * 4 + 1);
    raw[row] = 0;
    for (var x = 0; x < size; x++) {
      var p = paint(x, y, size);
      var o = row + 1 + x * 4;
      raw[o] = p[0];
      raw[o + 1] = p[1];
      raw[o + 2] = p[2];
      raw[o + 3] = p[3];
    }
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  var png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
}

function fill(px, x0, y0, x1, y1, rgb) {
  var x;
  var y;
  for (y = y0; y < y1; y++) {
    for (x = x0; x < x1; x++) {
      if (x >= 0 && y >= 0 && x < px.size && y < px.size) px.set(x, y, rgb);
    }
  }
}

function paintMark(x, y, size) {
  var u = size / 64;
  var px = {
    size: size,
    buf: null,
    set: function () {},
  };
  var ink = [26, 18, 14, 255];
  var teal = [46, 200, 195, 255];
  var cream = [244, 239, 230, 255];
  var gold = [232, 184, 109, 255];
  var deep = [20, 143, 140, 255];
  var rubber = [28, 28, 28, 255];
  var grid = new Array(size * size);
  var i;
  for (i = 0; i < grid.length; i++) grid[i] = ink;
  px.set = function (xx, yy, rgb) {
    grid[yy * size + xx] = rgb;
  };
  function R(x0, y0, x1, y1, rgb) {
    fill(px, Math.round(x0 * u), Math.round(y0 * u), Math.round(x1 * u), Math.round(y1 * u), rgb);
  }
  R(0, 0, 64, 64, ink);
  R(4, 42, 60, 50, deep);
  R(6, 44, 58, 48, teal);
  R(18, 28, 46, 38, cream);
  R(28, 22, 42, 28, cream);
  R(40, 30, 54, 36, teal);
  R(10, 30, 20, 36, teal);
  R(22, 20, 26, 24, gold);
  R(14, 36, 20, 42, rubber);
  R(44, 36, 50, 42, rubber);
  var cell = grid[y * size + x];
  return cell || ink;
}

var root = path.join(__dirname, "..");
var icons = path.join(root, "icons");
fs.mkdirSync(icons, { recursive: true });
writePng(path.join(icons, "icon-192.png"), 192, paintMark);
writePng(path.join(icons, "icon-512.png"), 512, paintMark);
writePng(path.join(icons, "apple-touch-icon.png"), 180, paintMark);
writePng(path.join(root, "apple-touch-icon.png"), 180, paintMark);
console.log("wrote icons 192/512/180");
